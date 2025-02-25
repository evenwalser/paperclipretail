'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mail, MessageSquare, Tag, Clock, CheckCircle2, XCircle, CornerUpRight, DollarSign, MoreHorizontal, ArrowLeft, Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { format } from 'date-fns'
import Link from 'next/link'
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: 'offer' | 'message' | 'email' | 'low_stock'
  sender: string
  subject: string
  content: string
  created_at: string
  read: boolean
  deleted_at: string | null
  metadata: {
    offerAmount?: number
    itemImage?: string
    itemTitle?: string
    quantity?: number
    threshold?: number
  }
  item_id?: string
  store_id?: number
}

const notifications: Notification[] = [
  {
    id: '1',
    type: 'offer',
    sender: 'John Doe',
    subject: 'Offer on Vintage Watch',
    content: 'I\'m interested in your vintage watch. Would you accept £150?',
    created_at: '2024-11-25T10:30:00Z',
    read: false,
    deleted_at: null,
    metadata: {
      offerAmount: 150,
      itemImage: '/placeholder.svg?height=100&width=100',
      itemTitle: 'Vintage Watch'
    }
  },
  {
    id: '2',
    type: 'message',
    sender: 'Jane Smith',
    subject: 'Question about item condition',
    content: 'Hi, I\'m wondering about the condition of the antique vase you\'re selling. Are there any chips or cracks?',
    created_at: '2024-11-23T09:15:00Z',
    read: false,
    deleted_at: null,
    metadata: {}
  },
  {
    id: '3',
    type: 'email',
    sender: 'Paperclip Support',
    subject: 'Welcome to Paperclip!',
    content: 'Welcome to Paperclip! We\'re excited to have you on board.',
    created_at: '2024-11-22T14:20:00Z',
    read: true,
    deleted_at: null,
    metadata: {}
  }
]

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'offer':
      return <Tag className="h-5 w-5 text-green-500" />
    case 'message':
      return <MessageSquare className="h-5 w-5 text-blue-500" />
    case 'email':
      return <Mail className="h-5 w-5 text-purple-500" />
    case 'low_stock':
      return <Bell className="h-4 w-4 text-white" />
    default:
      return null
  }
}

const NotificationBadge = ({ type }: { type: string }) => {
  switch (type) {
    case 'offer':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Offer</Badge>
    case 'message':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Message</Badge>
    case 'email':
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Email</Badge>
    case 'low_stock':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Low Stock</Badge>
    default:
      return null
  }
}

const UnreadIndicator = () => (
  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-600" />
);

export default function NotificationsPage() {
  const supabase = createClient();
  const [notificationList, setNotificationList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [counterOffer, setCounterOffer] = useState('')

  useEffect(() => {
    fetchNotifications()
    subscribeToNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotificationList(data || [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotificationList(prev => [payload.new as Notification, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotificationList(prev => 
              prev.map(notification => 
                notification.id === payload.new.id ? payload.new as Notification : notification
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setNotificationList(prev => 
              prev.filter(notification => notification.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const markAsRead = async (notificationId: string, isRead: boolean) => {
    try {
      const timestamp = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ 
          read: isRead,
          updated_at: timestamp
        })
        .eq('id', notificationId);

      if (updateError) throw updateError;

      // Update local state
      setNotificationList(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: isRead }
            : notification
        )
      );
    } catch (error) {
      console.error('Error updating notification:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const timestamp = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ 
          deleted_at: timestamp,
          updated_at: timestamp
        })
        .eq('id', notificationId);

      if (updateError) throw updateError;

      // Update local state
      setNotificationList(prev => 
        prev.filter(n => n.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleAction = (action: string, notification: Notification) => {
    setActiveModal(action)
    setActiveNotification(notification)
  }

  const handleReply = async () => {
    console.log('Sending reply:', replyContent)
    setNotificationList(prev => prev.map(n => 
      n.id === activeNotification?.id ? { ...n, read: true } : n
    ))
    setActiveModal(null)
    setReplyContent('')
  }

  const handleOfferAction = async (action: 'accept' | 'counter' | 'decline') => {
    console.log('Offer action:', action, counterOffer)
    setNotificationList(prev => prev.map(n => 
      n.id === activeNotification?.id ? { ...n, read: true } : n
    ))
    setActiveModal(null)
    setCounterOffer('')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return format(date, 'dd/MM/yyyy, HH:mm')
  }

  const renderDropdownMenu = (notification: Notification) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => markAsRead(notification.id, !notification.read)}
        >
          Mark as {notification.read ? 'unread' : 'read'}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => deleteNotification(notification.id)}
          className="text-red-600"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
      <Link href="/" passHref>
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to Dashboard
        </Button>
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Notifications</h1>
      
      <Card className="overflow-hidden border-0 shadow-lg bg-[#0a0a0a]">
        <CardHeader className="border-b bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">Inbox</CardTitle>
            <div className="text-sm text-gray-500">
              {notificationList.filter(n => !n.read).length} unread
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <AnimatePresence>
              {notificationList.map((notification) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    'relative border-b border-gray-100 dark:border-gray-800',
                    'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    'transition-colors duration-200',
                    !notification.read && 'bg-blue-50/50 dark:bg-blue-900/10'
                  )}
                >
                  {!notification.read && <UnreadIndicator />}
                  <div className="p-4 flex items-start gap-4 pl-6">
                    <div className="flex-shrink-0 pt-1">
                      <div className="w-[26px] h-[26px] rounded-full bg-[#5a9300] flex items-center justify-center">
                         <NotificationIcon type={notification.type} />
                      </div>
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <NotificationBadge type={notification.type} />
                        <span className={cn(
                          "text-sm",
                          notification.read 
                            ? "text-gray-500 dark:text-gray-400" 
                            : "text-gray-900 dark:text-gray-100 font-medium"
                        )}>
                          from {notification.sender}
                        </span>
                      </div>
                      
                      <h3 className={cn(
                        "text-lg mb-1",
                        notification.read 
                          ? "text-gray-700 dark:text-gray-300 font-normal"
                          : "text-gray-900 dark:text-gray-100 font-semibold"
                      )}>
                        {notification.subject}
                      </h3>
                      
                      <p className={cn(
                        "line-clamp-2",
                        notification.read 
                          ? "text-gray-500 dark:text-gray-400"
                          : "text-gray-700 dark:text-gray-200"
                      )}>
                        {notification.content}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="h-4 w-4" />
                        {formatDate(notification.created_at)}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      {notification.type === 'offer' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleAction('accept-offer', notification)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleAction('decline-offer', notification)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {(notification.type === 'message' || notification.type === 'email') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleAction('reply', notification)}
                        >
                          <CornerUpRight className="h-4 w-4" />
                        </Button>
                      )}

                      {renderDropdownMenu(notification)}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={activeModal === 'reply'} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reply to {activeNotification?.sender}</DialogTitle>
            <DialogDescription>{activeNotification?.subject}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Type your reply here..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleReply}>
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal?.includes('offer')} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {activeModal === 'accept-offer' ? 'Accept' : 'Decline'} Offer
            </DialogTitle>
            <DialogDescription>
              {activeNotification?.sender} offered ${activeNotification?.metadata.offerAmount}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {activeNotification?.metadata.itemImage && (
              <img
                src={activeNotification.metadata.itemImage}
                alt={activeNotification.metadata.itemTitle}
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            {activeModal === 'accept-offer' && (
              <Input
                type="number"
                placeholder="Enter counter offer amount"
                value={counterOffer}
                onChange={(e) => setCounterOffer(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            {activeModal === 'accept-offer' ? (
              <>
                <Button onClick={() => handleOfferAction('counter')}>
                  Counter Offer
                </Button>
                <Button onClick={() => handleOfferAction('accept')}>
                  Accept Offer
                </Button>
              </>
            ) : (
              <Button 
                variant="destructive" 
                onClick={() => handleOfferAction('decline')}
              >
                Decline Offer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

