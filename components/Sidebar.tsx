"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Package,
  PoundSterling,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import { ASSETS } from "@/lib/constants";
import { logout } from "@/app/login/actions";
import { supabase } from '@/lib/supabase';

// Add a NotificationBadge component
const NotificationBadge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  
  return (
    <div className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </div>
  );
};

export function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();

    const channel = supabase
      .channel('notification-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          // Immediately fetch the current unread count instead of trying to calculate it
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          // For new notifications, just fetch the current count
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .is('deleted_at', null);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const sidebarItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "POS", href: "/pos", icon: PoundSterling },
    { 
      name: "Notifications", 
      href: "/notifications", 
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : null 
    },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 w-64 border-r border-gray-200 dark:border-gray-800">
      <div className="p-4 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <img
          src={"/paperclip_logo_red.png"}
          alt="Paperclip Logo"
          width={200}
          height={67}
          className="filter-none"
        />
      </div>
      <ScrollArea className="flex-1">
        <nav className="space-y-2 p-4">
          {sidebarItems.map((item) => (
            <Link key={item.name} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start rounded-[8px] relative",
                  pathname === item.href
                    ? "bg-gray-100 dark:bg-gray-800 text-[#dc2626]"
                    : "hover:bg-gray-800 hover:text-[#fff]"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
                {item.badge && <NotificationBadge count={item.badge} />}
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-gray-800">
        <form action={logout}>
          <Button variant="ghost" className="w-full justify-start rounded-[8px]  text-[#dc2626] hover:bg-[#7f1d1d] hover:text-[#fff]">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </form>
      </div>
    </div>
  );
}
