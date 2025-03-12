// BasicInfo.tsx
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface BasicInfoProps {
  name: string;
  description: string;
  price: string;
  quantity: string;
  onChange: (updates: Partial<{ name: string; description: string; price: string; quantity: string }>) => void;
  fieldErrors: { name: string; price: string };
}

export default function BasicInfo({
  name,
  description,
  price,
  quantity,
  onChange,
  fieldErrors,
}: BasicInfoProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Item Name</Label>
        <Input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={cn(fieldErrors.name && "border-red-500")}
        />
        {fieldErrors.name && <p className="text-sm text-red-500 mt-1">{fieldErrors.name}</p>}
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
      <div>
        <Label>Price (£)</Label>
        <Input
          type="text"
          value={price}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
              onChange({ price: value });
            }
          }}
          className={cn(fieldErrors.price && "border-red-500")}
        />
        {fieldErrors.price && <p className="text-sm text-red-500 mt-1">{fieldErrors.price}</p>}
      </div>
      <div>
        <Label>Quantity</Label>
        <Input
          type="text"
          value={quantity}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "" || /^\d+$/.test(value)) {
              onChange({ quantity: value });
            }
          }}
        />
      </div>
    </div>
  );
}