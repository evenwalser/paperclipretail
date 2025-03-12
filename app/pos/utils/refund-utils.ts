import { RefundSale, RefundSaleItem, RefundQuantities, RefundRecord } from "../types";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "./payment-utils";

const supabase = createClient();

// Search for a sale by ID for refunding
export const searchSale = async (
  searchSaleId: string,
  setSelectedSale: (sale: RefundSale | null) => void,
  setRefundItems: (items: RefundSaleItem[]) => void
) => {
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

// Process a refund
export const processRefund = async (
  selectedSale: RefundSale | null,
  refundItems: RefundSaleItem[],
  refundReason: string,
  storeId: string,
  userId: string,
  calculateRefundTotal: () => number,
  setRefundReceiptData: (data: any) => void,
  setShowRefundReceipt: (show: boolean) => void,
  resetRefundState: () => void
) => {
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
        store_id: storeId,
        processed_by: userId,
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
    resetRefundState();
    toast.success("Refund processed successfully");
    
    return true;
  } catch (error) {
    console.error("Error processing refund:", error);
    toast.error("Error processing refund");
    return false;
  }
};

// Update refund quantity
export const updateRefundQuantity = (
  itemId: string,
  quantity: number,
  refundItems: RefundSaleItem[],
  setRefundItems: (items: RefundSaleItem[]) => void
) => {
  setRefundItems(
    refundItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            refund_quantity: Math.max(0, Math.min(quantity, item.quantity)),
          }
        : item
    )
  );
};

// Calculate refund total
export const calculateRefundTotal = (refundItems: RefundSaleItem[]) => {
  return refundItems.reduce(
    (total, item) => total + item.price * (item.refund_quantity || 0),
    0
  );
};