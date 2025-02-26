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
import { RefundReceipt } from "@/components/RefundReceipt";

// Add interface for receipt data
interface ReceiptData {
  saleData: {
    id: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
    amount_tendered: number;
    change_amount: number;
  } | {
    id: string;
    created_at: string;
    total_amount: number;
    refund_method: string;
    reason: string;
    originalSaleId: string;
    isRefund: boolean;
    customer?: {
      name: string;
      email?: string;
      phone?: string;
    };
  };
  items: any[];
}

// Add interface for customer data
interface CustomerData {
  name: string;
  email: string;
  phone: string;
}

// Add these interfaces
interface RefundSale {
  id: string;
  created_at: string;
  total_amount: number;
  payment_method: string;
  customer_id: string;
  sale_items: RefundSaleItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

// First, define the base SaleItem interface
interface SaleItem {
  id: string;
  item_id: string;
  quantity: number;
  price: number;
  title: string;
  image_url?: string;
}

// Then define the RefundSaleItem interface that extends SaleItem
interface RefundSaleItem extends SaleItem {
  original_quantity: number;
  refunded_quantity: number;
  refund_quantity?: number;
}

interface RefundQuantities {
  [key: string]: number;
}

interface RefundRecord {
  sale_item_id: string;
  quantity: number;
}

interface SaleReceiptData {
  saleData: {
    id: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
    amount_tendered: number;
    change_amount: number;
  };
  items: any[];
}

interface RefundReceiptData {
  saleData: {
    id: string;
    created_at: string;
    total_amount: number;
    refund_method: string;
    reason: string;
    originalSaleId: string;
    isRefund: boolean;
    customer?: {
      name: string;
      email?: string;
      phone?: string;
    };
  };
  items: any[];
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
  const [receiptData, setReceiptData] = useState<SaleReceiptData | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: "",
    email: "",
    phone: "",
  });
  const [posSettings, setPosSettings] = useState({
    acceptCash: true,
    acceptCard: true,
    receiptLogo: "",
    receiptMessage: "Thank you for shopping with us!",
  });
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [searchSaleId, setSearchSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState<RefundSale | null>(null);
  const [refundItems, setRefundItems] = useState<RefundSaleItem[]>([]);
  const [refundReason, setRefundReason] = useState("");
  const [showRefundReceipt, setShowRefundReceipt] = useState(false);
  const [refundReceiptData, setRefundReceiptData] = useState<RefundReceiptData | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getUser();
        setuser(user);
        console.log("here is my user", user);
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

  useEffect(() => {
    const fetchPOSSettings = async () => {
      try {
        if (!user) return;
        const { data, error } = await supabase
          .from("stores")
          .select("accept_cash, accept_card, receipt_logo, receipt_message")
          .eq("owner_id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          setPosSettings({
            acceptCash: data.accept_cash ?? true,
            acceptCard: data.accept_card ?? true,
            receiptLogo: data.receipt_logo || "",
            receiptMessage:
              data.receipt_message || "Thank you for shopping with us!",
          });
        }
      } catch (error) {
        console.error("Error fetching POS settings:", error);
        toast.error("Failed to load POS settings");
      }
    };

    fetchPOSSettings();
  }, [user,supabase]);

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
    setShowRefundModal(true);
  };

  const handleCompleteSale = async () => {
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (parseFloat(amount) < total) {
      toast.error("Amount is less than total");
      return;
    }

    // Validate stock quantities for all items before proceeding
    try {
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

      // If all validations pass, show the customer form
      setShowCustomerForm(true);
    } catch (error) {
      toast.error("Failed to validate stock quantities");
      console.error("Stock validation error:", error);
    }
  };

  const handleCustomerSubmit = () => {
    // Name validation
    if (!customerData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    // Phone validation - now required
    if (!customerData.phone?.trim()) {
      toast.error("Phone number is required");
      return;
    }

    // Phone format validation
    if (!/^\+?[\d\s-]{10,}$/.test(customerData.phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }

    // Email format validation (if provided)
    if (
      customerData.email?.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)
    ) {
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

      // First, try to find existing customer
      let customerQuery = supabase
        .from("customers")
        .select("*")
        .eq("store_id", user.store_id);

      if (customerData.email) {
        customerQuery = customerQuery.eq("email", customerData.email);
      } else if (customerData.phone) {
        customerQuery = customerQuery.eq("phone", customerData.phone);
      }

      const { data: existingCustomer, error: customerSearchError } =
        await customerQuery.single();

      let customerRecord;
      if (existingCustomer) {
        // Update existing customer
        const { data: updatedCustomer, error: updateError } = await supabase
          .from("customers")
          .update({
            name: customerData.name, // Update name in case it changed
            last_purchase_date: new Date().toISOString(),
            total_purchases: existingCustomer.total_purchases + 1,
            total_spent: existingCustomer.total_spent + total,
          })
          .eq("id", existingCustomer.id)
          .select()
          .single();

        if (updateError) throw updateError;
        customerRecord = updatedCustomer;
      } else {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from("customers")
          .insert({
            name: customerData.name,
            email: customerData.email || null,
            phone: customerData.phone || null,
            store_id: user.store_id,
            last_purchase_date: new Date().toISOString(),
            total_purchases: 1,
            total_spent: total,
          })
          .select()
          .single();

        if (createError) throw createError;
        customerRecord = newCustomer;
      }

      // Update sale data to include store_id
      const saleData = {
        total_amount: total,
        payment_method: method,
        status: "completed",
        payment_status: "paid",
        amount_tendered: method === "cash" ? parseFloat(amount) : total,
        change_amount: method === "cash" ? parseFloat(amount) - total : 0,
        customer_id: customerRecord.id,
        store_id: user.store_id,
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

  const searchSale = async () => {
    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(
            id,
            name,
            email,
            phone
          ),
          sale_items:sale_items(
            id,
            item_id,
            quantity,
            price,
            item:items(
              id,
              title,
              images:item_images(
                image_url
              )
            )
          ),
          refunds(*)
        `)
        .eq('id', searchSaleId)
        .single();

      if (saleError) throw saleError;
      if (!saleData) {
        toast.error('Sale not found');
        return;
      }

      // Check if sale is already fully refunded
      if (saleData.status === 'refunded') {
        toast.error('This sale has already been fully refunded');
        return;
      }

      // Get all refunded quantities for each item
      const { data: existingRefunds, error: refundsError } = await supabase
        .from('refund_items')
        .select(`
          quantity,
          sale_item_id
        `)
        .in('refund_id', saleData.refunds.map((r: { id: string }) => r.id));

      if (refundsError) throw refundsError;
          console.log(saleData,'this are the sales data')
          console.log(existingRefunds,'this are exisiting refunds');
      // Create a map of already refunded quantities
      const refundedQuantities = existingRefunds?.reduce((acc: RefundQuantities, refund: RefundRecord) => {
        acc[refund.sale_item_id] = (acc[refund.sale_item_id] || 0) + refund.quantity;
        return acc;
      }, {} as RefundQuantities);

      // Format the sale data and subtract already refunded quantities
      const formattedSale: RefundSale = {
        ...saleData,
        sale_items: saleData.sale_items.map((item: any) => {
          const alreadyRefundedQty = refundedQuantities?.[item.id] || 0;
          const remainingQty = item.quantity - alreadyRefundedQty;

          return {
            id: item.id,
            item_id: item.item_id,
            quantity: remainingQty, // Only show remaining quantity
            original_quantity: item.quantity,
            refunded_quantity: alreadyRefundedQty,
            price: item.price,
            title: item.item.title,
            image_url: item.item.images?.[0]?.image_url || "/placeholder.svg",
            refund_quantity: 0
          };
        }).filter((item: RefundSaleItem) => item.quantity > 0) // Only show items with remaining quantity
      };

      if (formattedSale.sale_items.length === 0) {
        toast.error('All items in this sale have already been refunded');
        return;
      }

      setSelectedSale(formattedSale);
      setRefundItems(formattedSale.sale_items);
    } catch (error) {
      console.error('Error searching sale:', error);
      toast.error('Error searching for sale');
    }
  };

  const updateRefundQuantity = (itemId: string, quantity: number) => {
    setRefundItems(items =>
      items.map(item =>
        item.id === itemId
          ? {
              ...item,
              refund_quantity: Math.max(0, Math.min(quantity, item.quantity))
            }
          : item
      )
    );
  };

  const calculateRefundTotal = () => {
    return refundItems.reduce((total, item) => 
      total + (item.price * (item.refund_quantity || 0)), 0
    );
  };

  const processRefund = async () => {
    if (!selectedSale || !refundItems.some(item => (item.refund_quantity || 0) > 0)) {
      toast.error('Please select items to refund');
      return;
    }

    if (!refundReason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    try {
      setIsProcessing(true);

      // Verify sale status hasn't changed
      const { data: currentSale, error: saleCheckError } = await supabase
        .from('sales')
        .select('status')
        .eq('id', selectedSale.id)
        .single();

      if (saleCheckError) throw saleCheckError;

      if (currentSale.status === 'refunded') {
        toast.error('This sale has already been fully refunded');
        return;
      }

      // Calculate refund total
      const refundTotal = calculateRefundTotal();

      // Create refund record
      const { data: refund, error: refundError } = await supabase
        .from('refunds')
        .insert({
          sale_id: selectedSale.id,
          total_amount: refundTotal,
          refund_method: selectedSale.payment_method,
          reason: refundReason,
          store_id: user.store_id,
          processed_by: user.id,
          status: 'completed'
        })
        .select()
        .single();

      if (refundError) throw refundError;

      // Process refund items
      const refundItemsToProcess = refundItems
        .filter(item => (item.refund_quantity || 0) > 0)
        .map(item => ({
          refund_id: refund.id,
          sale_item_id: item.id,
          quantity: item.refund_quantity,
          refund_amount: item.price * (item.refund_quantity || 0)
        }));

      const { error: refundItemsError } = await supabase
        .from('refund_items')
        .insert(refundItemsToProcess);

      if (refundItemsError) throw refundItemsError;

      // Update inventory quantities
      for (const item of refundItems) {
        if ((item.refund_quantity || 0) > 0) {
          const { error: updateError } = await supabase.rpc(
            'update_item_quantity',
            { 
              p_item_id: item.item_id,
              p_quantity_change: item.refund_quantity
            }
          );

          if (updateError) {
            console.error(`Error updating quantity for item ${item.item_id}:`, updateError);
            toast.error(`Failed to update inventory for ${item.title}`);
          }
        }
      }

      // Update sale status
      const allItemsRefunded = refundItems.every(
        item => item.refund_quantity === item.quantity
      );

      const { error: saleUpdateError } = await supabase
        .from('sales')
        .update({ 
          status: allItemsRefunded ? 'refunded' : 'partially_refunded'
        })
        .eq('id', selectedSale.id);

      if (saleUpdateError) throw saleUpdateError;

      // Set refund receipt data
      setRefundReceiptData({
        saleData: {
          id: refund.id,
          created_at: refund.created_at,
          total_amount: refundTotal,
          refund_method: selectedSale.payment_method,
          reason: refundReason,
          originalSaleId: selectedSale.id,
          isRefund: true,
          customer: selectedSale.customer
        },
        items: refundItems
          .filter(item => (item.refund_quantity || 0) > 0)
          .map(item => ({
            title: item.title,
            price: item.price,
            refund_quantity: item.refund_quantity
          }))
      });

      setShowRefundReceipt(true);
      setShowRefundModal(false);
      setSelectedSale(null);
      setRefundItems([]);
      setRefundReason("");
      setSearchSaleId("");
      toast.success('Refund processed successfully');

    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Error processing refund');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add this helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
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
              <ShoppingCart className="mr-2 h-5 w-5 text-paperclip-red" /> Cart
              Items
            </CardTitle>
            <div className="m-0">
              <Button
                onClick={clearCart}
                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
        font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
        disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-9 px-4 py-2 min-w-[100px]
         bg-[#fff] text-[#333] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] m-0"
              >
                Clear Cart
              </Button>
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
        <div className="fixed inset-0 flex items-center justify-center bg-[#191e25] bg-opacity-50 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-[500px]">
            <h2 className="text-xl m-0 p-5 border-b-[1px] border-[#384454]">
              Customer Information
            </h2>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <Input
                  value={customerData.name}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone *
                </label>
                <Input
                  type="tel"
                  value={customerData.phone}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="Enter customer phone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Email (Optional)
                </label>
                <Input
                  type="email"
                  value={customerData.email}
                  onChange={(e) =>
                    setCustomerData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
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
            <h2 className="text-xl m-0 p-5 bottom-0 border-b-[1px] border-[#384454]">
              Select Payment Method
            </h2>

            <div className="flex gap-4 p-6">
              {posSettings.acceptCash && (
                <Button
                  className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
                font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring 
                disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 
                [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px] bg-transparent 
                text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] 
                hover:border-[#dc2626]"
                  onClick={() => {
                    handlePayment("cash");
                    setShowPaymentOptions(false);
                  }}
                >
                  Cash Payment
                </Button>
              )}

              {posSettings.acceptCard && (
                <Button
                  className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
                font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring 
                disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 
                [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px] bg-transparent 
                text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] 
                hover:border-[#dc2626]"
                  onClick={() => {
                    handlePayment("card");
                    setShowPaymentOptions(false);
                  }}
                >
                  Card Payment
                </Button>
              )}

              <Button
                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
              font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring 
              disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 
              [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px] bg-transparent 
              text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] 
              hover:border-[#dc2626]"
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
        <div className="fixed inset-0 bg-[#191e25] bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-scroll">
          <Receipt
            saleData={receiptData.saleData as { 
              id: string;
              created_at: string;
              total_amount: number;
              payment_method: string;
              amount_tendered: number;
              change_amount: number;
            }}
            items={receiptData.items}
            userId={user?.id || ''}
            receiptLogo={posSettings.receiptLogo}
            receiptMessage={posSettings.receiptMessage}
            onClose={() => {
              setShowReceipt(false);
              setIsProcessing(false);
            }}
          />
        </div>
      )}

      {showRefundReceipt && refundReceiptData && (
        <div className="fixed inset-0 bg-[#191e25] bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-scroll">
          <RefundReceipt
            refundData={refundReceiptData.saleData}
            items={refundReceiptData.items}
            storeLogo={posSettings.receiptLogo}
            storeMessage={posSettings.receiptMessage}
            onClose={() => {
              setShowRefundReceipt(false);
              setIsProcessing(false);
            }}
          />
        </div>
      )}

      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Process Refund</h2>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowRefundModal(false);
                    setSelectedSale(null);
                    setRefundItems([]);
                    setRefundReason("");
                    setSearchSaleId("");
                  }}
                >
                  ✕
                </Button>
              </div>
              
              {!selectedSale ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={searchSaleId}
                      onChange={(e) => setSearchSaleId(e.target.value)}
                      placeholder="Enter Sale ID"
                      className="flex-1"
                    />
                    <Button onClick={searchSale}>Search Sale</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div>
                      <h3 className="font-semibold mb-2">Customer Details</h3>
                      <p>Name: {selectedSale.customer.name}</p>
                      <p>Email: {selectedSale.customer.email || 'N/A'}</p>
                      <p>Phone: {selectedSale.customer.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Sale Details</h3>
                      <p>Sale ID: {selectedSale.id}</p>
                      <p>Date: {new Date(selectedSale.created_at).toLocaleDateString()}</p>
                      <p>Original Amount: {formatCurrency(selectedSale.total_amount)}</p>
                      <p>Payment Method: {selectedSale.payment_method}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Items Available for Refund</h3>
                    <div className="space-y-4">
                      {refundItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <div className="w-20 h-20 relative rounded-md overflow-hidden flex-shrink-0">
                            <img
                              src={item.image_url || "/placeholder.svg"}
                              alt={item.title}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-medium">{item.title}</h4>
                            <p className="text-sm text-gray-500">
                              Price: {formatCurrency(item.price)}
                            </p>
                            <div className="text-sm text-gray-500">
                              <span>Original Qty: {item.original_quantity}</span>
                              {item.refunded_quantity > 0 && (
                                <span className="ml-2">
                                  (Previously Refunded: {item.refunded_quantity})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateRefundQuantity(item.id, (item.refund_quantity || 0) - 1)}
                              disabled={(item.refund_quantity || 0) <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <div className="w-16 text-center">
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={item.refund_quantity || 0}
                                onChange={(e) => 
                                  updateRefundQuantity(
                                    item.id,
                                    Math.min(parseInt(e.target.value) || 0, item.quantity)
                                  )
                                }
                                className="text-center"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateRefundQuantity(item.id, (item.refund_quantity || 0) + 1)}
                              disabled={(item.refund_quantity || 0) >= item.quantity}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="w-32 text-right">
                            <p className="font-medium">
                              {formatCurrency((item.refund_quantity || 0) * item.price)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block font-medium mb-2">Refund Reason</label>
                      <textarea
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Please provide a reason for the refund"
                        className="w-full p-2 border rounded-md"
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-500">Total Refund Amount</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(calculateRefundTotal())}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <Button
                        className="inline-flex items-center justify-center whitespace-nowrap text-sm 
                        font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
                        disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-2 py-2 min-w-[100px]
                         bg-[#fff] text-[#333] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff]"
                          variant="outline"
                          onClick={() => {
                            setShowRefundModal(false);
                            setSelectedSale(null);
                            setRefundItems([]);
                            setRefundReason("");
                            setSearchSaleId("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                        className="inline-flex items-center justify-center whitespace-nowrap text-sm 
                          font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none 
                          disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-2 py-2 min-w-[100px] 
                          bg-[#dc2626] text-[#fff] rounded-[8px] border-[1px] border-[#dc2626] hover:text-[#dc2626]"
                          onClick={processRefund}
                          disabled={
                            !refundItems.some((item) => (item.refund_quantity || 0) > 0) ||
                            !refundReason.trim()
                          }
                        >
                          Process Refund
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
