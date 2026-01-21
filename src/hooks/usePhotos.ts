import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/contexts/AuthContext";

type Photo = {
  id: string;
  venue_id: string;
  court_id: string | null;
  type: "COVER" | "ENTRANCE" | "FACILITY" | "COURT";
  url: string;
  created_at: string;
};

export const usePhotos = () => {
  const { session } = useAuthSession();
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["photos", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("photos").select("*");
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  return { photos, isLoading };
};
