import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { invalidateEscalationContacts } from "@/lib/invalidation";
import { useOrgScope } from "@/hooks/useOrgScope";

export interface EscalationContact {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  priority: number;
  notification_channels: string[];
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

/**
 * Hook to fetch escalation contacts for the current organization.
 * Uses org-scoped query key for proper cache invalidation on impersonation.
 */
export function useEscalationContacts() {
  const { orgId } = useOrgScope();
  
  return useQuery({
    queryKey: qk.org(orgId).escalationContacts(),
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from("escalation_contacts")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as EscalationContact[];
    },
    enabled: !!orgId,
  });
}

export function useCreateEscalationContact() {
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();

  return useMutation({
    mutationFn: async (contact: Omit<EscalationContact, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("escalation_contacts")
        .insert(contact)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      if (orgId) {
        await invalidateEscalationContacts(queryClient, orgId);
      }
    },
  });
}

export function useUpdateEscalationContact() {
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EscalationContact> & { id: string }) => {
      const { error } = await supabase
        .from("escalation_contacts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (orgId) {
        await invalidateEscalationContacts(queryClient, orgId);
      }
    },
  });
}

export function useDeleteEscalationContact() {
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("escalation_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (orgId) {
        await invalidateEscalationContacts(queryClient, orgId);
      }
    },
  });
}
