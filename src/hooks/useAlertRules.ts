import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlertRules {
  manual_interval_minutes: number;
  manual_grace_minutes: number;
  expected_reading_interval_seconds: number;
  offline_trigger_multiplier: number;
  offline_trigger_additional_minutes: number;
  door_open_warning_minutes: number;
  door_open_critical_minutes: number;
  door_open_max_mask_minutes_per_day: number;
  excursion_confirm_minutes_door_closed: number;
  excursion_confirm_minutes_door_open: number;
  max_excursion_minutes: number;
  source_unit: boolean;
  source_site: boolean;
  source_org: boolean;
}

export interface AlertRulesRow {
  id: string;
  organization_id: string | null;
  site_id: string | null;
  unit_id: string | null;
  manual_interval_minutes: number | null;
  manual_grace_minutes: number | null;
  expected_reading_interval_seconds: number | null;
  offline_trigger_multiplier: number | null;
  offline_trigger_additional_minutes: number | null;
  door_open_warning_minutes: number | null;
  door_open_critical_minutes: number | null;
  door_open_max_mask_minutes_per_day: number | null;
  excursion_confirm_minutes_door_closed: number | null;
  excursion_confirm_minutes_door_open: number | null;
  max_excursion_minutes: number | null;
}

// Default values when no rules are configured
export const DEFAULT_ALERT_RULES: AlertRules = {
  manual_interval_minutes: 240, // 4 hours (Standard mode)
  manual_grace_minutes: 0,
  expected_reading_interval_seconds: 60,
  offline_trigger_multiplier: 2.0,
  offline_trigger_additional_minutes: 2,
  door_open_warning_minutes: 3,
  door_open_critical_minutes: 10,
  door_open_max_mask_minutes_per_day: 60,
  excursion_confirm_minutes_door_closed: 10,
  excursion_confirm_minutes_door_open: 20,
  max_excursion_minutes: 60,
  source_unit: false,
  source_site: false,
  source_org: false,
};

/**
 * Compute offline trigger in milliseconds based on rules
 */
export function computeOfflineTriggerMs(rules: AlertRules): number {
  return (
    rules.expected_reading_interval_seconds * rules.offline_trigger_multiplier * 1000 +
    rules.offline_trigger_additional_minutes * 60 * 1000
  );
}

/**
 * Compute manual required trigger in minutes (interval + grace)
 */
export function computeManualTriggerMinutes(rules: AlertRules): number {
  return rules.manual_interval_minutes + rules.manual_grace_minutes;
}

/**
 * Get effective alert rules for a specific unit using the DB function
 */
export function useUnitAlertRules(unitId: string | null) {
  return useQuery({
    queryKey: ["alert-rules", "unit", unitId],
    queryFn: async (): Promise<AlertRules> => {
      if (!unitId) return DEFAULT_ALERT_RULES;
      
      const { data, error } = await supabase.rpc("get_effective_alert_rules", {
        p_unit_id: unitId,
      });
      
      if (error || !data) {
        console.warn("Failed to get alert rules, using defaults:", error);
        return DEFAULT_ALERT_RULES;
      }
      
      // The RPC returns JSONB, parse it properly
      const rules = typeof data === 'object' && data !== null ? data : {};
      return {
        ...DEFAULT_ALERT_RULES,
        ...rules,
      } as AlertRules;
    },
    enabled: !!unitId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Get organization-level alert rules
 */
export function useOrgAlertRules(orgId: string | null) {
  return useQuery({
    queryKey: ["alert-rules", "org", orgId],
    queryFn: async (): Promise<AlertRulesRow | null> => {
      if (!orgId) return null;
      
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      
      if (error) {
        console.warn("Failed to get org alert rules:", error);
        return null;
      }
      
      return data as AlertRulesRow | null;
    },
    enabled: !!orgId,
  });
}

/**
 * Get site-level alert rules
 */
export function useSiteAlertRules(siteId: string | null) {
  return useQuery({
    queryKey: ["alert-rules", "site", siteId],
    queryFn: async (): Promise<AlertRulesRow | null> => {
      if (!siteId) return null;
      
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("site_id", siteId)
        .maybeSingle();
      
      if (error) {
        console.warn("Failed to get site alert rules:", error);
        return null;
      }
      
      return data as AlertRulesRow | null;
    },
    enabled: !!siteId,
  });
}

/**
 * Get unit-level alert rules override
 */
export function useUnitAlertRulesOverride(unitId: string | null) {
  return useQuery({
    queryKey: ["alert-rules", "unit-override", unitId],
    queryFn: async (): Promise<AlertRulesRow | null> => {
      if (!unitId) return null;
      
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("unit_id", unitId)
        .maybeSingle();
      
      if (error) {
        console.warn("Failed to get unit alert rules:", error);
        return null;
      }
      
      return data as AlertRulesRow | null;
    },
    enabled: !!unitId,
  });
}

/**
 * Upsert alert rules (create or update)
 */
export async function upsertAlertRules(
  scope: { organization_id?: string; site_id?: string; unit_id?: string },
  rules: Partial<AlertRulesRow>
): Promise<{ error: Error | null }> {
  // Determine the filter based on scope
  let filter: Record<string, string>;
  if (scope.organization_id) {
    filter = { organization_id: scope.organization_id };
  } else if (scope.site_id) {
    filter = { site_id: scope.site_id };
  } else if (scope.unit_id) {
    filter = { unit_id: scope.unit_id };
  } else {
    return { error: new Error("Must specify org, site, or unit") };
  }

  // Check if exists
  const { data: existing } = await supabase
    .from("alert_rules")
    .select("id")
    .match(filter)
    .maybeSingle();

  if (existing) {
    // Update
    const { error } = await supabase
      .from("alert_rules")
      .update(rules)
      .eq("id", existing.id);
    return { error: error as Error | null };
  } else {
    // Insert
    const { error } = await supabase
      .from("alert_rules")
      .insert({ ...filter, ...rules });
    return { error: error as Error | null };
  }
}

/**
 * Delete alert rules override
 */
export async function deleteAlertRules(
  scope: { organization_id?: string; site_id?: string; unit_id?: string }
): Promise<{ error: Error | null }> {
  let filter: Record<string, string>;
  if (scope.organization_id) {
    filter = { organization_id: scope.organization_id };
  } else if (scope.site_id) {
    filter = { site_id: scope.site_id };
  } else if (scope.unit_id) {
    filter = { unit_id: scope.unit_id };
  } else {
    return { error: new Error("Must specify org, site, or unit") };
  }

  const { error } = await supabase
    .from("alert_rules")
    .delete()
    .match(filter);

  return { error: error as Error | null };
}
