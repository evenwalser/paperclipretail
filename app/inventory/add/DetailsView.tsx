import { Button } from "@/components/ui/button";
import ImageCarousel from "./ImageCarousel";
import BasicInfoForm from "./BasicInfoForm";
import CategorySelector from "./CategorySelector";
import ConditionSelector from "./ConditionSelector";
import SizeSelector from "./SizeSelector";
import AvailabilityToggles from "./AvailabilityToggles";

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

interface DetailsViewProps {
  images: ImageFile[];
  currentImageIndex: number;
  onNavigate: (index: number) => void;
  itemDetails: { name: string; description: string; price: string; condition: string; quantity: string };
  onItemDetailsChange: (details: { name: string; description: string; price: string; condition: string; quantity: string }) => void;
  categories: Category[];
  selectedCategories: { level1: string; level2: string; level3: string };
  onCategoryChange: (categories: { level1: string; level2: string; level3: string }) => void;
  condition: string;
  onConditionChange: (condition: string) => void;
  size: string;
  onSizeChange: (size: string) => void;
  availableInStore: boolean;
  onAvailableInStoreChange: (value: boolean) => void;
  listOnPaperclip: boolean;
  onListOnPaperclipChange: (value: boolean) => void;
  onSubmit: () => void;
  isSaving: boolean;
  fieldErrors: { name: string; price: string; images: string; category: string; quantity: string };
  isAnalyzing: boolean;
  onAIAnalysis: () => void;
}

export default function DetailsView({
  images,
  currentImageIndex,
  onNavigate,
  itemDetails,
  onItemDetailsChange,
  categories,
  selectedCategories,
  onCategoryChange,
  condition,
  onConditionChange,
  size,
  onSizeChange,
  availableInStore,
  onAvailableInStoreChange,
  listOnPaperclip,
  onListOnPaperclipChange,
  onSubmit,
  isSaving,
  fieldErrors,
  isAnalyzing,
  onAIAnalysis,
}: DetailsViewProps) {
  return (
    <div className="space-y-6">
      <div className="h-[300px] bg-black rounded-2xl overflow-hidden">
        <ImageCarousel images={images} currentIndex={currentImageIndex} onNavigate={onNavigate} />
      </div>
      <Button
        onClick={onAIAnalysis}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
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
      <BasicInfoForm itemDetails={itemDetails} onChange={onItemDetailsChange} fieldErrors={fieldErrors} />
      <CategorySelector categories={categories} selected={selectedCategories} onChange={onCategoryChange} fieldErrors={fieldErrors} />
      <ConditionSelector condition={condition} onChange={onConditionChange} />
      <SizeSelector size={size} onChange={onSizeChange} />
      <AvailabilityToggles
        availableInStore={availableInStore}
        onAvailableInStoreChange={onAvailableInStoreChange}
        listOnPaperclip={listOnPaperclip}
        onListOnPaperclipChange={onListOnPaperclipChange}
      />
      {fieldErrors.images && <p className="text-sm text-red-500 mt-1">{fieldErrors.images}</p>}
      <Button
        size="lg"
        onClick={onSubmit}
        disabled={isSaving || !itemDetails.name || !itemDetails.price || images.length === 0}
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
  );
}