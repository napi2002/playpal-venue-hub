import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";

type VenueUpdate = TablesUpdate<"venues">;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useVenue = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuthSession();

  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const data = await apiFetch("/api/venue");
      return data ?? null;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updateVenue = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: VenueUpdate }) => {
      const response = await apiFetch(`/api/venues/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue"] });
      toast({
        title: "Venue updated",
        description: "Your venue information has been saved.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update venue"),
        variant: "destructive",
      });
    },
  });

  const createVenue = useMutation({
    mutationFn: async (payload: {
      name: string | null;
      timezone: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      tax_information: string | null;
    }) => {
      const response = await apiFetch("/api/venues/draft", {
        method: "POST",
        body: JSON.stringify({
          profile: {
            venueNameEn: payload.name ?? "New Venue",
            venueNameTh: null,
            venueType: null,
            addressLine1: payload.address ?? null,
            subdistrict: null,
            district: null,
            province: null,
            postcode: null,
            googleMapsUrl: null,
            openingHours: null,
            defaultSlotDurationMins: null,
            email: payload.email ?? null,
            phone: payload.phone ?? null,
          },
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue"] });
      toast({
        title: "Venue created",
        description: "Your venue has been created.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to create venue"),
        variant: "destructive",
      });
    },
  });

  return {
    venue,
    isLoading,
    updateVenue: updateVenue.mutateAsync,
    createVenue: createVenue.mutateAsync,
    isSaving: updateVenue.isPending || createVenue.isPending,
  };
};
