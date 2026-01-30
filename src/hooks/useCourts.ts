import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { useVenue } from "@/hooks/useVenue";

export const useCourts = () => {
  const { session } = useAuthSession();
  const { venue } = useVenue();
  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["courts", session?.user?.id, venue?.id],
    enabled: !!session?.user?.id && !!venue?.id,
    queryFn: async () => {
      const data = await apiFetch(`/api/venues/${venue?.id}/courts`);
      return Array.isArray(data) ? data : [];
    },
  });

  return {
    courts,
    isLoading,
  };
};
