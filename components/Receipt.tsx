import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'

interface ReceiptProps {
  saleData: {
    id: string
    created_at: string
    total_amount: number
    payment_method: string
    amount_tendered: number
    change_amount: number
  }
  items: {
    title: string
    price: number
    quantity: number
  }[]
  onClose: () => void
}

export function Receipt({ saleData, items, onClose }: ReceiptProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="bg-black p-6 rounded-lg max-w-md mx-auto receipt-content">
      {/* Store Header */}
      {/* <div className="text-center mb-4">
        <h2 className="text-xl font-bold">Your Store Name</h2>
        <p className="text-sm text-gray-600">123 Store Street</p>
        <p className="text-sm text-gray-600">City, Country</p>
        <p className="text-sm text-gray-600">Phone: (123) 456-7890</p>
      </div> */}

      {/* Receipt Details */}
      <div className="mb-4 text-sm">
        <p>Receipt #: {saleData.id}</p>
        <p>Date: {formatDate(saleData.created_at)}</p>
        <p className="capitalize">Payment: {saleData.payment_method}</p>
      </div>

      {/* Items */}
      <div className="border-t border-b border-gray-200 py-2 mb-4">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm py-1">
            <div>
              <span>{item.title} x{item.quantity}</span>
            </div>
            <span>£{(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="text-sm">
        <div className="flex justify-between font-bold">
          <span>Total:</span>
          <span>£{saleData.total_amount.toFixed(2)}</span>
        </div>
        {saleData.payment_method === 'cash' && (
          <>
            <div className="flex justify-between">
              <span>Cash Tendered:</span>
              <span>£{saleData.amount_tendered.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change:</span>
              <span>£{saleData.change_amount.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* Thank You Message */}
      <div className="text-center mt-4 text-sm">
        <p>Thank you for your purchase!</p>
        <p>Please come again</p>
      </div>

      {/* Print Button */}
      <div className="mt-4 flex gap-2">
        <Button onClick={handlePrint} className="flex-1">
          <Printer className="mr-2 h-4 w-4" />
          Print Receipt
        </Button>
        <Button onClick={onClose} variant="outline" className="flex-1">
          Close
        </Button>
      </div>
    </div>
  )
} 