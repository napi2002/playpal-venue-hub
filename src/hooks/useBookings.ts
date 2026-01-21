import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthSession } from "@/contexts/AuthContext";

type Booking = Tables<"bookings">;
type BookingInsert = TablesInsert<"bookings">;
type BookingUpdate = TablesUpdate<"bookings">;

export const useBookings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { session } = useAuthSession();
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, courts(name)")
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const addBooking = useMutation({
    mutationFn: async (booking: BookingInsert) => {
      const { data, error } = await supabase
        .from("bookings")
        .insert(booking)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", id);

      if (error) throw error;
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
