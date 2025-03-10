"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { createClient } from "@/utils/supabase/client";
import { DateRange } from "react-day-picker";
import { getUserData } from "@/utils/supabase/actions";
import { CategorySelectorV2 } from "@/components/CategorySelectorV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overview } from "@/components/Overview";
import { CalendarDateRangePicker } from "@/components/date-range-picker";
import { Package, PoundSterling, Users, Activity } from "lucide-react";
import { addDays, set } from "date-fns";
import { TopSellingItems } from "@/components/TopSellingItems";
import { CategoryInsights } from "@/components/CategoryInsights";
import { CategoryStats, getCategoryStats } from "@/lib/services/categoryStats";
import { QuickActions } from "@/components/QuickActions";
import { getRecentSales, RecentSale } from "@/lib/services/recentSales";
import { RecentSales } from "@/components/RecentSales";
import { getUser } from "@/lib/services/items";
import POS from "@/components/POS";

interface OverviewProps {
  currency: string;
  categoryId?: string;
  dateRange?: DateRange;
}

type DashboardMetrics = {
  inventory: {
    total_items: number;
    total_value: number;
    low_stock_items: number;
    out_of_stock_items: number;
  };
  revenue: {
    total_revenue: number;
    total_sales: number;
    average_sale_amount: number;
    cash_sales_amount: number;
    card_sales_amount: number;
    completed_sales: number;
    pending_sales: number;
  };
  customers: {
    total_customers: number;
    active_customers: number;
    new_customers: number;
    returning_customers: number;
    average_purchase_value: number;
    total_customer_spent: number;
    top_spending_customers: any[];
  };
  monthly_sales: {
    month: number;
    month_name: string;
    total_sales: number;
    year: number;
  }[];
}

export default function DashboardPage() {
  const supabase = createClient();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
    to: new Date(),
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const handleSignIn = () => {
    signIn("google", { prompt: "select_account" });
  };

  useEffect(() => {
    async function fetchUserStore() {
      try {
        const user = await getUser();
        setStoreId(user?.store_id);
        console.log("User store ID:", user);
      } catch (error) {
        console.error("Failed to fetch user store:", error);
        setError("Failed to load store information");
      }
    }

    fetchUserStore();
  }, [session]);

  useEffect(() => {
    async function fetchRecentSales() {
      console.log("here is store id ", storeId);
      if (!storeId) return;

      try {
        const sales = await getRecentSales(date, storeId);
        setRecentSales(sales);
      } catch (error) {
        console.error("Failed to fetch recent sales:", error);
      }
    }

    fetchRecentSales();
  }, [date, storeId]);

  useEffect(() => {
    async function fetchDashboardMetrics() {
      if (!storeId) return;
      setLoading(true);

      try {
        const [inventoryData, revenueData, customerData, monthlySalesData] = await Promise.all([
          supabase.rpc('get_total_inventory', { 
            store_id_param: storeId,
            start_date: date?.from?.toISOString() || null,
            end_date: date?.to?.toISOString() || null
          }),
          supabase.rpc('get_total_revenue', { 
            store_id_param: storeId,
            start_date: date?.from?.toISOString() || null,
            end_date: date?.to?.toISOString() || null
          }),
          supabase.rpc('get_active_customers', { 
            store_id_param: storeId,
            start_date: date?.from?.toISOString() || null,
            end_date: date?.to?.toISOString() || null
          }),
          supabase.rpc('get_monthly_sales', { 
            store_id_param: storeId,
            start_date: date?.from?.toISOString() || null,
            end_date: date?.to?.toISOString() || null
          })
        ]);

        if (inventoryData.error) throw inventoryData.error;
        if (revenueData.error) throw revenueData.error;
        if (customerData.error) throw customerData.error;
        if (monthlySalesData.error) throw monthlySalesData.error;

        setMetrics({
          inventory: inventoryData.data[0],
          revenue: revenueData.data[0],
          customers: customerData.data[0],
          monthly_sales: monthlySalesData.data
        });

      } catch (error) {
        console.error("Error fetching metrics:", error);
        setError("Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardMetrics();
  }, [storeId, date]);

  // useEffect(() => {
  //   async function fetchStats() {
  //     try {
  //       setLoading(true);
  //       const stats = await getCategoryStats(selectedCategory, date);
  //       console.log(stats);
  //       setStats(stats);
  //     } catch (error) {
  //       console.error("Failed to fetch stats:", error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }

  //   fetchStats();
  // }, [selectedCategory, date]);

  const setDateHandler = (data: DateRange | undefined) => {
    setDate(data);
  };
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  // Logging function
  const log = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  // Remove the inline scripts and update the useEffect for browser compatibility
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/);
      if (chromeVersion && parseInt(chromeVersion[1]) < 89) {
        log('Warning! Keep in mind this sample has been tested with Chrome 89.');
      }

      if (!('NDEFReader' in window)) {
        log('Web NFC is not available. Use Chrome on Android.');
      }
    }
  }, []);

  // NFC Scan handler
  const handleScan = async () => {
    log('User clicked scan button');

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      log('> Scan started');

      ndef.addEventListener('readingerror', () => {
        log('Argh! Cannot read data from the NFC tag. Try another one?');
      });

      ndef.addEventListener('reading', ({ message, serialNumber }: any) => {
        log(`> Serial Number: ${serialNumber}`);
        log(`> Records: (${message.records.length})`);
      });
    } catch (error) {
      log(`Argh! ${error}`);
    }
  };

  // NFC Write handler
  const handleWrite = async () => {
    log('User clicked write button');

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.write('Hello world!');
      log('> Message written');
    } catch (error) {
      log(`Argh! ${error}`);
    }
  };

  // Make Read-only handler
  const handleMakeReadOnly = async () => {
    log('User clicked make read-only button');

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.makeReadOnly();
      log('> NFC tag has been made permanently read-only');
    } catch (error) {
      log(`Argh! ${error}`);
    }
  };

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="flex-1 space-y-8 px-4 py-8">
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1"></div>
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <CalendarDateRangePicker date={date} onDateChange={setDate} />
        </div>
      </div>

      <QuickActions />

      {/* <div className="mt-4 p-4 bg-gray-100 rounded">
        <h2 className="font-bold mb-2">Logs:</h2>
        {logs.map((log, index) => (
          <div key={index} className="mb-1">
            {log}
          </div>
        ))}
      </div> */}
      <POS/>
    </div>

 
  );
}

// export function DashboardRouter() {
//   const { role, storeId } = useProfile();

//   if (!role) return <LoadingScreen />;

//   return (
//     <>
//       {role === 'user' && <OnboardingScreen />}
//       {role === 'store_owner' && <StoreDashboard storeId={storeId} />}
//       {role === 'sales_associate' && <AssociateDashboard storeId={storeId} />}
//     </>
//   );
// }
