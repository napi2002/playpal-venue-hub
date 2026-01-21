import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuthSession } from "@/contexts/AuthContext";

export interface Integration {
  id: string;
  venue_id: string;
  integration_type: string;
  is_enabled: boolean;
  config: unknown;
  credentials_encrypted: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useIntegrations = () => {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .order("integration_type", { ascending: true });

      if (error) throw error;
      return data as Integration[];
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Integration> }) => {
      const { error } = await supabase
        .from("integrations")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to update integration"));
    },
  });

  const createIntegration = useMutation({
    mutationFn: async (integration: Omit<Integration, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("integrations")
        .insert(integration);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration added successfully");
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to add integration"));
    },
  });

  return {
    integrations,
    isLoading,
    updateIntegration: updateIntegration.mutate,
    createIntegration: createIntegration.mutate,
  };
};
