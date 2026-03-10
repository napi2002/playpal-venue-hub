import { useQuery } from "@tanstack/react-query";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";

export type PortalContext = {
  id: string;
  dbUserId: number;
  email: string | null;
  username: string | null;
  role: "admin" | "court";
  venueId: number | null;
  courtIds: number[];
  primaryCourtId: number | null;
};

export const usePortalContext = () => {
  const { session } = useAuthSession();

  const query = useQuery({
    queryKey: ["portal-context", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const data = await apiFetch("/api/me");
      return data as PortalContext;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    portalContext: query.data ?? null,
    isLoading: query.isLoading,
  };
};
