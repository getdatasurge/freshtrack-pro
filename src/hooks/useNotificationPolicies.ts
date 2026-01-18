import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { invalidateNotificationPolicies } from "@/lib/invalidation";

// Alert types that can have notification policies
export const ALERT_TYPES = [
  "temp_excursion",
  "monitoring_interrupted",
  "missed_manual_entry",
  "low_battery",
  "sensor_fault",
  "door_open",
  "alarm_active",
  "suspected_cooling_failure",
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  temp_excursion: "Temperature Excursion",
  monitoring_interrupted: "Monitoring Interrupted",
  missed_manual_entry: "Missed Manual Entry",
  low_battery: "Low Battery",
  sensor_fault: "Sensor Fault",
  door_open: "Door Left Open",
  alarm_active: "Alarm Active",
  suspected_cooling_failure: "Suspected Cooling Failure",
};

export type NotificationChannel = "WEB_TOAST" | "IN_APP_CENTER" | "EMAIL" | "SMS";

export interface EscalationStep {
  delay_minutes: number;
  channels: ("EMAIL" | "SMS")[];
  contact_priority?: number;
  repeat: boolean;
}

export type AppRole = "owner" | "admin" | "manager" | "staff" | "viewer";

export interface NotificationPolicy {
  id?: string;
  organization_id?: string | null;
  site_id?: string | null;
  unit_id?: string | null;
  alert_type: string;
  initial_channels: NotificationChannel[];
  requires_ack: boolean;
  ack_deadline_minutes: number | null;
  escalation_steps: EscalationStep[];
  send_resolved_notifications: boolean;
  reminders_enabled: boolean;
  reminder_interval_minutes: number | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start_local: string | null;
  quiet_hours_end_local: string | null;
  severity_threshold: "INFO" | "WARNING" | "CRITICAL";
  allow_warning_notifications: boolean;
  // Recipient targeting
  notify_roles: AppRole[];
  notify_site_managers: boolean;
  notify_assigned_users: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EffectiveNotificationPolicy extends Omit<NotificationPolicy, "id" | "organization_id" | "site_id" | "unit_id"> {
  source_unit: boolean;
  source_site: boolean;
  source_org: boolean;
}

// Default policy values
export const DEFAULT_NOTIFICATION_POLICY: Omit<NotificationPolicy, "alert_type"> = {
  initial_channels: ["IN_APP_CENTER"],
  requires_ack: false,
  ack_deadline_minutes: null,
  escalation_steps: [],
  send_resolved_notifications: false,
  reminders_enabled: false,
  reminder_interval_minutes: null,
  quiet_hours_enabled: false,
  quiet_hours_start_local: null,
  quiet_hours_end_local: null,
  severity_threshold: "WARNING",
  allow_warning_notifications: false,
  notify_roles: ["owner", "admin"],
  notify_site_managers: true,
  notify_assigned_users: false,
};

// Helper to map DB row to NotificationPolicy
function mapDbRowToPolicy(row: Record<string, unknown>): NotificationPolicy {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string | null,
    site_id: row.site_id as string | null,
    unit_id: row.unit_id as string | null,
    alert_type: row.alert_type as string,
    initial_channels: (row.initial_channels || []) as NotificationChannel[],
    requires_ack: row.requires_ack as boolean,
    ack_deadline_minutes: row.ack_deadline_minutes as number | null,
    escalation_steps: (row.escalation_steps || []) as EscalationStep[],
    send_resolved_notifications: row.send_resolved_notifications as boolean,
    reminders_enabled: row.reminders_enabled as boolean,
    reminder_interval_minutes: row.reminder_interval_minutes as number | null,
    quiet_hours_enabled: row.quiet_hours_enabled as boolean,
    quiet_hours_start_local: row.quiet_hours_start_local as string | null,
    quiet_hours_end_local: row.quiet_hours_end_local as string | null,
    severity_threshold: row.severity_threshold as "INFO" | "WARNING" | "CRITICAL",
    allow_warning_notifications: row.allow_warning_notifications as boolean,
    notify_roles: (row.notify_roles || ["owner", "admin"]) as AppRole[],
    notify_site_managers: row.notify_site_managers as boolean ?? true,
    notify_assigned_users: row.notify_assigned_users as boolean ?? false,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// Hook to fetch org-level notification policies
export function useOrgNotificationPolicies(orgId: string | null) {
  return useQuery({
    queryKey: qk.org(orgId).notificationPolicies(),
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("notification_policies")
        .select("*")
        .eq("organization_id", orgId);
      if (error) throw error;
      return (data || []).map(mapDbRowToPolicy);
    },
    enabled: !!orgId,
  });
}

// Hook to fetch site-level notification policies
export function useSiteNotificationPolicies(siteId: string | null) {
  return useQuery({
    queryKey: ['site', siteId, 'notification-policies'] as const,
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("notification_policies")
        .select("*")
        .eq("site_id", siteId);
      if (error) throw error;
      return (data || []).map(mapDbRowToPolicy);
    },
    enabled: !!siteId,
  });
}

// Hook to fetch unit-level notification policies
export function useUnitNotificationPolicies(unitId: string | null) {
  return useQuery({
    queryKey: qk.unit(unitId).notificationPolicies(),
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("notification_policies")
        .select("*")
        .eq("unit_id", unitId);
      if (error) throw error;
      return (data || []).map(mapDbRowToPolicy);
    },
    enabled: !!unitId,
  });
}

// Hook to fetch effective notification policy for a unit + alert type
export function useEffectiveNotificationPolicy(unitId: string | null, alertType: string | null) {
  return useQuery({
    queryKey: qk.unit(unitId).notificationPolicies(alertType ?? undefined),
    queryFn: async () => {
      if (!unitId || !alertType) return null;
      const { data, error } = await supabase.rpc("get_effective_notification_policy", {
        p_unit_id: unitId,
        p_alert_type: alertType,
      });
      if (error) throw error;
      if (!data) return null;
      // Map the JSONB response
      const d = data as Record<string, unknown>;
      return {
        alert_type: alertType,
        initial_channels: (d.initial_channels || []) as NotificationChannel[],
        requires_ack: d.requires_ack as boolean,
        ack_deadline_minutes: d.ack_deadline_minutes as number | null,
        escalation_steps: (d.escalation_steps || []) as EscalationStep[],
        send_resolved_notifications: d.send_resolved_notifications as boolean,
        reminders_enabled: d.reminders_enabled as boolean,
        reminder_interval_minutes: d.reminder_interval_minutes as number | null,
        quiet_hours_enabled: d.quiet_hours_enabled as boolean,
        quiet_hours_start_local: d.quiet_hours_start_local as string | null,
        quiet_hours_end_local: d.quiet_hours_end_local as string | null,
        severity_threshold: (d.severity_threshold || "WARNING") as "INFO" | "WARNING" | "CRITICAL",
        allow_warning_notifications: d.allow_warning_notifications as boolean,
        source_unit: d.source_unit as boolean,
        source_site: d.source_site as boolean,
        source_org: d.source_org as boolean,
      } as EffectiveNotificationPolicy;
    },
    enabled: !!unitId && !!alertType,
  });
}

// Upsert a notification policy
export async function upsertNotificationPolicy(
  scope: { organization_id?: string; site_id?: string; unit_id?: string },
  alertType: string,
  policy: Partial<NotificationPolicy>
): Promise<{ error: Error | null }> {
  try {
    // Build upsert data
    const upsertData: Record<string, unknown> = {
      ...scope,
      alert_type: alertType,
      initial_channels: policy.initial_channels,
      requires_ack: policy.requires_ack,
      ack_deadline_minutes: policy.ack_deadline_minutes,
      escalation_steps: JSON.stringify(policy.escalation_steps || []),
      send_resolved_notifications: policy.send_resolved_notifications,
      reminders_enabled: policy.reminders_enabled,
      reminder_interval_minutes: policy.reminder_interval_minutes,
      quiet_hours_enabled: policy.quiet_hours_enabled,
      quiet_hours_start_local: policy.quiet_hours_start_local,
      quiet_hours_end_local: policy.quiet_hours_end_local,
      severity_threshold: policy.severity_threshold,
      allow_warning_notifications: policy.allow_warning_notifications,
      notify_roles: policy.notify_roles,
      notify_site_managers: policy.notify_site_managers,
      notify_assigned_users: policy.notify_assigned_users,
    };

    // Use upsert with conflict on unique index
    const { error } = await supabase
      .from("notification_policies")
      .upsert(upsertData as any, {
        onConflict: scope.organization_id
          ? "organization_id,alert_type"
          : scope.site_id
          ? "site_id,alert_type"
          : "unit_id,alert_type",
      });

    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

// Delete a notification policy
export async function deleteNotificationPolicy(
  scope: { organization_id?: string; site_id?: string; unit_id?: string },
  alertType: string
): Promise<{ error: Error | null }> {
  try {
    let query = supabase.from("notification_policies").delete();

    if (scope.organization_id) {
      query = query.eq("organization_id", scope.organization_id);
    } else if (scope.site_id) {
      query = query.eq("site_id", scope.site_id);
    } else if (scope.unit_id) {
      query = query.eq("unit_id", scope.unit_id);
    }

    const { error } = await query.eq("alert_type", alertType);
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

// Hook for upserting notification policy with mutation
export function useUpsertNotificationPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scope,
      alertType,
      policy,
    }: {
      scope: { organization_id?: string; site_id?: string; unit_id?: string };
      alertType: string;
      policy: Partial<NotificationPolicy>;
    }) => {
      const { error } = await upsertNotificationPolicy(scope, alertType, policy);
      if (error) throw error;
      return scope; // Return scope for onSuccess
    },
    onSuccess: async (scope) => {
      await invalidateNotificationPolicies(queryClient, {
        orgId: scope.organization_id,
        siteId: scope.site_id,
        unitId: scope.unit_id,
      });
    },
  });
}

// Hook for deleting notification policy with mutation
export function useDeleteNotificationPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scope,
      alertType,
    }: {
      scope: { organization_id?: string; site_id?: string; unit_id?: string };
      alertType: string;
    }) => {
      const { error } = await deleteNotificationPolicy(scope, alertType);
      if (error) throw error;
      return scope; // Return scope for onSuccess
    },
    onSuccess: async (scope) => {
      await invalidateNotificationPolicies(queryClient, {
        orgId: scope.organization_id,
        siteId: scope.site_id,
        unitId: scope.unit_id,
      });
    },
  });
}

// Get policy for specific alert type from array
export function getPolicyForAlertType(
  policies: NotificationPolicy[] | undefined,
  alertType: string
): NotificationPolicy | undefined {
  return policies?.find((p) => p.alert_type === alertType);
}
