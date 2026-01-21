import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthSession } from "@/contexts/AuthContext";

export const useAuth = () => {
  const { user, session, loading } = useAuthSession();
  const navigate = useNavigate();

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Signed in successfully");
      navigate("/dashboard");
      return { data, error: null };
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to sign in"));
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success("Signed out successfully");
      navigate("/");
      return { error: null };
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to sign out"));
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
  };
};
