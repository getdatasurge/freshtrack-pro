import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { qk } from "@/lib/queryKeys";
import { invalidateGateways } from "@/lib/invalidation";
import type { TtnProvisioningState } from "@/types/ttn";

export interface CheckGatewayResult {
  gateway_id: string;
  organization_id: string;
  provisioning_state: TtnProvisioningState;
  ttn_gateway_id?: string;
  error?: string;
  checked_at: string;
}

export interface CheckGatewayResponse {
  success: boolean;
  checked_count: number;
  summary: {
    total: number;
    exists_in_ttn: number;
    missing_in_ttn: number;
    not_configured: number;
    error: number;
  };
  results: CheckGatewayResult[];
}

/**
 * Hook to check whether gateways exist on TTN.
 *
 * Accepts either specific gateway IDs or an organization_id to check all
 * unlinked gateways. Gateways that already have `ttn_gateway_id` set are
 * skipped (they're already provisioned — no need to re-check).
 */
export function useCheckTtnGatewayState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      params: { gatewayIds: string[] } | { organizationId: string }
    ): Promise<CheckGatewayResponse> => {
      const body =
        "gatewayIds" in params
          ? { gateway_ids: params.gatewayIds }
          : { organization_id: params.organizationId };

      const { data, error } = await supabase.functions.invoke(
        "check-ttn-gateway-exists",
        { body }
      );

      if (error) {
        console.error("[useCheckTtnGatewayState] Error:", error);
        throw new Error(error.message || "Failed to check gateway TTN status");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Unknown error checking gateway status");
      }

      return data as CheckGatewayResponse;
    },

    onSuccess: (data) => {
      // Invalidate gateway queries for affected orgs
      const orgIds = [
        ...new Set(data.results.map((r) => r.organization_id).filter(Boolean)),
      ];
      for (const orgId of orgIds) {
        invalidateGateways(queryClient, orgId);
      }

      const { exists_in_ttn, missing_in_ttn, error: errorCount } = data.summary;

      if (data.checked_count === 0) {
        // All gateways already provisioned — nothing to check
        return;
      }

      // Only show toasts for actionable outcomes (found or error)
      // Don't toast "not yet on TTN" — the UI already shows provisioning state
      if (data.checked_count === 1) {
        const result = data.results[0];
        if (result.provisioning_state === "exists_in_ttn") {
          toast.success("Gateway found on TTN", {
            description: `Linked as ${result.ttn_gateway_id}`,
          });
        } else if (result.provisioning_state === "error") {
          toast.warning("Unable to verify gateway", {
            description:
              result.error && result.error.length > 120
                ? result.error.substring(0, 117) + "..."
                : result.error,
          });
        }
      } else if (exists_in_ttn > 0 || errorCount > 0) {
        const parts: string[] = [];
        if (exists_in_ttn > 0) parts.push(`${exists_in_ttn} found and linked`);
        if (errorCount > 0) parts.push(`${errorCount} errors`);
        toast.success(`Verified ${data.checked_count} gateways`, {
          description: parts.join(", "),
        });
      }
    },

    onError: (error: Error) => {
      toast.error("Unable to verify gateways", {
        description:
          error.message.length > 120
            ? error.message.substring(0, 117) + "..."
            : error.message,
      });
    },
  });
}
