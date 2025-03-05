"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, X, Upload, Wand2 } from "lucide-react";
import { Reorder } from "framer-motion";
import { cn } from "@/lib/utils";
import { analyzeImage } from "@/lib/together";
import { toast } from "sonner";
import { Sparkles, Star, ThumbsUp, Check, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getUser } from "@/lib/services/items";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
  display_order: number;
}

interface ItemImage {
  id: string;
  image_url: string;
  filepath: string;
  file?: File;
  url?: string;
}

interface ItemType {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  category_id: string;
  condition: string;
  size?: string;
  status: "available" | "low_stock" | "out_of_stock";
  available_in_store: boolean;
  list_on_paperclip: boolean;
  store_id: string;
  item_images: ItemImage[];
}

const conditionOptions = [
  { value: "New", icon: Sparkles },
  { value: "Like New", icon: Star },
  { value: "Very Good", icon: ThumbsUp },
  { value: "Good", icon: Check },
  { value: "Fair", icon: AlertCircle },
] as const;

export default function EditItemPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const supabase = createClient();
  const [item, setItem] = useState<ItemType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState({
    level1: "",
    level2: "",
    level3: "",
  });
  const [isPrePopulated, setIsPrePopulated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [itemDetails, setItemDetails] = useState({
    name: "",
    description: "",
    price: "",
    quantity: "1",
    condition: "New",
    size: "",
    availableInStore: true,
    listOnPaperclip: true,
  });

  const level1Categories = categories.filter((cat) => !cat.parent_id);
  const level2Categories = categories.filter(
    (cat) => cat.parent_id === selectedCategories.level1
  );
  const level3Categories = categories.filter(
    (cat) => cat.parent_id === selectedCategories.level2
  );

  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    price: '',
    images: '',
    category: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const user = await getUser();
      setUser(user);
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (categoriesData) setCategories(categoriesData);

      const { data: itemData } = await supabase
        .from("items")
        .select(
          `
          *,
          item_images (*)
        `
        )
        .eq("id", id)
        .single();

      if (itemData) {
        setItem(itemData);
        setImages(itemData.item_images || []);
        setItemDetails({
          name: itemData.title,
          description: itemData.description,
          price: itemData.price.toString(),
          quantity: itemData.quantity?.toString() || "1",
          condition: itemData.condition,
          size: itemData.size || "",
          availableInStore: itemData.available_in_store,
          listOnPaperclip: itemData.list_on_paperclip,
        });

        // Fetch category hierarchy
        const categoryId = itemData.category_id;
        const category = categoriesData?.find((c) => c.id === categoryId);
        if (category) {
          const parent = categoriesData?.find(
            (c) => c.id === category.parent_id
          );
          const grandParent = parent
            ? categoriesData?.find((c) => c.id === parent.parent_id)
            : null;

          setSelectedCategories({
            level1: grandParent?.id || parent?.id || categoryId,
            level2: parent?.id || categoryId,
            level3: categoryId,
          });
        }

        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files?.length) return;

    try {
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const filePath = `items/${id}/${Date.now()}-${file.name}`;
          const { error } = await supabase.storage
            .from("item-images")
            .upload(filePath, file);

          if (error) throw error;

          const {
            data: { publicUrl },
          } = supabase.storage.from("item-images").getPublicUrl(filePath);

          return {
            id: "", // Temporary ID for new images
            image_url: publicUrl,
            filepath: filePath,
            file: file,
          };
        })
      );

      setImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      toast.error("Error uploading images");
    }
  };

  const handleDeleteImage = async (index: number) => {
    const imageToDelete = images[index];
    if (!imageToDelete) return;

    try {
      // Delete from storage if it's an existing image
      if (imageToDelete.id) {
        await supabase.storage
          .from("item-images")
          .remove([imageToDelete.filepath]);

        await supabase.from("item_images").delete().eq("id", imageToDelete.id);
      } else {
        // For new images that haven't been saved yet
        await supabase.storage
          .from("item-images")
          .remove([imageToDelete.filepath]);
      }

      setImages((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      toast.error("Error deleting image");
    }
  };

  function extractJson(response: any) {
    try {
      // Check if response contains valid JSON structure
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No valid JSON found in the response.");
      }

      // Extract the JSON part from the response string
      const jsonString = response.substring(jsonStart, jsonEnd).trim();

      // Attempt to parse the JSON string
      const jsonObject = JSON.parse(jsonString);

      // Ensure the parsed result is an object
      if (typeof jsonObject !== "object" || jsonObject === null) {
        throw new Error("Parsed result is not a valid JSON object.");
      }

      return jsonObject;
    } catch (error: any) {
      console.error("Error extracting or parsing JSON:", error.message);
      return null;
    }
  }

  const handleAIAnalysis = async () => {
    if (!images.length) {
      toast.error("Please add at least one image to analyze");
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      images.forEach((image) => {
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(image?.image_url); // Check if the URL matches image extensions
        if (!isImage) return; // Skip if it's not an image

        formData.append("image", image.image_url); // Append image URL to formData
      });

      const result = await analyzeImage(formData);
      const dataObject =
        extractJson(result?.data?.choices?.[0]?.message?.content) || "{}";

      setItemDetails((prev) => ({
        ...prev,
        name: dataObject.title || prev.name,
        description: dataObject.description || prev.description,
        price: dataObject.price_avg?.toString() || prev.price,
        condition: dataObject.condition || prev.condition,
        size: dataObject.size || prev.size,
      }));

      // Category handling similar to Add Item page
      if (dataObject.category_id) {
        const categoryNames = dataObject.category_id.split(" > ");
        const level1 = categories.find((cat) => cat.name === categoryNames[0]);
        const level2 = categories.find(
          (cat) => cat.name === categoryNames[1] && cat.parent_id === level1?.id
        );
        const level3 = categories.find(
          (cat) => cat.name === categoryNames[2] && cat.parent_id === level2?.id
        );

        setSelectedCategories({
          level1: level1?.id || "",
          level2: level2?.id || "",
          level3: level3?.id || "",
        });
      }
    } catch (error) {
      console.log("here is error :", error);
      toast.error("AI analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!item) return;
    
    // Reset errors
    setFieldErrors({
      name: '',
      price: '',
      images: '',
      category: ''
    });

    // Validate fields
    let hasErrors = false;
    const newErrors = {
      name: '',
      price: '',
      images: '',
      category: ''
    };

    if (!itemDetails.name.trim()) {
      newErrors.name = 'Item name is required';
      hasErrors = true;
    }

    if (!itemDetails.price || isNaN(parseFloat(itemDetails.price)) || parseFloat(itemDetails.price) <= 0) {
      newErrors.price = 'Valid price is required';
      hasErrors = true;
    }

    // Check if there are any images
    const isImage = (image: ItemImage) => /\.(jpg|jpeg|png|gif|webp)$/i.test(image.image_url);
    const filteredImages = images.filter(isImage);
    if (filteredImages.length === 0) {
      newErrors.images = 'At least one image is required';
      hasErrors = true;
    }

    // Check if category is selected
    if (!selectedCategories.level1) {
      newErrors.category = 'Please select a main category';
      hasErrors = true;
    } else if (!selectedCategories.level2) {
      newErrors.category = 'Please select a subcategory';
      hasErrors = true;
    } else if (!selectedCategories.level3) {
      newErrors.category = 'Please select a sub-subcategory';
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(newErrors);
      return;
    }

    setIsSaving(true);

    try {
      // Update item details
      const { error: itemError } = await supabase
        .from("items")
        .update({
          title: itemDetails.name,
          description: itemDetails.description,
          price: parseFloat(itemDetails.price) || 0,
          quantity: parseInt(itemDetails.quantity) || 0,
          category_id:
            selectedCategories.level3 ||
            selectedCategories.level2 ||
            selectedCategories.level1,
          condition: itemDetails.condition,
          size: itemDetails.size,
          available_in_store: itemDetails.availableInStore,
          list_on_paperclip: itemDetails.listOnPaperclip,
        })
        .eq("id", item.id);

      if (itemError) throw itemError;


      const imageUploads = await Promise.all(
        images.map(async (image, index) => {
          // Generate unique filename
          const fileExt = image.image_url.split(".").pop();
          const fileName = `${user.id}/${
            item.id
          }/${crypto.randomUUID()}.${fileExt}`;
          let fileData: Blob;

          if (image.file) {
            fileData = image.file;
          } else {
            // Convert base64 to blob for camera images
            const response = await fetch(image.image_url);
            fileData = await response.blob();
          }
          console.log("all images removed", handleDeleteImage(index));
          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from("item-images")
            .upload(fileName, fileData, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadError) {
            console.log("error happens while uploading an image", uploadError);
            throw uploadError;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("item-images").getPublicUrl(fileName);
          console.log("here is public url ", publicUrl);

          // Create image record
          return {
            item_id: item.id,
            image_url: publicUrl,
            display_order: index,
          };
        })
      );
      if (imageUploads.length > 0) {
        const { error: imageError } = await supabase
          .from("item_images")
          .insert(imageUploads);

        if (imageError) {
          console.log("Error inserting image records:", imageError);
          throw imageError;
        }
      }
      // 4. Cleanup temporary URLs
      images.forEach((image) => URL.revokeObjectURL(image.image_url));
      // Update images
      // const existingIds = images.filter((img) => img.id).map((img) => img.id);
      // await supabase
      //   .from("item_images")
      //   .delete()
      //   .eq("item_id", item.id)
      //   .not("id", "in", `(${existingIds.join(",")})`);

      // const newImages = images.filter((img) => !img.id);
      // if (newImages.length) {
      //   await supabase.from("item_images").insert(
      //     newImages.map((img) => ({
      //       item_id: item.id,
      //       image_url: img.image_url,
      //       filepath: img.filepath,
      //     }))
      //   );
      // }

      router.push("/inventory");
      toast.success("Item updated successfully");
    } catch (error) {
      toast.error("Error saving changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReorder = (newOrder: ItemImage[]) => {
    setImages(newOrder);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-6">
      <Button variant="link" onClick={() => router.back()} className="mb-4">
        &larr; Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Edit Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Image Section */}
            <div className="space-y-4">
              <div className="bg-black rounded-2xl overflow-hidden">
                <div className="aspect-[4/3] relative">
                  {images.length > 0 && (
                    <>
                      {/\.(jpg|jpeg|png|gif|webp)$/i.test(images[currentImageIndex]?.image_url || images[currentImageIndex]?.url || "") ? (
                        <img
                          src={images[currentImageIndex]?.image_url || images[currentImageIndex]?.url}
                          className="w-full h-full object-contain"
                          alt="Current item"
                        />
                      ) : (
                        <video
                          src={images[currentImageIndex]?.image_url || images[currentImageIndex]?.url}
                          controls
                          className="w-full h-full object-contain"
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </>
                  )}
                  {images.length > 1 && (
                    <div className="absolute inset-0 flex items-center justify-between p-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCurrentImageIndex((prev) => Math.max(0, prev - 1))
                        }
                        className="bg-black/20 text-white"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCurrentImageIndex((prev) =>
                            Math.min(images.length - 1, prev + 1)
                          )
                        }
                        className="bg-black/20 text-white"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4">
                <Reorder.Group
                  axis="x"
                  values={images}
                  onReorder={handleReorder}
                  className="flex gap-3 overflow-x-auto py-2 px-1"
                >
                  {images.map((image, index) => {
                    const imageUrl = image.image_url || image.url;
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(imageUrl || "");

                    return (
                      <Reorder.Item
                        key={image.id || image.filepath || imageUrl}
                        value={image}
                        className={cn(
                          "relative flex-shrink-0 cursor-move group",
                          "rounded-lg overflow-hidden",
                          index === currentImageIndex ? "ring-2 ring-red-500" : ""
                        )}
                        dragListener={true}
                        whileDrag={{
                          scale: 1.05,
                          cursor: "grabbing",
                        }}
                      >
                        <div
                          onClick={() => setCurrentImageIndex(index)}
                          className="w-20 h-20 relative z-10"
                        >
                          {isImage ? (
                            <img
                              src={imageUrl}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                              draggable={false}
                            />
                          ) : (
                            <video
                              src={imageUrl}
                              controls
                              className="w-full h-full object-contain rounded-lg pointer-events-none"
                              draggable={false}
                            >
                              Your browser does not support the video tag.
                            </video>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 
                            group-hover:opacity-100 transition-opacity duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(index);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Add Photos
              </Button>
            </div>

            {/* Form Section */}
            <div className="space-y-4">
              <div>
                <Label>Item Name</Label>
                <Input
                  value={itemDetails.name}
                  onChange={(e) =>
                    setItemDetails((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className={cn(fieldErrors.name && "border-red-500")}
                />
                {fieldErrors.name && (
                  <p className="text-sm text-red-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={itemDetails.description}
                  onChange={(e) =>
                    setItemDetails((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label>Price (£)</Label>
                <Input
                  type="text"
                  value={itemDetails.price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                      setItemDetails(prev => ({
                        ...prev,
                        price: value
                      }))
                    }
                  }}
                  className={cn(fieldErrors.price && "border-red-500")}
                />
                {fieldErrors.price && (
                  <p className="text-sm text-red-500 mt-1">{fieldErrors.price}</p>
                )}
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="text"
                  value={itemDetails.quantity}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d+$/.test(value)) {
                      setItemDetails(prev => ({
                        ...prev,
                        quantity: value
                      }))
                    }
                  }}
                />
              </div>

              {/* Category Selectors */}
              <div className="space-y-4">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={selectedCategories.level1}
                    onValueChange={(value) =>
                      setSelectedCategories({
                        ...selectedCategories,
                        level1: value,
                      })
                    }
                  >
                    <SelectTrigger className={cn(fieldErrors.category && "border-red-500")}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {level1Categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.category && (
                    <p className="text-sm text-red-500 mt-1">{fieldErrors.category}</p>
                  )}
                </div>

                {selectedCategories.level1 && level2Categories.length > 0 && (
                  <div>
                    <Label>Subcategory</Label>
                    <Select
                      value={selectedCategories.level2}
                      onValueChange={(value) =>
                        setSelectedCategories({
                          ...selectedCategories,
                          level2: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {level2Categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedCategories.level2 && level3Categories.length > 0 && (
                  <div>
                    <Label>Sub-Subcategory</Label>
                    <Select
                      value={selectedCategories.level3}
                      onValueChange={(value) =>
                        setSelectedCategories({
                          ...selectedCategories,
                          level3: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sub-subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {level3Categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Condition and Size */}
              <div className="space-y-8">
                <div>
                  <Label>Condition</Label>
                  <div className="grid grid-cols-5 gap-3 mt-3">
                    {conditionOptions.map(({ value, icon: Icon }) => (
                      <Button
                        key={value}
                        variant="outline"
                        onClick={() =>
                          setItemDetails({ ...itemDetails, condition: value })
                        }
                        className={cn(
                          "flex flex-col items-center py-3 h-auto transition-all",
                          "hover:border-blue-500/50 hover:bg-blue-500/10",
                          itemDetails.condition === value &&
                            "border-blue-500 bg-blue-500/20 text-blue-600"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5 mb-1",
                            itemDetails.condition === value
                              ? "text-blue-500"
                              : "text-gray-500"
                          )}
                        />
                        <span className="text-sm">{value}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Size</Label>
                  <div className="flex justify-between gap-2 mt-3">
                    {["XS", "S", "M", "L", "XL", "XXL"].map((sizeOption) => (
                      <Button
                        key={sizeOption}
                        variant="outline"
                        onClick={() =>
                          setItemDetails({ ...itemDetails, size: sizeOption })
                        }
                        className={cn(
                          "flex-1 transition-all",
                          "hover:border-blue-500/50 hover:bg-blue-500/10",
                          itemDetails.size === sizeOption &&
                            "border-blue-500 bg-blue-500/20 text-blue-600"
                        )}
                      >
                        {sizeOption}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Availability Toggles */}
              <div className="space-y-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="store-availability"
                    className="cursor-pointer"
                  >
                    Available in Store
                  </Label>
                  <Switch
                    id="store-availability"
                    checked={itemDetails.availableInStore}
                    onCheckedChange={(e) =>
                      setItemDetails({
                        ...itemDetails,
                        availableInStore: e,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="paperclip-listing"
                    className="text-gray-700 dark:text-gray-300"
                  >
                    List on Paperclip
                  </Label>
                  <Switch
                    id="paperclip-listing"
                    checked={true}
                    className="pointer-events-none opacity-50 data-[state=checked]:bg-green-500"
                  />
                </div>
              </div>

              {fieldErrors.images && (
                <p className="text-sm text-red-500 mt-1">{fieldErrors.images}</p>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing}
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    "Analyzing..."
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      AI Optimize
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
