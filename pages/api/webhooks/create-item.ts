// File: pages/api/paperclip-webhook.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import getRawBody from 'raw-body'
import { IncomingForm, File as FormidableFile, Fields, Files } from 'formidable'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { createClient } from '@/utils/supabase/client'

// Disable Next.js automatic body parsing so we can verify the raw payload
export const config = {
  api: { bodyParser: false },
}

// Helper: compute HMAC sha256 hex digest (optional)
function computeHMAC(rawBody: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
}

// Helper: map marketplace condition codes to your labels
type ConditionType = 0 | 1 | 4 | number
function mapConditionFromMarketplace(conditionType: ConditionType): string {
  switch (conditionType) {
    case 0: return 'New'
    case 1: return 'Refurbished'
    default: return 'Used'
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
  }

  const contentType = (req.headers['content-type'] || '').toLowerCase()
  let rawBody: Buffer
  let payload: any
  const mediaUrls: string[] = []

  // 1️⃣ Handle JSON
  if (contentType.includes('application/json')) {
    try {
      rawBody = await getRawBody(req)
      payload = JSON.parse(rawBody.toString())
    } catch (err) {
      console.error('JSON parse error:', err)
      return res.status(400).json({ error: 'Invalid JSON' })
    }

    // collect any URL-based media
    Array.isArray(payload?.item?.media) &&
      payload.item.media.forEach((u: any) => typeof u === 'string' && mediaUrls.push(u))

  // 2️⃣ Handle multipart/form-data
  } else if (contentType.includes('multipart/form-data')) {
    const form = new IncomingForm({ multiples: true })
    let fields: Fields, files: Files
    console.log("🚀 ~ form:", form)

    try {
      ;({ fields, files } = await new Promise<{ fields: Fields, files: Files }>((resolve, reject) =>
        form.parse(req as any, (err, f, fi) => err ? reject(err) : resolve({ fields: f, files: fi }))
      ))
    } catch (err) {
      console.error('Form parse error:', err)
      return res.status(400).json({ error: 'Invalid form-data' })
    }

    if (!fields.payload) {
      console.error('Missing payload field; got:', fields)
      return res.status(400).json({ error: 'Missing payload field' })
    }

    try {
      const rawField = Array.isArray(fields.payload) ? fields.payload[0] : fields.payload
      payload = JSON.parse(rawField as string)
    } catch (err) {
      console.error('Invalid JSON payload field:', err)
      return res.status(400).json({ error: 'Invalid JSON payload' })
    }

    // collect any URL-based media
    Array.isArray(payload?.item?.media) &&
      payload.item.media.forEach((u: any) => typeof u === 'string' && mediaUrls.push(u))

    // read uploaded files into buffers
    const mediaFiles = Array.isArray(files.media)
      ? (files.media as FormidableFile[])
      : files.media
        ? [files.media as FormidableFile]
        : []

    if (mediaFiles.length) {
      const supabase = createClient()
      for (const file of mediaFiles) {
        const diskPath = (file as any).filepath || (file as any).path
        let buffer: Buffer
        try {
          buffer = await fs.readFile(diskPath as string)
        } catch (readErr) {
          console.error('File read error:', readErr)
          continue
        }

        const filename = (file as any).originalFilename || path.basename(diskPath as string)
        const key = `items/${Date.now()}-${filename}`

        const { error: upErr } = await supabase.storage
          .from('item-images')
          .upload(key, buffer, { upsert: true })
        if (upErr) {
          console.error('Supabase upload error:', upErr)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('item-images')
          .getPublicUrl(key)
        mediaUrls.push(publicUrl)
      }
    }

  // 3️⃣ Unsupported content type
  } else {
    return res.status(415).json({ error: 'Unsupported Content-Type' })
  }

  // 4️⃣ Common processing
  console.log('Parsed event:', payload.event)
  console.log('Item data:', payload.item)
  console.log('Media URLs:', mediaUrls)

  const { event, item } = payload
  if (event !== 'item_created') {
    return res.status(400).json({ error: 'Unsupported event type' })
  }

  const supabase = createClient()
  try {
    // Dedupe
    const { data: existing, error: existErr } = await supabase
      .from('items')
      .select('id')
      .eq('paperclip_marketplace_id', item.id)
      .maybeSingle()
    if (existErr) throw existErr
    if (existing) {
      return res.status(200).json({ message: 'Item already exists', itemId: existing.id })
    }

    // Lookup user
    const { data: userData, error: userErr } = await supabase
      .from('users')
      .select('id, store_id')
      .eq('paperclip_marketplace_id', item.userId)
      .single()
    if (userErr || !userData?.store_id) {
      console.error('User/store lookup failed:', userErr)
      return res.status(404).json({ error: 'User or store not found' })
    }

    // Resolve category
    let categoryId: number | null = null
    const { data: catData, error: catErr } = await supabase
      .from('categories')
      .select('id')
      .eq('paperclip_marketplace_id', item.categoryId)
      .single()
    if (!catErr && catData) categoryId = catData.id
    else {
      const { data: defaults } = await supabase.from('categories').select('id').limit(1)
      categoryId = defaults?.[0]?.id ?? null
    }

    // Insert item
    const insertPayload = {
      title: item.name,
      description: item.description,
      price: parseFloat(item.price),
      quantity: item.quantity ?? 1,
      category_id: categoryId,
      condition: mapConditionFromMarketplace(item.condition_type),
      size: item.size ?? '',
      brand: item.brand ?? '',
      available_in_store: true,
      list_on_paperclip: true,
      store_id: userData.store_id,
      created_by: userData.id,
      paperclip_marketplace_id: item.id,
      paperclip_listed_at: new Date().toISOString(),
      listed_on_paperclip: true,
      tags: item.tags ?? [],
    }
    const { data: newItem, error: itemErr } = await supabase
      .from('items')
      .insert(insertPayload)
      .select()
      .single()
    if (itemErr) throw itemErr

    // Save image records
    if (mediaUrls.length) {
      const uploads = mediaUrls.map((url, idx) => ({
        item_id: newItem.id,
        image_url: url,
        display_order: idx,
      }))
      const { error: imgErr } = await supabase.from('item_images').insert(uploads)
      if (imgErr) console.error('Failed to save images:', imgErr)
    }

    return res.status(201).json({ message: 'Item created successfully', itemId: newItem.id })
  } catch (err) {
    console.error('Processing error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// File: pages/api/paperclip-webhook.ts

// File: pages/api/paperclip-webhook.ts

// File: pages/api/webhooks/create-item.ts

// File: pages/api/webhooks/create-item.ts

// import type { NextApiRequest, NextApiResponse } from 'next'
// import getRawBody from 'raw-body'
// import { IncomingForm, File as FormidableFile, Fields, Files } from 'formidable'
// import fs from 'fs/promises'            // use promise-based fs
// import path from 'path'
// import crypto from 'crypto'
// import { createClient } from '@/utils/supabase/client'

// export const config = { api: { bodyParser: false } }

// // Helper to map condition codes
// type ConditionType = 0 | 1 | 4 | number
// function mapConditionFromMarketplace(c: ConditionType) {
//   return c === 0 ? 'New' : c === 1 ? 'Refurbished' : 'Used'
// }

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', 'POST')
//     return res.status(405).json({ error: `Method ${req.method} Not Allowed` })
//   }

//   const ct = (req.headers['content-type'] || '').toLowerCase()
//   let payload: any
//   const mediaUrls: string[] = []

//   if (ct.includes('application/json')) {
//     // JSON path
//     let raw: Buffer
//     try { raw = await getRawBody(req) }
//     catch (err) { return res.status(400).json({ error: 'Unable to read body' }) }

//     try { payload = JSON.parse(raw.toString()) }
//     catch (err) { return res.status(400).json({ error: 'Invalid JSON' }) }

//     Array.isArray(payload?.item?.media) &&
//       payload.item.media.forEach((u: any) => typeof u === 'string' && mediaUrls.push(u))
//   }
//   else if (ct.includes('multipart/form-data')) {
//     // multipart path
//     const form = new IncomingForm({ multiples: true })
//     let fields: Fields, files: Files
//     try {
//       ;({ fields, files } = await new Promise((resolve, reject) =>
//         form.parse(req as any, (e, f, fi) => e ? reject(e) : resolve({ fields: f, files: fi }))
//       ))
//     } catch (err) {
//       return res.status(400).json({ error: 'Invalid form-data' })
//     }

//     if (!fields.payload) {
//       console.error('Missing payload field; got:', fields)
//       return res.status(400).json({ error: 'Missing payload field' })
//     }
//     try {
//       const rawField = Array.isArray(fields.payload) ? fields.payload[0] : fields.payload
//       payload = JSON.parse(rawField as string)
//     } catch (err) {
//       return res.status(400).json({ error: 'Invalid JSON payload' })
//     }

//     Array.isArray(payload?.item?.media) &&
//       payload.item.media.forEach((u: any) => typeof u === 'string' && mediaUrls.push(u))

//     // --- THE ONLY CHANGE: read into a buffer instead of streaming ---
//     const mediaFiles = Array.isArray(files.media)
//       ? (files.media as FormidableFile[])
//       : files.media
//         ? [files.media as FormidableFile]
//         : []

//     if (mediaFiles.length) {
//       const supabase = createClient()
//       for (const file of mediaFiles) {
//         // read the entire file into a Buffer
//         const diskPath = (file as any).filepath || (file as any).path
//         const buffer = await fs.readFile(diskPath as string)

//         const filename = (file as any).originalFilename || path.basename(diskPath as string)
//         const key = `items/${Date.now()}-${filename}`

//         // pass buffer, not stream
//         const { error: upErr } = await supabase.storage
//           .from('item-images')
//           .upload(key, buffer, { upsert: true })

//         if (upErr) {
//           console.error('Upload error:', upErr)
//           continue
//         }

//         const { data: { publicUrl } } = supabase.storage
//           .from('item-images')
//           .getPublicUrl(key)

//         mediaUrls.push(publicUrl)
//       }
//     }
//   }
//   else {
//     return res.status(415).json({ error: 'Unsupported Content-Type' })
//   }

//   // debug log
//   console.log('Parsed payload:', payload)
//   console.log('Media URLs:', mediaUrls)

//   // your Supabase logic here...
//   const { event, item } = payload
//   if (event !== 'item_created') return res.status(400).json({ error: 'Bad event' })

//   // …dedupe, lookup, insert, image-records…

//   return res.status(201).json({ message: 'Item created successfully', media: mediaUrls })
// }
