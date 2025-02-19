// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { PlusCircle, Pencil, Trash2, ShoppingCart } from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { supabase } from "@/lib/supabase";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { cn } from "@/lib/utils";
import Image from "next/image";

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

  useEffect(() => {
    const loadItems = async () => {
      try {
        setIsLoading(true);
        const user = await getUser();
        setuser(user);
        if (user) {
          const { items, totalPages } = await getItems(currentPage, 9, user);
          const categoryData = await fetchLevel1Categories();
          console.log("here is my categories data ", categoryData);
          console.log("here is items", items);
          setCategories(categoryData);
          setItems(items);
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

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" ||
      item.categories.some((category) => category.id === selectedCategory);

    const matchesSearch =
      searchQuery.trim() === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });
  console.log("here is my filtered storeSettings ", storeSettings);

  const sortedItems = filteredItems.slice().sort((a, b) => {
    switch (storeSettings.defaultSorting) {
      case "newest":
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case "lowStock":
        return (a.quantity || 0) - (b.quantity || 0);
      case "highStock":
        return (b.quantity || 0) - (a.quantity || 0);
      case "alphabetical":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

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
      // First, delete associated images from storage
      const { data: imageData } = await supabase
        .from("item_images")
        .select("image_url")
        .eq("item_id", itemId);

      if (imageData?.length) {
        // Extract file paths from URLs and delete from storage
        const filePaths = imageData.map((img) => {
          const url = new URL(img.image_url);
          return url.pathname.split("/").pop()!;
        });

        if (filePaths.length > 0) {
          await supabase.storage.from("items").remove(filePaths);
        }
      }

      // Delete image records
      await supabase.from("item_images").delete().eq("item_id", itemId);

      // Delete the item
      await supabase.from("items").delete().eq("id", itemId);

      // Update local state
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));

      // Close the delete dialog if open
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item. Please try again.");
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

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Inventory</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
          <Button
            onClick={sendSelectedToPOS}
            disabled={selectedItems.length === 0}
            className="bg-[#FF3B30] hover:bg-[#E6352B] text-white rounded-[8px]"
          >
            Send to POS
          </Button>
          {user && (
            <Button
              onClick={() => {
                if (user?.store_id) {
                  router.push("/inventory/add");
                } else {
                  toast.error("No store associated with this account");
                }
              }}
              className="bg-[#FF3B30] hover:bg-[#E6352B] text-white rounded-[8px]"
            >
              Add New Item
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <Input
          placeholder="Search inventory..."
          className="flex-grow"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Select onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue
              placeholder={
                categories.length === 0
                  ? "No categories available"
                  : "All Categories"
              }
            />
          </SelectTrigger>
          <SelectContent className="h-[250px] overflow-y-auto">
            {categories.length === 0 ? (
              <SelectItem disabled value="no-categories">
                No categories available
              </SelectItem>
            ) : (
              <>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

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
            <Card
              key={item.id}
              className={`overflow-hidden transition-shadow duration-300 ${
                selectedItems.includes(item.id) ? "ring-2 ring-[#FF3B30]" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="relative mb-4 aspect-[4/2]">
                  <div className="relative mb-4">
                    {item.item_images?.length > 0 ? (
                      <Swiper
                        modules={[Navigation, Pagination]}
                        navigation
                        pagination={{ clickable: true }}
                        spaceBetween={10}
                        slidesPerView={1}
                        className="w-full rounded-lg swiper-inventory"
                      >
                        {item.item_images.map((media, index) => (
                          <SwiperSlide key={index}>
                            {isVideo(media.image_url) ? (
                              <video
                                controls
                                className="w-full h-48 object-cover rounded-lg"
                              >
                                <source
                                  src={media.image_url}
                                  type="video/mp4"
                                />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <img
                                src={media.image_url}
                                alt={`${item.title} - ${index + 1}`}
                                className="w-full h-48 object-cover rounded-lg"
                              />
                            )}
                          </SwiperSlide>
                        ))}
                      </Swiper>
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gray-200 rounded-lg">
                        <span className="text-gray-500 text-sm">
                          No Media Available
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Image component can be added here */}
                  {selectedItems.includes(item.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                      <span className="text-white text-lg sm:text-xl font-bold">
                        Selected
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 space-y-2 sm:space-y-0 gap-2">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2 overflow-hidden text-ellipsis overflow-clip display-webkit-box line-clamp-2 min-h-[56px]">
                      {item.title}
                    </h3>
                    <p className="text-xl sm:text-2xl font-bold text-gray-700">
                      £{item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center min-w-[68px]">
                    {item.status === "available" && (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        In Stock
                      </span>
                    )}
                    {item.status === "low_stock" && (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Low Stock
                      </span>
                    )}
                    {item.status === "out_of_stock" && (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Out of Stock
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Category:{" "}
                  {item.categories.find((category) => category.level === 1)
                    ?.name || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Quantity: {item.quantity || 0}
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full leading-[normal] hover:bg-[#f42037] "
                    onClick={() => router.push(`/inventory/edit/${item.id}`)}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 leading-[normal]"
                    disabled={deletingItems.has(item.id)}
                    onClick={() => handleDeleteClick(item.id)}
                  >
                    {deletingItems.has(item.id) ? (
                      <>
                        <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full mr-1" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled= {item?.status === 'out_of_stock'}
                    className={`w-full leading-[normal] ${
                      selectedItems.includes(item.id)
                        ? "bg-[#FF3B30] text-white hover:bg-[#E6352B]"
                        : "hover:bg-[#f42037]"
                    }`}
                    onClick={() => toggleItemSelection(item.id)}
                  >
                    {selectedItems.includes(item.id) ? "Deselect" : "Select"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && <Pagination />}

      <DeleteDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
