import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useOrgScope } from "@/hooks/useOrgScope";

export interface AlertSuppression {
  id: string;
  organization_id: string;
  site_id: string | null;
  unit_id: string | null;
  alert_types: string[];
  reason: "maintenance" | "defrost" | "relocation" | "snooze" | "other";
  custom_reason: string | null;
  starts_at: string;
  ends_at: string;
  created_by: string | null;
  alert_id: string | null;
  created_at: string;
  // Joined fields
  unit?: { id: string; name: string } | null;
  site?: { id: string; name: string } | null;
}

export type CreateSuppressionInput = {
  organization_id: string;
  site_id?: string | null;
  unit_id?: string | null;
  alert_types?: string[];
  reason: "maintenance" | "defrost" | "relocation" | "snooze" | "other";
  custom_reason?: string | null;
  starts_at?: string;
  ends_at: string;
  alert_id?: string | null;
};

/**
 * Fetch active suppressions for the current organization.
 * Optionally filter by site or unit.
 */
export function useActiveSuppressions(siteId?: string | null, unitId?: string | null) {
  const { orgId } = useOrgScope();

  return useQuery({
    queryKey: qk.org(orgId).alertSuppressions(),
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from("alert_suppressions")
        .select("*, unit:units(id, name), site:sites(id, name)")
        .eq("organization_id", orgId)
        .lte("starts_at", new Date().toISOString())
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: true });

      if (unitId) {
        query = query.eq("unit_id", unitId);
      } else if (siteId) {
        query = query.eq("site_id", siteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AlertSuppression[];
    },
    enabled: !!orgId,
    refetchInterval: 60_000, // Refresh every minute to update time-remaining
  });
}

/**
 * Create a new alert suppression.
 */
export function useCreateSuppression() {
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();

  return useMutation({
    mutationFn: async (input: CreateSuppressionInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("alert_suppressions")
        .insert({
          organization_id: input.organization_id,
          site_id: input.site_id || null,
          unit_id: input.unit_id || null,
          alert_types: input.alert_types || [],
          reason: input.reason,
          custom_reason: input.custom_reason || null,
          starts_at: input.starts_at || new Date().toISOString(),
          ends_at: input.ends_at,
          created_by: user?.id || null,
          alert_id: input.alert_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org(orgId).alertSuppressions() });
    },
  });
}

/**
 * Cancel a suppression early by setting ends_at to now.
 */
export function useCancelSuppression() {
  const queryClient = useQueryClient();
  const { orgId } = useOrgScope();

  return useMutation({
    mutationFn: async (suppressionId: string) => {
      const { error } = await supabase
        .from("alert_suppressions")
        .update({ ends_at: new Date().toISOString() })
        .eq("id", suppressionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org(orgId).alertSuppressions() });
    },
  });
}

/**
 * Quick snooze an individual alert.
 * Creates a snooze suppression for the alert's unit and type.
 */
export function useSnoozeAlert() {
  const createSuppression = useCreateSuppression();

  return {
    ...createSuppression,
    snooze: (params: {
      organizationId: string;
      unitId: string;
      alertType: string;
      alertId: string;
      durationMinutes: number;
    }) => {
      const endsAt = new Date(Date.now() + params.durationMinutes * 60 * 1000).toISOString();
      return createSuppression.mutateAsync({
        organization_id: params.organizationId,
        unit_id: params.unitId,
        alert_types: [params.alertType],
        reason: "snooze",
        ends_at: endsAt,
        alert_id: params.alertId,
      });
    },
  };
}
