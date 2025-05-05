// File: pages/api/paperclip-item-updated.ts

import type { NextApiRequest, NextApiResponse } from "next";
import getRawBody from "raw-body";
import { IncomingForm, Fields, Files } from 'formidable';
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { createClient } from "@/utils/supabase/client";

export const config = { api: { bodyParser: false } };


function computeHMAC(raw: Buffer, secret: string): string {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

type ConditionType = 0 | 1 | 4 | number;
function mapConditionFromMarketplace(c: ConditionType): string {
  switch (c) {
    case 0:
      return "New";
    case 1:
      return "Refurbished";
    default:
      return "Used";
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`[Webhook] Received request: ${req.method}`);

  if (req.method !== "POST") {
    console.warn("[Webhook] Method not allowed:", req.method);
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const contentType = (req.headers["content-type"] || "").toLowerCase();
  console.log("[Webhook] Content-Type:", contentType);

  let rawBody: Buffer;
  let payload: any;
  const mediaUrls: string[] = [];


  if (contentType.includes("application/json")) {
      let rawBody: Buffer;
      try {
        rawBody = await getRawBody(req);
        console.log('[Webhook] Raw body read successfully');
        payload = JSON.parse(rawBody.toString());
        console.log('[Webhook] Parsed JSON payload:', payload);
      } catch (err) {
        console.error('[Webhook] Error reading or parsing JSON:', err);
        return res.status(400).json({ error: 'Invalid JSON' });
      }

    Array.isArray(payload?.item?.media) &&
      payload.item.media.forEach(
        (u: any) => typeof u === "string" && mediaUrls.push(u)
      );
  } else if (contentType.includes("multipart/form-data")) {
    const form = new IncomingForm({ multiples: true });
    let fields: Fields, files: Files;

    try {
      console.log('req', req); // Log the request object if needed
      ({ fields, files } = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
        form.parse(req, (err, f, fi) => {
          if (err) reject(err);
          else resolve({ fields: f, files: fi });
        });
      }));
      console.log('[Webhook] Form parsed successfully:', { fields, files });

      if (!fields.payload) {
        console.error('[Webhook] Missing payload field in form data', fields);
        return res.status(400).json({ error: 'Missing payload field' });
      }

      // Parse the payload field if it's JSON
      try {
        const rawField = Array.isArray(fields.payload) ? fields.payload[0] : fields.payload;
        payload = JSON.parse(rawField as string);
        console.log('[Webhook] Parsed payload:', payload);
      } catch (err) {
        console.error('[Webhook] Invalid payload JSON in form:', err);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    } catch (err) {
      console.error('Form parse error:', err);
      return res.status(400).json({ error: 'Invalid form-data' });
    }
  } else {
    console.warn('[Webhook] Unsupported Content-Type:', contentType);
    return res.status(415).json({ error: 'Unsupported Content-Type' });
  }

    const { event, item } = payload
    console.log('[Webhook] Event:', event)

    if (event !== 'item_updated') {
      console.warn('[Webhook] Ignoring unsupported event:', event)
      return res.status(400).json({ error: 'Unsupported event' })
    }
    console.log('[Webhook] Proceeding with item update:', item.id)

  const supabase = createClient();
  console.log("reached here successfully");

    try {
      const { data: existing, error: findErr } = await supabase
        .from('items')
        .select('id, category_id')
        .eq('paperclip_marketplace_id', item.id)
        // .is('paperclip_deleted_at', null)
        .single()

      if (findErr || !existing) {
        console.error('[Webhook] Item not found in Supabase:', findErr)
        return res.status(404).json({ error: 'Item not found or deleted' })
      }

      console.log('[Webhook] Found item in DB:', existing)

      let categoryId = existing.category_id
      if (item.categoryId) {
        const { data: cat, error: catErr } = await supabase
          .from('categories')
          .select('id')
          .eq('paperclip_marketplace_id', item.categoryId)
          .single()

        if (!catErr && cat) {
          categoryId = cat.id
          console.log('[Webhook] Resolved category:', categoryId)
        }
      }

      const { error: updateErr } = await supabase
        .from('items')
        .update({
          title: item.name,
          description: item.description,
          price: parseFloat(item.price),
          quantity: item.quantity,
          condition: mapConditionFromMarketplace(item.condition_type),
          size: item.size ?? '',
          brand: item.brand ?? '',
          tags: item.tags ?? [],
          category_id: categoryId,
        })
        .eq('id', existing.id)

      if (updateErr) throw updateErr
      console.log('[Webhook] Item core fields updated')

      if (mediaUrls.length) {
        const { data: existingImgs } = await supabase
          .from('item_images')
          .select('id, image_url')
          .eq('item_id', existing.id)

        const existingSet = new Set(existingImgs?.map(i => i.image_url) || [])
        const incomingSet = new Set(mediaUrls)

        const toDelete = existingImgs
          ?.filter(i => !incomingSet.has(i.image_url))
          .map(i => i.id)

        if (toDelete?.length) {
          await supabase.from('item_images').delete().in('id', toDelete)
          console.log('[Webhook] Deleted old images:', toDelete)
        }

        const newOnes = mediaUrls.filter(u => !existingSet.has(u))
        if (newOnes.length) {
          const uploads = newOnes.map((url, idx) => ({
            item_id: existing.id,
            image_url: url,
            display_order: (existingImgs?.length ?? 0) + idx,
          }))
          await supabase.from('item_images').insert(uploads)
          console.log('[Webhook] Added new images:', uploads)
        }

        const { data: allImgs } = await supabase
          .from('item_images')
          .select('id, image_url')
          .eq('item_id', existing.id)

        if (allImgs) {
          for (let i = 0; i < mediaUrls.length; i++) {
            const url = mediaUrls[i]
            const match = allImgs.find(img => img.image_url === url)
            if (match) {
              await supabase
                .from('item_images')
                .update({ display_order: i })
                .eq('id', match.id)
            }
          }
          console.log('[Webhook] Reordered images')
        }
      }

      console.log('[Webhook] Successfully updated item:', existing.id)
      return res.status(200).json({ message: 'Item updated successfully', itemId: existing.id })

    } catch (err) {
      console.error('[Webhook] Handler error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
}
