import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { toast } from "sonner";
import type {
  AlarmDefinition,
  AlarmEvent,
  AlarmEventState,
  AlarmSeverity,
  AlarmCategory,
  DetectionTier,
  AvailableAlarmRow,
  AlarmOverride,
} from "@/types/alarms";

// Helper: untyped supabase access for alarm library tables
// (Generated types may lag behind migrations; this avoids TS errors)
const db = supabase as any;

// ─── Alarm Definitions ───────────────────────────────────────

interface AlarmDefinitionFilters {
  category?: AlarmCategory;
  tier?: DetectionTier;
  severity?: AlarmSeverity;
}

/**
 * Fetch all alarm definitions (admin view).
 * Supports optional filtering by category, tier, and severity.
 */
export function useAlarmDefinitions(filters?: AlarmDefinitionFilters) {
  return useQuery({
    queryKey: ['alarm-definitions', filters],
    queryFn: async (): Promise<AlarmDefinition[]> => {
      let query = db
        .from("alarm_definitions")
        .select("*")
        .order("category")
        .order("sort_order");

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      if (filters?.tier) {
        query = query.eq("detection_tier", filters.tier);
      }
      if (filters?.severity) {
        query = query.eq("severity", filters.severity);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AlarmDefinition[];
    },
  });
}

// ─── Unit Alarms (Resolved) ─────────────────────────────────

/**
 * Fetch available alarms for a specific unit.
 * Uses the get_available_alarms_for_unit RPC which resolves
 * tiers, sensors, and the override chain.
 */
export function useUnitAlarms(unitId: string | null, orgId: string | null, siteId?: string | null) {
  return useQuery({
    queryKey: qk.unit(unitId).alarmDefinitions(),
    queryFn: async (): Promise<AvailableAlarmRow[]> => {
      if (!unitId || !orgId) return [];

      const { data, error } = await db.rpc("get_available_alarms_for_unit", {
        p_unit_id: unitId,
        p_org_id: orgId,
        p_site_id: siteId ?? null,
      });

      if (error) throw error;
      return (data ?? []) as AvailableAlarmRow[];
    },
    enabled: !!unitId && !!orgId,
  });
}

// ─── Alarm Events ────────────────────────────────────────────

interface AlarmEventFilters {
  state?: AlarmEventState;
  severity?: AlarmSeverity;
  unitId?: string;
}

/**
 * Fetch alarm events for an organization with optional filters.
 */
export function useAlarmEvents(orgId: string | null, filters?: AlarmEventFilters) {
  return useQuery({
    queryKey: qk.org(orgId).alarmEvents(filters as Record<string, unknown>),
    queryFn: async (): Promise<AlarmEvent[]> => {
      if (!orgId) return [];

      let query = db
        .from("alarm_events")
        .select("*, alarm_definitions(*)")
        .eq("org_id", orgId)
        .order("triggered_at", { ascending: false });

      if (filters?.state) {
        query = query.eq("state", filters.state);
      }
      if (filters?.severity) {
        query = query.eq("severity_at_trigger", filters.severity);
      }
      if (filters?.unitId) {
        query = query.eq("unit_id", filters.unitId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        ...row,
        alarm_definition: row.alarm_definitions ?? undefined,
      })) as AlarmEvent[];
    },
    enabled: !!orgId,
  });
}

// ─── Alarm Event Actions ─────────────────────────────────────

/**
 * Mutations for alarm event lifecycle: acknowledge, resolve, snooze.
 */
export function useAlarmEventActions() {
  const queryClient = useQueryClient();

  const acknowledge = useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const { error } = await db
        .from("alarm_events")
        .update({
          state: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId,
        })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarm-events'] });
      toast.success("Alarm acknowledged");
    },
    onError: (err: Error) => {
      toast.error(`Failed to acknowledge alarm: ${err.message}`);
    },
  });

  const resolve = useMutation({
    mutationFn: async ({
      eventId, userId, notes, correctiveAction,
    }: {
      eventId: string; userId: string; notes?: string; correctiveAction?: string;
    }) => {
      const { error } = await db
        .from("alarm_events")
        .update({
          state: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolution_notes: notes ?? null,
          corrective_action_taken: correctiveAction ?? null,
        })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarm-events'] });
      toast.success("Alarm resolved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to resolve alarm: ${err.message}`);
    },
  });

  const snooze = useMutation({
    mutationFn: async ({ eventId, until }: { eventId: string; until: string }) => {
      const { error } = await db
        .from("alarm_events")
        .update({ state: "snoozed", snoozed_until: until })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarm-events'] });
      toast.success("Alarm snoozed");
    },
    onError: (err: Error) => {
      toast.error(`Failed to snooze alarm: ${err.message}`);
    },
  });

  return { acknowledge, resolve, snooze };
}

// ─── Alarm Overrides ─────────────────────────────────────────

/**
 * Mutations for creating/updating alarm overrides at org, site, or unit level.
 */
export function useAlarmOverrides(orgId: string | null) {
  const queryClient = useQueryClient();

  const upsertOrgOverride = useMutation({
    mutationFn: async (override: Omit<AlarmOverride, 'id' | 'created_at' | 'updated_at' | 'site_id' | 'unit_id'>) => {
      const { data: existing } = await db
        .from("alarm_org_overrides")
        .select("id")
        .eq("alarm_definition_id", override.alarm_definition_id)
        .eq("org_id", override.org_id)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from("alarm_org_overrides").update(override).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("alarm_org_overrides").insert(override);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org(orgId).alarmOverrides() });
      toast.success("Organization override saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save override: ${err.message}`);
    },
  });

  const upsertSiteOverride = useMutation({
    mutationFn: async (override: Omit<AlarmOverride, 'id' | 'created_at' | 'updated_at' | 'unit_id'> & { site_id: string }) => {
      const { data: existing } = await db
        .from("alarm_site_overrides")
        .select("id")
        .eq("alarm_definition_id", override.alarm_definition_id)
        .eq("org_id", override.org_id)
        .eq("site_id", override.site_id)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from("alarm_site_overrides").update(override).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("alarm_site_overrides").insert(override);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org(orgId).alarmOverrides() });
      toast.success("Site override saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save override: ${err.message}`);
    },
  });

  const upsertUnitOverride = useMutation({
    mutationFn: async (override: Omit<AlarmOverride, 'id' | 'created_at' | 'updated_at' | 'site_id'> & { unit_id: string }) => {
      const { data: existing } = await db
        .from("alarm_unit_overrides")
        .select("id")
        .eq("alarm_definition_id", override.alarm_definition_id)
        .eq("org_id", override.org_id)
        .eq("unit_id", override.unit_id)
        .maybeSingle();

      if (existing) {
        const { error } = await db.from("alarm_unit_overrides").update(override).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("alarm_unit_overrides").insert(override);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.org(orgId).alarmOverrides() });
      toast.success("Unit override saved");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save override: ${err.message}`);
    },
  });

  return { upsertOrgOverride, upsertSiteOverride, upsertUnitOverride };
}

// ─── Alarm Definition Admin ──────────────────────────────────

/**
 * Admin mutations for creating and updating alarm definitions.
 */
export function useAlarmDefinitionAdmin() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (definition: Partial<AlarmDefinition>) => {
      const { data, error } = await db
        .from("alarm_definitions")
        .insert(definition)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarm-definitions'] });
      toast.success("Alarm definition created");
    },
    onError: (err: Error) => {
      toast.error(`Failed to create alarm definition: ${err.message}`);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AlarmDefinition> }) => {
      const { data, error } = await db
        .from("alarm_definitions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarm-definitions'] });
      toast.success("Alarm definition updated");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update alarm definition: ${err.message}`);
    },
  });

  return { create, update };
}
