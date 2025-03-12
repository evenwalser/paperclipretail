import React from 'react';
import { DiscountModalProps } from '../types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DiscountModal: React.FC<DiscountModalProps> = ({
  discount,
  setDiscount,
  setShowDiscountModal,
  total,
  calculateFinalTotal
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Apply Discount</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={discount.type === "percentage" ? "default" : "outline"}
                onClick={() =>
                  setDiscount((prev) => ({ ...prev, type: "percentage" }))
                }
              >
                Percentage (%)
              </Button>
              <Button
                variant={discount.type === "fixed" ? "default" : "outline"}
                onClick={() =>
                  setDiscount((prev) => ({ ...prev, type: "fixed" }))
                }
              >
                Fixed Amount (£)
              </Button>
            </div>
            <Input
              type="number"
              min="0"
              max={discount.type === "percentage" ? 100 : total}
              value={discount.value}
              onChange={(e) =>
                setDiscount((prev) => ({
                  ...prev,
                  value: parseFloat(e.target.value) || 0,
                }))
              }
              placeholder={
                discount.type === "percentage"
                  ? "Enter percentage"
                  : "Enter amount"
              }
            />
            <div className="text-sm">
              Original Total: £{total.toFixed(2)}
              <br />
              Final Total: £{calculateFinalTotal().toFixed(2)}
              <br />
              Savings: £{(total - calculateFinalTotal()).toFixed(2)}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  setShowDiscountModal(false);
                }}
              >
                Apply
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setDiscount({ type: "fixed", value: 0 });
                  setShowDiscountModal(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscountModal; 