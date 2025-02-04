// // components/SignupForm.tsx
// import { useState } from 'react';
// import { createClient } from "@/utils/supabase/client";
// import { useRouter } from "next/navigation";


// export function SignupForm({ invitation }) {
//   const [password, setPassword] = useState('');
//   const supabase = createClient();
//   const [loading, setLoading] = useState(false);
//   const router = useRouter();

//   const handleSignup = async (e) => {
//     e.preventDefault();
//     setLoading(true);

//     try {
//       const { data: authData, error: authError } = await supabase.auth.signUp({
//         email: invitation.email,
//         password,
//         options: { emailRedirectTo: `${window.location.origin}/dashboard` },
//       });

//       if (authError) throw authError;

//       const { error: profileError } = await supabase
//         .from('profiles')
//         .update({
//           role: invitation.role,
//           store_id: invitation.store_id,
//         })
//         .eq('id', authData.user?.id);

//       if (profileError) throw profileError;

//       await supabase
//         .from('invitations')
//         .update({ claimed_at: new Date().toISOString(), claimed_by: authData.user?.id })
//         .eq('id', invitation.id);

//       router.push('/dashboard');
//     } catch (error) {
//       console.error('Signup failed:', error);
//       alert('Signup failed: ' + error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form onSubmit={handleSignup}>
//       <h2>Complete Your Registration</h2>
//       <p>Email: {invitation.email}</p>
//       <input
//         type="password"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//         placeholder="Create password"
//         required
//       />
//       <button type="submit" disabled={loading}>
//         {loading ? 'Creating Account...' : 'Complete Signup'}
//       </button>
//     </form>
//   );
// }


// pages/SignupForm/page.tsx

'use client';

import { Input } from "@/components/ui/input";
import { signup } from "./actions"; // Ensure this is properly defined for handling the form submission.
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function SignupForm({
  invitation,
}: {
  invitation: { email: string; token: string };
}) {
  const isSignup = true; // This flag ensures we know it's a signup form

  return (
    <div className="flex justify-center items-center h-[-webkit-fill-available] absolute w-full flex-col">
      <div className="p-6">
        <img 
          src={'/paperclip_logo_red.png'}
          alt="Paperclip Logo"
          width={200}
          height={67}
          className="filter-none"
        />
      </div>
      <form className="max-w-[600px] w-full p-6 rounded-xl border bg-card shadow">
        {/* <div className="flex mb-6 flex items-center border border-[#ffffff] p-[5px]">
          <Link
            href="?tab=signup"
            className={`py-[5px] px-[10px] text-lg font-medium transition-colors w-full text-center bg-[#ffffff] text-[#000000]`}
          >
            Sign Up
          </Link>
        </div> */}

        <div className="mb-4 text-red-500 text-sm">
          {/* Add any potential errors here */}
        </div>

        <label className="mt-2 block" htmlFor="email">
          Name:
        </label>
        <Input
          id="name"
          name="name"
          type="name"
          required
          
        />

        {/* Pre-fill email from the invitation */}
        <label className="mt-2 block" htmlFor="email">
          Email (Invited):
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={invitation.email}
          required
          disabled
        />

        {/* Password */}
        <label className="mt-2 block" htmlFor="password">
          Password:
        </label>
        <Input id="password" name="password" type="password" required />

        {/* Confirm Password */}
        <label className="mt-2 block" htmlFor="confirmPassword">
          Confirm Password:
        </label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required />

        <Button
          formAction={signup}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg w-full mt-[20px]"
        >
          Sign up
        </Button>

        <div className="mt-4 text-center">
          <Link
            href="/reset-password"
            className="text-sm text-muted-foreground hover:text-primary text-[#0093ff]"
          >
            Forgot your password?
          </Link>
        </div>
      </form>
    </div>
  );
}
