// app/api/webhooks/route.ts

import Stripe from 'stripe'
import { NextResponse } from "next/server"
import { Readable } from 'stream'
import { updateTransactionStatus } from '@/utils/supabase/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion:
'2025-02-24.acacia',

})

export async function POST(req: Request) {
  try {
    const sig = req.headers.get('stripe-signature')
    const body = await getRawBody(req)

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    // Handle specific Terminal events
    switch (event.type) {
      case 'terminal.reader.action_succeeded':
        await handleReaderSuccess(event)
        break
        
      case 'terminal.reader.action_failed':
        await handleReaderFailure(event)
        break
        
      // Add other event handlers as needed
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })
    
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }
}

// Get raw body as Buffer
async function getRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = []
  const reader = req.body?.getReader()
  
  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
  }
  
  return Buffer.concat(chunks)
}

// Event handlers
async function handleReaderSuccess(event: Stripe.Event) {
  const reader = event.data.object as Stripe.Terminal.Reader
  const paymentIntentId = reader.action?.process_payment_intent?.payment_intent
  console.log('terminal.reader.action_succeeded', paymentIntentId)
  if (paymentIntentId) {
    await updateTransactionStatus(
      paymentIntentId,
      'succeeded',
      null
    )
  }
}

async function handleReaderFailure(event: Stripe.Event) {
  const reader = event.data.object as Stripe.Terminal.Reader
  const paymentIntentId = reader.action?.process_payment_intent?.payment_intent
  
  if (paymentIntentId) {
    await updateTransactionStatus(
      paymentIntentId,
      'failed',
    )
  }
}