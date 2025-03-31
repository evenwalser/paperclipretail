// import Stripe from 'stripe';
// import { NextResponse } from "next/server";
// import { createClient } from "@/utils/supabase/client";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2025-02-24.acacia',
// });

// export async function POST(req: Request) {
//   const supabase = createClient();
  
//   try {
//     const sig = req.headers.get('stripe-signature');
//     const body = await getRawBody(req);

//     if (!sig) {
//       return NextResponse.json(
//         { error: 'Missing stripe-signature header' },
//         { status: 400 }
//       );
//     }

//     const event = stripe.webhooks.constructEvent(
//       body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET!
//     );

//     console.log(`Received webhook event: ${event.type}`);

//     // Handle specific Terminal events
//     switch (event.type) {
//       case 'terminal.reader.action_succeeded':
//         await handleReaderSuccess(event, supabase);
//         break;
        
//       case 'terminal.reader.action_failed':
//         await handleReaderFailure(event, supabase);
//         break;
        
//       case 'payment_intent.succeeded':
//         // This is a backup event in case terminal.reader.action_succeeded doesn't fire
//         await handlePaymentIntentSuccess(event, supabase);
//         break;
        
//       case 'payment_intent.payment_failed':
//         await handlePaymentIntentFailure(event, supabase);
//         break;
        
//       default:
//         console.log(`Unhandled event type: ${event.type}`);
//     }

//     return NextResponse.json({ received: true }, { status: 200 });
    
//   } catch (err: any) {
//     console.error(`Webhook error: ${err.message}`);
//     return NextResponse.json(
//       { error: `Webhook Error: ${err.message}` },
//       { status: 400 }
//     );
//   }
// }

// // Get raw body as Buffer
// async function getRawBody(req: Request): Promise<Buffer> {
//   const chunks: Buffer[] = [];
//   const reader = req.body?.getReader();
  
//   if (reader) {
//     while (true) {
//       const { done, value } = await reader.read();
//       if (done) break;
//       if (value) chunks.push(Buffer.from(value));
//     }
//   }
  
//   return Buffer.concat(chunks);
// }

// // Handle successful Terminal payment
// async function handleReaderSuccess(event: Stripe.Event, supabase: any) {
//   try {
//     const reader = event.data.object as Stripe.Terminal.Reader;
//     const paymentIntentId = reader.action?.process_payment_intent?.payment_intent;
    
//     if (!paymentIntentId) {
//       console.log('No payment intent ID found in the event');
//       return;
//     }
    
//     console.log(`Processing successful terminal payment for ${paymentIntentId}`);
    
//     // Process the terminal payment
//     await processTerminalPayment(
//       typeof paymentIntentId === 'string' ? paymentIntentId : paymentIntentId.id,
//       'succeeded',
//       supabase
//     );
    
//   } catch (error) {
//     console.error('Error handling reader success:', error);
//   }
// }

// // Handle failed Terminal payment
// async function handleReaderFailure(event: Stripe.Event, supabase: any) {
//   try {
//     const reader = event.data.object as Stripe.Terminal.Reader;
//     const paymentIntentId = reader.action?.process_payment_intent?.payment_intent;
    
//     if (!paymentIntentId) {
//       console.log('No payment intent ID found in the event');
//       return;
//     }
    
//     console.log(`Processing failed terminal payment for ${paymentIntentId}`);
    
//     // Process the terminal payment failure
//     await processTerminalPayment(
//       typeof paymentIntentId === 'string' ? paymentIntentId : paymentIntentId.id,
//       'failed',
//       supabase
//     );
    
//   } catch (error) {
//     console.error('Error handling reader failure:', error);
//   }
// }

// // Handle payment intent success (backup for terminal.reader.action_succeeded)
// async function handlePaymentIntentSuccess(event: Stripe.Event, supabase: any) {
//   try {
//     const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
//     // Only process if this was a terminal payment
//     if (paymentIntent.payment_method_types.includes('card_present')) {
//       console.log(`Processing successful payment intent for ${paymentIntent.id}`);
      
//       // Process the terminal payment
//       await processTerminalPayment(paymentIntent.id, 'succeeded', supabase);
//     }
//   } catch (error) {
//     console.error('Error handling payment intent success:', error);
//   }
// }

// // Handle payment intent failure (backup for terminal.reader.action_failed)
// async function handlePaymentIntentFailure(event: Stripe.Event, supabase: any) {
//   try {
//     const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
//     // Only process if this was a terminal payment
//     if (paymentIntent.payment_method_types.includes('card_present')) {
//       console.log(`Processing failed payment intent for ${paymentIntent.id}`);
      
//       // Process the terminal payment failure
//       await processTerminalPayment(paymentIntent.id, 'failed', supabase);
//     }
//   } catch (error) {
//     console.error('Error handling payment intent failure:', error);
//   }
// }

// // Main function to process a terminal payment (success or failure)
// async function processTerminalPayment(paymentIntentId: string, status: 'succeeded' | 'failed', supabase: any) {
//   console.log("🚀 ~ processTerminalPayment ~ status:", status)
//   // 1. Find the stored payment context
//   const { data: context, error: contextError } = await supabase
//     .from('terminal_payment_context')
//     .select('*')
//     .eq('payment_intent_id', paymentIntentId)
//     .single();
    
//   if (contextError) {
//     console.error('Error retrieving payment context:', contextError);
//     return;
//   }
  
//   if (status === 'failed') {
//     // For failed payments, just update the status
//     await supabase
//       .from('terminal_payment_context')
//       .update({ 
//         status: 'failed',
//         processed_at: new Date().toISOString()
//       })
//       .eq('payment_intent_id', paymentIntentId);
      
//     // Also update payment record if it exists
//     await supabase
//       .from('payments')
//       .update({ 
//         status: 'failed',
//         updated_at: new Date().toISOString()
//       })
//       .eq('payment_id', paymentIntentId);
      
//     return;
//   }
  
//   // For successful payments, create all necessary records
  
//   // 2. Check if we already processed this payment
//   if (context.status === 'processed') {
//     console.log(`Payment ${paymentIntentId} was already processed`);
//     return;
//   }

//   const generateNumericReceiptId = (): string => {
//     // Use timestamp and random number to ensure uniqueness
//     const timestamp = Date.now().toString(); // Current time in milliseconds
//     const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // 4-digit random number
//     return `${timestamp}${randomNum}`.slice(-10); // Take last 10 digits for consistency
//   };
  
//   try {
//     // 3. First, check if there's already a sale record for this payment
//     const { data: existingSale } = await supabase
//       .from('sales')
//       .select('id, status')
//       .eq('payment_id', paymentIntentId)
//       .single();
      
//     console.log("🚀 ~ processTerminalPayment ~ existingSale:", existingSale)
//     let saleId: string;
    
//     if (existingSale) {
//       // If the sale exists but is in 'pending' status, update it
//       if (existingSale.status === 'pending') {
//         await supabase
//           .from('sales')
//           .update({
//             status: 'completed',
//             payment_status: 'paid',
//             updated_at: new Date().toISOString()
//           })
//           .eq('id', existingSale.id);
//       }
      
//       saleId = existingSale.id;
      
//       // Check if sale items have already been created for this sale
//       const { data: existingSaleItems, error: saleItemsError } = await supabase
//         .from('sale_items')
//         .select('id')
//         .eq('sale_id', saleId);
        
//       // If there are no sale items yet, create them
//       if (!saleItemsError && (!existingSaleItems || existingSaleItems.length === 0)) {
//         const items = context.items || [];
//         const saleItems = items.map((item: any) => ({
//           sale_id: saleId,
//           item_id: item.id,
//           quantity: item.quantity,
//           price: item.price,
//         }));
        
//         await supabase.from('sale_items').insert(saleItems);
//       }
      
//     } else {
//       // 4. Create a new sale record if it doesn't exist
//       const saleData = {
//         total_amount: context.final_amount,
//         original_amount: context.original_amount,
//         discount_type: context.discount_type,
//         discount_value: context.discount_value,
//         payment_method: 'card', // Terminal uses card
//         status: 'completed',
//         payment_status: 'paid',
//         amount_tendered: context.final_amount,
//         change_amount: 0,
//         customer_id: context.customer_id,
//         store_id: context.store_id,
//         payment_id: paymentIntentId,
//         receipt_id: context.receipt_id || generateNumericReceiptId()
//       };
      
//       const { data: saleRecord, error: saleError } = await supabase
//         .from('sales')
//         .insert(saleData)
//         .select()
//         .single();
        
//       if (saleError) {
//         console.error('Error creating sale record:', saleError);
//         return;
//       }
      
//       saleId = saleRecord.id;
//       console.log("🚀 ~ processTerminalPayment ~ saleId:", saleId)
      
//       // 5. Create sale items records
//       const items = context.items || [];
//       console.log("🚀 ~ processTerminalPayment ~ items:", items)
//       const saleItems = items.map((item: any) => ({
//         sale_id: saleId,
//         item_id: item.id,
//         quantity: item.quantity,
//         price: item.price,
//       }));
//       console.log("🚀 ~ saleItems ~ saleItems:", saleItems)
      
//       const { error: saleItemsError } = await supabase
//         .from('sale_items')
//         .insert(saleItems);
        
//       if (saleItemsError) {
//         console.error('Error creating sale items:', saleItemsError);
//       }
//     }
    
//     // IMPORTANT: Check if inventory has already been updated for this payment
//     const { data: inventoryUpdated } = await supabase
//       .from('terminal_payment_context')
//       .select('inventory_updated')
//       .eq('payment_intent_id', paymentIntentId)
//       .single();
      
//     // Only update inventory if it hasn't been updated yet
//     if (!inventoryUpdated || !inventoryUpdated.inventory_updated) {
//       // 6. Update inventory quantities for each item - This runs for both new and existing sales
//       const items = context.items || [];
//       if (items.length > 0) {
//         console.log("Updating inventory for items:", items);
        
//         for (const item of items) {
//           try {
//             console.log(`Updating inventory for item ${item.id} with quantity change: -${item.quantity}`);
            
//             // First, get the current quantity
//             const { data: currentItem, error: getError } = await supabase
//               .from('items')
//               .select('quantity')
//               .eq('id', item.id)
//               .single();
              
//             if (getError) {
//               console.error(`Error getting current quantity for item ${item.id}:`, getError);
//               continue;
//             }
            
//             if (!currentItem) {
//               console.error(`Item ${item.id} not found`);
//               continue;
//             }
            
//             // Calculate new quantity and update
//             const newQuantity = Math.max(0, (currentItem.quantity || 0) - item.quantity);
            
//             // const { error: updateQuantityError } = await supabase
//             //   .from('items')
//             //   .update({ 
//             //     quantity: newQuantity
//             //   })
//             //   .eq('id', item.id);
              
//             // if (updateQuantityError) {
//             //   console.error(`Error updating quantity for item ${item.id}:`, updateQuantityError);
//             // } else {
//             //   console.log(`Successfully updated inventory for item ${item.id} from ${currentItem.quantity} to ${newQuantity}`);
//             // }
//           } catch (updateError) {
//             console.error(`Error updating quantity for item ${item.id}:`, updateError);
//           }
//         }
        
//         // Mark inventory as updated to prevent double-updates
//         await supabase
//           .from('terminal_payment_context')
//           .update({ 
//             inventory_updated: true 
//           })
//           .eq('payment_intent_id', paymentIntentId);
//       } else {
//         console.error("No items found in context:", context);
//       }
//     } else {
//       console.log("Inventory already updated for this payment");
//     }
    
//     // 7. Update payment record with sale ID and completed status
//     await supabase
//       .from('payments')
//       .update({ 
//         order_id: saleId,
//         status: 'completed',
//         updated_at: new Date().toISOString()
//       })
//       .eq('payment_id', paymentIntentId);
    
//     // 8. Mark payment context as processed
//     await supabase
//       .from('terminal_payment_context')
//       .update({ 
//         status: 'processed',
//         processed_at: new Date().toISOString()
//       })
//       .eq('payment_intent_id', paymentIntentId);
    
//     console.log(`Successfully processed terminal payment ${paymentIntentId}`);
    
//   } catch (error) {
//     console.error('Error processing terminal payment:', error);
//   }
// }

import Stripe from 'stripe';
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";
import { getShopifyCredentials } from '@/lib/shopify';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(req: Request) {
  const supabase = createClient();
  
  try {
    const sig = req.headers.get('stripe-signature');
    const body = await getRawBody(req);

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log(`Received webhook event: ${event.type}`);

    switch (event.type) {
      case 'terminal.reader.action_succeeded':
        await handleReaderSuccess(event, supabase);
        break;
      case 'terminal.reader.action_failed':
        await handleReaderFailure(event, supabase);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSuccess(event, supabase);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailure(event, supabase);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
    
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }
}

// Utility to get raw body as Buffer
async function getRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const reader = req.body?.getReader();
  
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  }
  
  return Buffer.concat(chunks);
}

// Event handlers
async function handleReaderSuccess(event: Stripe.Event, supabase: any) {
  const reader = event.data.object as Stripe.Terminal.Reader;
  const paymentIntentId = reader.action?.process_payment_intent?.payment_intent;
  if (paymentIntentId) {
    await processTerminalPayment(
      typeof paymentIntentId === 'string' ? paymentIntentId : paymentIntentId.id,
      'succeeded',
      supabase
    );
  }
}

async function handleReaderFailure(event: Stripe.Event, supabase: any) {
  const reader = event.data.object as Stripe.Terminal.Reader;
  const paymentIntentId = reader.action?.process_payment_intent?.payment_intent;
  if (paymentIntentId) {
    await processTerminalPayment(
      typeof paymentIntentId === 'string' ? paymentIntentId : paymentIntentId.id,
      'failed',
      supabase
    );
  }
}

async function handlePaymentIntentSuccess(event: Stripe.Event, supabase: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  if (paymentIntent.payment_method_types.includes('card_present')) {
    await processTerminalPayment(paymentIntent.id, 'succeeded', supabase);
  }
}

async function handlePaymentIntentFailure(event: Stripe.Event, supabase: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  if (paymentIntent.payment_method_types.includes('card_present')) {
    await processTerminalPayment(paymentIntent.id, 'failed', supabase);
  }
}

// Core processing function with deduplication
// async function processTerminalPayment(paymentIntentId: string, status: 'succeeded' | 'failed', supabase: any) {
//   console.log(`Processing payment ${paymentIntentId} with status: ${status}`);

//   // 1. Retrieve payment context
//   const { data: context, error: contextError } = await supabase
//     .from('terminal_payment_context')
//     .select('*')
//     .eq('payment_intent_id', paymentIntentId)
//     .single();

//   if (contextError) {
//     console.error('Error retrieving payment context:', contextError);
//     return;
//   }

//   // 2. Handle failed payments
//   if (status === 'failed') {
//     await supabase
//       .from('terminal_payment_context')
//       .update({ 
//         status: 'failed',
//         processed_at: new Date().toISOString()
//       })
//       .eq('payment_intent_id', paymentIntentId);

//     await supabase
//       .from('payments')
//       .update({ 
//         status: 'failed',
//         updated_at: new Date().toISOString()
//       })
//       .eq('payment_id', paymentIntentId);
//     return;
//   }

//   // 3. Atomic status update for successful payments
//   const { data: updatedContext, error: updateError } = await supabase
//     .from('terminal_payment_context')
//     .update({ status: 'processing' })
//     .eq('payment_intent_id', paymentIntentId)
//     .eq('status', 'pending') // Only update if currently 'pending'
//     .select()
//     .single();

//   if (updateError || !updatedContext) {
//     console.log(`Payment ${paymentIntentId} is already being processed or was processed`);
//     return;
//   }

//   try {
//     let saleId: string;

//     // 4. Check for existing sale
//     const { data: existingSale } = await supabase
//       .from('sales')
//       .select('id, status')
//       .eq('payment_id', paymentIntentId)
//       .single();

//     if (existingSale) {
//       saleId = existingSale.id;
//       if (existingSale.status === 'pending') {
//         await supabase
//           .from('sales')
//           .update({
//             status: 'completed',
//             payment_status: 'paid',
//             updated_at: new Date().toISOString()
//           })
//           .eq('id', saleId);
//       }

//       // 5. Check for existing sale_items
//       const { data: existingSaleItems, error: saleItemsError } = await supabase
//         .from('sale_items')
//         .select('id')
//         .eq('sale_id', saleId);

//       if (!saleItemsError && (!existingSaleItems || existingSaleItems.length === 0)) {
//         const items = context.items || [];
//         const saleItems = items.map((item: any) => ({
//           sale_id: saleId,
//           item_id: item.id,
//           quantity: item.quantity,
//           price: item.price,
//         }));
//         await supabase.from('sale_items').insert(saleItems);
//       }
//     } else {
//       // 6. Create new sale if it doesn’t exist
//       const saleData = {
//         total_amount: context.final_amount,
//         original_amount: context.original_amount,
//         discount_type: context.discount_type,
//         discount_value: context.discount_value,
//         payment_method: 'card',
//         status: 'completed',
//         payment_status: 'paid',
//         amount_tendered: context.final_amount,
//         change_amount: 0,
//         customer_id: context.customer_id,
//         store_id: context.store_id,
//         payment_id: paymentIntentId,
//         receipt_id: context.receipt_id || `${Date.now().toString().slice(-10)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
//       };

//       const { data: saleRecord, error: saleError } = await supabase
//         .from('sales')
//         .insert(saleData)
//         .select()
//         .single();

//       if (saleError) throw saleError;
//       saleId = saleRecord.id;

//       // 7. Insert sale_items
//       const items = context.items || [];
//       const saleItems = items.map((item: any) => ({
//         sale_id: saleId,
//         item_id: item.id,
//         quantity: item.quantity,
//         price: item.price,
//       }));
//       const { error: saleItemsError } = await supabase
//         .from('sale_items')
//         .insert(saleItems);
//       if (saleItemsError) throw saleItemsError;
//     }

//     // 8. Update inventory (only if not already updated)
//     const { data: inventoryUpdated } = await supabase
//       .from('terminal_payment_context')
//       .select('inventory_updated')
//       .eq('payment_intent_id', paymentIntentId)
//       .single();

//     if (!inventoryUpdated?.inventory_updated) {
//       const items = context.items || [];
//       for (const item of items) {
//         const { data: currentItem, error: getError } = await supabase
//           .from('items')
//           .select('quantity')
//           .eq('id', item.id)
//           .single();

//         if (getError || !currentItem) continue;

//         const newQuantity = Math.max(0, (currentItem.quantity || 0) - item.quantity);
//         await supabase
//           .from('items')
//           .update({ quantity: newQuantity })
//           .eq('id', item.id);
//       }
//       await supabase
//         .from('terminal_payment_context')
//         .update({ inventory_updated: true })
//         .eq('payment_intent_id', paymentIntentId);
//     }

//     // 9. Update payment record
//     await supabase
//       .from('payments')
//       .update({ 
//         order_id: saleId,
//         status: 'completed',
//         updated_at: new Date().toISOString()
//       })
//       .eq('payment_id', paymentIntentId);

//     // 10. Mark context as processed
//     await supabase
//       .from('terminal_payment_context')
//       .update({ 
//         status: 'processed',
//         processed_at: new Date().toISOString()
//       })
//       .eq('payment_intent_id', paymentIntentId);

//     console.log(`Successfully processed terminal payment ${paymentIntentId}`);
//   } catch (error) {
//     console.error('Error processing terminal payment:', error);
//     await supabase
//       .from('terminal_payment_context')
//       .update({ 
//         status: 'failed',
//         processed_at: new Date().toISOString()
//       })
//       .eq('payment_intent_id', paymentIntentId);
//   }
// }
async function processTerminalPayment(paymentIntentId: string, status: 'succeeded' | 'failed', supabase: any) {
  console.log(`Processing payment ${paymentIntentId} with status: ${status}`);

  // 1. Retrieve payment context
  const { data: context, error: contextError } = await supabase
    .from('terminal_payment_context')
    .select('*')
    .eq('payment_intent_id', paymentIntentId)
    .single();

  if (contextError) {
    console.error('Error retrieving payment context:', contextError);
    return;
  }

  // 2. Handle failed payments
  if (status === 'failed') {
    await supabase
      .from('terminal_payment_context')
      .update({ 
        status: 'failed',
        processed_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntentId);

    await supabase
      .from('payments')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', paymentIntentId);
    return;
  }

  // 3. Atomic status update for successful payments
  const { data: updatedContext, error: updateError } = await supabase
    .from('terminal_payment_context')
    .update({ status: 'processing' })
    .eq('payment_intent_id', paymentIntentId)
    .eq('status', 'pending')
    .select()
    .single();

  if (updateError || !updatedContext) {
    console.log(`Payment ${paymentIntentId} is already being processed or was processed`);
    return;
  }

  try {
    let saleId: string;

    // 4. Check for existing sale
    const { data: existingSale } = await supabase
      .from('sales')
      .select('id, status')
      .eq('payment_id', paymentIntentId)
      .single();

    if (existingSale) {
      saleId = existingSale.id;
      if (existingSale.status === 'pending') {
        await supabase
          .from('sales')
          .update({
            status: 'completed',
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', saleId);
      }

      // 5. Check for existing sale_items
      const { data: existingSaleItems, error: saleItemsError } = await supabase
        .from('sale_items')
        .select('id')
        .eq('sale_id', saleId);
        console.log("🚀 ~ processTerminalPayment ~ existingSaleItems:", existingSaleItems)

      if (!saleItemsError && (!existingSaleItems || existingSaleItems.length === 0)) {
        const items = context.items || [];
        const saleItems = items.map((item: any) => ({
          sale_id: saleId,
          item_id: item.id,
          quantity: item.quantity,
          price: item.price,
        }));
        await supabase.from('sale_items').insert(saleItems);
      }
    } else {
      // 6. Create new sale if it doesn’t exist
      const saleData = {
        total_amount: context.final_amount,
        original_amount: context.original_amount,
        discount_type: context.discount_type,
        discount_value: context.discount_value,
        payment_method: 'card',
        status: 'completed',
        payment_status: 'paid',
        amount_tendered: context.final_amount,
        change_amount: 0,
        customer_id: context.customer_id,
        store_id: context.store_id,
        payment_id: paymentIntentId,
        receipt_id: context.receipt_id || `${Date.now().toString().slice(-10)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
      };

      const { data: saleRecord, error: saleError } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single();

      if (saleError) throw saleError;
      saleId = saleRecord.id;

      // 7. Insert sale_items
      const items = context.items || [];
      const saleItems = items.map((item: any) => ({
        sale_id: saleId,
        item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));
      
      console.log("🚀 ~ saleItems ~ saleItems:", saleItems)
      const { error: saleItemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);
      if (saleItemsError) throw saleItemsError;


      const updates = items.map((item: any) => ({
        itemId: item.id,
        quantityDelta: -item.quantity,
      }));
  
      const { accessToken, shopName } = await getShopifyCredentials(context.store_id);
      if (accessToken && shopName) {
        const itemIds = updates.map(u => u.itemId);
        const { data: itemsData } = await supabase
          .from('items')
          .select('id, shopify_inventory_level_id')
          .in('id', itemIds);
  
        const itemMap = new Map(itemsData.map(item => [item.id, item.shopify_inventory_level_id]));
  
        for (const update of updates) {
          const inventoryLevelId = itemMap.get(update.itemId);
          if (inventoryLevelId) {
            const mutation = `
              mutation {
                inventoryAdjustQuantity(input: {
                  inventoryLevelId: "${inventoryLevelId}",
                  availableDelta: ${update.quantityDelta}
                }) {
                  inventoryLevel {
                    id
                    available
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;
  
            const response = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ query: mutation }),
            });
  
            const result = await response.json();
            if (result.errors || result.data.inventoryAdjustQuantity.userErrors.length > 0) {
              console.error('Error updating Shopify inventory:', result.errors || result.data.inventoryAdjustQuantity.userErrors);
            }
          }
        }
      }
    }


    // 8. Inventory update removed - assume trigger handles it

    // 9. Update payment record
    await supabase
      .from('payments')
      .update({ 
        order_id: saleId,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', paymentIntentId);

    // 10. Mark context as processed
    await supabase
      .from('terminal_payment_context')
      .update({ 
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntentId);

    console.log(`Successfully processed terminal payment ${paymentIntentId}`);
  } catch (error) {
    console.error('Error processing terminal payment:', error);
    await supabase
      .from('terminal_payment_context')
      .update({ 
        status: 'failed',
        processed_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntentId);
  }
}