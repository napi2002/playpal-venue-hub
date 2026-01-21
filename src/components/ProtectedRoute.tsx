import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuthSession();
  const [hasVenue, setHasVenue] = useState<boolean | null>(null);
  const [requiresOnboarding, setRequiresOnboarding] = useState<boolean | null>(null);
  const [checkingVenue, setCheckingVenue] = useState(false);
  const location = useLocation();

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
        const pendingSubmit = localStorage.getItem("playpal-onboarding-submitted") === "true";
        const { data, error } = await supabase
          .from("venues")
          .select("id,status")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;
        if (error || !data) {
          setHasVenue(false);
          setRequiresOnboarding(!pendingSubmit);
        } else {
          setHasVenue(true);
          setRequiresOnboarding(data.status !== "SUBMITTED");
          if (data.status === "SUBMITTED") {
            localStorage.removeItem("playpal-onboarding-submitted");
          }
        }
      } catch {
        if (!isMounted) return;
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
  }, [user?.id]);

  if (loading || (user && checkingVenue)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isOnboardingRoute =
    location.pathname === "/onboarding" || location.pathname === "/onboarding/success";

  if ((hasVenue === false || requiresOnboarding === true) && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiresOnboarding === false && isOnboardingRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
