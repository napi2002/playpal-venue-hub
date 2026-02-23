import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuthSession();
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
        if (error instanceof Error && error.message.includes("Admin access required")) {
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
