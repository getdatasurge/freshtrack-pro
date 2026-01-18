import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gateway, GatewayInsert } from "@/types/ttn";
import { toast } from "sonner";
import { debugLog } from "@/lib/debugLogger";
import { qk } from "@/lib/queryKeys";
import { invalidateGateways } from "@/lib/invalidation";

/**
 * Hook to fetch all gateways for an organization
 */
export function useGateways(orgId: string | null) {
  return useQuery({
    queryKey: qk.org(orgId).gateways(),
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
    queryKey: qk.gateway(gatewayId).details(),
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
    onSuccess: async (data) => {
      await invalidateGateways(queryClient, data.organization_id);
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
    onSuccess: async (data) => {
      await Promise.all([
        invalidateGateways(queryClient, data.organization_id),
        queryClient.invalidateQueries({ queryKey: qk.gateway(data.id).all }),
      ]);
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
    onSuccess: async (_, variables) => {
      await invalidateGateways(queryClient, variables.orgId);
      toast.success("Gateway deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete gateway: ${error.message}`);
    },
  });
}

interface ProvisionErrorDetails {
  message: string;
  hint?: string;
  requestId?: string;
}

/**
 * Helper to parse and format gateway provisioning errors
 */
function parseGatewayProvisionError(error: unknown): ProvisionErrorDetails {
  // Try to extract structured error from response
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    // Check for hint and request_id from edge function response
    const hint = typeof err.hint === 'string' ? err.hint : undefined;
    const requestId = typeof err.request_id === 'string' ? err.request_id : undefined;
    const errorCode = typeof err.error_code === 'string' ? err.error_code : undefined;
    const errorMessage = typeof err.error === 'string' ? err.error : undefined;
    
    if (errorCode || errorMessage) {
      let message = errorMessage || 'Provisioning failed';
      
      // Map error codes to user-friendly messages
      switch (errorCode) {
        case 'TTN_PERMISSION_DENIED':
          message = 'TTN API key lacks gateway permissions';
          break;
        case 'EUI_CONFLICT':
          message = 'Gateway EUI is already registered elsewhere';
          break;
        case 'INVALID_API_KEY':
          message = 'TTN API key is invalid or expired';
          break;
        case 'TTN_NOT_CONFIGURED':
          message = 'TTN connection not configured';
          break;
        case 'API_KEY_MISSING':
          message = 'TTN API key not configured';
          break;
      }
      
      return { message, hint, requestId };
    }
  }
  
  // Fallback for string errors
  const errorStr = error instanceof Error ? error.message : String(error);
  
  if (errorStr.includes('PERMISSION') || errorStr.includes('403')) {
    return { 
      message: 'TTN API key lacks gateway permissions',
      hint: "Regenerate your TTN API key with 'Write gateway access' permission"
    };
  }
  if (errorStr.includes('CONFLICT') || errorStr.includes('409')) {
    return { 
      message: 'Gateway EUI already registered',
      hint: 'This EUI is registered to another account. Use TTN Console to claim or delete it.'
    };
  }
  if (errorStr.includes('401')) {
    return { 
      message: 'TTN API key invalid',
      hint: 'Generate a new API key in TTN Console'
    };
  }
  
  return { message: errorStr };
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

        if (data && !data.success && !data.ok) {
          debugLog.error('ttn', 'TTN_PROVISION_GATEWAY_ERROR', {
            request_id: data.request_id || requestId,
            gateway_id: gatewayId,
            error_code: data.error_code,
            error: data.error,
            hint: data.hint,
            duration_ms: durationMs,
          });
          // Throw error object with structured data for better error handling
          const errorObj = new Error(data.error || "Provisioning failed");
          (errorObj as Error & { details?: unknown }).details = data;
          throw errorObj;
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
    onSuccess: async (data, variables) => {
      await invalidateGateways(queryClient, variables.organizationId);
      if (data?.already_exists) {
        toast.success("Gateway already registered in TTN - ready to use");
      } else {
        toast.success("Gateway registered in TTN successfully");
      }
    },
    onError: (error: Error & { details?: unknown }) => {
      const parsed = parseGatewayProvisionError(error.details || error);
      
      // Build toast message with hint if available
      let toastMessage = `Gateway registration failed: ${parsed.message}`;
      if (parsed.hint) {
        toastMessage += `. ${parsed.hint}`;
      }
      if (parsed.requestId) {
        toastMessage += ` (ref: ${parsed.requestId})`;
      }
      
      toast.error(toastMessage, {
        duration: 8000, // Longer duration for actionable errors
      });
    },
  });

  return {
    ...mutation,
    provisioningId,
    isProvisioning: (id: string) => provisioningId === id,
  };
}
