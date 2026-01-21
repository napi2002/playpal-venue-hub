import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/contexts/AuthContext";

type Venue = Tables<"venues">;
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
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Venue | null;
    },
  });

  const updateVenue = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: VenueUpdate }) => {
      const { data, error } = await supabase
        .from("venues")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Venue;
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
      const { data, error } = await supabase.rpc("create_venue_for_user", {
        _name: payload.name,
        _timezone: payload.timezone,
        _address: payload.address,
        _phone: payload.phone,
        _email: payload.email,
        _tax_information: payload.tax_information,
      });

      if (error) throw error;
      return data as Venue;
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
