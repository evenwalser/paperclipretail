// import { NextResponse } from 'next/server';
// import { createClient } from "@/utils/supabase/server";
// import { getShopifyCredentials } from '@/lib/shopify';

// export async function POST(req: Request) {
//   // Parse the request body
//   let body;
//   try {
//     body = await req.json();
//   } catch (error) {
//     return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
//   }

//   const { storeId, itemId } = body;
//   if (!storeId || !itemId) {
//     return NextResponse.json({ error: 'Missing storeId or itemId' }, { status: 400 });
//   }

//   const supabase = await createClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) {
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//   }

//   // Verify that the user owns the store
//   const { data: store } = await supabase
//     .from('stores')
//     .select('id')
//     .eq('id', storeId)
//     .eq('owner_id', user.id)
//     .single();

//   if (!store) {
//     return NextResponse.json({ error: 'Forbidden: You do not own this store' }, { status: 403 });
//   }

//   try {
//     // Fetch item data
//     const { data: item, error } = await supabase
//       .from('items')
//       .select('*, categories:category_id (name, parent_id), condition, size, tags, title, description, price, quantity, category_id')
//       .eq('id', itemId)
//       .single();
//     if (error || !item) {
//       return NextResponse.json({ error: 'Item not found' }, { status: 404 });
//     }

//     // Fetch images
//     const { data: images } = await supabase
//       .from('item_images')
//       .select('image_url')
//       .eq('item_id', itemId)
//       .order('display_order');

//     // Get category hierarchy
//     const categoryHierarchy = await getCategoryHierarchy(item.category_id);
//     const productType = categoryHierarchy[0] || 'Uncategorized';
//     const tags = [
//       ...categoryHierarchy.slice(1),
//       item.condition,
//       item.size,
//       ...(item.tags || [])
//     ].filter(Boolean).join(', ');

//     const productData = {
//       product: {
//         title: item.title,
//         body_html: item.description,
//         vendor: 'paperclip_test',
//         product_type: productType,
//         tags: tags,
//         variants: [{
//           price: item.price,
//           inventory_quantity: item.quantity,
//           inventory_management: 'shopify'
//         }],
//         images: images?.map((img: { image_url: string }) => ({ src: img.image_url })),
//       },
//     };

//     const { accessToken, shopName } = await getShopifyCredentials(storeId);
//     if (!accessToken || !shopName) {
//       return NextResponse.json({ error: 'Shopify not connected' }, { status: 400 });
//     }

//     const shopifyResponse = await fetch(`https://${shopName}/admin/api/2023-10/products.json`, {
//       method: 'POST',
//       headers: {
//         'X-Shopify-Access-Token': accessToken,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(productData),
//     });

//     if (!shopifyResponse.ok) {
//       const errorData = await shopifyResponse.json();
//       throw new Error(`Failed to create product: ${JSON.stringify(errorData)}`);
//     }

//     const shopifyProduct = await shopifyResponse.json();
//     return NextResponse.json(shopifyProduct, { status: 200 });
//   } catch (error) {
//     console.error('Error creating Shopify product:', error);
//     return NextResponse.json({ error: 'Failed to create Shopify product' }, { status: 500 });
//   }
// }

// async function getCategoryHierarchy(categoryId: string) {
//     const supabase = await createClient();
//   let hierarchy: string[] = [];
//   let currentId = categoryId;
//   while (currentId) {
//     const { data } = await supabase
//       .from('categories')
//       .select('id, name, parent_id')
//       .eq('id', currentId)
//       .single();
//     if (!data) break;
//     hierarchy.unshift(data.name);
//     currentId = data.parent_id;
//   }
//   return hierarchy;
// }
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getShopifyCredentials } from "@/lib/shopify";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { storeId, itemId } = body;
  if (!storeId || !itemId) {
    return NextResponse.json(
      { error: "Missing storeId or itemId" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .single();

  if (!store) {
    return NextResponse.json(
      { error: "Forbidden: You do not own this store" },
      { status: 403 }
    );
  }

  // const { data: item, error } = await supabase
  //   .from('items')
  //   .select('*, categories:category_id (name, parent_id), condition, size, tags, title, description, price, quantity, category_id')
  //   .eq('id', itemId)
  //   .single();
  // if (error || !item) {
  //   return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  // }

  // const { data: images } = await supabase
  //   .from('item_images')
  //   .select('image_url')
  //   .eq('item_id', itemId)
  //   .order('display_order');

  // const categoryHierarchy = await getCategoryHierarchy(item.category_id);
  // const productType = categoryHierarchy[0] || 'Uncategorized';
  // const tagArray = [
  //   ...categoryHierarchy.slice(1),
  //   item.condition,
  //   item.size,
  //   ...(item.tags || [])
  // ].filter(Boolean);

  const { accessToken, shopName } = await getShopifyCredentials(storeId);
  if (!accessToken || !shopName) {
    return NextResponse.json(
      { error: "Shopify not connected" },
      { status: 400 }
    );
  }

  // Step 2: Define the product creation mutation
  async function createShopifyProduct(shopName, accessToken) {
    // Step 1: Fetch the location ID
    const locationQuery = `
      query {
        locations(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    const locationResponse = await fetch(
      `https://${shopName}/admin/api/2023-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: locationQuery }),
      }
    );
    const locationData = await locationResponse.json();
    const locationId = locationData.data.locations.edges[0].node.id;
    console.log("here is location id", locationId);
    // Step 2: Define the product creation mutation
    const mutation = `
      mutation CreateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            id
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Step 3: Prepare the variables
    const variables = {
      input: {
        title: "Nike Kids Running Shoes-3",
        descriptionHtml:
          "These Nike Kids Running Shoes are designed for comfort and style. Featuring a sleek gray body with vibrant red accents, these shoes are perfect for active kids. The Nike logo is prominently displayed, ensuring quality and durability. Ideal for running and everyday wear.",
        // category:'mens t-shirt',
        vendor: "paperclip_test",
        productType: "Sports & fitness",
        tags: [
          "Footwear",
          "Kids",
          "Like New",
          "M",
          "Nike",
          "Running",
          "Kids",
          "Comfort",
          "Stylish",
        ],
        variants: [
          {
            price: "500",
            inventoryManagement: "SHOPIFY",
            inventoryQuantities: [
              {
                locationId: locationId,
                availableQuantity: 1,
              },
            ],
          },
        ],
      },
      media: [
        {
          mediaContentType: "IMAGE", // or the appropriate type
          originalSource:
            "https://img.freepik.com/free-photo/japan-background-digital-art_23-2151546131.jpg?ga=GA1.1.1517070874.1743053066",
          alt: "Background image", // optional alt text
        },
      ],
    };

    // Step 4: Execute the mutation
    const response = await fetch(
      `https://${shopName}/admin/api/2023-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );

    const result = await response.json();
    console.log("🚀 ~ createShopifyProduct ~ result:", result);

    if (result.errors || result.data.productCreate.userErrors.length > 0) {
      throw new Error(
        JSON.stringify(result.errors || result.data.productCreate.userErrors)
      );
    }

    return result.data.productCreate.product;
  }

  async function publishProduct(productId, shopName, accessToken) {
    // Mutation to publish the product immediately using the Online Store publication.
    const publishMutation = `
      mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          publishable {
            availablePublicationCount
            publicationCount
            publishedOnCurrentPublication
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const publishVariables = {
      id: productId,
      input: [
        {
          publicationId: "gid://shopify/Publication/OnlineStore",
          publishDate: new Date().toISOString(),
        },
      ],
    };

    const publishResponse = await fetch(
      `https://${shopName}/admin/api/2023-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: publishMutation,
          variables: publishVariables,
        }),
      }
    );

    const publishResult = await publishResponse.json();
    console.log("🚀 ~ publishResult:", publishResult);

    if (
      publishResult.errors ||
      (publishResult.data.publishablePublish.userErrors &&
        publishResult.data.publishablePublish.userErrors.length > 0)
    ) {
      throw new Error(
        JSON.stringify(
          publishResult.errors ||
            publishResult.data.publishablePublish.userErrors
        )
      );
    }

    // Since the mutation no longer returns the product details,
    // you can optionally re-query the product if needed.
    return publishResult.data.publishablePublish;
  }

  // async function createShopifyProduct(shopName, accessToken) {
  //   // Step 1: Fetch the location ID
  //   const locationQuery = `
  //     query {
  //       locations(first: 1) {
  //         edges {
  //           node {
  //             id
  //           }
  //         }
  //       }
  //     }
  //   `;
  //   const locationResponse = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
  //     method: 'POST',
  //     headers: {
  //       'X-Shopify-Access-Token': accessToken,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ query: locationQuery }),
  //   });
  //   const locationData = await locationResponse.json();
  //   const locationId = locationData.data.locations.edges[0].node.id;
  //   console.log('here is location id', locationId)
  //   // Step 2: Define the product creation mutation
  //   const mutation = `
  //     mutation CreateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
  //       productCreate(input: $input, media: $media) {
  //         product {
  //           id
  //           variants(first: 1) {
  //             edges {
  //               node {
  //                 id
  //               }
  //             }
  //           }
  //         }
  //         userErrors {
  //           field
  //           message
  //         }
  //       }
  //     }
  //   `;

  //   // Step 3: Prepare the variables
  //   const variables = {
  //     input: {
  //       title: "Nike Kids Running Shoes-3",
  //       descriptionHtml: "These Nike Kids Running Shoes are designed for comfort and style. Featuring a sleek gray body with vibrant red accents, these shoes are perfect for active kids. The Nike logo is prominently displayed, ensuring quality and durability. Ideal for running and everyday wear.",
  //       // category:'mens t-shirt',
  //       vendor: "paperclip_test",
  //       productType: "Sports & fitness",
  //       tags: ["Footwear", "Kids", "Like New", "M", "Nike", "Running", "Kids", "Comfort", "Stylish"],
  //       variants: [
  //         {
  //           price: "500",
  //           inventoryManagement: "SHOPIFY",
  //           inventoryQuantities: [
  //             {
  //               locationId: locationId,
  //               availableQuantity: 1,
  //             },
  //           ],
  //         },
  //       ],
  //     },
  //     media: [
  //       {
  //         mediaContentType: "IMAGE", // or the appropriate type
  //         originalSource: "https://img.freepik.com/free-photo/japan-background-digital-art_23-2151546131.jpg?ga=GA1.1.1517070874.1743053066",
  //         alt: "Background image" // optional alt text
  //       }
  //     ],
  //   };

  //   // Step 4: Execute the mutation
  //   const response = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
  //     method: 'POST',
  //     headers: {
  //       'X-Shopify-Access-Token': accessToken,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ query: mutation, variables }),
  //   });

  //   const result = await response.json();
  //   console.log("🚀 ~ createShopifyProduct ~ result:", result)

  //   if (result.errors || result.data.productCreate.userErrors.length > 0) {
  //     throw new Error(JSON.stringify(result.errors || result.data.productCreate.userErrors));
  //   }

  //   return result.data.productCreate.product;
  // }

  // Usage
  try {
    const product = await createShopifyProduct(shopName, accessToken);
    console.log("Product created:", product);

    const publishedProduct = await publishProduct(
      product.id,
      shopName,
      accessToken
    );
    console.log("Product published:", publishedProduct);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function getCategoryHierarchy(categoryId: string) {
  const supabase = await createClient();
  let hierarchy: string[] = [];
  let currentId = categoryId;
  while (currentId) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .single();
    if (!data) break;
    hierarchy.unshift(data.name);
    currentId = data.parent_id;
  }
  return hierarchy;
}
