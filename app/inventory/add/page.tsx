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
    condition: "",
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
  const [availableInStore, setAvailableInStore] = useState(true);
  const [listOnPaperclip, setListOnPaperclip] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const currentMediaUrl = images[currentImageIndex]?.url;

  // Use a regex to check if the URL is an image
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(currentMediaUrl);

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
    if (isPrePopulated) return;
    // When level1 changes, clear level2 and level3
    setSelectedCategories((prev) => ({ ...prev, level2: "", level3: "" }));
  }, [selectedCategories.level1]);

  useEffect(() => {
    // When level2 changes, clear level3.
    if (isPrePopulated) return;
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
      // Process all selected files and upload each to Supabase
      const newImages = await Promise.all(
        Array.from(files).map(async (file) => {
          // Define a file path for storage (you may want to generate unique names)
          const filePath = `uploads/${Date.now()}/${file.name}`;

          // Upload the file to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from("item-images")
            .upload(filePath, file, { cacheControl: "3600", upsert: true });

          console.log("Upload error (if any):", uploadError);
          if (uploadError) throw uploadError;

          // Get the public URL for the uploaded file
          const {
            data: { publicUrl },
          } = supabase.storage.from("item-images").getPublicUrl(filePath);

          // Optionally, you can log or process the publicUrl further
          return { url: publicUrl, file };
        })
      );

      // Update your state with the new images (each now containing the Supabase public URL)
      setImages((prev) => [...prev, ...newImages]);
      // Note: logging "images" immediately after setImages may still log the old state
      console.log("newImages:", newImages);
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
  const removeImage = async (index: number) => {
    // Get the image to remove from the current state.
    const imageToRemove = images[index];
    if (!imageToRemove) return;

    // If the URL starts with "blob:" then it's a locally generated URL that we can revoke.
    if (imageToRemove.url.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.url);
    } else {
      // Otherwise, compute the file path (or use a stored filePath property if available)
      const filePath = `uploads/${
        imageToRemove?.file && imageToRemove?.file.name
      }`;

      // Remove the file from Supabase storage
      const { error: deleteError } = await supabase.storage
        .from("item-images")
        .remove([filePath]);
      if (deleteError) {
        console.error("Error deleting file from Supabase:", deleteError);
        // Optionally, you may decide whether to continue or abort removal.
      }
    }

    // Update state to remove the image from your local list
    setImages((prev) => {
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
  function extractJson(response) {
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
      console.log("here is my images ", images);
      const formData = new FormData();

      // Loop through all the images and append them to formData
      for (const image of images) {
       
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(image?.url);
        if(!isImage) continue;
        const file = image?.file;
   
        const filePath = `uploads/${file?.name}`;

        // Upload each image to Supabase storage
        // const { error: uploadError } = await supabase.storage
        //   .from("item-images")
        //   .upload(filePath, file, { cacheControl: "3600", upsert: true });

        // console.log("here is upload error", uploadError);
        // if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = await supabase.storage.from("item-images").getPublicUrl(filePath);
        console.log("here is publicUrl", publicUrl);
        console.log("Uploading image to AI:", { url: publicUrl });

        // Append the public URL for each image
        formData.append("image", publicUrl);
      }

      // Call AI analysis function with multiple images
      const result = await analyzeImage(formData);
      console.log("AI Analysis Result:", result);
      console.log(
        "here is result form api ",
        result?.data?.choices?.[0]?.message?.content
      );
      const dataObject =
        extractJson(result?.data?.choices?.[0]?.message?.content) || "{}";

      // Update form with AI results
      setItemDetails((prev) => ({
        ...prev,
        name: dataObject?.title || prev.name,
        description: dataObject?.description || prev.description,
        price: dataObject?.price_avg?.toString() || prev.price,
        // category: dataObject?.category_id.split(">") || prev.category,
      }));

      setCondition((prev) => dataObject.condition);

      if (dataObject.category_id) {
        const categoryNames = dataObject.category_id.split(" > ");

        // Find category IDs based on names
        const level1 = categories.find((cat) => cat.name === categoryNames[0]);
        const level2 = categories.find(
          (cat) => cat.name === categoryNames[1] && cat.parent_id === level1?.id
        );
        const level3 = categories.find(
          (cat) => cat.name === categoryNames[2] && cat.parent_id === level2?.id
        );

        // const level1 = '2d98fcb8-e081-4c3a-89cd-7a364b4aada4'
        // const level2 = 'b36478d7-9e10-4c5d-8839-c70dfa8f9aa0'
        // const level3 =  '46445967-02d5-41ec-abc5-9dcb080d7e20'

        console.log("here is categories names", categoryNames);
        console.log("here is level1 ", level1);
        console.log("here is level2 ", level2);
        console.log("here is level3 ", level3);
        setIsPrePopulated(true);
        setSelectedCategories({
          level1: level1?.id || "",
          level2: level2?.id || "",
          level3: level3?.id || "",
        });
        // setIsPrePopulated(false);
        console.log("here is selected categories ", selectedCategories);
        // setSelectedCategories({
        //   level1: level1?.id || "",
        //   level2: level2?.id || "",
        //   level3: level3?.id || "",
        // });
        // setIsPrePopulated(true);
      }

      // Update categories if provided
      // if (result.category_id) {
      //   setSelectedCategories((prev) => ({
      //     ...prev,
      //     level1: result.category_id,
      //   }));
      // }

      // // Update condition if provided
      // if (result.condition) {
      //   setCondition(result.condition);
      // }
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
                  Choose File
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
                    {isImage ? (
                      <img
                        src={currentMediaUrl}
                        alt={`Photo ${currentImageIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <video
                        src={currentMediaUrl}
                        controls
                        className="w-full h-full object-contain absolute z-10"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
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
                    {images.map((image, index) => {
                      // Determine if the media URL is for an image
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(
                        image.url
                      );

                      return (
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
                            className="w-20 h-20 relative z-10"
                          >
                            {isImage ? (
                              <img
                                src={image.url}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                                draggable={false}
                              />
                            ) : (
                              <video
                                src={image.url}
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
                                removeImage(index);
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

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (inputMethod === "camera") {
                        setCurrentView("camera");
                        startCamera();
                      } else {
                        // setCurrentView("fileSelect");
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
                        Choose More Files
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
                  {isImage ? (
                      <img
                        src={currentMediaUrl}
                        alt={`Photo ${currentImageIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <video
                        src={currentMediaUrl}
                        controls
                        autoPlay={true}
                        className="w-full h-full object-contain"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
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
                        onValueChange={(value) => {
                          if (isPrePopulated) setIsPrePopulated(false);
                          setSelectedCategories((prev) => ({
                            ...prev,
                            level1: value,
                          }));
                        }}
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
                            onValueChange={(value) => {
                              if (isPrePopulated) setIsPrePopulated(false);
                              setSelectedCategories((prev) => ({
                                ...prev,
                                level2: value,
                              }));
                            }}
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
                            onValueChange={(value) => {
                              if (isPrePopulated) setIsPrePopulated(false);
                              setSelectedCategories((prev) => ({
                                ...prev,
                                level3: value,
                              }));
                            }}
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

            {/* {currentView === "fileSelect" && isProcessing && (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                  <span>Processing images...</span>
                </div>
              </div>
            )} */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
