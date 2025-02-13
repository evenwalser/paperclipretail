'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { createClient } from '@/utils/supabase/client'

interface InventorySettingsProps {
  lowStockThreshold: number;
  setLowStockThreshold: React.Dispatch<React.SetStateAction<number>>;
  hideLowStock: boolean;
  setHideLowStock: React.Dispatch<React.SetStateAction<boolean>>;
  defaultSorting: string;
  setDefaultSorting: React.Dispatch<React.SetStateAction<string>>;
}

export function InventorySettings({
  lowStockThreshold,
  setLowStockThreshold,
  hideLowStock,
  setHideLowStock,
  defaultSorting,
  setDefaultSorting,
}: InventorySettingsProps) {
  const supabase = createClient()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const handleSaveChanges = async () => {
    // Update the low_stock_threshold setting.
    const { error: errorLow } = await supabase
      .from('store_settings')
      .update({ setting_value: lowStockThreshold.toString() })
      .eq('setting_key', 'low_stock_threshold')

    // Update the default_sorting setting.
    const { error: errorSort } = await supabase
      .from('store_settings')
      .update({ setting_value: defaultSorting })
      .eq('setting_key', 'default_sorting')

    if (errorLow || errorSort) {
      console.error("Error updating settings:", errorLow || errorSort)
      setSaveMessage("Error updating settings")
    } else {
      setSaveMessage("Settings updated successfully!")
    }
    console.log("Settings saved:", {
      lowStockThreshold,
      hideLowStock,
      defaultSorting,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
          <Input 
            id="lowStockThreshold" 
            type="number" 
            placeholder="e.g., 5 units"
            className="max-w-xs mt-1"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(parseInt(e.target.value))}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch 
            id="hideLowStock" 
            checked={hideLowStock}
            onCheckedChange={(checked) => setHideLowStock(checked)}
          />
          <Label htmlFor="hideLowStock">
            Hide Low Stock Items on Marketplace
          </Label>
        </div>
        
        <div>
          <Label htmlFor="defaultSorting">Default Inventory Sorting</Label>
          <Select onValueChange={setDefaultSorting} value={defaultSorting}>
            <SelectTrigger className="max-w-xs mt-1">
              <SelectValue placeholder="Select default sorting" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="lowStock">Low Stock First</SelectItem>
              <SelectItem value="highStock">High Stock First</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSaveChanges} className="w-full bg-[#FF3B30] hover:bg-[#E6352B] text-white">
          Save Changes
        </Button>
        {saveMessage && <p className="mt-2 text-sm">{saveMessage}</p>}
      </CardContent>
    </Card>
  )
}
