import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Court = Tables<"courts">;

export const useCourts = () => {
  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["courts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("*")
        .eq("status", "active")
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
