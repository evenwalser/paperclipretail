import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Utility function to get Shopify credentials (assumed to exist)
import { getShopifyCredentials } from '@/lib/shopify';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storeId, itemId } = body;
    if (!storeId || !itemId) {
      return NextResponse.json({ error: 'Missing storeId or itemId' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify store ownership
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .single();

    if (!store) {
      return NextResponse.json({ error: 'Forbidden: You do not own this store' }, { status: 403 });
    }

    const { accessToken, shopName } = await getShopifyCredentials(storeId);
    if (!accessToken || !shopName) {
      return NextResponse.json({ error: 'Shopify not connected' }, { status: 400 });
    }

    // Fetch item details
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();
    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Fetch item images
    const { data: images, error: imagesError } = await supabase
      .from('item_images')
      .select('image_url')
      .eq('item_id', itemId)
      .order('display_order');
    if (imagesError) {
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
    }

    // Fetch category hierarchy
    const categoryHierarchy = await getCategoryHierarchy(item.category_id, supabase);

    // Create Shopify product
    const product = await createShopifyProduct(shopName, accessToken, item, images, categoryHierarchy);
    await publishProduct(product.id, shopName, accessToken);

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error creating Shopify product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createShopifyProduct(shopName, accessToken, item, images, categoryHierarchy) {
  // Fetch location ID for inventory
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
  const locationResponse = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: locationQuery }),
  });
  const locationData = await locationResponse.json();
  if (locationData.errors) {
    throw new Error(JSON.stringify(locationData.errors));
  }
  const locationId = locationData.data.locations.edges[0].node.id;

  // Product creation mutation
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

  const variables = {
    input: {
      title: item.title,
      descriptionHtml: item.description || '',
      vendor: 'paperclip_test', // Replace with actual vendor
      productType: categoryHierarchy.join(' > '),
      tags: item.tags || [],
      variants: [
        {
          price: item.price.toString(),
          inventoryManagement: 'SHOPIFY',
          inventoryQuantities: [
            {
              locationId,
              availableQuantity: item.quantity,
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
    // media: images.map((img, index) => ({
    //   mediaContentType: 'IMAGE',
    //   originalSource: img.image_url,
    //   alt: `${item.title} - Image ${index + 1}`,
    // })),
  };

  const response = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const result = await response.json();
  if (result.errors || result.data.productCreate.userErrors.length > 0) {
    throw new Error(JSON.stringify(result.errors || result.data.productCreate.userErrors));
  }

  return result.data.productCreate.product;
}

async function getOnlineStorePublicationId(shopName, accessToken) {
  
  const query = `
    query {
      publications(first: 10) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const response = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error(JSON.stringify(result.errors));
  }

  const publications = result.data.publications.edges;
  const onlineStorePub = publications.find(pub => pub.node.name === 'Online Store');
  if (!onlineStorePub) {
    throw new Error('Online Store publication not found');
  }

  return onlineStorePub.node.id;
}

async function publishProduct(productId, shopName, accessToken) {
  const publicationId = await getOnlineStorePublicationId(shopName, accessToken);
  const publishMutation = `
  mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
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
      publicationId, // Use the fetched ID
      publishDate: new Date().toISOString(),
    },
  ],
};
const publishResponse = await fetch(`https://${shopName}/admin/api/2023-10/graphql.json`, {
  method: 'POST',
  headers: {
    'X-Shopify-Access-Token': accessToken,  
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: publishMutation, variables: publishVariables }),
});
const publishResult = await publishResponse.json();
  if (publishResult.errors || publishResult.data.publishablePublish.userErrors.length > 0) {
    throw new Error(JSON.stringify(publishResult.errors || publishResult.data.publishablePublish.userErrors));
  }
  return publishResult.data.publishablePublish.product;
}

async function getCategoryHierarchy(categoryId, supabase) {
  let hierarchy = [];
  let currentId = categoryId;
  while (currentId) {
    const { data } = await supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('id', currentId)
      .single();
    if (!data) break;
    hierarchy.unshift(data.name);
    currentId = data.parent_id;
  }
  return hierarchy;
}