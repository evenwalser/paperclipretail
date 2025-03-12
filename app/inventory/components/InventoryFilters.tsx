import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InventoryFiltersProps } from '../types';
import { Input } from '@/components/ui/input';

const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  searchQuery,
  onSearchChange,
  categories,
  onCategoryChange
}) => {
  return (
    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
      <Input
        placeholder="Search inventory..."
        className="flex-grow"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <Select onValueChange={onCategoryChange}>
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
  );
};

export default InventoryFilters; 