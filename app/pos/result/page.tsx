'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { setTimeout } from 'node:timers';

export default function PaymentResult() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('checking');

  // useEffect(() => {
  //   const checkPaymentStatus = async () => {
  //     try {
  //       const pendingPaymentId = localStorage.getItem('pendingPaymentId');
  //       if (!pendingPaymentId) {
  //         throw new Error('Payment reference not found');
  //       }

  //       const supabase = createClient();
  //       const { data: payment, error } = await supabase
  //         .from('payments')
  //         .select('status')
  //         .eq('id', pendingPaymentId)
  //         .single();

  //       if (error) throw error;

  //       if (payment.status === 'COMPLETED') {
  //         setStatus('success');
  //         toast.success('Payment successful');
  //         // Clear the pending payment ID
  //         localStorage.removeItem('pendingPaymentId');
  //         // Redirect back to POS after 3 seconds
  //         setTimeout(() => router.push('/pos'), 3000);
  //       } else if (payment.status === 'FAILED') {
  //         setStatus('failed');
  //         toast.error('Payment failed');
  //       } else {
  //         // Payment still pending, check again in 2 seconds
  //         setTimeout(checkPaymentStatus, 2000);
  //       }
  //     } catch (error) {
  //       console.error('Error checking payment status:', error);
  //       setStatus('error');
  //       toast.error('Error checking payment status');
  //     }
  //   };

  //   checkPaymentStatus();
  // }, [router]);


    useEffect(() => {
     
    setStatus('success');
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">Payment Status</h1>
        {status === 'checking' && (
          <p>Checking payment status...</p>
        )}
        {status === 'success' && (
          <p className="text-green-500">Payment successful! Redirecting...</p>
        )}
        {status === 'failed' && (
          <p className="text-red-500">Payment failed. Please try again.</p>
        )}
        {status === 'error' && (
          <p className="text-red-500">Error checking payment status.</p>
        )}
      </div>
    </div>
  );
} 