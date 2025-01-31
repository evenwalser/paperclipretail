import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, ShoppingCart, RotateCcw } from "lucide-react"
import Link from "next/link"

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/inventory/add">
            <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border border-gray-800 bg-card text-card-foreground shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 p-6 pt-0 flex flex-col items-center justify-center h-32">
              <PlusCircle className="!h-8 !w-8 !text-[#dc2626]" />
              <span className="text-2xl font-semibold leading-none tracking-tight">Add New Item</span>
            </Button>
          </Link>
          <Link href="/pos">
            <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border border-gray-800 bg-card text-card-foreground shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 p-6 pt-0 flex flex-col items-center justify-center h-32">
              <ShoppingCart className="!h-8 !w-8 !text-[#dc2626]" />
              <span className="text-2xl font-semibold leading-none tracking-tight">New Sale</span>
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center space-y-2 rounded-xl border border-gray-800 bg-card text-card-foreground shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 p-6 pt-0 flex flex-col items-center justify-center h-32">
              <RotateCcw className="!h-8 !w-8 !text-[#dc2626]" />
              <span className="text-2xl font-semibold leading-none tracking-tight">Process Return</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

