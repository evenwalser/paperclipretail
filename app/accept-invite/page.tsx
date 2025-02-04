// pages/accept-invite.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'
import { createClient } from "@/utils/supabase/client";
import SignupForm from '../SignupForm/page';


export default function AcceptInvitePage() {
//   const router = useRouter();
  const [invitation, setInvitation] = useState(null);
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const searchParams = useSearchParams()
  useEffect(() => {
    const validateInvitation = async () => {
        
        const token = searchParams.get('token');
        const email = searchParams.get('email');
        console.log('here is token', token, 'and here is email', email)
      if (!token || !email) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .eq('email', email)
          .gte('expires_at', new Date().toISOString())
          .single();

        if (error || !data) throw new Error('Invalid or expired invitation');
        
        setInvitation(data);
        setValid(true);
      } catch (error) {
        console.error('Invitation validation failed:', error);
        setValid(false);
      } finally {
        setLoading(false);
      }
    };

    validateInvitation();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!valid) {
    return (
      <div>
        <h2>Invalid Invitation</h2>
        <p>This invitation link is either expired or invalid.</p>
      </div>
    );
  }

  return <SignupForm invitation={invitation} />;
}
