import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  venue_id: string;
  created_at: string;
  updated_at: string;
  roles?: {
    id: string;
    role: string;
  }[];
}

export const useTeam = () => {
  const queryClient = useQueryClient();

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const membersWithRoles = profiles.map((profile) => ({
        ...profile,
        roles: roles.filter((role) => role.user_id === profile.id),
      }));

      return membersWithRoles as TeamMember[];
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({
      userId,
      venueId,
      role,
    }: {
      userId: string;
      venueId: string;
      role: "admin" | "manager" | "owner" | "staff";
    }) => {
      // First check if user already has a role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .eq("venue_id", venueId)
        .maybeSingle();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role })
          .eq("id", existingRole.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert([{
          user_id: userId,
          venue_id: venueId,
          role,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Role updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const removeMemberRole = useMutation({
    mutationFn: async ({ roleId }: { roleId: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success("Role removed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove role");
    },
  });

  return {
    teamMembers,
    isLoading,
    updateMemberRole: updateMemberRole.mutate,
    removeMemberRole: removeMemberRole.mutate,
  };
};
