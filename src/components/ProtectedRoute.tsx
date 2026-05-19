import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { supabase } from "@/integrations/supabase/client";
import { usePortalContext } from "@/hooks/usePortalContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuthSession();
  const { portalContext, isLoading: isPortalLoading } = usePortalContext();
  const [hasVenue, setHasVenue] = useState<boolean | null>(null);
  const [requiresOnboarding, setRequiresOnboarding] = useState<boolean | null>(null);
  const [checkingVenue, setCheckingVenue] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setHasVenue(null);
      setRequiresOnboarding(null);
      return () => {
        isMounted = false;
      };
    }

    const checkVenue = async () => {
      setCheckingVenue(true);
      try {
        if (portalContext?.role === "internal") {
          setHasVenue(true);
          setRequiresOnboarding(false);
          return;
        }

        const pendingSubmit = localStorage.getItem("playpal-onboarding-submitted") === "true";
        const data = await apiFetch("/api/venue");

        if (!isMounted) return;
        if (!data || data.error) {
          setHasVenue(false);
          setRequiresOnboarding(!pendingSubmit);
        } else {
          setHasVenue(true);
          setRequiresOnboarding(false);
          localStorage.removeItem("playpal-onboarding-submitted");
        }
      } catch (error) {
        if (!isMounted) return;
        if (
          error instanceof Error &&
          (error.message.includes("Admin access required") ||
            error.message.includes("Portal access required"))
        ) {
          await supabase.auth.signOut();
          navigate("/");
          return;
        }
        setHasVenue(false);
        setRequiresOnboarding(true);
      } finally {
        if (isMounted) {
          setCheckingVenue(false);
        }
      }
    };

    checkVenue();

    return () => {
      isMounted = false;
    };
  }, [navigate, portalContext?.role, user]);

  if (loading || isPortalLoading || (user && checkingVenue)) {
    return (
      <div className="min-h-screen flex w-full bg-background animate-pulse">
        <aside className="w-64 shrink-0 border-r border-border bg-sidebar">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center gap-3 border-b border-border px-4">
              <div className="h-7 w-7 rounded-md bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
            <div className="flex-1 space-y-1 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/60" />
              ))}
            </div>
          </div>
        </aside>
        <main className="flex-1 p-6 space-y-6 max-w-7xl">
          <div className="h-8 w-44 rounded bg-muted" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-muted" />
        </main>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isOnboardingRoute =
    location.pathname === "/onboarding" || location.pathname === "/onboarding/success";
  const internalAllowedPrefixes = [
    "/dashboard",
    "/users",
    "/bookings",
    "/payments",
    "/plans",
    "/support",
    "/account-management",
    "/court-management",
  ];
  const restrictedAdminPrefixes = ["/membership", "/payments", "/settings", "/onboarding"];
  const isInternalAllowedRoute = internalAllowedPrefixes.some((prefix) => location.pathname.startsWith(prefix));
  const isRestrictedAdminRoute = restrictedAdminPrefixes.some((prefix) => location.pathname.startsWith(prefix));
  const isScopedAdmin = portalContext?.role === "admin" && (portalContext.courtIds?.length ?? 0) > 0;

  if (portalContext?.role === "internal" && !isInternalAllowedRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  if (portalContext?.role === "admin" && isInternalAllowedRoute && location.pathname !== "/dashboard" && location.pathname !== "/bookings" && location.pathname !== "/payments") {
    return <Navigate to="/dashboard" replace />;
  }

  if (isScopedAdmin && isRestrictedAdminRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  if ((hasVenue === false || requiresOnboarding === true) && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiresOnboarding === false && isOnboardingRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
