import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface RefundReceiptProps {
  refundData: {
    id: string;
    created_at: string;
    total_amount: number;
    refund_method: string;
    reason: string;
    originalSaleId: string;
    customer?: {
      name: string;
      email?: string;
      phone?: string;
    };
  };
  items: {
    title: string;
    price: number;
    refund_quantity: number;
  }[];
  storeLogo?: string;
  storeMessage?: string;
  onClose: () => void;
}

export function RefundReceipt({
  refundData,
  items,
  storeLogo,
  storeMessage,
  onClose,
}: RefundReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
      <div className="text-center mb-6">
        {storeLogo && (
          <img
            src={storeLogo}
            alt="Store Logo"
            className="mx-auto mb-4 max-h-20"
          />
        )}
        <h2 className="text-2xl font-bold mb-2">Refund Receipt</h2>
        <p className="text-gray-600">Refund ID: {refundData.id}</p>
        <p className="text-gray-600">
          Original Sale ID: {refundData.originalSaleId}
        </p>
        <p className="text-gray-600">
          Date: {formatDate(refundData.created_at)}
        </p>
      </div>

      {refundData.customer && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Customer Details</h3>
          <p>Name: {refundData.customer.name}</p>
          {refundData.customer.email && (
            <p>Email: {refundData.customer.email}</p>
          )}
          {refundData.customer.phone && (
            <p>Phone: {refundData.customer.phone}</p>
          )}
        </div>
      )}

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Refunded Items</h3>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex justify-between">
              <div>
                <p>{item.title}</p>
                <p className="text-sm text-gray-600">
                  Qty: {item.refund_quantity} x £{item.price.toFixed(2)}
                </p>
              </div>
              <p className="font-medium">
                £{(item.price * item.refund_quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4 mb-6">
        <div className="flex justify-between font-bold">
          <p>Total Refund Amount:</p>
          <p>£{refundData.total_amount.toFixed(2)}</p>
        </div>
        <p className="text-gray-600 mt-2">
          Refund Method: {refundData.refund_method}
        </p>
        <p className="text-gray-600 mt-2">Reason: {refundData.reason}</p>
      </div>

      {storeMessage && (
        <div className="text-center text-gray-600 mb-6">{storeMessage}</div>
      )}

      <div className="flex gap-4 print:hidden">
        <Button onClick={handlePrint} className="flex-1">
          Print Receipt
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          Close
        </Button>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content,
          .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
} 