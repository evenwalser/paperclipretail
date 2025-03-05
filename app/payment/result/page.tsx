'use client';

import { useSearchParams } from 'next/navigation';

export default function PaymentResult() {
  const searchParams  = useSearchParams();
  const orderId = searchParams?.get('orderId')
 
  return (
    <div> 
      <h1>Payment Successful!</h1>
      <p>Order ID: {orderId}</p>
    </div>
  );
} 