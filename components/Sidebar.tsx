"use client";

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

const sidebarItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "POS", href: "/pos", icon: PoundSterling },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
                  "w-full justify-start rounded-[8px]",
                  pathname === item.href
                    ? "bg-gray-100 dark:bg-gray-800 text-[#dc2626]"
                    : "hover:bg-gray-800 hover:text-[#fff]"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
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
