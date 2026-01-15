import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TtnProvisioningState =
  | "not_configured"
  | "unknown"
  | "exists_in_ttn"
  | "missing_in_ttn"
  | "error";

export type ProvisionedSource = "emulator" | "app" | "unknown" | "manual";

export interface CheckTtnResult {
  sensor_id: string;
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
      // Invalidate sensor queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["lora-sensors"] });

      // Show summary toast
      const existsCount = data.results.filter((r) => r.provisioning_state === "exists_in_ttn").length;
      const missingCount = data.results.filter((r) => r.provisioning_state === "missing_in_ttn").length;
      const errorCount = data.results.filter((r) => r.provisioning_state === "error").length;

      if (data.checked_count === 1) {
        const result = data.results[0];
        if (result.provisioning_state === "exists_in_ttn") {
          toast.success("Device found in TTN", { description: "Sensor is provisioned" });
        } else if (result.provisioning_state === "missing_in_ttn") {
          toast.info("Device not in TTN", { description: "Sensor can be provisioned" });
        } else if (result.provisioning_state === "error") {
          toast.error("Check failed", { description: result.error });
        } else {
          toast.warning("Not configured", { description: result.error });
        }
      } else {
        const parts: string[] = [];
        if (existsCount > 0) parts.push(`${existsCount} provisioned`);
        if (missingCount > 0) parts.push(`${missingCount} not in TTN`);
        if (errorCount > 0) parts.push(`${errorCount} errors`);
        toast.success(`Checked ${data.checked_count} sensors`, {
          description: parts.join(", "),
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to check TTN status", { description: error.message });
    },
  });
}
