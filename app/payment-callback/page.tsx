'use client';  
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from "@/utils/supabase/client";


export default function PaymentCallback() {
  const supabase = createClient();
  const router = useRouter();
  const { order } = router.query;

//   useEffect(() => {
//     const checkStatus = async () => {
//       const { data } = await supabase
//         .from('orders')
//         .select('status')
//         .eq('id', order)
//         .single();

//       if (data?.status === 'paid') {
//         router.push('/success');
//       } else {
//         router.push('/failed');
//       }
//     };

//     checkStatus();
//   }, [order]);
console.log('order', order);

  return <div>Processing payment...</div>;
}