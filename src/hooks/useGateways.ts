import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gateway, GatewayInsert } from "@/types/ttn";
import { toast } from "sonner";
import { debugLog } from "@/lib/debugLogger";

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
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("gateways")
        .insert({
          ...gateway,
          created_by: user?.id || null,
        })
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

/**
 * Helper to get user-friendly error messages for gateway provisioning
 */
function getGatewayProvisionErrorMessage(error: string): string {
  if (error.includes('PERMISSION_MISSING') || error.includes('403')) {
    return "TTN API key missing required permissions. Regenerate key with gateways:write permission.";
  }
  if (error.includes('TTN_NOT_CONFIGURED') || error.includes('API_KEY_MISSING')) {
    return "TTN not configured. Go to Developer settings to set up TTN connection.";
  }
  if (error.includes('CONFLICT') || error.includes('409')) {
    return "Gateway EUI already registered to another TTN account.";
  }
  if (error.includes('INVALID_API_KEY') || error.includes('401')) {
    return "TTN API key is invalid or expired. Check your TTN connection settings.";
  }
  return error;
}

/**
 * Hook to provision a gateway to TTN
 */
export function useProvisionGateway() {
  const queryClient = useQueryClient();
  const [provisioningId, setProvisioningId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ 
      gatewayId, 
      organizationId 
    }: { 
      gatewayId: string; 
      organizationId: string;
    }) => {
      const requestId = crypto.randomUUID().slice(0, 8);
      const startTime = Date.now();
      
      setProvisioningId(gatewayId);

      debugLog.info('ttn', 'TTN_PROVISION_GATEWAY_REQUEST', {
        request_id: requestId,
        gateway_id: gatewayId,
        org_id: organizationId,
      });

      try {
        const { data, error } = await supabase.functions.invoke("ttn-provision-gateway", {
          body: { 
            action: "create", 
            gateway_id: gatewayId, 
            organization_id: organizationId 
          }
        });

        const durationMs = Date.now() - startTime;

        if (error) {
          debugLog.error('ttn', 'TTN_PROVISION_GATEWAY_ERROR', {
            request_id: requestId,
            gateway_id: gatewayId,
            error: error.message,
            duration_ms: durationMs,
          });
          throw new Error(error.message);
        }

        if (data && !data.success) {
          debugLog.error('ttn', 'TTN_PROVISION_GATEWAY_ERROR', {
            request_id: requestId,
            gateway_id: gatewayId,
            error_code: data.error_code,
            error: data.error,
            hint: data.hint,
            duration_ms: durationMs,
          });
          throw new Error(data.error || "Provisioning failed");
        }

        debugLog.info('ttn', 'TTN_PROVISION_GATEWAY_SUCCESS', {
          request_id: requestId,
          gateway_id: gatewayId,
          ttn_gateway_id: data?.gateway_id,
          outcome: data?.already_exists ? 'already_exists' : 'created',
          duration_ms: durationMs,
        });

        return data;
      } finally {
        setProvisioningId(null);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gateways"] });
      if (data?.already_exists) {
        toast.success("Gateway already registered in TTN - ready to use");
      } else {
        toast.success("Gateway registered in TTN successfully");
      }
    },
    onError: (error: Error) => {
      const message = getGatewayProvisionErrorMessage(error.message);
      toast.error(`Gateway registration failed: ${message}`);
    },
  });

  return {
    ...mutation,
    provisioningId,
    isProvisioning: (id: string) => provisioningId === id,
  };
}
