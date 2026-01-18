import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";

export interface DeprovisionJob {
  id: string;
  organization_id: string;
  sensor_id: string | null;
  dev_eui: string;
  ttn_device_id: string | null;
  ttn_application_id: string;
  reason: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_payload: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  site_id: string | null;
  unit_id: string | null;
  sensor_name: string | null;
}

export interface TTNDevice {
  device_id: string;
  dev_eui: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JobStats {
  pending: number;
  running: number;
  retrying: number;
  failed: number;
  blocked: number;
  succeeded: number;
  needs_attention: number;
}

/**
 * Hook to fetch TTN deprovision jobs for an organization
 */
export function useTTNDeprovisionJobs(orgId: string | null, statusFilter?: string[]) {
  return useQuery({
    queryKey: qk.org(orgId).ttnDeprovisionJobs(statusFilter),
    queryFn: async (): Promise<DeprovisionJob[]> => {
      if (!orgId) return [];

      let query = supabase
        .from("ttn_deprovision_jobs")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter && statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DeprovisionJob[];
    },
    enabled: !!orgId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to get job statistics
 */
export function useTTNJobStats(orgId: string | null) {
  return useQuery({
    queryKey: qk.org(orgId).ttnJobStats(),
    queryFn: async (): Promise<JobStats> => {
      if (!orgId) return {
        pending: 0, running: 0, retrying: 0, failed: 0, blocked: 0, succeeded: 0, needs_attention: 0
      };

      const { data, error } = await supabase.rpc("get_deprovision_job_stats", {
        p_organization_id: orgId,
      });

      if (error) throw error;
      return data as unknown as JobStats;
    },
    enabled: !!orgId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

/**
 * Hook to scan TTN for orphaned devices
 */
export function useScanTTNOrphans() {
  return useMutation({
    mutationFn: async (organizationId: string): Promise<{
      ttn_application_id: string;
      devices: TTNDevice[];
      orphans: TTNDevice[];
      frostguard_sensors: number;
    }> => {
      // Ensure fresh session token before invoking edge function
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Session expired. Please sign in again.");
      }

      const { data, error } = await supabase.functions.invoke("ttn-list-devices", {
        body: { organization_id: organizationId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
  });
}

/**
 * Hook to manually enqueue a deprovision job for orphan cleanup
 */
export function useEnqueueOrphanCleanup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      orphans,
      ttnApplicationId,
    }: {
      organizationId: string;
      orphans: TTNDevice[];
      ttnApplicationId: string;
    }): Promise<number> => {
      const jobs = orphans.map(orphan => ({
        organization_id: organizationId,
        dev_eui: orphan.dev_eui,
        ttn_device_id: orphan.device_id,
        ttn_application_id: ttnApplicationId,
        reason: "MANUAL_CLEANUP",
        sensor_name: orphan.name || orphan.device_id,
      }));

      const { error, data } = await supabase
        .from("ttn_deprovision_jobs")
        .insert(jobs)
        .select();

      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: async (_, variables) => {
      // Invalidate TTN job queries for this org
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.org(variables.organizationId).ttnDeprovisionJobs() }),
        queryClient.invalidateQueries({ queryKey: qk.org(variables.organizationId).ttnJobStats() }),
        // Legacy keys for migration
        queryClient.invalidateQueries({ queryKey: ["ttn-deprovision-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["ttn-job-stats"] }),
      ]);
    },
  });
}

/**
 * Hook to retry a failed job
 */
export function useRetryDeprovisionJob(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string): Promise<void> => {
      const { error } = await supabase
        .from("ttn_deprovision_jobs")
        .update({
          status: "PENDING",
          attempts: 0,
          next_retry_at: null,
          last_error_code: null,
          last_error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    },
    onSuccess: async () => {
      // Invalidate TTN job queries for this org
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).ttnDeprovisionJobs() }),
        queryClient.invalidateQueries({ queryKey: qk.org(orgId).ttnJobStats() }),
        // Legacy keys for migration
        queryClient.invalidateQueries({ queryKey: ["ttn-deprovision-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["ttn-job-stats"] }),
      ]);
    },
  });
}
