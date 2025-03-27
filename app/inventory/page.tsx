"use client";

import { useEffect, useState } from "react";
import { fetchLevel1Categories } from "@/lib/services/items";
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
import { useMemo } from "react";

interface Category {
  id: string;
  name: string;
}

type Brand = {
  brand: string;
  logo_url: string;
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextToken, setNextToken] = useState<string | null>(null);
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
   const [categories, setCategories] = useState<Category[]>([]);
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

  // Fetch categories and filter options
  useEffect(() => {
    const initialize = async () => {
      if (!user) return;
      try {
        const [categoryData, sizesData, brandsData, agesData, colorsData] =
          await Promise.all([
            fetchLevel1Categories(),
            supabase.rpc("get_distinct_sizes", { p_store_id: user.store_id }),
            supabase.rpc("get_distinct_brands_with_logo", { p_store_id: user.store_id }),
            supabase.rpc("get_distinct_ages", { p_store_id: user.store_id }),
            supabase.rpc("get_distinct_colors", { p_store_id: user.store_id }),
          ]);
        setCategories(categoryData);
        setFilterOptions({
          sizes: sizesData.data || [],
          brands: brandsData.data || [],
          ages: agesData.data || [],
          colors: colorsData.data || [],
        });
      } catch (error) {
        console.error("Failed to load initial data:", error);
      }
    };
    initialize();
  }, [user]);

  // Fetch items from API route
  const fetchItems = async (token: string | null = null) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/shopify/products?storeId=${user.store_id}&nextToken=${token || ''}&filters=${encodeURIComponent(JSON.stringify(filters))}`
      );
      if (!response.ok) throw new Error("Failed to fetch items");
      const { items: newItems, hasMore, nextToken } = await response.json();
      // Filter out deleted items (relevant for Supabase items)
      const filteredItems = newItems.filter((item: Item) => !item.deleted_at);
      setItems((prev) => (token ? [...prev, ...filteredItems] : filteredItems));
      setHasMore(hasMore);
      setNextToken(nextToken);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(); // Initial fetch
  }, [user, filters]);

  const handleLoadMore = () => {
    fetchItems(nextToken);
  };

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

  const sortedItems = sortItems(items, storeSettings.defaultSorting);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setItems([]); // Reset items on filter change
    setNextToken(null); // Reset pagination
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const sendSelectedToPOS = () => {
    const selectedItemsData = items
      .filter((item) => selectedItems.includes(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        image_url: item.item_images?.[0]?.image_url || item.image_url,
        category: item.categories?.[0]?.name || item.category || item.category_id,
        size: item.size,
        quantity: item.quantity,
      }));
    addItems(selectedItemsData);
    router.push("/pos");
  };

  const handleDelete = async (itemId: string) => {
    if (itemId.startsWith("gid://shopify/")) {
      toast.error("Cannot delete Shopify items from here.");
      return;
    }
    setDeletingItems((prev) => new Set(prev).add(itemId));
    try {
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
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
      return {
        ...prev,
        brands: currentBrands.includes(brand)
          ? currentBrands.filter((b) => b !== brand)
          : [...currentBrands, brand],
      };
    });
    setItems([]);
    setNextToken(null);
  };

  const handleDeleteClick = (itemId: string) => setItemToDelete(itemId);
  const handleDeleteConfirm = () => itemToDelete && handleDelete(itemToDelete);

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
        categories={categories}
        onCategoryChange={(value) => handleFilterChange("category", value)}
        filterOptions={filterOptions}
        selectedFilters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* {filterOptions.brands.length > 0 && (
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
              <span className={filters.brands.includes(brandObj.brand) ? "text-[#000]" : ""}>
                {brandObj.brand}
              </span>
            </button>
          ))}
        </div>
      )} */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => <ItemSkeleton key={i} />)
        ) : sortedItems.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <p className="text-xl text-gray-500 mb-4">No items found</p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              brandLogoMap={brandLogoMap}
              isSelected={selectedItems.includes(item.id)}
              onSelect={toggleItemSelection}
              onEdit={(id) => router.push(`/inventory/edit/${id}`)}
              onDelete={handleDeleteClick}
              onDuplicate={(id) => router.push(`/inventory/add?duplicate=${id}`)}
              isDeleting={deletingItems.has(item.id)}
              canManageItems={canManageItems()}
            />
          ))
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load More"}
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