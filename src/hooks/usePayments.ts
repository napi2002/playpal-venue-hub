import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthSession } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import { usePortalContext } from "@/hooks/usePortalContext";

export interface Payment {
  id: string;
  booking_id: string;
  venue_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  transaction_date: string | null;
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
  const { session } = useAuthSession();
  const { portalContext } = usePortalContext();
  const isScopedAdmin = portalContext?.role === "admin" && (portalContext.courtIds?.length ?? 0) > 0;
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", session?.user?.id],
    enabled: !!session?.user?.id && portalContext?.role === "admin" && !isScopedAdmin,
    queryFn: async () => {
      const response = (await apiFetch("/api/payments?page=1&pageSize=200")) as {
        data?: Payment[];
      };
      return response.data ?? [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Payment> }) => {
      await apiFetch(`/api/payments/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update payment"));
    },
  });

  const refundPayment = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await apiFetch(`/api/payments/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "refunded",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment refunded successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to refund payment"));
    },
  });

  return {
    payments,
    isLoading,
    updatePayment: updatePayment.mutate,
    refundPayment: refundPayment.mutate,
  };
};
