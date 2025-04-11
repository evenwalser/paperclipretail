import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";


interface ShopifyWebhook {
  topic: string;
  address: string;
  format: string;
}

interface ShopifyWebhooksResponse {
  webhooks: ShopifyWebhook[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");

  if (!code || !shop) {
    return NextResponse.json({ error: "Missing code or shop" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Exchange code for access token
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  const { access_token } = await response.json();

  await supabase
    .from("stores")
    .update({
      shopify_access_token: access_token,
      shopify_shop_name: shop,
    })
    .eq("owner_id", user.id);

  try {
    await registerWebhooks(shop, access_token);
  } catch (error) {
    console.error("Error registering webhook:", error);
  }

  const redirectURL = new URL("/inventory", process.env.NEXT_PUBLIC_APP_URL);
  return NextResponse.redirect(redirectURL);
}

async function registerWebhooks(shopName: string, accessToken: string) {
  const webhook = {
    topic: "inventory_levels/update",
    address: `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/shopify-webhooks`,
    format: "json",
  };

  const existingWebhooksResponse = await fetch(
    `https://${shopName}/admin/api/2025-01/webhooks.json`,
    {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
      },
    }
  );

  if (!existingWebhooksResponse.ok) {
    const errorText = await existingWebhooksResponse.text();
    console.error("Failed to fetch existing webhooks:", errorText);
    throw new Error("Failed to fetch existing webhooks");
  }

  const existingWebhooks = await existingWebhooksResponse.json() as ShopifyWebhooksResponse;
  const isWebhookExists = existingWebhooks.webhooks.some(
    (wh: ShopifyWebhook) => wh.topic === webhook.topic && wh.address === webhook.address
  );

  if (isWebhookExists) {
    console.log("Webhook already exists, skipping registration");
    return;
  }

  const response = await fetch(
    `https://${shopName}/admin/api/2025-01/webhooks.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webhook }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to register webhook:", errorText);
    throw new Error("Webhook registration failed");
  }

  console.log("Webhook registered successfully");
}