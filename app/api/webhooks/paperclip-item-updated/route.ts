import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/utils/supabase/client';

// Helper function to compute HMAC signature
function computeHMAC(rawBody: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

export async function POST(request: NextRequest) {
  // Extract the signature from the header
  const signature = request.headers.get('X-Paperclip-Signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  try {
    // Get the raw body as a Buffer for HMAC verification
    const rawBody = Buffer.from(await request.arrayBuffer());
    
    // Retrieve the shared secret from environment variables
    const secret = process.env.PAPERCLIP_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('Missing PAPERCLIP_WEBHOOK_SECRET environment variable');
    }

    // Compute and verify the HMAC signature
    const computedSignature = computeHMAC(rawBody, secret);
    if (computedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Parse the JSON payload
    const body = JSON.parse(rawBody.toString());
    console.log("Paperclip item updated webhook:", body);
    
    const { event, item } = body;

    // Ensure the event is 'item_updated'
    if (event !== 'item_updated') {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
    }

    // Initialize Supabase client
    const supabase = createClient();

    // Find the item in the database using paperclip_marketplace_id
    const { data: existingItem, error: findError } = await supabase
      .from('items')
      .select('id, category_id')
      .eq('paperclip_marketplace_id', item.id)
      .single();

    if (findError || !existingItem) {
      return NextResponse.json({ error: 'Item not found in retail system' }, { status: 404 });
    }

    // Update item in retail system
    const { error: updateError } = await supabase
      .from('items')
      .update({
        title: item.name,
        description: item.description,
        price: parseFloat(item.price),
        quantity: item.quantity,
        condition: mapConditionFromMarketplace(item.condition_type),
        size: item.size || '',
        brand: item.brand || '',
        tags: item.tags || [],
        // Only update category if needed and you have a mapping system
        // category_id: mapCategoryFromMarketplace(item.category_id, existingItem.category_id),
      })
      .eq('id', existingItem.id);

    if (updateError) {
      throw updateError;
    }

    // Handle image updates if needed
    if (item.media && item.media.length > 0) {
      // First, get existing images
      const { data: existingImages } = await supabase
        .from('item_images')
        .select('id, image_url')
        .eq('item_id', existingItem.id);
      
      // Delete images that are no longer in the item's media array
      if (existingImages && existingImages.length > 0) {
        const keepImageUrls = new Set(item.media);
        const imagesToDelete = existingImages.filter(img => !keepImageUrls.has(img.image_url)).map(img => img.id);
        
        if (imagesToDelete.length > 0) {
          await supabase
            .from('item_images')
            .delete()
            .in('id', imagesToDelete);
        }
      }
      
      // Add new images that don't exist in our database
      const existingUrls = new Set(existingImages?.map(img => img.image_url) || []);
      const newImageUrls = item.media.filter((url: string) => !existingUrls.has(url));
      
      if (newImageUrls.length > 0) {
        const imageUploads = newImageUrls.map((imageUrl: string, index: number) => ({
          item_id: existingItem.id,
          image_url: imageUrl,
          display_order: (existingImages?.length || 0) + index,
        }));

        await supabase
          .from('item_images')
          .insert(imageUploads);
      }
      
      // Update display order for all images to match the order in the media array
      const { data: allImages } = await supabase
        .from('item_images')
        .select('id, image_url')
        .eq('item_id', existingItem.id);
        
      if (allImages) {
        for (const [index, imageUrl] of item.media.entries()) {
          const matchingImage = allImages.find(img => img.image_url === imageUrl);
          if (matchingImage) {
            await supabase
              .from('item_images')
              .update({ display_order: index })
              .eq('id', matchingImage.id);
          }
        }
      }
    }

    return NextResponse.json({ 
      message: 'Item updated successfully',
      itemId: existingItem.id 
    }, { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to map condition type from marketplace to retail format
function mapConditionFromMarketplace(conditionType: number): string {
  switch (conditionType) {
    case 0:
      return 'New';
    case 1:
      return 'Refurbished';
    case 4:
    default:
      return 'Used';
  }
}