import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface TTNCleanupLogEntry {
  id: string;
  job_id: string | null;
  sensor_id: string | null;
  dev_eui: string;
  organization_id: string;
  action: string;
  status: string;
  ttn_response: unknown;
  ttn_status_code: number | null;
  ttn_endpoint: string | null;
  cluster: string | null;
  error_message: string | null;
  created_at: string;
  // Joined from deprovision job
  sensor_name?: string | null;
}

export interface SensorCleanupStatus {
  sensor_id: string;
  status: string; // PENDING | RUNNING | RETRYING | SUCCEEDED | FAILED | BLOCKED
}

/**
 * Fetch recent TTN cleanup log entries for the org
 */
export function useTTNCleanupLogs(orgId: string | null | undefined) {
  return useQuery({
    queryKey: qk.org(orgId ?? null).ttnCleanupLogs(),
    queryFn: async () => {
      if (!orgId) return [];

      // Query cleanup logs, join with deprovision jobs for sensor_name
      const { data, error } = await supabase
        .from("ttn_cleanup_log")
        .select(`
          id, job_id, sensor_id, dev_eui, organization_id,
          action, status, ttn_response, ttn_status_code,
          ttn_endpoint, cluster, error_message, created_at
        `)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Batch-fetch sensor names from deprovision jobs
      const jobIds = [...new Set((data || []).map(d => d.job_id).filter(Boolean))];
      let jobMap: Record<string, string | null> = {};
      
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase
          .from("ttn_deprovision_jobs")
          .select("id, sensor_name")
          .in("id", jobIds);
        
        if (jobs) {
          jobMap = Object.fromEntries(jobs.map(j => [j.id, j.sensor_name]));
        }
      }

      return (data || []).map(row => ({
        ...row,
        sensor_name: row.job_id ? jobMap[row.job_id] ?? null : null,
      })) as TTNCleanupLogEntry[];
    },
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
}

/**
 * Batch-fetch deprovision job statuses for a list of archived sensor IDs
 */
export function useSensorCleanupStatuses(orgId: string | null | undefined, sensorIds: string[]) {
  return useQuery({
    queryKey: [...qk.org(orgId ?? null).ttnCleanupLogs(), "sensor-statuses", sensorIds],
    queryFn: async (): Promise<Record<string, SensorCleanupStatus>> => {
      if (!orgId || sensorIds.length === 0) return {};

      const { data, error } = await supabase
        .from("ttn_deprovision_jobs")
        .select("id, sensor_id, status")
        .eq("organization_id", orgId)
        .in("sensor_id", sensorIds);

      if (error) throw error;

      // For each sensor, use the "worst" status (FAILED > BLOCKED > RETRYING > RUNNING > PENDING > SUCCEEDED)
      const statusPriority: Record<string, number> = {
        FAILED: 6, BLOCKED: 5, RETRYING: 4, RUNNING: 3, PENDING: 2, SUCCEEDED: 1,
      };

      const result: Record<string, SensorCleanupStatus> = {};
      for (const job of data || []) {
        if (!job.sensor_id) continue;
        const existing = result[job.sensor_id];
        if (!existing || (statusPriority[job.status] || 0) > (statusPriority[existing.status] || 0)) {
          result[job.sensor_id] = { sensor_id: job.sensor_id, status: job.status };
        }
      }

      return result;
    },
    enabled: !!orgId && sensorIds.length > 0,
    refetchInterval: 30_000,
  });
}
