import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { useVenue } from "@/hooks/useVenue";

type RecurringBookingInsert = TablesInsert<"recurring_bookings">;
type RecurringBookingUpdate = TablesUpdate<"recurring_bookings">;

export const useRecurringBookings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuthSession();
  const { venue } = useVenue();
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const { data: recurringBookings = [], isLoading } = useQuery({
    queryKey: ["recurring_bookings", session?.user?.id, venue?.id],
    enabled: !!session?.user?.id && !!venue?.id,
    queryFn: async () => {
      const data = await apiFetch(`/api/venues/${venue?.id}/recurring-bookings`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const addRecurringBooking = useMutation({
    mutationFn: async (booking: RecurringBookingInsert) => {
      const response = await apiFetch(`/api/venues/${venue?.id}/recurring-bookings`, {
        method: "POST",
        body: JSON.stringify(booking),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_bookings"] });
      toast({
        title: "Recurring booking created",
        description: "The recurring booking has been added successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to create recurring booking"),
        variant: "destructive",
      });
    },
  });

  const updateRecurringBooking = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: RecurringBookingUpdate }) => {
      const response = await apiFetch(`/api/recurring-bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_bookings"] });
      toast({
        title: "Recurring booking updated",
        description: "The recurring booking has been updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update recurring booking"),
        variant: "destructive",
      });
    },
  });

  const deleteRecurringBooking = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/recurring-bookings/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_bookings"] });
      toast({
        title: "Recurring booking deleted",
        description: "The recurring booking has been removed successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete recurring booking"),
        variant: "destructive",
      });
    },
  });

  const generateBookings = useMutation({
    mutationFn: async ({ id, weeksAhead = 4 }: { id: string; weeksAhead?: number }) => {
      const response = await apiFetch(`/api/recurring-bookings/${id}/generate`, {
        method: "POST",
        body: JSON.stringify({ weeksAhead }),
      });
      return response;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Bookings generated",
        description: `Successfully created ${count} bookings from recurring rule`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to generate bookings"),
        variant: "destructive",
      });
    },
  });

  return {
    recurringBookings,
    isLoading,
    addRecurringBooking: addRecurringBooking.mutateAsync,
    updateRecurringBooking: updateRecurringBooking.mutate,
    deleteRecurringBooking: deleteRecurringBooking.mutate,
    generateBookings: generateBookings.mutate,
  };
};
