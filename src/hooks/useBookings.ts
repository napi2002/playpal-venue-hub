import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { useVenue } from "@/hooks/useVenue";

type BookingInsert = TablesInsert<"bookings">;
type BookingUpdate = TablesUpdate<"bookings">;

export const useBookings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuthSession();
  const { venue } = useVenue();
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", session?.user?.id, venue?.id],
    enabled: !!session?.user?.id && !!venue?.id,
    queryFn: async () => {
      const data = await apiFetch(`/api/venues/${venue?.id}/bookings/list`);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const addBooking = useMutation({
    mutationFn: async (booking: BookingInsert) => {
      const response = await apiFetch(`/api/venues/${booking.venue_id}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          venueId: booking.venue_id,
          courtId: booking.court_id,
          slotStart: booking.slot_start,
          slotEnd: booking.slot_end,
          durationMinutes: booking.duration_minutes,
          status: booking.status,
          totalPrice: booking.total_price,
          currency: booking.currency ?? "THB",
          notes: booking.notes,
          bookingNumber: booking.booking_number,
          playerName: booking.player_name,
          playerEmail: booking.player_email,
          source: booking.source,
          paymentStatus: booking.payment_status,
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Booking created",
        description: "The booking has been added successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to create booking"),
        variant: "destructive",
      });
    },
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: BookingUpdate }) => {
      const response = await apiFetch(`/api/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: updates.status,
          paymentStatus: updates.payment_status,
          cancellationReason: updates.cancellation_reason,
          cancellationTimestamp: updates.cancellation_timestamp,
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Booking updated",
        description: "The booking has been updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to update booking"),
        variant: "destructive",
      });
    },
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "cancelled",
          cancellationTimestamp: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Booking deleted",
        description: "The booking has been removed successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error, "Failed to delete booking"),
        variant: "destructive",
      });
    },
  });

  return {
    bookings,
    isLoading,
    addBooking: addBooking.mutateAsync,
    updateBooking: updateBooking.mutate,
    deleteBooking: deleteBooking.mutate,
  };
};
