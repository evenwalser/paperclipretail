"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import InitialView from "./InitialView";
import CameraView from "./CameraView";
import ReviewView from "./ReviewView";
import DetailsView from "./DetailsView";
import { analyzeImage } from "@/lib/together";

type ViewState = "initial" | "camera" | "review" | "details";

interface ImageFile {
  url: string;
  file: File | null;
  filepath: string | null;
}

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface DuplicateItemData {
  title: string;
  description: string;
  price: string;
  category_id: string;
  condition: string;
  size: string;
  available_in_store: boolean;
  list_on_paperclip: boolean;
  quantity: string;
  images: ImageFile[];
}

export default function AddItemPage() {
  const router = useRouter();
  const supabase = createClient();

  // State management
  const [currentView, setCurrentView] = useState<ViewState>("initial");
  const [images, setImages] = useState<ImageFile[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [brandSuggestions, setBrandSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputMethod, setInputMethod] = useState<"camera" | "fileSelect">(
    "camera"
  );
  const [itemDetails, setItemDetails] = useState({
    name: "",
    description: "",
    price: "",
    condition: "",
    quantity: "1",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState({
    level1: "",
    level2: "",
    level3: "",
  });
  const [isPrePopulated, setIsPrePopulated] = useState(false);
  const [condition, setCondition] = useState<
    "New" | "Like New" | "Very Good" | "Good" | "Fair"
  >("New");
  const [size, setSize] = useState("");
  const [brand, setBrand] = useState("");
  const [age, setAge] = useState("");
  const [color, setColor] = useState("");
  const [availableInStore, setAvailableInStore] = useState(true);
  const [listOnPaperclip, setListOnPaperclip] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    price: "",
    images: "",
    category: "",
    quantity: "",
  });
  const [hasShownRecommendations, setHasShownRecommendations] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user and categories on mount
  useEffect(() => {
    const getSessionAndStore = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();
        setUser(userData);
      }
    };
    getSessionAndStore();

    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) console.error("Error fetching categories:", error);
      else setCategories(data);
    };
    fetchCategories();
  }, []);

  // Handle duplicate item
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const duplicateItemId = searchParams.get("duplicate");
    if (duplicateItemId) {
      setIsDuplicating(true);
      fetchItemDetails(duplicateItemId);
    }
  }, []);

  // Clean up image URLs on unmount or images change
  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
      });
    };
  }, [images]);

  // Reset lower-level categories when higher-level changes
  useEffect(() => {
    if (isPrePopulated) return;
    setSelectedCategories((prev) => ({ ...prev, level2: "", level3: "" }));
  }, [selectedCategories.level1]);

  useEffect(() => {
    if (isPrePopulated) return;
    setSelectedCategories((prev) => ({ ...prev, level3: "" }));
  }, [selectedCategories.level2]);

  const startCamera = async () => {
    setCurrentView("camera");
  };

  const handleBrandChange = async (value: string) => {
    setBrand(value);
    if (value.length > 2) {
      // Fetch only if input is at least 3 characters
      try {
        const response = await fetch(
          `/api/logo-search?q=${encodeURIComponent(value)}`
        );
        if (!response.ok) throw new Error("Failed to fetch brand suggestions");
        const data = await response.json();
        setBrandSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching brand suggestions:", error);
        setBrandSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setBrandSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleBrandSelect = (selectedBrand: any) => {
    setBrand(selectedBrand.name);
    setLogoUrl(selectedBrand.logo_url || "");
    setShowSuggestions(false);
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files?.length) return;

    try {
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const filePath = `review/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("item-images")
            .upload(filePath, file, { cacheControl: "3600", upsert: true });
          if (uploadError) throw uploadError;
          const {
            data: { publicUrl },
          } = supabase.storage.from("item-images").getPublicUrl(filePath);
          return { url: publicUrl, file, filepath: filePath };
        })
      );
      setImages((prev) => [...prev, ...newImages]);
      setCurrentImageIndex(0);
      setCurrentView("review");
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error("Failed to process images. Please try again.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (images.length > 0 && !hasShownRecommendations) {
      showImageRecommendations();
    } else if (images.length === 0) {
      setHasShownRecommendations(false);
    }
  }, [images.length, hasShownRecommendations]);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const showImageRecommendations = async () => {
    if (hasShownRecommendations) return;

    const recommendedMessages = [
      "Tip 1: Capture the full beauty of your item! A complete view from the front, back, and sides helps buyers appreciate every detail.",
      "Tip 2: Zoom in on unique features like tags, logos, or textures to highlight what makes your item special.",
      "Tip 3: Use a top-down shot to clearly showcase the overall layout and condition of your item.",
      "Tip 4: If there are any imperfections or signs of wear, a close-up image can build trust by showing transparency.",
    ];

    for (const message of recommendedMessages) {
      toast.success(message, { duration: 3500 });
      await delay(3500);
    }

    setHasShownRecommendations(true);
  };
  const removeImage = async (index: number) => {
    const imageToRemove = images[index];
    if (!imageToRemove) return;

    if (imageToRemove.url.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.url);
    } else if (imageToRemove.filepath) {
      const { error } = await supabase.storage
        .from("item-images")
        .remove([imageToRemove.filepath]);
      if (error) console.error("Error deleting file:", error);
    }

    setImages((prev) => {
      const newImages = prev.filter((_, i) => i !== index);
      if (currentImageIndex >= newImages.length)
        setCurrentImageIndex(Math.max(0, newImages.length - 1));
      return newImages;
    });
  };

  const handleReorder = (newOrder: ImageFile[]) => {
    const selectedImage = images[currentImageIndex];
    setImages(newOrder);
    const newIndex = newOrder.findIndex((img) => img.url === selectedImage.url);
    setCurrentImageIndex(newIndex);
  };

  const handleAIAnalysis = async () => {
    if (!images.length) {
      toast.error("Please add at least one image to analyze");
      return;
    }
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      for (const image of images) {
        if (!isImageFile(image.url)) continue;
        const filePath = `temp/${Date.now()}-${crypto.randomUUID()}.jpg`;
        const fileData = image.file || (await (await fetch(image.url)).blob());
        const { error } = await supabase.storage
          .from("item-images")
          .upload(filePath, fileData, { cacheControl: "3600", upsert: true });
        if (error) throw error;
        const {
          data: { publicUrl },
        } = supabase.storage.from("item-images").getPublicUrl(filePath);
        formData.append("image", publicUrl);
      }

      const result = await analyzeImage(formData);
      const dataObject =
        extractJson(result?.data?.choices?.[0]?.message?.content) || {};

      setItemDetails((prev) => ({
        ...prev,
        name: dataObject.title || prev.name,
        description: dataObject.description || prev.description,
        price: dataObject.price_avg?.toString() || prev.price,
      }));
      setCondition(dataObject.condition || "New");
      setBrand(dataObject.brand || ""); // Added to set brand from AI response
      setColor(dataObject.color || "");
      setSuggestedTags(dataObject.tags || []);
      setSelectedTags(dataObject.tags || []);

      if (dataObject.category_id) {
        const categoryNames = dataObject.category_id.split(" > ");
        const level1 = categories.find((cat) => cat.name === categoryNames[0]);
        const level2 = categories.find(
          (cat) => cat.name === categoryNames[1] && cat.parent_id === level1?.id
        );
        const level3 = categories.find(
          (cat) => cat.name === categoryNames[2] && cat.parent_id === level2?.id
        );
        setIsPrePopulated(true);
        setSelectedCategories({
          level1: level1?.id || "",
          level2: level2?.id || "",
          level3: level3?.id || "",
        });
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      toast.error("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isImageFile = (url: string) => {
    if (url.startsWith("data:")) {
      return url.includes("image/");
    }
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const handleSubmit = async () => {
    setFieldErrors({
      name: "",
      price: "",
      images: "",
      category: "",
      quantity: "",
    });
    let hasErrors = false;
    const newErrors = {
      name: "",
      price: "",
      images: "",
      category: "",
      quantity: "",
    };

    if (!itemDetails.name.trim()) {
      newErrors.name = "Item name is required";
      hasErrors = true;
    }
    const priceNum = parseFloat(itemDetails.price);
    if (!itemDetails.price || isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = "Valid price is required";
      hasErrors = true;
    }
    const quantityNum = parseInt(itemDetails.quantity);
    if (!itemDetails.quantity || isNaN(quantityNum) || quantityNum < 1) {
      newErrors.quantity = "Quantity must be at least 1";
      hasErrors = true;
    }
    const filteredImages = images.filter((img) => isImageFile(img.url));
    if (filteredImages.length === 0) {
      newErrors.images = "At least one image is required";
      hasErrors = true;
    }
    if (
      !selectedCategories.level1 ||
      !selectedCategories.level2 ||
      !selectedCategories.level3
    ) {
      newErrors.category = "Please select all category levels";
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      if (!user?.store_id)
        throw new Error("No store associated with this account");

      const category_id =
        selectedCategories.level3 ||
        selectedCategories.level2 ||
        selectedCategories.level1;
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          title: itemDetails.name.trim(),
          description: itemDetails.description.trim(),
          price: priceNum,
          category_id,
          condition,
          size,
          brand,
          logo_url: logoUrl,
          age,
          color,
          available_in_store: availableInStore,
          list_on_paperclip: listOnPaperclip,
          store_id: user.store_id,
          created_by: user.id,
          quantity: quantityNum,
          duplicated_from: isDuplicating
            ? new URLSearchParams(window.location.search).get("duplicate")
            : null,
          tags: selectedTags,
        })

        .select()
        .single();
      console.log("🚀 ~ handleSubmit ~ logoUrl:", logoUrl);
      if (itemError) throw itemError;

      const imageUploads = await Promise.all(
        images.map(async (image, index) => {
          let fileExt;
          if (image.url.startsWith("data:")) {
            const mimeType = image.url.split(";")[0].split(":")[1];
            switch (mimeType) {
              case "image/jpeg":
                fileExt = "jpg";
                break;
              case "image/png":
                fileExt = "png";
                break;
              default:
                fileExt = "jpg"; // Default to jpg
            }
          } else {
            fileExt = image.url.split(".").pop() || "jpg";
          }
          const fileName = `${user.id}/${
            item.id
          }/${crypto.randomUUID()}.${fileExt}`;
          const fileData =
            image.file || (await (await fetch(image.url)).blob());
          const contentType = image.file
            ? image.file.type
            : image.url.startsWith("data:")
            ? image.url.split(";")[0].split(":")[1]
            : "image/jpeg";
          const { error } = await supabase.storage
            .from("item-images")
            .upload(fileName, fileData, {
              cacheControl: "3600",
              upsert: false,
              contentType: contentType,
            });
          if (error) throw error;
          const {
            data: { publicUrl },
          } = supabase.storage.from("item-images").getPublicUrl(fileName);
          return {
            item_id: item.id,
            image_url: publicUrl,
            display_order: index,
          };
        })
      );

      if (imageUploads.length > 0) {
        const { error } = await supabase
          .from("item_images")
          .insert(imageUploads);
        if (error) throw error;
      }

      images.forEach((image) => URL.revokeObjectURL(image.url));
      toast.success("Item added successfully!");
      router.push("/inventory");
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchItemDetails = async (itemId: string) => {
    try {
      setCurrentView("details");
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });
      if (categoriesError) throw categoriesError;

      const { data: item, error: itemError } = await supabase
        .from("items")
        .select("*, categories:category_id (id, name, parent_id)")
        .eq("id", itemId)
        .single();
      if (itemError) throw itemError;

      const { data: imageData, error: imageError } = await supabase
        .from("item_images")
        .select("*")
        .eq("item_id", itemId)
        .order("display_order");
      if (imageError) throw imageError;

      const processedImages = await Promise.all(
        imageData.map(async (img) => {
          const response = await fetch(img.image_url);
          const blob = await response.blob();
          const file = new File([blob], `duplicate-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          return {
            url: img.image_url,
            file,
            filepath: `duplicate/${Date.now()}-${file.name}`,
          };
        })
      );

      const findCategoryHierarchy = (categoryId: string) => {
        const hierarchy = { level1: "", level2: "", level3: "" };
        const currentCategory = categoriesData.find(
          (cat) => cat.id === categoryId
        );
        if (!currentCategory) return hierarchy;

        if (!currentCategory.parent_id) {
          hierarchy.level1 = currentCategory.id;
        } else {
          const parent = categoriesData.find(
            (cat) => cat.id === currentCategory.parent_id
          );
          if (!parent) return hierarchy;
          if (!parent.parent_id) {
            hierarchy.level1 = parent.id;
            hierarchy.level2 = currentCategory.id;
          } else {
            const grandparent = categoriesData.find(
              (cat) => cat.id === parent.parent_id
            );
            if (grandparent) {
              hierarchy.level1 = grandparent.id;
              hierarchy.level2 = parent.id;
              hierarchy.level3 = currentCategory.id;
            }
          }
        }
        return hierarchy;
      };

      setCategories(categoriesData);
      const categoryHierarchy = findCategoryHierarchy(item.category_id);
      setSelectedCategories(categoryHierarchy);
      setIsPrePopulated(true);

      setItemDetails({
        name: item.title,
        description: item.description,
        price: item.price.toString(),
        quantity: item.quantity.toString(),
        condition: item.condition || "",
      });
      setCondition(item.condition);
      setSize(item.size);
      setAge(item.age);
      setBrand(item.brand);
      setColor(item.color);
      setAvailableInStore(item.available_in_store);
      setListOnPaperclip(item.list_on_paperclip);
      setImages(processedImages);
      setSelectedTags(item.tags || []);
    } catch (error) {
      console.error("Error fetching item details:", error);
      toast.error("Failed to load item details for duplication");
    } finally {
      setIsDuplicating(false);
    }
  };

  const extractJson = (response: string) => {
    try {
      const jsonStart = response.indexOf("{");
      const jsonEnd = response.lastIndexOf("}") + 1;
      if (jsonStart === -1 || jsonEnd === -1)
        throw new Error("No valid JSON found");
      const jsonString = response.substring(jsonStart, jsonEnd).trim();
      const jsonObject = JSON.parse(jsonString);
      if (typeof jsonObject !== "object" || jsonObject === null)
        throw new Error("Not a valid JSON object");
      return jsonObject;
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return {};
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader className="flex justify-center items-center space-x-2 mb-4 text-4xl">
          <CardTitle>Add New Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-2xl mx-auto">
            {currentView === "initial" && (
              <InitialView
                onCameraClick={() => {
                  setInputMethod("camera");
                  startCamera();
                }}
                onFileSelectClick={() => {
                  setInputMethod("fileSelect");
                  fileInputRef.current?.click();
                }}
              />
            )}
            {currentView === "camera" && (
              <CameraView
                images={images}
                onAddImage={(newImage) =>
                  setImages((prev) => [...prev, newImage])
                }
                onRemoveImage={removeImage}
                onDone={() => setCurrentView("review")}
                isFlashing={isFlashing}
                setIsFlashing={setIsFlashing}
              />
            )}
            {currentView === "review" && (
              <ReviewView
                images={images}
                currentImageIndex={currentImageIndex}
                onReorder={handleReorder}
                onRemove={removeImage}
                onSelect={setCurrentImageIndex}
                onAddMore={() => {
                  if (inputMethod === "camera") startCamera();
                  else fileInputRef.current?.click();
                }}
                onContinue={() => setCurrentView("details")}
              />
            )}
            {currentView === "details" && (
              <DetailsView
                images={images}
                currentImageIndex={currentImageIndex}
                onNavigate={setCurrentImageIndex}
                itemDetails={itemDetails}
                onItemDetailsChange={setItemDetails}
                categories={categories}
                selectedCategories={selectedCategories}
                onCategoryChange={setSelectedCategories}
                condition={condition}
                onConditionChange={(value) =>
                  setCondition(
                    value as "New" | "Like New" | "Very Good" | "Good" | "Fair"
                  )
                }
                size={size}
                onSizeChange={setSize}
                brand={brand}
                onBrandChange={handleBrandChange}
                age={age}
                onAgeChange={setAge}
                color={color}
                onColorChange={setColor}
                availableInStore={availableInStore}
                onAvailableInStoreChange={setAvailableInStore}
                listOnPaperclip={listOnPaperclip}
                onListOnPaperclipChange={setListOnPaperclip}
                onSubmit={handleSubmit}
                isSaving={isSaving}
                fieldErrors={fieldErrors}
                isAnalyzing={isAnalyzing}
                onAIAnalysis={handleAIAnalysis}
                logoUrl={logoUrl}
                brandSuggestions={brandSuggestions}
                showSuggestions={showSuggestions}
                onBrandSelect={handleBrandSelect}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
