"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Receipt } from "@/components/Receipt";
import { getUser } from "@/lib/services/items";
import { RefundReceipt } from "@/components/RefundReceipt";
import { loadStripe } from "@stripe/stripe-js";

declare global {
  interface Window {
    NDEFReader: any;
  }
}

interface Reader {
  id: string;
  object: string;
  device_type: string;
  label: string;
  status: string;
}
// Add these interfaces
interface NDEFMessage {
  records: any[];
}

interface ReaderState {
  id: string;
  label: string;
  status: string;
  device_type: string;
  last_connected: string;
}


interface NDEFReadingEvent {
  message: NDEFMessage;
  serialNumber: string;
}

// Add interface for receipt data
interface ReceiptData {
  saleData:
    | {
        id: string;
        created_at: string;
        total_amount: number;
        payment_method: string;
        amount_tendered: number;
        change_amount: number;
      }
    | {
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
  discount?: {
    type: "percentage" | "fixed";
    value: number;
    savingsAmount: number;
  };
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

// Add these interfaces
interface Discount {
  type: "percentage" | "fixed";
  value: number;
}

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || ""
);

// Add these interfaces for Stripe Terminal
interface Reader {
  id: string;
  object: string;
  device_type: string;
  label: string;
  status: string;
}

// Add these interfaces for reader management
interface ReaderState {
  id: string;
  label: string;
  status: string;
  device_type: string;
  last_connected: string;
}


interface Transaction {
  id: string;
  amount: number;
  status: string;
}

export default function POSPage() {

  const [availableReaders, setAvailableReaders] = useState<Reader[]>([]);
  const [showReaderManager, setShowReaderManager] = useState(false);
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
  const [showTerminalOptions, setShowTerminalOptions] = useState(false);
  const [refundReceiptData, setRefundReceiptData] =
    useState<RefundReceiptData | null>(null);
  const [discount, setDiscount] = useState<Discount>({
    type: "fixed",
    value: 0,
  });
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<string>("");
  const scanButton = useRef<HTMLButtonElement>(null);

  // Add Stripe Terminal states
  const [reader, setReader] = useState<Reader | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<string | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<string>(
    "Stripe Terminal not initialized"
  );
  const [terminalLoading, setTerminalLoading] = useState(false);

  // Add these new states for terminal payment processing
  const [waitingForTerminal, setWaitingForTerminal] = useState(false);

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
    const loadSavedReader = async () => {
      try {
        // Try to get reader from local storage first
        const savedReader = localStorage.getItem('pos_active_reader');
        
        if (savedReader) {
          const readerData = JSON.parse(savedReader);
          setReader(readerData);
          setTerminalStatus(`Reader loaded: ${readerData.label || readerData.id}`);
        } else {
          // Try to get reader from database if user is logged in
          if (user?.store_id) {
            const { data } = await supabase
              .from('terminal_readers')
              .select('*')
              .eq('store_id', user.store_id)
              .eq('is_active', true)
              .maybeSingle();
              
            if (data) {
              setReader(data);
              // Also save to localStorage for faster access next time
              localStorage.setItem('pos_active_reader', JSON.stringify(data));
              setTerminalStatus(`Reader loaded: ${data.label || data.id}`);
            }
          }
        }
      } catch (error) {
        console.error('Error loading saved reader:', error);
      }
    };
    
    loadSavedReader();
  }, [user?.store_id, supabase]);

  const handlePaymentSquere = async () => {
    try {
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: "500", // Use actual total instead of hardcoded value
          orderId: crypto.randomUUID(), // Generate a unique order ID
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment");
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to initiate payment");
    }
  };

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
        console.log("🚀 ~ fetchPOSSettings ~ data:", data);
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
  }, [user, supabase]);

  useEffect(() => {
    let nfcReader: any = null;

    const startNfcScan = async () => {
      if (!scanButton.current) return;
      scanButton.current?.addEventListener("click", async () => {
        try {
          const ndef = new window.NDEFReader();
          await ndef.scan();
          setNfcStatus("Scan started - Please tap your NFC card");

          // Handle reading errors
          ndef.addEventListener("readingerror", () => {
            setNfcStatus("Error reading NFC card - Please try again");
            toast.error("Failed to read NFC card");
          });

          // Handle successful reads
          ndef.addEventListener(
            "reading",
            ({ message, serialNumber }: NDEFReadingEvent) => {
              setNfcStatus(`Card detected! Serial: ${serialNumber}`);

              // Process the NFC message records
              message.records.forEach((record, index) => {
                try {
                  if (record.recordType === "text") {
                    const textDecoder = new TextDecoder();
                    const text = textDecoder.decode(record.data);
                    toast.success(`Card Data (${index + 1}): ${text}`);
                  } else if (record.recordType === "url") {
                    const textDecoder = new TextDecoder();
                    const url = textDecoder.decode(record.data);
                    toast.success(`URL found: ${url}`);
                  } else {
                    console.log(
                      `Record ${index + 1} type: ${record.recordType}`
                    );
                  }
                } catch (error) {
                  console.error(`Error processing record ${index + 1}:`, error);
                }
              });
            }
          );
        } catch (error) {
          if (error instanceof Error) {
            if (error.name === "NotAllowedError") {
              setNfcStatus("NFC permission denied");
              toast.error("Please enable NFC permissions");
            } else if (error.name === "NotSupportedError") {
              setNfcStatus("NFC not supported on this device");
              toast.error("NFC is not supported on your device");
            } else {
              setNfcStatus(`NFC Error: ${error.message}`);
              toast.error(error.message);
            }
          }
          console.error("NFC Error:", error);
        }
      });
    };

    startNfcScan();

    // Cleanup function
    return () => {
      if (nfcReader) {
        // Remove event listeners if necessary
        nfcReader = null;
      }
    };
  }, []);

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

    const finalTotal = calculateFinalTotal();
    if (parseFloat(amount) < finalTotal) {
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

  const handlePayment = async (method: "card" | "cash" | "terminal") => {
    try {
      // Validate cart is not empty
      if (items.length === 0) {
        toast.error("Cart is empty");
        return;
      }

      // Validate all items in cart have sufficient stock
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

      // Handle terminal payment with improved flow
      if (method === "terminal") {
        setPaymentMethod("card");
        setIsProcessing(true);
        setShowPaymentOptions(false);

        // Initialize the reader
        if (!reader) {
          // No reader configured - show reader manager
          toast.error("No card reader configured. Please set up a reader first.");
          setShowReaderManager(true);
          setIsProcessing(false);
          return;
        }

        // Ensure reader is ready
        const readerStatus = await checkReaderStatus(reader);
        if (!readerStatus.ready) {
          toast.error(`Reader issue: ${readerStatus.message}`);
          setIsProcessing(false);
          return;
        }

        // Create payment intent with existing reader
        const { success: paymentCreated, paymentIntentId } = 
          await createTerminalPayment(reader);
          
        if (!paymentCreated || !paymentIntentId) {
          toast.error("Failed to create payment");
          setIsProcessing(false);
          return;
        }

        // Process the payment with existing reader
        await processTerminalPayment(reader, paymentIntentId);
        return;
      }

      // For cash and regular card payments, continue with existing logic
      setPaymentMethod(method);
      setIsProcessing(true);

      // Handle cash payment
      if (method === "cash") {
        const amountTendered = parseFloat(amount);
        const finalTotal = calculateFinalTotal();
        const changeAmount = amountTendered - finalTotal;

        if (changeAmount < 0) {
          toast.error("Insufficient payment amount");
          setIsProcessing(false);
          return;
        }

        setChange(changeAmount);

        // Process customer data
        const customerRecord = await processCustomerData(finalTotal);
        if (!customerRecord) {
          setIsProcessing(false);
          return;
        }

        const originalAmount = total;

        // Create sale data
        const saleData = {
          total_amount: finalTotal,
          original_amount: originalAmount,
          discount_type: discount.value > 0 ? discount.type : null,
          discount_value: discount.value > 0 ? discount.value : null,
          payment_method: "cash",
          status: "completed",
          payment_status: "paid",
          amount_tendered: amountTendered,
          change_amount: changeAmount,
          customer_id: customerRecord.id,
          store_id: user.store_id,
        };

        // Create sale record
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

        await supabase
          .from("sales")
          .update({ inventory_updated: true })
          .eq("id", saleRecord.id);

        // Now update inventory quantities
        // for (const item of items) {
        //   const { error: updateError } = await supabase.rpc(
        //     "update_item_quantity",
        //     {
        //       p_item_id: item.id,
        //       p_quantity_change: -item.quantity,
        //     }
        //   );

        //   if (updateError) {
        //     console.error(
        //       `Error updating quantity for item ${item.id}:`,
        //       updateError
        //     );
        //   }
        // }

        // // Update inventory quantities
        // for (const item of items) {
        //   const { error: updateError } = await supabase.rpc(
        //     "update_item_quantity",
        //     {
        //       p_item_id: item.id,
        //       p_quantity_change: -item.quantity,
        //     }
        //   );

        //   if (updateError) {
        //     console.error(`Error updating quantity for item ${item.id}:`, updateError);
        //   }
        // }

        // Create payment record
        const { error: paymentError } = await supabase.from("payments").insert({
          order_id: saleRecord.id,
          amount: finalTotal,
          status: "completed",
          customer_id: customerRecord.id,
          customer_data: customerData,
          items: items,
          store_id: user.store_id,
        });

        if (paymentError) {
          console.error("Error creating payment record:", paymentError);
        }

        // Set receipt data
        setReceiptData({
          saleData: saleRecord,
          items: items,
          discount:
            discount.value > 0
              ? {
                  type: discount.type,
                  value: discount.value,
                  savingsAmount: originalAmount - finalTotal,
                }
              : undefined,
        });

        setShowReceipt(true);
        toast.success("Payment successful via cash");
        clearCart();
        setAmount("0.00");
      }
      // Handle regular card payment as before
      else if (method === "card") {
        // Your existing card payment logic
        // ...
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment processing failed"
      );
      setIsProcessing(false);
      setPaymentMethod(null);
    }
  };

  const checkReaderStatus = async (currentReader: Reader) => {
    try {
      const response = await fetch("/api/reader-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId: currentReader.id }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { 
          ready: false, 
          message: error.error || `Reader connection issue (${response.status})` 
        };
      }
      
      const data = await response.json();
      
      if (data.reader.status === "online") {
        return { ready: true, message: "Reader is online" };
      } else {
        return { 
          ready: false, 
          message: `Reader is ${data.reader.status}. Please reconnect.` 
        };
      }
    } catch (error) {
      console.error("Error checking reader status:", error);
      return { 
        ready: false, 
        message: error instanceof Error ? error.message : "Unknown reader error" 
      };
    }
  };

  const discoverReaders = async () => {
    try {
      setTerminalLoading(true);
      setTerminalStatus("Discovering readers...");
      
      const response = await fetch("/api/discover-readers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.readers && Array.isArray(data.readers)) {
        setAvailableReaders(data.readers);
        setTerminalStatus(`Found ${data.readers.length} readers`);
        toast.success(`Found ${data.readers.length} card readers`);
        return data.readers;
      } else {
        throw new Error("Invalid reader discovery response");
      }
    } catch (error) {
      console.error("Reader discovery error:", error);
      setTerminalStatus(`Discovery Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to discover readers");
      return [];
    } finally {
      setTerminalLoading(false);
    }
  };
  const selectReader = async (readerId: string) => {
    try {
      setTerminalLoading(true);
      setTerminalStatus("Connecting to reader...");
      
      const response = await fetch("/api/connect-reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerId }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.reader) {
        // Save the reader in both state and local storage
        setReader(data.reader);
        localStorage.setItem('pos_active_reader', JSON.stringify(data.reader));
        
        // Also save to database if logged in
        if (user?.store_id) {
          // First, clear any previously active readers
          await supabase
            .from('terminal_readers')
            .update({ is_active: false })
            .eq('store_id', user.store_id);
            
          // Then save this reader as active
          await supabase.from('terminal_readers').upsert({
            id: data.reader.id,
            label: data.reader.label,
            device_type: data.reader.device_type,
            status: data.reader.status,
            store_id: user.store_id,
            is_active: true,
            last_connected: new Date().toISOString()
          });
        }
        
        setTerminalStatus(`Connected to reader: ${data.reader.label || data.reader.id}`);
        toast.success(`Connected to ${data.reader.label || data.reader.id}`);
        return true;
      } else {
        throw new Error("Invalid reader connection response");
      }
    } catch (error) {
      console.error("Reader connection error:", error);
      setTerminalStatus(`Connection Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      toast.error("Failed to connect to reader");
      return false;
    } finally {
      setTerminalLoading(false);
    }
  };

  const ReaderManagerComponent = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Stripe Terminal Reader Manager</h2>
          
          <div className="space-y-4">
            {reader && (
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <h3 className="font-medium mb-2">Current Reader</h3>
                <p><strong>Name:</strong> {reader.label || 'Unnamed Reader'}</p>
                <p><strong>Type:</strong> {reader.device_type}</p>
                <p><strong>Status:</strong> {reader.status}</p>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button 
                onClick={discoverReaders}
                disabled={terminalLoading}
                className="flex-1 mr-2"
              >
                {terminalLoading ? 'Discovering...' : 'Discover Readers'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowReaderManager(false)}
                className="flex-1 ml-2"
              >
                Close
              </Button>
            </div>
            
            {availableReaders.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Available Readers</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableReaders.map((r) => (
                    <div 
                      key={r.id} 
                      className={`p-3 rounded-md cursor-pointer border ${
                        reader?.id === r.id 
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() => selectReader(r.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{r.label || 'Unnamed Reader'}</p>
                          <p className="text-sm text-gray-500">{r.device_type} • {r.status}</p>
                        </div>
                        {reader?.id === r.id && (
                          <div className="text-green-500 text-sm font-medium">Current</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

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
        .from("sales")
        .select(
          `
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
        `
        )
        .eq("id", searchSaleId)
        .single();

      if (saleError) throw saleError;
      if (!saleData) {
        toast.error("Sale not found");
        return;
      }

      // Check if sale is already fully refunded
      if (saleData.status === "refunded") {
        toast.error("This sale has already been fully refunded");
        return;
      }

      // Get all refunded quantities for each item
      const { data: existingRefunds, error: refundsError } = await supabase
        .from("refund_items")
        .select(
          `
          quantity,
          sale_item_id
        `
        )
        .in(
          "refund_id",
          saleData.refunds.map((r: { id: string }) => r.id)
        );

      if (refundsError) throw refundsError;
      console.log(saleData, "this are the sales data");
      console.log(existingRefunds, "this are exisiting refunds");
      // Create a map of already refunded quantities
      const refundedQuantities = existingRefunds?.reduce(
        (acc: RefundQuantities, refund: RefundRecord) => {
          acc[refund.sale_item_id] =
            (acc[refund.sale_item_id] || 0) + refund.quantity;
          return acc;
        },
        {} as RefundQuantities
      );

      // Format the sale data and subtract already refunded quantities
      const formattedSale: RefundSale = {
        ...saleData,
        sale_items: saleData.sale_items
          .map((item: any) => {
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
              refund_quantity: 0,
            };
          })
          .filter((item: RefundSaleItem) => item.quantity > 0), // Only show items with remaining quantity
      };

      if (formattedSale.sale_items.length === 0) {
        toast.error("All items in this sale have already been refunded");
        return;
      }

      setSelectedSale(formattedSale);
      setRefundItems(formattedSale.sale_items);
    } catch (error) {
      console.error("Error searching sale:", error);
      toast.error("Error searching for sale");
    }
  };

  const updateRefundQuantity = (itemId: string, quantity: number) => {
    setRefundItems((items) =>
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              refund_quantity: Math.max(0, Math.min(quantity, item.quantity)),
            }
          : item
      )
    );
  };

  const calculateRefundTotal = () => {
    return refundItems.reduce(
      (total, item) => total + item.price * (item.refund_quantity || 0),
      0
    );
  };

  const processRefund = async () => {
    if (
      !selectedSale ||
      !refundItems.some((item) => (item.refund_quantity || 0) > 0)
    ) {
      toast.error("Please select items to refund");
      return;
    }

    if (!refundReason.trim()) {
      toast.error("Please provide a reason for the refund");
      return;
    }

    try {
      setIsProcessing(true);

      // Verify sale status hasn't changed
      const { data: currentSale, error: saleCheckError } = await supabase
        .from("sales")
        .select("status")
        .eq("id", selectedSale.id)
        .single();

      if (saleCheckError) throw saleCheckError;

      if (currentSale.status === "refunded") {
        toast.error("This sale has already been fully refunded");
        return;
      }

      // Calculate refund total
      const refundTotal = calculateRefundTotal();

      // Create refund record
      const { data: refund, error: refundError } = await supabase
        .from("refunds")
        .insert({
          sale_id: selectedSale.id,
          total_amount: refundTotal,
          refund_method: selectedSale.payment_method,
          reason: refundReason,
          store_id: user.store_id,
          processed_by: user.id,
          status: "completed",
        })
        .select()
        .single();

      if (refundError) throw refundError;

      // Process refund items
      const refundItemsToProcess = refundItems
        .filter((item) => (item.refund_quantity || 0) > 0)
        .map((item) => ({
          refund_id: refund.id,
          sale_item_id: item.id,
          quantity: item.refund_quantity,
          refund_amount: item.price * (item.refund_quantity || 0),
        }));

      const { error: refundItemsError } = await supabase
        .from("refund_items")
        .insert(refundItemsToProcess);

      if (refundItemsError) throw refundItemsError;

      // Update inventory quantities
      for (const item of refundItems) {
        if ((item.refund_quantity || 0) > 0) {
          const { error: updateError } = await supabase.rpc(
            "update_item_quantity",
            {
              p_item_id: item.item_id,
              p_quantity_change: item.refund_quantity,
            }
          );

          if (updateError) {
            console.error(
              `Error updating quantity for item ${item.item_id}:`,
              updateError
            );
            toast.error(`Failed to update inventory for ${item.title}`);
          }
        }
      }

      // Update sale status
      const allItemsRefunded = refundItems.every(
        (item) => item.refund_quantity === item.quantity
      );

      const { error: saleUpdateError } = await supabase
        .from("sales")
        .update({
          status: allItemsRefunded ? "refunded" : "partially_refunded",
        })
        .eq("id", selectedSale.id);

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
          customer: selectedSale.customer,
        },
        items: refundItems
          .filter((item) => item.refund_quantity || 0)
          .map((item) => ({
            title: item.title,
            price: item.price,
            refund_quantity: item.refund_quantity,
          })),
      });
      setShowRefundReceipt(true);
      setShowRefundModal(false);
      setSelectedSale(null);
      setRefundItems([]);
      setRefundReason("");
      setSearchSaleId("");
      toast.success("Refund processed successfully");
    } catch (error) {
      console.error("Error processing refund:", error);
      toast.error("Error processing refund");
    } finally {
      setIsProcessing(false);
    }
  };

  // Add this helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  // Add this function to calculate final total after discount
  const calculateFinalTotal = () => {
    if (discount.value === 0) return total;

    if (discount.type === "percentage") {
      return total - total * (discount.value / 100);
    } else {
      return Math.max(0, total - discount.value);
    }
  };

  // Add this component for the discount modal
  const DiscountModal = () => (
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

  // Initialize Reader
  const initializeReader = async () => {
    if (terminalLoading) {
      return { success: false, reader: null };
    }

    if (reader) {
      setTerminalStatus("Reader is already initialized");
      toast.success("Reader already connected");
      return { success: true, reader: reader };
    }

    setTerminalLoading(true);
    setTerminalStatus("Initializing Reader...");

    try {
      const response = await fetch("/api/create-reader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.data.reader) {
        const readerData = data.data.reader;
        setReader(readerData); // Also update the state for future use
        setTerminalStatus("Reader Ready");
        toast.success("Stripe Terminal reader connected");
        return { success: true, reader: readerData }; // Return the reader directly
      } else {
        throw new Error("No reader data received");
      }
    } catch (error: any) {
      console.error("Reader initialization error:", error);
      setTerminalStatus(`Reader Error: ${error.message}`);
      toast.error(`Terminal Error: ${error.message}`);
      return { success: false, reader: null };
    } finally {
      setTerminalLoading(false);
    }
  };

  // Create Payment Intent for Terminal - updated function
  const createTerminalPayment = async (currentReader: Reader) => {
    if (terminalLoading) {
      toast.error("Payment processing already in progress");
      return { success: false, paymentIntentId: null };
    }

    setTerminalLoading(true);
    setTerminalStatus("Creating Payment...");

    try {
      const finalAmount = calculateFinalTotal();

      const response = await fetch("/api/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(finalAmount * 100) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      console.log("🚀 ~ createTerminalPayment ~ data:", data);

      if (data.clientSecret && data.paymentIntentId) {
        // Update state for future use
        setPaymentIntent(data.paymentIntentId);
        setTerminalStatus("Payment Created - Ready to Process");
        toast.success("Payment ready to process on terminal");

        // Store payment context
        await storeTerminalPaymentContext(data.paymentIntentId, finalAmount);

        return { success: true, paymentIntentId: data.paymentIntentId };
      } else {
        throw new Error("Invalid payment intent response");
      }
    } catch (error: any) {
      console.error("Payment creation error:", error);
      setTerminalStatus(`Payment Error: ${error.message}`);
      toast.error(`Payment creation error: ${error.message}`);
      return { success: false, paymentIntentId: null };
    } finally {
      setTerminalLoading(false);
    }
  };

  // Process Payment on Terminal - updated function
  const processTerminalPayment = async (
    currentReader: Reader,
    currentPaymentIntentId: string
  ) => {
    console.log("Processing with reader:", currentReader);
    console.log("Processing with payment intent:", currentPaymentIntentId);

    if (!currentReader || !currentPaymentIntentId) {
      setTerminalStatus("Reader or payment intent not available");
      toast.error("Reader or payment intent not available");
      return false;
    }

    setTerminalLoading(true);
    setTerminalStatus("Processing Payment...");

    try {
      const response = await fetch("/api/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readerId: currentReader.id,
          paymentIntentId: currentPaymentIntentId,
        }),
      });

      // Parse the response
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP error ${response.status}`);
      }

      // Process payment request was successful
      setTerminalStatus("Present Card on Reader...");
      toast.success(
        "Present card on reader. Payment will be processed automatically."
      );

      // Start waiting for webhook response
      setWaitingForTerminal(true);
      startPollingForPaymentStatus(currentPaymentIntentId);

      // Set up UI
      setShowTerminalOptions(true);

      return true;
    } catch (error: any) {
      console.error("Payment processing error:", error);
      setTerminalStatus(`Processing Error: ${error.message}`);
      toast.error(`Processing error: ${error.message}`);
      setIsProcessing(false);

      // Handle intent_invalid_state error
      if (error.message && error.message.includes("intent_invalid_state")) {
        toast.error(
          "The payment intent is in the wrong state. Please try again."
        );
        setPaymentIntent(null);
        setTerminalStatus("Payment needs to be restarted. Please try again.");
      }

      return false;
    } finally {
      setTerminalLoading(false);
    }
  };

  // Add a polling function to check payment status
  const startPollingForPaymentStatus = async (paymentIntentId: string) => {
    // Check payment status every 3 seconds
    const intervalId = setInterval(async () => {
      try {
        const { data: context } = await supabase
          .from("terminal_payment_context")
          .select("status")
          .eq("payment_intent_id", paymentIntentId)
          .single();

        if (context?.status === "processed") {
          // Payment was successfully processed
          clearInterval(intervalId);
          handleTerminalPaymentCompletion(true);
        } else if (context?.status === "failed") {
          // Payment failed
          clearInterval(intervalId);
          handleTerminalPaymentCompletion(false);
        }
        // Otherwise keep polling
      } catch (error) {
        console.error("Error polling for payment status:", error);
      }
    }, 3000);

    // Stop polling after 2 minutes (timeout)
    setTimeout(() => {
      clearInterval(intervalId);
      // If we're still waiting, show a message
      if (waitingForTerminal) {
        setWaitingForTerminal(false);
        toast.error(
          "Payment processing timed out. Please check your dashboard."
        );
        setIsProcessing(false);
      }
    }, 120000);
  };

  // Function to handle terminal payment completion
  const handleTerminalPaymentCompletion = async (success: boolean) => {
    setWaitingForTerminal(false);

    if (success) {
      // Get the payment intent ID from the context store instead of state
      const { data: context } = await supabase
        .from("terminal_payment_context")
        .select("payment_intent_id")
        .eq("status", "processed")
        .order("processed_at", { ascending: false })
        .limit(1)
        .single();

      const processedPaymentIntentId = context?.payment_intent_id;
      console.log(
        "🚀 ~ handleTerminalPaymentCompletion ~ retrieved payment intent:",
        processedPaymentIntentId
      );

      if (processedPaymentIntentId) {
        toast.success("Payment successful via Stripe Terminal");

        // Fetch the sale record to show the receipt
        const { data: payment } = await supabase
          .from("payments")
          .select("order_id")
          .eq("payment_id", processedPaymentIntentId)
          .single();

        if (payment?.order_id) {
          const { data: sale } = await supabase
            .from("sales")
            .select("*")
            .eq("id", payment.order_id)
            .single();

          if (sale) {
            // Get the sale items to show receipt
            const { data: saleItems } = await supabase
              .from("sale_items")
              .select(
                `
                id,
                quantity,
                price,
                item:items(
                  id,
                  title,
                  images:item_images(image_url)
                )
              `
              )
              .eq("sale_id", sale.id);

            // Format the items for the receipt
            const receiptItems = saleItems?.map((item: any) => ({
              id: item.item.id,
              title: item.item.title,
              price: item.price,
              quantity: item.quantity,
              image_url: item.item.images?.[0]?.image_url || "/placeholder.svg",
            }));

            // Show the receipt
            setReceiptData({
              saleData: sale,
              items: receiptItems ?? [],
              discount: sale.discount_type
                ? {
                    type: sale.discount_type as "percentage" | "fixed",
                    value: Number(sale.discount_value),
                    savingsAmount:
                      Number(sale.original_amount) - Number(sale.total_amount),
                  }
                : undefined,
            });

            setShowReceipt(true);
          }
        }

        // Clear cart and reset amount
        clearCart();
        setAmount("0.00");
      } else {
        console.error("No processed payment intent found");
        toast.error("Couldn't find payment details");
      }
    } else {
      toast.error("Terminal payment failed");
    }

    // Reset states
    setPaymentIntent(null);
    setTerminalStatus("Reader Ready");
    setIsProcessing(false);
  };

  // Add Terminal Status Component
  const TerminalStatusComponent = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Stripe Terminal Status</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-lg">{terminalStatus}</p>
              {terminalLoading && (
                <div className="flex justify-center mt-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white"></div>
                </div>
              )}
            </div>

            {showTerminalOptions && (
              <div className="flex gap-2 mt-4">
                {/* <Button 
                  onClick={() => completeTerminalPayment(true)} 
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  Payment Succeeded
                </Button> */}
                {/* <Button 
                  onClick={() => completeTerminalPayment(false)} 
                  variant="destructive" 
                  className="flex-1"
                >
                  Payment Failed
                </Button> */}
              </div>
            )}

            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setShowTerminalOptions(false);
                setIsProcessing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Store all information needed for webhook processing
  const storeTerminalPaymentContext = async (
    paymentIntentId: string,
    finalAmount: number
  ) => {
    try {
      // 1. Process customer first to get customer ID
      const customerRecord = await processCustomerData(finalAmount);
      if (!customerRecord) {
        throw new Error("Failed to process customer data");
      }

      // Calculate important values
      const originalAmount = total;

      // 2. Store transaction context in terminal_payment_context table
      const paymentContext = {
        payment_intent_id: paymentIntentId,
        customer_id: customerRecord.id,
        customer_data: customerData,
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          title: item.title,
          image_url: item.image_url,
        })),
        original_amount: originalAmount,
        final_amount: finalAmount,
        discount_type: discount.value > 0 ? discount.type : null,
        discount_value: discount.value > 0 ? discount.value : null,
        store_id: user.store_id,
        created_at: new Date().toISOString(),
        status: "pending",
      };

      // Create a record in terminal_payment_context table
      const { error: contextError } = await supabase
        .from("terminal_payment_context")
        .insert(paymentContext);

      if (contextError) {
        console.error("Error storing payment context:", contextError);
        throw new Error("Failed to store payment context");
      }

      // Create a temporary sale record to get an order_id
      const { data: tempSale, error: tempSaleError } = await supabase
        .from("sales")
        .insert({
          total_amount: finalAmount,
          original_amount: originalAmount,
          discount_type: discount.value > 0 ? discount.type : null,
          discount_value: discount.value > 0 ? discount.value : null,
          payment_method: "card",
          status: "pending",
          payment_status: "pending",
          customer_id: customerRecord.id,
          store_id: user.store_id,
          payment_id: paymentIntentId,
          amount_tendered: finalAmount,
          change_amount: 0,
        })
        .select()
        .single();

      if (tempSaleError) {
        console.error("Error creating temporary sale:", tempSaleError);
        throw new Error("Failed to create temporary sale");
      }

      // Now create the payment record with the temporary sale ID
      const { error: paymentError } = await supabase.from("payments").insert({
        order_id: tempSale.id,
        payment_id: paymentIntentId,
        amount: finalAmount,
        status: "pending",
        customer_id: customerRecord.id,
        customer_data: customerData,
        items: items,
        store_id: user.store_id,
      });

      if (paymentError) {
        console.error("Error storing payment data:", paymentError);
        throw new Error("Failed to store payment data");
      }

      console.log("Successfully stored payment context for webhook processing");
      return true;
    } catch (error) {
      console.error("Error storing terminal payment context:", error);
      toast.error("Failed to prepare payment data");
      return false;
    }
  };

  // Helper function to process or create customer data
  const processCustomerData = async (finalTotal: number) => {
    try {
      // Find existing customer
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
        await customerQuery.maybeSingle();

      let customerRecord;
      if (existingCustomer) {
        // Update existing customer
        const { data: updatedCustomer, error: updateError } = await supabase
          .from("customers")
          .update({
            name: customerData.name,
            last_purchase_date: new Date().toISOString(),
            total_purchases: (existingCustomer.total_purchases || 0) + 1,
            total_spent: (existingCustomer.total_spent || 0) + finalTotal,
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
            total_spent: finalTotal,
          })
          .select()
          .single();

        if (createError) throw createError;
        customerRecord = newCustomer;
      }

      return customerRecord;
    } catch (error) {
      console.error("Error processing customer data:", error);
      toast.error("Failed to process customer information");
      return null;
    }
  };

  // Add Terminal Waiting Component
  const TerminalWaitingComponent = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Processing Payment</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-lg text-center mb-4">
                Payment is being processed on the terminal...
              </p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            </div>
            <p className="text-sm text-center text-gray-500">
              Please do not refresh or close this page. The receipt will appear
              automatically when payment is complete.
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setWaitingForTerminal(false);
                setIsProcessing(false);
                setTerminalStatus("Reader Ready");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">
        Point of Saless {nfcStatus}
      </h1>
      {/* <button onClick={handlePaymentSquere}>Pay Now</button> */}
      {/* <button ref={scanButton} >Scan</button>q */}
      {reader && (
        <div className="mb-4 flex items-center">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1 flex items-center">
            <CreditCard className="h-4 w-4 mr-2 text-gray-500" />
            <span className="text-sm">
              Reader: {reader.label || reader.id} ({reader.status})
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2 h-6 w-6 p-0" 
              onClick={() => setShowReaderManager(true)}
            >
              <span className="sr-only">Manage Reader</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
              </svg>
            </Button>
          </div>
        </div>
      )}
      
      {/* Add a Configure Reader button if no reader is set */}
      {!reader && (
        <div className="mb-4">
          <Button 
            onClick={() => setShowReaderManager(true)} 
            variant="outline" 
            className="flex items-center"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Configure Card Reader
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cart Section */}
        <Card className="bg-white dark:bg-gray-800 shadow-lg justify-between">
          <div className="border-b border-[#3e4a5c] flex items-center gap-2 flex-row justify-between px-4 py-3 !m-0">
            <CardTitle className="flex items-center">
              <ShoppingCart className="mr-2 h-5 w-5 text-paperclip-red" /> Cart
              Items
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowDiscountModal(true)}
                className="inline-flex items-center justify-center gap-2"
              >
                Discount
              </Button>
              <Button onClick={clearCart}>Clear Cart</Button>
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
          <CardFooter className="flex flex-col">
            <div className="w-full flex justify-between items-center mb-2">
              <span className="text-xl font-semibold">Subtotal:</span>
              <span className="text-xl">£{total.toFixed(2)}</span>
            </div>
            {discount.value > 0 && (
              <div className="w-full flex justify-between items-center mb-2 text-green-500">
                <span>
                  Discount (
                  {discount.type === "percentage"
                    ? `${discount.value}%`
                    : `£${discount.value}`}
                  ):
                </span>
                <span>-£{(total - calculateFinalTotal()).toFixed(2)}</span>
              </div>
            )}
            <div className="w-full flex justify-between items-center">
              <span className="text-xl font-semibold">Final Total:</span>
              <span
                className={`text-2xl font-bold ${
                  discount.value > 0
                    ? discount.type === "percentage"
                      ? "text-yellow-500"
                      : "text-green-500"
                    : "text-paperclip-red"
                }`}
              >
                £{calculateFinalTotal().toFixed(2)}
              </span>
            </div>
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

            <div className="flex flex-col gap-4 p-6">
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

              {/* {posSettings.acceptCard && (
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
                  Standard Card Payment
                </Button>
              )} */}

              <Button
                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm 
              font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring 
              disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 
              [&_svg]:shrink-0 shadow hover:bg-primary/90 h-11 px-4 py-2 min-w-[100px] bg-transparent 
              text-[#fff] rounded-[8px] border-[1px] border-[#fff] hover:text-[#fff] hover:bg-[#dc2626] 
              hover:border-[#dc2626]"
                onClick={() => {
                  handlePayment("terminal");
                  setShowPaymentOptions(false);
                }}
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Stripe Terminal
              </Button>

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
            saleData={
              receiptData.saleData as {
                id: string;
                created_at: string;
                total_amount: number;
                payment_method: string;
                amount_tendered: number;
                change_amount: number;
              }
            }
            items={receiptData.items}
            userId={user?.id || ""}
            receiptLogo={posSettings.receiptLogo}
            receiptMessage={posSettings.receiptMessage}
            discount={receiptData.discount}
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
                      <p>Email: {selectedSale.customer.email || "N/A"}</p>
                      <p>Phone: {selectedSale.customer.phone || "N/A"}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Sale Details</h3>
                      <p>Sale ID: {selectedSale.id}</p>
                      <p>
                        Date:{" "}
                        {new Date(selectedSale.created_at).toLocaleDateString()}
                      </p>
                      <p>
                        Original Amount:{" "}
                        {formatCurrency(selectedSale.total_amount)}
                      </p>
                      <p>Payment Method: {selectedSale.payment_method}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">
                      Items Available for Refund
                    </h3>
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
                              <span>
                                Original Qty: {item.original_quantity}
                              </span>
                              {item.refunded_quantity > 0 && (
                                <span className="ml-2">
                                  (Previously Refunded: {item.refunded_quantity}
                                  )
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateRefundQuantity(
                                  item.id,
                                  (item.refund_quantity || 0) - 1
                                )
                              }
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
                                    Math.min(
                                      parseInt(e.target.value) || 0,
                                      item.quantity
                                    )
                                  )
                                }
                                className="text-center"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateRefundQuantity(
                                  item.id,
                                  (item.refund_quantity || 0) + 1
                                )
                              }
                              disabled={
                                (item.refund_quantity || 0) >= item.quantity
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="w-32 text-right">
                            <p className="font-medium">
                              {formatCurrency(
                                (item.refund_quantity || 0) * item.price
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block font-medium mb-2">
                        Refund Reason
                      </label>
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
                        <p className="text-sm text-gray-500">
                          Total Refund Amount
                        </p>
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
                            !refundItems.some(
                              (item) => (item.refund_quantity || 0) > 0
                            ) || !refundReason.trim()
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
        {showReaderManager && <ReaderManagerComponent />}

      {showDiscountModal && <DiscountModal />}

      {(terminalLoading || showTerminalOptions) && <TerminalStatusComponent />}

      {waitingForTerminal && <TerminalWaitingComponent />}
    </div>
  );
}
