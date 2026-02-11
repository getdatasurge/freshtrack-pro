import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { qk } from "@/lib/queryKeys";

export type TtnProvisioningState =
  | "not_configured"
  | "unknown"
  | "exists_in_ttn"
  | "missing_in_ttn"
  | "error";

export type ProvisionedSource = "emulator" | "app" | "unknown" | "manual";

export interface CheckTtnResult {
  sensor_id: string;
  organization_id: string;
  provisioning_state: TtnProvisioningState;
  ttn_device_id?: string;
  ttn_app_id?: string;
  ttn_cluster?: string;
  error?: string;
  checked_at: string;
}

export interface CheckTtnResponse {
  success: boolean;
  checked_count: number;
  results: CheckTtnResult[];
}

/**
 * Hook to check TTN device existence for one or more sensors.
 * Updates the sensor's provisioning_state in the database.
 */
export function useCheckTtnProvisioningState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sensorIds: string[]): Promise<CheckTtnResponse> => {
      if (sensorIds.length === 0) {
        throw new Error("No sensor IDs provided");
      }

      const { data, error } = await supabase.functions.invoke("check-ttn-device-exists", {
        body: { sensor_ids: sensorIds },
      });

      if (error) {
        console.error("[useCheckTtnProvisioningState] Error:", error);
        throw new Error(error.message || "Failed to check TTN device status");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Unknown error checking TTN status");
      }

      return data as CheckTtnResponse;
    },
    onSuccess: (data) => {
      // Invalidate sensor queries using correct org-scoped keys
      const orgIds = [...new Set(data.results.map(r => r.organization_id).filter(Boolean))];
      orgIds.forEach(orgId => {
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).loraSensors() });
      });
      // Also invalidate legacy flat key for backwards compatibility
      queryClient.invalidateQueries({ queryKey: ["lora-sensors"] });

      // Show summary toast
      const existsCount = data.results.filter((r) => r.provisioning_state === "exists_in_ttn").length;
      const missingCount = data.results.filter((r) => r.provisioning_state === "missing_in_ttn").length;
      const errorCount = data.results.filter((r) => r.provisioning_state === "error").length;

      if (data.checked_count === 1) {
        const result = data.results[0];
        if (result.provisioning_state === "exists_in_ttn") {
          toast.success("Sensor is registered", { description: "Ready to send data" });
        } else if (result.provisioning_state === "missing_in_ttn") {
          toast.info("Sensor not yet registered", { description: "Click Provision to register it" });
        } else if (result.provisioning_state === "error") {
          toast.warning("Unable to verify sensor", { description: result.error });
        } else {
          toast.warning("Setup needed", { description: result.error });
        }
      } else {
        const parts: string[] = [];
        if (existsCount > 0) parts.push(`${existsCount} registered`);
        if (missingCount > 0) parts.push(`${missingCount} not registered`);
        if (errorCount > 0) parts.push(`${errorCount} unable to verify`);
        toast.success(`Verified ${data.checked_count} sensors`, {
          description: parts.join(", "),
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Unable to verify sensors", { description: error.message });
    },
  });
}
