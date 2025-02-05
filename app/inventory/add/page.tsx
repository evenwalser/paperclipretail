"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { User } from "next-auth";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Camera, Upload, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reorder } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyzeImage } from "@/lib/together";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import { Sparkles, Star, ThumbsUp, Check, AlertCircle } from "lucide-react";
// import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { CategorySelectorV2 } from "@/components/CategorySelectorV2";

// Define our view states
type ViewState = "initial" | "camera" | "fileSelect" | "review" | "details";

// Define interfaces
interface ImageFile {
  url: string;
  file?: File;
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

interface NewItem {
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory1?: string;
  subcategory2?: string;
  condition: string;
  size?: string;
  status: "available" | "low_stock" | "out_of_stock";
  available_in_store: boolean;
  list_on_paperclip: boolean;
}

export default function AddItemPage() {
  const router = useRouter();
  // State management
  const [currentView, setCurrentView] = useState<ViewState>("initial");
  const [images, setImages] = useState<ImageFile[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  //  const [user, setUser] = useState<any>(null);
  const [storeId, setStoreId] = useState<any>(null);
  const [inputMethod, setInputMethod] = useState<"camera" | "fileSelect">(
    "camera"
  );

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = createClient();
  // Add these states for the form
  const [itemDetails, setItemDetails] = useState({
    name: "",
    description: "",
    price: "",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState({
    level1: "",
    level2: "",
    level3: "",
  });

  const [condition, setCondition] = useState<
    "New" | "Like New" | "Very Good" | "Good" | "Fair"
  >("New");
  const [size, setSize] = useState("");
  const [availableInStore, setAvailableInStore] = useState(true);
  const [listOnPaperclip, setListOnPaperclip] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const getSessionAndStore = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // setUser(user);
      console.log("User:", user);
      if (user) {
        // Fetch existing store data
        const { data: userData, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();
        console.log("User data:", userData);
        if (userData) {
          setUser(userData);
        }
      }
    };
    getSessionAndStore();
  }, []);

  // Camera handlers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Unable to access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.url.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, [images]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setImages((prev) => [...prev, { url: imageDataUrl }]);
    } catch (error) {
      console.error("Error capturing photo:", error);
      alert("Failed to capture photo. Please try again.");
    }
  };

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) {
        console.error("Error fetching categories:", error);
      } else {
        setCategories(data);
        console.log("here is the cetegories data", data);
      }
    }
    fetchCategories();
  }, []);

  // Filter for top-level categories: parent_id is null
  const level1Categories = categories.filter((cat) => !cat.parent_id);

  // Filter for level 2: parent_id matches the selected level1 id
  const level2Categories = categories.filter(
    (cat) => cat.parent_id === selectedCategories.level1
  );

  // Filter for level 3: parent_id matches the selected level2 id
  const level3Categories = categories.filter(
    (cat) => cat.parent_id === selectedCategories.level2
  );

  // If a higher-level category is changed, reset the lower levels.
  useEffect(() => {
    // When level1 changes, clear level2 and level3.
    setSelectedCategories((prev) => ({ ...prev, level2: "", level3: "" }));
  }, [selectedCategories.level1]);

  useEffect(() => {
    // When level2 changes, clear level3.
    setSelectedCategories((prev) => ({ ...prev, level3: "" }));
  }, [selectedCategories.level2]);

  // File handlers
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsProcessing(true);
    try {
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const url = URL.createObjectURL(file);
          return { url, file };
        })
      );

      setImages((prev) => [...prev, ...newImages]);
      setCurrentImageIndex(0);
      setCurrentView("review");
    } catch (error) {
      console.error("Error processing files:", error);
      alert("Failed to process images. Please try again.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Review handlers
  const removeImage = (index: number) => {
    setImages((prev) => {
      const removedImage = prev[index];
      if (removedImage.url.startsWith("blob:")) {
        URL.revokeObjectURL(removedImage.url);
      }
      const newImages = prev.filter((_, i) => i !== index);
      if (currentImageIndex >= newImages.length) {
        setCurrentImageIndex(Math.max(0, newImages.length - 1));
      }
      return newImages;
    });
  };

  const handleDone = () => {
    stopCamera();
    setCurrentView("review");
  };

  const handleReorder = (newOrder: ImageFile[]) => {
    // Find the currently selected image
    const selectedImage = images[currentImageIndex];

    // Update the images array
    setImages(newOrder);

    // Update the current index to maintain selection
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
      const currentImage = images[currentImageIndex];
      console.log("Starting AI analysis for image:", {
        index: currentImageIndex,
        type: typeof currentImage,
        isBase64: currentImage.url.startsWith("data:"),
      });

      const result = await analyzeImage(currentImage.url);

      // Update form with AI results
      setItemDetails((prev) => ({
        ...prev,
        name: result.title || prev.name,
        description: result.description || prev.description,
        price: result.price_avg?.toString() || prev.price,
        category: result.category_id || prev.category,
      }));

      // Update categories if provided
      if (result.category_id) {
        setSelectedCategories((prev) => ({
          ...prev,
          level1: result.category_id,
        }));
      }

      // Update condition if provided
      if (result.condition) {
        setCondition(
          result.condition as "New" | "Like New" | "Very Good" | "Good" | "Fair"
        );
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      alert("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);

      if (!user?.store_id) {
        toast.error("No store associated with this account");
        return;
      }

      // 1. First create the item record
      const category_id =
        selectedCategories.level3 ||
        selectedCategories.level2 ||
        selectedCategories.level1;

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          title: itemDetails.name,
          description: itemDetails.description,
          price: parseFloat(itemDetails.price) || 0,
          category_id,
          condition,
          size,
          available_in_store: availableInStore,
          list_on_paperclip: true,
          store_id: user?.store_id,
          created_by: user?.id,
          status: "available",
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // 2. Upload images to storage and create image records
      const imageUploads = await Promise.all(
        images.map(async (image, index) => {
          // Generate unique filename
          const fileName = `${item.id}/${crypto.randomUUID()}`;
          let fileData: Blob;

          if (image.file) {
            fileData = image.file;
          } else {
            // Convert base64 to blob for camera images
            const response = await fetch(image.url);
            fileData = await response.blob();
          }

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
            image_url: fileName, // Store path instead of full URL
            display_order: index,
          };
        })
      );

      // 3. Insert image records
      const { error: imageError } = await supabase
        .from("item_images")
        .insert(imageUploads);

      if (imageError) throw imageError;

      // 4. Cleanup temporary URLs
      images.forEach((image) => URL.revokeObjectURL(image.url));
      toast.success("Item added successfully!");
      router.push("/inventory");
    } catch (error) {
      console.error("Error saving item:", error);
      alert("Failed to save item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Update getImageUrl function
  const getImageUrl = (path: string) => {
    return supabase.storage.from("item-images").getPublicUrl(path).data
      .publicUrl;
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-2xl mx-auto">
            {currentView === "initial" && (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-32 text-lg"
                  onClick={() => {
                    setInputMethod("camera");
                    setCurrentView("camera");
                    startCamera();
                  }}
                >
                  <Camera className="mr-2 h-6 w-6" />
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  className="h-32 text-lg"
                  onClick={() => {
                    setInputMethod("fileSelect");
                    setCurrentView("fileSelect");
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload className="mr-2 h-6 w-6" />
                  Choose Photo
                </Button>
              </div>
            )}

            {/* Camera View */}
            {currentView === "camera" && (
              <div className="space-y-4">
                <div className="bg-black rounded-2xl overflow-hidden">
                  <div className="aspect-[4/3] relative">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {isFlashing && (
                      <div className="absolute inset-0 bg-white z-50 animate-flash" />
                    )}

                    {/* Capture Button */}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                      <Button
                        onClick={capturePhoto}
                        className="w-16 h-16 rounded-full bg-white hover:bg-gray-100"
                      >
                        <div className="w-12 h-12 rounded-full border-4 border-black" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Thumbnails */}
                {images.length > 0 && (
                  <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex gap-3 overflow-x-auto py-2 px-1">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="relative flex-shrink-0 group"
                        >
                          <div
                            className="w-20 h-20 rounded-lg overflow-hidden border-2 border-transparent 
                                      hover:border-white/25 transition-all duration-200"
                          >
                            <img
                              src={image.url}
                              alt={`Capture ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 
                                       group-hover:opacity-100 transition-opacity duration-200"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Done Button */}
                <Button
                  onClick={handleDone}
                  variant="outline"
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            )}

            {/* Review View */}
            {currentView === "review" && (
              <div className="space-y-6">
                {/* Main Carousel */}
                <div className="bg-black rounded-2xl overflow-hidden">
                  <div className="aspect-[4/3] relative">
                    <img
                      src={images[currentImageIndex]?.url}
                      alt={`Photo ${currentImageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />

                    {/* Navigation Arrows */}
                    {images.length > 1 && (
                      <div className="absolute inset-0 flex items-center justify-between p-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev === 0 ? images.length - 1 : prev - 1
                            )
                          }
                          className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 text-white"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev === images.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 text-white"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </div>
                    )}

                    {/* Image Counter */}
                    <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </div>
                </div>

                {/* Thumbnails */}
                <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4">
                  <Reorder.Group
                    axis="x"
                    values={images}
                    onReorder={handleReorder}
                    className="flex gap-3 overflow-x-auto py-2 px-1"
                  >
                    {images.map((image, index) => (
                      <Reorder.Item
                        key={image.url}
                        value={image}
                        className={cn(
                          "relative flex-shrink-0 cursor-move group",
                          "rounded-lg overflow-hidden",
                          index === currentImageIndex
                            ? "ring-2 ring-red-500"
                            : ""
                        )}
                        dragListener={true}
                        whileDrag={{
                          scale: 1.05,
                          cursor: "grabbing",
                        }}
                      >
                        <div
                          onClick={() => setCurrentImageIndex(index)}
                          className="w-20 h-20 relative"
                        >
                          <img
                            src={image.url}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                            draggable={false}
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 
                                     group-hover:opacity-100 transition-opacity duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(index);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (inputMethod === "camera") {
                        setCurrentView("camera");
                        startCamera();
                      } else {
                        setCurrentView("fileSelect");
                        fileInputRef.current?.click();
                      }
                    }}
                    className="flex-1"
                  >
                    {inputMethod === "camera" ? (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Take More Photos
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Choose More Photos
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentView("details")}
                    className="flex-1"
                  >
                    Continue to Details
                  </Button>
                </div>
              </div>
            )}

            {/* Details View */}
            {currentView === "details" && (
              <div className="space-y-6">
                {/* Smaller Image Carousel */}
                <div className="h-[300px] bg-black rounded-2xl overflow-hidden">
                  <div className="relative h-full">
                    <img
                      src={images[currentImageIndex]?.url}
                      alt={`Photo ${currentImageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                    {/* Navigation Arrows */}
                    {images.length > 1 && (
                      <div className="absolute inset-0 flex items-center justify-between p-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev === 0 ? images.length - 1 : prev - 1
                            )
                          }
                          className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 text-white"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setCurrentImageIndex((prev) =>
                              prev === images.length - 1 ? 0 : prev + 1
                            )
                          }
                          className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/40 text-white"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </Button>
                      </div>
                    )}
                    {/* Image Counter */}
                    <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </div>
                </div>

                {/* AI Analysis Button */}
                <Button
                  onClick={handleAIAnalysis}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 
                             hover:from-purple-700 hover:to-blue-700 text-white"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/60 border-t-white mr-2" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg mr-2">🤖</span>
                      <span>Analyze with AI</span>
                    </>
                  )}
                </Button>

                {/* Form Fields */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Item Name</Label>
                      <Input
                        id="name"
                        value={itemDetails.name}
                        onChange={(e) =>
                          setItemDetails((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Enter item name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={itemDetails.description}
                        onChange={(e) =>
                          setItemDetails((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Enter item description"
                        className="h-32"
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price (£)</Label>
                      <Input
                        id="price"
                        type="number"
                        value={itemDetails.price}
                        onChange={(e) =>
                          setItemDetails((prev) => ({
                            ...prev,
                            price: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        step="0.01"
                        min="0.01"
                      />
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={selectedCategories.level1}
                        onValueChange={(value) =>
                          setSelectedCategories((prev) => ({
                            ...prev,
                            level1: value,
                          }))
                        }
                      >
                        <SelectTrigger>
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
                    </div>
                    {selectedCategories.level1 &&
                      level2Categories.length > 0 && (
                        <div>
                          <Label htmlFor="subcategory">Subcategory</Label>
                          <Select
                            value={selectedCategories.level2}
                            onValueChange={(value) =>
                              setSelectedCategories((prev) => ({
                                ...prev,
                                level2: value,
                              }))
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
                    {selectedCategories.level2 &&
                      level3Categories.length > 0 && (
                        <div>
                          <Label htmlFor="subsubcategory">
                            Sub-Subcategory
                          </Label>
                          <Select
                            value={selectedCategories.level3}
                            onValueChange={(value) =>
                              setSelectedCategories((prev) => ({
                                ...prev,
                                level3: value,
                              }))
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
                        {[
                          { value: "New", icon: Sparkles },
                          { value: "Like New", icon: Star },
                          { value: "Very Good", icon: ThumbsUp },
                          { value: "Good", icon: Check },
                          { value: "Fair", icon: AlertCircle },
                        ].map(({ value, icon: Icon }) => (
                          <Button
                            key={value}
                            variant="outline"
                            onClick={() => setCondition(value)}
                            className={cn(
                              "flex flex-col items-center py-3 h-auto transition-all",
                              "hover:border-blue-500/50 hover:bg-blue-500/10",
                              condition === value &&
                                "border-blue-500 bg-blue-500/20 text-blue-600"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-5 w-5 mb-1",
                                condition === value
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
                        {["XS", "S", "M", "L", "XL", "XXL"].map(
                          (sizeOption) => (
                            <Button
                              key={sizeOption}
                              variant="outline"
                              onClick={() => setSize(sizeOption)}
                              className={cn(
                                "flex-1 transition-all",
                                "hover:border-blue-500/50 hover:bg-blue-500/10",
                                size === sizeOption &&
                                  "border-blue-500 bg-blue-500/20 text-blue-600"
                              )}
                            >
                              {sizeOption}
                            </Button>
                          )
                        )}
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
                        checked={availableInStore}
                        onCheckedChange={setAvailableInStore}
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

                  {/* Submit Button */}
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={
                      isSaving ||
                      !itemDetails.name ||
                      !itemDetails.price ||
                      images.length === 0
                    }
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 text-lg py-6"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/60 border-t-white mr-2" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      "Add Item to Inventory"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {currentView === "fileSelect" && isProcessing && (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                  <span>Processing images...</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



