"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchLevel1Categories, getItems } from "@/lib/services/items";
import { Item } from "@/types/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useCart } from "../contexts/CartContext";
import { useRole } from "@/hooks/useRole";
import { useUser } from "../contexts/UserContext";
import InventoryHeader from "./components/InventoryHeader";
import InventoryFilters from "./components/InventoryFilters";
import ItemCard from "./components/ItemCard";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { sortItems } from "./utils/inventory-utils";

// Define Shopify types
interface ShopifyProduct {
  id: string;
  title: string;
  vendor: string;
  product_type: string;
  variants: ShopifyVariant[];
  images: { id: string; src: string }[];
  created_at: string;
}

interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  inventory_quantity: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
}

interface Category {
  id: string;
  name: string;
}

type Brand = {
  brand: string;
  logo_url: string;
};

// Function to fetch all Shopify products with pagination
async function fetchAllShopifyProducts(accessToken: string, shopDomain: string): Promise<ShopifyProduct[]> {
  // Call the Next.js API route instead of the Shopify API directly
  const response = await fetch(`/api/shopify/shopify-products?accessToken=${encodeURIComponent(accessToken)}&shopDomain=${encodeURIComponent(shopDomain)}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch Shopify products");
  }
  
  const data = await response.json();
  return data.products;
}

// Function to map Shopify variant to Supabase Item type
function shopifyVariantToItem(product: ShopifyProduct, variant: ShopifyVariant): Item {
  return {
    id: `shopify-${variant.id}`,
    title: variant.title === "Default Title" ? product.title : `${product.title} - ${variant.title}`,
    price: parseFloat(variant.price),
    quantity: variant.inventory_quantity,
    item_images: product.images.map((image) => ({ image_url: image.src })),
    categories: [{ name: product.product_type }],
    brand: product.vendor,
    created_at: product.created_at, // For sorting
    // Add other fields as needed, setting defaults for optional fields
    status: variant.inventory_quantity > 0 ? "available" : "out_of_stock",
  };
}

// Function to filter Shopify products client-side
function filterShopifyProducts(products: ShopifyProduct[], filters: any): Item[] {
  return products.flatMap((product) => {
    const matchingVariants = product.variants.filter((variant) => {
      // Category filter
      if (filters.category !== "all" && product.product_type !== filters.category) return false;
      // Search filter
      if (
        filters.search &&
        !product.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !variant.title.toLowerCase().includes(filters.search.toLowerCase())
      ) return false;
      // Brands filter
      if (filters.brands.length > 0 && !filters.brands.includes(product.vendor)) return false;
      // Sizes and colors filter (assuming option1=size, option2=color, adjust as needed)
      const variantOptions = [variant.option1, variant.option2, variant.option3].filter(Boolean);
      if (filters.sizes.length > 0 && !variantOptions.some((opt) => filters.sizes.includes(opt))) return false;
      if (filters.colors.length > 0 && !variantOptions.some((opt) => filters.colors.includes(opt))) return false;
      return true;
    });
    return matchingVariants.map((variant) => shopifyVariantToItem(product, variant));
  });
}

export default function InventoryPage() {
  const [supabaseItems, setSupabaseItems] = useState<Item[]>([]);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState()
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: "all",
    search: "",
    sizes: [] as string[],
    brands: [] as string[],
    ages: [] as string[],
    colors: [] as string[],
  });
  const [filterOptions, setFilterOptions] = useState({
    sizes: [] as string[],
    brands: [] as Brand[],
    ages: [] as string[],
    colors: [] as string[],
  });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const { addItems } = useCart();
  const router = useRouter();
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState({
    lowStockThreshold: null,
    defaultSorting: "newest",
  });
  const { role } = useRole();
  const user = useUser();

  // Fetch initial data: categories, filter options, and Shopify products
  useEffect(() => {
    const initialize = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const [categoryData, sizesData, brandsData, agesData, colorsData, storeData] = await Promise.all([
          fetchLevel1Categories(),
          supabase.rpc("get_distinct_sizes", { p_store_id: user.store_id }),
          supabase.rpc("get_distinct_brands_with_logo", { p_store_id: user.store_id }),
          supabase.rpc("get_distinct_ages", { p_store_id: user.store_id }),
          supabase.rpc("get_distinct_colors", { p_store_id: user.store_id }),
          supabase.from("stores").select("shopify_access_token").eq("id", user.store_id).single(),
        ]);

        setCategories(categoryData);
        setFilterOptions({
          sizes: sizesData.data || [],
          brands: brandsData.data || [],
          ages: agesData.data || [],
          colors: colorsData.data || [],
        });

        // Fetch Shopify products if access token exists
        const accessToken = storeData.data?.shopify_access_token;
        const shopDomain = 'paperclip-test-development.myshopify.com'; // Replace with actual domain
        if (accessToken) {
          const products = await fetchAllShopifyProducts(accessToken, shopDomain);
          setShopifyProducts(products);
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
        toast.error("Failed to initialize inventory data.");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, [user]);

  // Fetch all filtered Supabase items when filters change
  useEffect(() => {
    const loadSupabaseItems = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        // Fetch all items without pagination (modify getItems accordingly)
        const { items } = await getItems(1, 9, user, filters);
        setSupabaseItems(items.filter((item) => !item.deleted_at));
      } catch (error) {
        console.error("Failed to load Supabase items:", error);
        toast.error("Failed to load Supabase items.");
      } finally {
        setIsLoading(false);
      }
    };
    loadSupabaseItems();
  }, [filters, user]);


//   useEffect(() => {
//   const supabaseItemsNotSynced = supabaseItems.filter(item => !item.shopify_product_id);
//   const filteredShopifyItems = filterShopifyProducts(shopifyProducts, filters);
//   const combinedItems = [...supabaseItemsNotSynced, ...filteredShopifyItems];
//   const sortedItems = sortItems(combinedItems, storeSettings.defaultSorting);
//   setAllItems(sortedItems);
//   setTotalPages(Math.ceil(sortedItems.length / 9));
// }, [supabaseItems, shopifyProducts, filters, storeSettings.defaultSorting]);
  // Combine and sort items when supabaseItems or shopifyProducts change
  useEffect(() => {
    const filteredShopifyItems = filterShopifyProducts(shopifyProducts, filters);
    const combinedItems = [...supabaseItems, ...filteredShopifyItems];
    const sortedItems = sortItems(combinedItems, storeSettings.defaultSorting);
    setAllItems(sortedItems);
    setTotalPages(Math.ceil(sortedItems.length / 9));
  }, [supabaseItems, shopifyProducts, filters, storeSettings.defaultSorting]);

  // Compute items for the current page
  const items = useMemo(() => {
    const start = (currentPage - 1) * 9;
    const end = start + 9;
    return allItems.slice(start, end);
  }, [allItems, currentPage]);

  // Fetch store settings
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("low_stock_threshold, default_sorting")
          .eq("id", user.store_id)
          .single();
        if (error) throw error;
        if (data) {
          setStoreSettings({
            lowStockThreshold: data.low_stock_threshold,
            defaultSorting: data.default_sorting,
          });
        }
      } catch (error) {
        console.error("Error fetching store settings:", error);
      }
    };
    if (user) fetchStoreSettings();
  }, [user]);

  const brandLogoMap = useMemo(() => {
    return filterOptions.brands.reduce((acc, { brand, logo_url }) => {
      acc[brand] = logo_url;
      return acc;
    }, {} as Record<string, string | null>);
  }, [filterOptions.brands]);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to page 1 on filter change
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const sendSelectedToPOS = () => {
    const selectedItemsData = allItems
      .filter((item) => selectedItems.includes(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        image_url: item.item_images?.[0]?.image_url,
        category: item.categories?.[0]?.name || item.category_id,
        size: item.size,
        quantity: item.quantity,
      }));
    addItems(selectedItemsData);
    router.push("/pos");
  };

  const handleDelete = async (itemId: string) => {
    if (itemId.startsWith("shopify-")) {
      toast.error("Cannot delete Shopify items from this interface.");
      setItemToDelete(null);
      return;
    }
    setDeletingItems((prev) => new Set(prev).add(itemId));
    try {
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
      setSupabaseItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
      setItemToDelete(null);
      toast.success("Item successfully removed from inventory");
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Failed to remove item. Please try again.");
    } finally {
      setDeletingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleBrandFilter = (brand: string) => {
    setFilters((prev) => {
      const currentBrands = prev.brands;
      if (currentBrands.includes(brand)) {
        return { ...prev, brands: currentBrands.filter((b) => b !== brand) };
      } else {
        return { ...prev, brands: [...currentBrands, brand] };
      }
    });
    setCurrentPage(1);
  };

  const handleDeleteClick = (itemId: string) => setItemToDelete(itemId);
  const handleDeleteConfirm = () => itemToDelete && handleDelete(itemToDelete);
  const handlePageChange = (newPage: number) => setCurrentPage(newPage);

  const canManageItems = () => !!role && ["store_owner"].includes(role);

  const ItemSkeleton = () => (
    <div className="animate-pulse">
      <div className="mb-4 aspect-[4/2] rounded-lg bg-gray-200" />
      <div className="h-6 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-1/2 bg-gray-200 rounded mb-4" />
      <div className="h-3 w-full bg-gray-200 rounded mb-2" />
      <div className="h-3 w-5/6 bg-gray-200 rounded mb-2" />
      <div className="flex space-x-2 mt-4">
        <div className="h-8 w-20 bg-gray-200 rounded" />
        <div className="h-8 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <InventoryHeader
        selectedItemsCount={selectedItems.length}
        sendSelectedToPOS={sendSelectedToPOS}
        canManageItems={canManageItems()}
        user={user}
        onAddNewItem={() => router.push("/inventory/add")}
      />

      <InventoryFilters
        searchQuery={filters.search}
        onSearchChange={(value) => handleFilterChange("search", value)}
        categories={categories || []}
        onCategoryChange={(value) => handleFilterChange("category", value)}
        filterOptions={filterOptions}
        selectedFilters={filters}
        onFilterChange={handleFilterChange}
      />

      {filterOptions.brands.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6">
          {filterOptions.brands.map((brandObj) => (
            <button
              key={brandObj.brand}
              onClick={() => handleBrandFilter(brandObj.brand)}
              className={`flex flex-col items-center space-y-2 p-2 border rounded hover:bg-[#afb8c7] ${
                filters.brands.includes(brandObj.brand) ? "bg-blue-100" : ""
              }`}
            >
              {brandObj.logo_url ? (
                <img
                  src={brandObj.logo_url}
                  alt={brandObj.brand}
                  className="h-12 w-12 object-contain"
                />
              ) : (
                <div className="h-12 w-12 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-sm">No Logo</span>
                </div>
              )}
              <span className={`${filters.brands.includes(brandObj.brand) ? "text-[#000]" : ""}`}>
                {brandObj.brand}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : items.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <p className="text-xl text-gray-500 mb-4">No items found</p>
          </div>
        ) : (
          items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              brandLogoMap={brandLogoMap}
              isSelected={selectedItems.includes(item.id)}
              onSelect={toggleItemSelection}
              onEdit={(id) => !id.startsWith("shopify-") && router.push(`/inventory/edit/${id}`)}
              onDelete={handleDeleteClick}
              onDuplicate={(id) => !id.startsWith("shopify-") && router.push(`/inventory/add?duplicate=${id}`)}
              isDeleting={deletingItems.has(item.id)}
              canManageItems={canManageItems() && !item.id.startsWith("shopify-")}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || isLoading}
          >
            Previous
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(page)}
              disabled={isLoading}
              className={cn(
                "w-8 h-8",
                currentPage === page && "bg-[#FF3B30] text-white"
              )}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || isLoading}
          >
            Next
          </Button>
        </div>
      )}

      <DeleteDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}