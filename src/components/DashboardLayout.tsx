import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  Calendar,
  BookOpen,
  CreditCard,
  ChevronLeft,
  LogOut,
  IdCard,
  LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePortalContext } from "@/hooks/usePortalContext";
import BrandMark from "@/components/BrandMark";

interface DashboardLayoutProps {
  children: ReactNode;
}

const venueAdminNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Venue & Courts", href: "/venue", icon: MapPin },
  { name: "Availability", href: "/availability", icon: Calendar },
  { name: "Bookings", href: "/bookings", icon: BookOpen },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Membership", href: "/membership", icon: IdCard },
];

const scopedAdminNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Venue & Courts", href: "/venue", icon: MapPin },
  { name: "Availability", href: "/availability", icon: Calendar },
  { name: "Bookings", href: "/bookings", icon: BookOpen },
];

const internalNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/users", icon: IdCard },
  { name: "Bookings", href: "/bookings", icon: BookOpen },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Plans", href: "/plans", icon: Calendar },
  { name: "Support", href: "/support", icon: LifeBuoy },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const { portalContext } = usePortalContext();
  const isScopedAdmin = portalContext?.role === "admin" && (portalContext.courtIds?.length ?? 0) > 0;
  const navigation =
    portalContext?.role === "internal"
      ? internalNavigation
      : isScopedAdmin
        ? scopedAdminNavigation
        : venueAdminNavigation;

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <BrandMark className="h-8 w-8" />
                <span className="font-semibold text-lg">PlayPal</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform",
                  collapsed && "rotate-180"
                )}
              />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              onClick={signOut}
              className={cn(
                "w-full justify-start gap-3",
                collapsed && "justify-center"
              )}
            >
              <LogOut className="h-5 w-5" />
              {!collapsed && <span>Sign out</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
