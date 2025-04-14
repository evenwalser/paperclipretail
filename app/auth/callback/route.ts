// import { NextResponse } from "next/server";
// import { createClient } from "@/utils/supabase/server";

// export async function GET(request: Request) {
//   const { searchParams, origin } = new URL(request.url);
//   const code = searchParams.get("code");
//   const next = searchParams.get("next") ?? "/";

//   if (code) {
//     const supabase = await createClient();
//     const { error } = await supabase.auth.exchangeCodeForSession(code);
//     if (!error) {
//       return NextResponse.redirect(`${origin}${next}`);
//     }
//   }

//   return NextResponse.redirect(`${origin}/auth/auth-code-error`);
// }

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      const session = data.session;

      // Determine the provider (google or apple)
      const provider = user?.app_metadata?.provider;
      if (!provider) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=Missing provider`);
      }

      // Extract identity data
      const identity = user?.identities?.find((id) => id.provider === provider);
      const identityData = identity?.identity_data;

      // Extract required fields
      const firstName = identityData?.given_name || user?.user_metadata?.given_name || "";
      const lastName = identityData?.family_name || user?.user_metadata?.family_name || "";
      const id = identityData?.sub; // Unique ID from provider
      const userToken = session?.access_token; // JWT token

      if (!id || !userToken) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error?error=Missing id or token`);
      }

      // Set timezone (default or dynamic)
      const timezone = "Europe/Kyiv"; // Matches client's example; adjust as needed

      // Construct payload for /v4/login
      const payload = {
        firstName,
        lastName,
        source: provider, // "google" or "apple"
        timezone,
        id,
        userToken,
      };

      // Send POST request to /v4/login
      const response = await fetch(`${process.env.NEXT_PUBLIC_PAPERCLIP_API_URL}/v4/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Successful registration or login; redirect to next page
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        const errorData = await response.json();
        return NextResponse.redirect(
          `${origin}/auth/auth-code-error?error=${encodeURIComponent(errorData.message || "Login failed")}`
        );
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}