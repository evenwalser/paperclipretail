import { NextApiRequest, NextApiResponse } from 'next';
import { WebhooksHelper as Webhooks } from 'square';
import getRawBody from 'raw-body';

export default async function handler(req : NextApiRequest, res : NextApiResponse) {
  const webhookSignature = req.headers['x-square-hmac-sha256'];
  const rawBody = await getRawBody(req); // Use a library to get raw body

//   requestBody: string;
//   signatureHeader: string;
//   signatureKey: string;
//   notificationUrl: string;
  // Validate webhook signature
  const isValid = Webhooks.verifySignature({
    requestBody:rawBody.toString(),
    signatureHeader: webhookSignature as string,
    signatureKey:process.env.SQUARE_WEBHOOK_SIGNATURE_KEY as string,
    notificationUrl: 'https://0c23-49-43-35-153.ngrok-free.app/api/webhook'
  });

  if (!isValid) return res.status(403).end();

  const event = JSON.parse(rawBody.toString());
  switch (event.type) {
    case 'payment.updated':
      const payment = event.data.object;
      // Update your database with payment.status
      break;
  }

  res.status(200).end();
}