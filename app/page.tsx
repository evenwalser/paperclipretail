"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
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

interface OverviewProps {
  currency: string;
  categoryId?: string;
  dateRange?: DateRange;
}

export default function DashboardPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = () => {
    signIn("google", { prompt: "select_account" });
  };

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const stats = await getCategoryStats(selectedCategory, date);
        console.log(stats);
        setStats(stats);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [selectedCategory, date]);

  const setDateHandler = (data: DateRange) => {
    setDate(date);
  };
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="flex-1 space-y-8 px-4 py-8">
      {/* {session ? (
        <>
          <p>Welcome!</p>
          <button onClick={() => signOut()}>Sign out</button>
        </>
      ) : (
        <button onClick={() => signIn("google")}>Sign in with Google</button>
      )} */}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <CalendarDateRangePicker date={date} onDateChange={setDate} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Category Selector - Now using V2 */}
      <Card>
        <CardHeader>
          <CardTitle>Select Category</CardTitle>
        </CardHeader>
        <CardContent>
          <CategorySelectorV2
            onSelect={handleCategoryChange}
            selectedCategory={selectedCategory}
          />
        </CardContent>
      </Card>

      {/* Category Performance Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Category Revenue
            </CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              £{stats?.revenue.total.toLocaleString() ?? "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              <p className="text-xs text-muted-foreground">
                {(stats?.revenue.percentageChange ?? 0) > 0 ? "+" : ""}
                {(stats?.revenue.percentageChange ?? 0).toFixed(1)}% from last
                month
              </p>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Items in Category
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.items.total.toLocaleString() ?? "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.items.newThisWeek} added this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sales Velocity
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.salesVelocity.averageDays.toFixed(1) ?? "0"} days
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.salesVelocity.description}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.returnRate.percentage.toFixed(1) ?? "0"}%
            </div>
            <p className="text-xs text-muted-foreground">
              {typeof stats?.returnRate.change === "number" && (
                <>
                  {stats.returnRate.change > 0 ? "+" : ""}
                  {stats.returnRate.change.toFixed(1)}% from last month
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Analytics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview
              currency="£"
              categoryId={selectedCategory}
              dateRange={date}
            />
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent>
            <TopSellingItems categoryId={selectedCategory} dateRange={date} />
          </CardContent>
        </Card>
      </div>
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
