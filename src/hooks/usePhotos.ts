import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { useVenue } from "@/hooks/useVenue";

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
  const { venue } = useVenue();
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["photos", session?.user?.id, venue?.id],
    enabled: !!session?.user?.id && !!venue?.id,
    queryFn: async () => {
      const data = await apiFetch(`/api/venues/${venue?.id}/photos`);
      return Array.isArray(data) ? (data as Photo[]) : [];
    },
  });

  return { photos, isLoading };
};
