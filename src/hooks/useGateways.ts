import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gateway, GatewayInsert } from "@/types/ttn";
import { toast } from "sonner";

/**
 * Hook to fetch all gateways for an organization
 */
export function useGateways(orgId: string | null) {
  return useQuery({
    queryKey: ["gateways", orgId],
    queryFn: async (): Promise<Gateway[]> => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from("gateways")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Gateway[];
    },
    enabled: !!orgId,
  });
}

/**
 * Hook to fetch a single gateway by ID
 */
export function useGateway(gatewayId: string | null) {
  return useQuery({
    queryKey: ["gateway", gatewayId],
    queryFn: async (): Promise<Gateway | null> => {
      if (!gatewayId) return null;

      const { data, error } = await supabase
        .from("gateways")
        .select("*")
        .eq("id", gatewayId)
        .maybeSingle();

      if (error) throw error;
      return data as Gateway | null;
    },
    enabled: !!gatewayId,
  });
}

/**
 * Hook to create a new gateway
 */
export function useCreateGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gateway: GatewayInsert): Promise<Gateway> => {
      const { data, error } = await supabase
        .from("gateways")
        .insert(gateway)
        .select()
        .single();

      if (error) throw error;
      return data as Gateway;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gateways", data.organization_id] });
      toast.success("Gateway created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create gateway: ${error.message}`);
    },
  });
}

/**
 * Hook to update a gateway
 */
export function useUpdateGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<Gateway> 
    }): Promise<Gateway> => {
      const { data, error } = await supabase
        .from("gateways")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Gateway;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gateways", data.organization_id] });
      queryClient.invalidateQueries({ queryKey: ["gateway", data.id] });
      toast.success("Gateway updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update gateway: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a gateway
 */
export function useDeleteGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, orgId }: { id: string; orgId: string }): Promise<void> => {
      const { error } = await supabase
        .from("gateways")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["gateways", variables.orgId] });
      toast.success("Gateway deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete gateway: ${error.message}`);
    },
  });
}
