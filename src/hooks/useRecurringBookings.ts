import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type RecurringBooking = Tables<"recurring_bookings">;
type RecurringBookingInsert = TablesInsert<"recurring_bookings">;
type RecurringBookingUpdate = TablesUpdate<"recurring_bookings">;

export const useRecurringBookings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: recurringBookings = [], isLoading } = useQuery({
    queryKey: ["recurring_bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_bookings")
        .select("*, courts(name)")
        .order("day_of_week", { ascending: true })
        .order("time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const addRecurringBooking = useMutation({
    mutationFn: async (booking: RecurringBookingInsert) => {
      const { data, error } = await supabase
        .from("recurring_bookings")
        .insert(booking)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_bookings"] });
      toast({
        title: "Recurring booking created",
        description: "The recurring booking has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRecurringBooking = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: RecurringBookingUpdate }) => {
      const { data, error } = await supabase
        .from("recurring_bookings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_bookings"] });
      toast({
        title: "Recurring booking updated",
        description: "The recurring booking has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRecurringBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_bookings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_bookings"] });
      toast({
        title: "Recurring booking deleted",
        description: "The recurring booking has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateBookings = useMutation({
    mutationFn: async ({ id, weeksAhead = 4 }: { id: string; weeksAhead?: number }) => {
      const { data, error } = await supabase.rpc("generate_bookings_from_recurring", {
        _recurring_booking_id: id,
        _weeks_ahead: weeksAhead,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: "Bookings generated",
        description: `Successfully created ${count} bookings from recurring rule`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    recurringBookings,
    isLoading,
    addRecurringBooking: addRecurringBooking.mutate,
    updateRecurringBooking: updateRecurringBooking.mutate,
    deleteRecurringBooking: deleteRecurringBooking.mutate,
    generateBookings: generateBookings.mutate,
  };
};
