import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { toast } from "sonner";
import type {
  SensorConfiguration,
  SensorPendingChange,
  DownlinkCommandParams,
  DownlinkResponse,
} from "@/types/sensorConfig";

// ---------------------------------------------------------------------------
// Fetch sensor configuration
// ---------------------------------------------------------------------------

export function useSensorConfig(sensorId: string | null) {
  return useQuery({
    queryKey: qk.sensor(sensorId).config(),
    queryFn: async (): Promise<SensorConfiguration | null> => {
      if (!sensorId) return null;
      const { data, error } = await supabase
        .from("sensor_configurations")
        .select("*")
        .eq("sensor_id", sensorId)
        .maybeSingle();
      if (error) throw error;
      return data as SensorConfiguration | null;
    },
    enabled: !!sensorId,
  });
}

// ---------------------------------------------------------------------------
// Fetch pending changes for a sensor (most recent first)
// ---------------------------------------------------------------------------

export function useSensorPendingChanges(sensorId: string | null) {
  return useQuery({
    queryKey: qk.sensor(sensorId).pendingChanges(),
    queryFn: async (): Promise<SensorPendingChange[]> => {
      if (!sensorId) return [];
      const { data, error } = await supabase
        .from("sensor_pending_changes")
        .select("*")
        .eq("sensor_id", sensorId)
        .order("requested_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as SensorPendingChange[];
    },
    enabled: !!sensorId,
  });
}

// ---------------------------------------------------------------------------
// Send downlink command (invokes edge function)
// ---------------------------------------------------------------------------

export function useSendDownlink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sensorId,
      commandType,
      commandParams,
    }: {
      sensorId: string;
      commandType: string;
      commandParams: DownlinkCommandParams;
    }): Promise<DownlinkResponse> => {
      const { data, error } = await supabase.functions.invoke(
        "ttn-send-downlink",
        {
          body: {
            sensor_id: sensorId,
            command_type: commandType,
            command_params: commandParams,
          },
        }
      );

      if (error) {
        // Try to extract detailed message from context
        let message = error.message;
        const ctx = (error as any)?.context;
        if (ctx) {
          try {
            const clone = ctx.clone ? ctx.clone() : ctx;
            if (typeof clone.json === "function") {
              const body = await clone.json();
              if (body?.error) message = body.error;
            }
          } catch {
            /* ignore */
          }
        }
        throw new Error(message);
      }

      if (data && !data.ok) {
        throw new Error(data.error || "Downlink failed");
      }

      return data as DownlinkResponse;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.sensor(variables.sensorId).config(),
        }),
        queryClient.invalidateQueries({
          queryKey: qk.sensor(variables.sensorId).pendingChanges(),
        }),
      ]);
      toast.success(
        "Downlink queued — device will receive it after next uplink (Class A)"
      );
    },
    onError: (error: Error) => {
      toast.error(`Downlink failed: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Count active (sent/queued) pending changes per sensor — for badge display
// ---------------------------------------------------------------------------

export function usePendingChangeCounts(sensorIds: string[]) {
  return useQuery({
    queryKey: ["pending-change-counts", ...sensorIds.sort()],
    queryFn: async (): Promise<Record<string, number>> => {
      if (sensorIds.length === 0) return {};
      const { data, error } = await supabase
        .from("sensor_pending_changes")
        .select("sensor_id, status")
        .in("sensor_id", sensorIds)
        .in("status", ["sent", "queued"]);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.sensor_id] = (counts[row.sensor_id] || 0) + 1;
      }
      return counts;
    },
    enabled: sensorIds.length > 0,
    refetchInterval: 30_000, // refresh every 30s for badge updates
  });
}

// ---------------------------------------------------------------------------
// Upsert sensor configuration (local DB only, no downlink)
// ---------------------------------------------------------------------------

export function useUpsertSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sensorId,
      organizationId,
      updates,
    }: {
      sensorId: string;
      organizationId: string;
      updates: Partial<SensorConfiguration>;
    }): Promise<SensorConfiguration> => {
      const { data, error } = await supabase
        .from("sensor_configurations")
        .upsert(
          {
            sensor_id: sensorId,
            organization_id: organizationId,
            ...updates,
          },
          { onConflict: "sensor_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as SensorConfiguration;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: qk.sensor(variables.sensorId).config(),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save sensor config: ${error.message}`);
    },
  });
}
