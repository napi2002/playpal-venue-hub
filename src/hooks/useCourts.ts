import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuthSession } from "@/contexts/AuthContext";

type Court = Tables<"courts">;

export const useCourts = () => {
  const { session } = useAuthSession();
  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["courts", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Court[];
    },
  });

  return {
    courts,
    isLoading,
  };
};
