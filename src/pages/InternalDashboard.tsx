import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiClient";

type OverviewResponse = {
  summary: {
    total_venues: number;
    active_venues_30d: number;
    total_admin_accounts: number;
    bookings_today: number;
    bookings_month: number;
    platform_gmv: string;
    commission_revenue: string;
    expiring_packages: number;
  } | null;
  activity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    happened_at: string;
  }>;
  expiringAccounts: Array<{
    id: number;
    venue_name: string;
    admin_email: string;
    plan: "starter" | "growth" | "pro" | "custom";
    months_paid: number;
    created_at: string;
    expires_at: string;
    expiry_status: "expiring" | "expired";
  }>;
};

const kpiClass = "border-slate-200 bg-white";

const InternalDashboard = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["internal-overview", query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      return (await apiFetch(`/api/internal/overview?${params.toString()}`)) as OverviewResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const summary = data?.summary;

  const cards = [
    ["Total Venues", summary?.total_venues ?? 0],
    ["Active Venues (30d)", summary?.active_venues_30d ?? 0],
    ["Venue Admin Accounts", summary?.total_admin_accounts ?? 0],
    ["Bookings Today", summary?.bookings_today ?? 0],
    ["Bookings This Month", summary?.bookings_month ?? 0],
    ["Platform GMV", `THB ${Number(summary?.platform_gmv ?? 0).toLocaleString()}`],
    ["Commission Revenue", `THB ${Number(summary?.commission_revenue ?? 0).toLocaleString()}`],
    ["Packages Expiring", summary?.expiring_packages ?? 0],
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">PlayPal Operations</h1>
            <p className="mt-1 text-sm text-slate-500">Internal console for venue operations, plans, bookings, and revenue.</p>
          </div>
          <div className="w-full max-w-md">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value]) => (
            <Card key={label} className={kpiClass}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{isLoading ? "..." : value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recent Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.activity?.length ? data.activity.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.detail}</p>
                    </div>
                    <div className="text-xs text-slate-400">{new Date(item.happened_at).toLocaleString()}</div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No recent activity found.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Quick Management Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]" onClick={() => navigate("/users")}>Create Venue</Button>
              <Button variant="outline" onClick={() => navigate("/users")}>Create Venue Admin</Button>
              <Button variant="outline" onClick={() => navigate("/plans")}>Add Plan</Button>
              <Button variant="outline" onClick={() => navigate("/users")}>View All Venues</Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Package Expiry Notices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.expiringAccounts?.length ? data.expiringAccounts.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-md border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{item.venue_name}</p>
                  <p className="text-sm text-slate-500">
                    {item.admin_email} · {item.plan} · {item.months_paid} month{item.months_paid === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-sm">
                  <span className={item.expiry_status === "expired" ? "font-medium text-[#FF7A33]" : "font-medium text-slate-700"}>
                    {item.expiry_status === "expired" ? "Expired" : "Expiring soon"}
                  </span>
                  <span className="ml-2 text-slate-500">{new Date(item.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No venue packages are near expiry.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InternalDashboard;
