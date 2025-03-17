"use client";

import { use, useEffect, useState } from "react";
import { fetchLevel1Categories, getItems, getUser } from "@/lib/services/items";
import { Item } from "@/types/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PlusCircle, Pencil, Trash2, ShoppingCart, Copy } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { supabase } from "@/lib/supabase";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { RoleGuard } from "@/components/RoleGuard";
import { useRole } from "@/hooks/useRole";
import InventoryHeader from './components/InventoryHeader';
import InventoryFilters from './components/InventoryFilters';
import ItemCard from './components/ItemCard';
import Pagination from './components/Pagination';
import { filterItems, sortItems } from './utils/inventory-utils';


interface InventoryItem {
  id: string;
  title: string;
  price: number;
  category: string;
  item_images?: { image_url: string }[];
  quantity?: number;
}

interface Category {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [user, setuser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const { addItems } = useCart();
  const router = useRouter();
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [storeSettings, setStoreSettings] = useState({
    lowStockThreshold: null,
    defaultSorting: 'newest',
  });
  const { role, isLoading: roleLoading } = useRole();

  useEffect(() => {
    const loadItems = async () => {
      try {
        setIsLoading(true);
        const user = await getUser();
        console.log('here is user', user);
        setuser(user);
        if (user) {
          const { items, totalPages } = await getItems(currentPage, 9, user);
          const categoryData = await fetchLevel1Categories();
          console.log("here is my categories data ", categoryData);
          console.log("here is items", items);
          setCategories(categoryData);
          setItems(items.filter(item => !item.deleted_at));
          console.log("here is my items ", items);
          setTotalPages(totalPages);
        }
      } catch (error) {
        console.error("Failed to load items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
  }, [currentPage]);

  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('low_stock_threshold, default_sorting')
          .eq('id', user.store_id) // Replace with the actual store ID
          .single();
          console.log("here is my data ", data,'store id', user.store_id);
        if (error) {
          console.error('Error fetching store settings:', error);
        } else if (data) {
          setStoreSettings({
            lowStockThreshold: data.low_stock_threshold,
            defaultSorting: data.default_sorting,
          });
        }
      } catch (error) {
        console.error('Error fetching store settings:', error);
      }
    };

    fetchStoreSettings();
  }, [user]);

  const filteredItems = filterItems(items, selectedCategory, searchQuery);
  const sortedItems = sortItems(filteredItems, storeSettings.defaultSorting);

  const handleCategoryChange = (newValue: string) => {
    setSelectedCategory(newValue);
    console.log("Selected category:", newValue);
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
        image_url: item.item_images?.[0]?.image_url, // or adjust based on your logic
        category: item.categories?.[0]?.name || item.category_id, // use first category name or fallback
        size: item.size,
        quantity: item.quantity,
      }));

    addItems(selectedItemsData);
    router.push("/pos");
  };

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i);
  };

  const handleDelete = async (itemId: string) => {
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

  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId);
  };

  const handleDeleteConfirm = async () => {
    if (itemToDelete) {
      await handleDelete(itemToDelete);
    }
  };

  const handlePageChange = async (newPage: number) => {
    setIsTransitioning(true);
    setCurrentPage(newPage);
    // The useEffect will handle the data fetching
  };

  // Add pagination controls
  const Pagination = () => (
    <div className="flex justify-center items-center space-x-2 mt-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1 || isLoading || isTransitioning}
      >
        Previous
      </Button>

      <div className="flex items-center space-x-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentPage(page)}
            disabled={isLoading}
            className={cn(
              "w-8 h-8",
              currentPage === page && "bg-[#FF3B30] text-white"
            )}
          >
            {page}
          </Button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        disabled={currentPage === totalPages || isLoading}
      >
        Next
      </Button>
    </div>
  );

  // Add helper function to check permissions
  const canManageItems = (): boolean => {
    return !!role && ['store_owner'].includes(role);
  };

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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        onCategoryChange={handleCategoryChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4"></CardContent>
            </Card>
          ))
        ) : sortedItems.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <p className="text-xl text-gray-500 mb-4">No items found</p>
            {/* <p className="text-sm text-gray-400">
              Try adjusting your search or filter criteria
            </p> */}
          </div>
        ) : (
          sortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
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

      {totalPages > 1 && (
        <Pagination />
      )}

      <DeleteDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
