"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../contexts/CartContext";
import {
  ShoppingCart,
  CreditCard,
  Smartphone,
  QrCode,
  Plus,
  Minus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Receipt } from "@/components/Receipt";
import { getUser } from "@/lib/services/items";

// Add interface for receipt data
interface ReceiptData {
  saleData: any; // Replace 'any' with proper sale record type
  items: any[]; // Replace 'any' with proper item type
}

// Add interface for customer data
interface CustomerData {
  name: string;
  email: string;
}

export default function POSPage() {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart();
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [user, setuser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();
  const [amount, setAmount] = useState("0.00");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | null>(
    null
  );
  const [change, setChange] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    email: ''
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getUser();
        setuser(user);
      } catch (error) {
        console.error("Failed to load items:", error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (typeof total === "number") {
      setAmount(total.toFixed(2));
    }
  }, [total]);

  const handleNumberClick = (num: string) => {
    if (amount === "0.00") {
      setAmount(num);
    } else {
      setAmount((prev) => prev + num);
    }
  };

  const handleClear = () => {
    setAmount(typeof total === "number" ? total.toFixed(2) : "0.00");
  };

  const handleDecimal = () => {
    if (!amount.includes(".")) {
      setAmount((prev) => prev + ".");
    }
  };

  const handleProcessRefund = () => {
    router.push("/inventory");
  };

  const handleCompleteSale = () => {
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (parseFloat(amount) < total) {
      toast.error("Amount is less than total");
      return;
    }

    setShowCustomerForm(true);
  };

  const handleCustomerSubmit = () => {
    if (!customerData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    
    // Email validation
    if (customerData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
      toast.error("Please enter a valid email");
      return;
    }

    setShowCustomerForm(false);
    setShowPaymentOptions(true);
  };

  const handlePayment = async (method: "card" | "cash") => {
    try {
      // Validate all items in cart
      for (const item of items) {
        const { data: currentItem, error } = await supabase
          .from("items")
          .select("quantity")
          .eq("id", item.id)
          .single();

        if (error) throw error;
        if (!currentItem) {
          toast.error(`Item "${item.title}" not found`);
          return;
        }

        if (item.quantity > currentItem.quantity) {
          toast.error(
            `Only ${currentItem.quantity} items available for "${item.title}"`
          );
          updateQuantity(item.id, currentItem.quantity);
          return;
        }
      }

      // Proceed with payment processing only if stock validation passes
      setPaymentMethod(method);
      setIsProcessing(true);

      if (method === "cash") {
        const amountTendered = parseFloat(amount);
        const changeAmount = amountTendered - total;
        if (changeAmount < 0) {
          toast.error("Insufficient payment amount");
          setIsProcessing(false);
          return;
        }
        setChange(changeAmount);
      }

      // Create customer record first
      const { data: customerRecord, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customerData.name,
          email: customerData.email || null
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Update sale data to include customer_id
      const saleData = {
        total_amount: total,
        payment_method: method,
        status: "completed",
        payment_status: "paid",
        amount_tendered: method === "cash" ? parseFloat(amount) : total,
        change_amount: method === "cash" ? parseFloat(amount) - total : 0,
        customer_id: customerRecord.id
      };

      const { data: saleRecord, error: saleError } = await supabase
        .from("sales")
        .insert(saleData)
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items records
      const saleItems = items.map((item) => ({
        sale_id: saleRecord.id,
        item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: saleItemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (saleItemsError) {
        await supabase.from("sales").delete().eq("id", saleRecord.id);
        throw saleItemsError;
      }

      // Set receipt data
      setReceiptData({
        saleData: saleRecord,
        items: items,
      });
      setShowReceipt(true);

      toast.success(`Payment successful via ${method}`);
      clearCart();
      setAmount("0.00");
    } catch (error) {
      console.error("Payment processing error:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment processing failed"
      );
      setIsProcessing(false);
      setPaymentMethod(null);
    }
  };

  const validateAndUpdateQuantity = async (
    itemId: string,
    newQuantity: number
  ) => {
    // Optimistically update the UI immediately.
    updateQuantity(itemId, newQuantity);

    try {
      // Validate stock in the background.
      const { data: currentItem, error } = await supabase
        .from("items")
        .select("quantity")
        .eq("id", itemId)
        .single();

      if (error) throw error;
      if (!currentItem) {
        toast.error("Item not found");
        // Optionally, revert the optimistic update if needed.
        return;
      }

      if (newQuantity > currentItem.quantity) {
        // Only show the error if it hasn't been shown already
        toast.error(
          `Only ${currentItem.quantity} items available in stock`,
          { id: "stock-error" } // using a unique id
        );
        updateQuantity(itemId, currentItem.quantity);
        return;
      }
      // If validation passes, no further action is needed.
    } catch (error) {
      toast.error("Failed to validate stock quantity");
      // Optionally revert the optimistic update here as well.
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">
        Point of Sale
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cart Section */}
        <Card className="bg-white dark:bg-gray-800 shadow-lg justify-between">
          <div className="border-b border-[#3e4a5c] flex items-center gap-2 flex-row justify-between px-4 py-3 !m-0">
            <CardTitle className="flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5 text-paperclip-red" /> Cart Items
            </CardTitle>
            <div className="m-0">
              <Button onClick={clearCart} className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
        font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
        disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-9 px-4 py-2 min-w-[100px]
         bg-[#fff] text-[#333] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] m-0">Clear Cart</Button>
            </div>
          </div>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center space-x-4 py-2 border-b"
                >
                  <div className="w-16 h-16 flex-shrink-0 relative rounded-md overflow-hidden">
                    <img
                      src={item.image_url || "/placeholder.svg"}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium">{item.title}</h3>
                    <div className="text-sm text-gray-500 space-x-1">
                      <span>{item.category}</span>
                      {item.size && <span>• {item.size}</span>}
                    </div>
                    <div className="text-sm font-semibold">
                      £{item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        validateAndUpdateQuantity(item.id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        validateAndUpdateQuantity(item.id, item.quantity + 1)
                      }
                    >
                      +
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <span className="text-xl font-semibold">Total:</span>
            <span className="text-2xl font-bold text-paperclip-red">
              £{total.toFixed(2)}
            </span>
          </CardFooter>
        </Card>

        {/* Payment Section */}
        <Card className="bg-white dark:bg-gray-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              <CreditCard className="mr-2 h-5 w-5 text-paperclip-red" />
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-right mb-6">
              <span className="text-4xl font-bold text-paperclip-red">
                £{amount}
              </span>
              {change > 0 && (
                <div className="text-green-600 text-xl mt-2">
                  Change: £{change.toFixed(2)}
                </div>
              )}
            </div>

            <Button
              className="w-full bg-paperclip-red hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg mb-6"
              onClick={() => handlePayment("card")}
              disabled={isProcessing || items.length === 0}
            >
              <div className="flex items-center justify-center gap-2">
                {isProcessing && paymentMethod === "card" ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    <Smartphone className="h-5 w-5" />
                    <QrCode className="h-5 w-5" />
                    <span>Pay with Card</span>
                  </>
                )}
              </div>
            </Button>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "C"].map((num) => (
                <Button
                  key={num}
                  variant={num === "C" ? "destructive" : "outline"}
                  className="h-16 text-xl font-semibold"
                  onClick={() => {
                    if (num === "C") handleClear(); // Reset the amount
                    else if (num === ".") handleDecimal(); // Add decimal
                    else handleNumberClick(num.toString()); // Add the number to amount
                  }}
                >
                  {num}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex gap-4">
        <Button
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg"
          onClick={handleCompleteSale}
          disabled={isProcessing || items.length === 0}
        >
          {isProcessing && paymentMethod === "cash" ? (
            <span>Processing...</span>
          ) : (
            "Complete Sale"
          )}
        </Button>
        <Button
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg"
          onClick={handleProcessRefund}
          disabled={isProcessing}
        >
          <RotateCcw className="mr-2 h-5 w-5" />
          Process Refund
        </Button>
      </div>

      {showCustomerForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#191e25] bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-[500px]">
            <h2 className="text-xl m-0 p-5 border-b-[1px] border-[#384454]">Customer Information</h2>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <Input
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email (Optional)</label>
                <Input
                  type="email"
                  value={customerData.email}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter customer email"
                />
              </div>
              <div className="flex gap-4">
                <Button
                  className="flex-1 bg-paperclip-red hover:bg-red-700 text-white"
                  onClick={handleCustomerSubmit}
                >
                  Continue to Payment
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => setShowCustomerForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentOptions && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#191e25] bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-[500px]">
            <h2 className="text-xl m-0 p-5 bottom-0 border-b-[1px] border-[#384454]">Select Payment Method</h2>

            <div className="flex gap-4 p-6">
              <Button
              className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
        font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
        disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px]
         bg-transparent text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] hover:border-[#dc2626]"
                onClick={() => {
                  handlePayment("cash");
                  setShowPaymentOptions(false);
                }}
              >
                Cash Payment
              </Button>
              <Button
              className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
        font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
        disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px]
         bg-transparent text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] hover:border-[#dc2626]"
                onClick={() => {
                  handlePayment("card");
                  setShowPaymentOptions(false);
                }}
              >
                Card Payment
              </Button>
              <Button
              className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
        font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
        disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px]
         bg-transparent text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] hover:border-[#dc2626]"
                variant="destructive"
                onClick={() => setShowPaymentOptions(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-[#191e25] bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Receipt
            saleData={receiptData.saleData}
            items={receiptData.items}
            userId={user.id}
            onClose={() => {
              setShowReceipt(false);
              setIsProcessing(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
