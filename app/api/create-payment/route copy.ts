import { NextResponse } from 'next/server';
import { SquareClient, SquareEnvironment } from 'square';

// Securely initialize the Square client using environment variables
const client = new SquareClient({
  environment: process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production' 
    ? SquareEnvironment.Production 
    : SquareEnvironment.Sandbox,
  token: process.env.SQUARE_ACCESS_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { amount, orderId } = await request.json();
    
    // Validate input
    if (!amount || !orderId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Ensure amount is converted to cents
    const amountCents = Math.round(Number(amount) * 100);

    const response = await client.checkout.paymentLinks.create({
      idempotencyKey: crypto.randomUUID(),
      quickPay: {
        name: `Order #${orderId}`,
        priceMoney: {
          amount: BigInt(amountCents),
          currency: 'USD',
        },
        locationId: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID as string,
      },
      checkoutOptions: {
        // redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/pos/result?orderId=${orderId}`,
        redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/pos/result?done=true`,

      },
    });

    return NextResponse.json({ url: response.paymentLink?.url });
  } catch (error: any) {
    console.error('Payment Link Creation Error:', {
      message: error.message,
      errors: error.errors,
      statusCode: error.statusCode
    });

    return NextResponse.json(
      { 
        error: "Payment processing failed",
        details: error.errors || error.message 
      },
      { status: 500 }
    );
  }
}