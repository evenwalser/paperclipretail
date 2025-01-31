'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, User, Settings, LogOut, UserPlus, ShoppingCart, AlertTriangle, PoundSterling } from 'lucide-react'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ASSETS } from '@/lib/constants'
import Image from 'next/image'

interface Notification {
  id: string
  title: string
  description: string
  time: string
  type: 'order' | 'alert' | 'update'
}

const mockNotifications: Notification[] = [
  { id: '1', title: 'New Order', description: 'You have a new order #1234', time: '5 min ago', type: 'order' },
  { id: '2', title: 'Low Stock Alert', description: 'Item "Vintage Leather Jacket" is running low', time: '1 hour ago', type: 'alert' },
  { id: '3', title: 'Price Change', description: 'Price updated for "Antique Silver Necklace"', time: '2 hours ago', type: 'update' },
]

export function Header() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)

  const handleProfileClick = (path: string) => {
    router.push(`/settings?tab=${path}`)
  }

  const handleNotificationClick = () => {
    router.push('/notifications')
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-5 w-5 text-blue-500" />
      case 'alert':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'update':
        return <PoundSterling className="h-5 w-5 text-green-500" />
      default:
        return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center">
      <div></div>
      <div className="flex items-center space-x-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Notifications</h2>
                  <Button variant="ghost" size="sm" onClick={handleNotificationClick} className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
                    View All
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.map((notification) => (
                  <div key={notification.id} className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 ease-in-out">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{notification.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{notification.description}</p>
                        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">{notification.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleProfileClick('store-profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProfileClick('users')}>
              <UserPlus className="mr-2 h-4 w-4" />
              <span>Switch User</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleProfileClick('security')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

