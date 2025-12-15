import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Payment {
  id: string;
  booking_id: string;
  venue_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_provider: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  bookings?: {
    booking_number: string;
    player_name: string;
    player_email: string;
    date: string;
    time: string;
  };
}

export const usePayments = () => {
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          bookings (
            booking_number,
            player_name,
            player_email,
            date,
            time
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Payment> }) => {
      const { error } = await supabase
        .from("payments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update payment");
    },
  });

  const refundPayment = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from("payments")
        .update({
          status: "refunded",
          refund_amount: amount,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment refunded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to refund payment");
    },
  });

  return {
    payments,
    isLoading,
    updatePayment: updatePayment.mutate,
    refundPayment: refundPayment.mutate,
  };
};
