import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/client';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');

  if (!code || !shop) {
    return NextResponse.json({ error: 'Missing code or shop' }, { status: 400 });
  }

//   const supabase = createClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

  // Exchange code for access token
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  const { access_token } = await response.json();

//   await supabase
//     .from('stores')
//     .update({
//       shopify_access_token: access_token,
//       shopify_shop_name: shop,
//     })
//     .eq('owner_id', user.id);

const redirectURL = new URL('/inventory', process.env.NEXT_PUBLIC_APP_URL);
console.log('access_token',access_token,shop)
return NextResponse.redirect(redirectURL);
}
