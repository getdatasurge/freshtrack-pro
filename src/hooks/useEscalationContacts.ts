import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useEscalationContacts() {
  return useQuery({
    queryKey: ["escalation-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalation_contacts")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as EscalationContact[];
    },
  });
}

export function useCreateEscalationContact() {
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-contacts"] });
    },
  });
}

export function useUpdateEscalationContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EscalationContact> & { id: string }) => {
      const { error } = await supabase
        .from("escalation_contacts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-contacts"] });
    },
  });
}

export function useDeleteEscalationContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("escalation_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-contacts"] });
    },
  });
}
