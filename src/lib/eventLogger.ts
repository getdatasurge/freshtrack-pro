import { supabase } from "@/integrations/supabase/client";
import type { EventCategory, EventSeverity } from "./eventTypeMapper";

export interface ImpersonationContext {
  isImpersonating: boolean;
  sessionId?: string | null;
  actingUserId?: string | null;
}

export interface LogEventParams {
  event_type: string;
  category?: EventCategory;
  severity?: EventSeverity;
  title: string;
  organization_id: string;
  site_id?: string | null;
  area_id?: string | null;
  unit_id?: string | null;
  actor_id?: string | null;
  actor_type?: "user" | "system" | "impersonated";
  event_data?: Record<string, any>;
  /** Optional: Pass impersonation context to use server-side audited logging */
  impersonationContext?: ImpersonationContext;
}

/**
 * Log an event to the event_logs table for audit trail.
 * 
 * When impersonation context is provided and active, this uses the server-side
 * `log_impersonated_action` RPC which validates cross-tenant writes and records
 * full audit trail including acting_user_id and impersonation_session_id.
 */
export async function logEvent(params: LogEventParams): Promise<{ error: Error | null }> {
  try {
    // If impersonating, use the server-side RPC for security validation
    if (params.impersonationContext?.isImpersonating) {
      const { error } = await supabase.rpc('log_impersonated_action', {
        p_event_type: params.event_type,
        p_category: params.category || 'system',
        p_severity: params.severity || 'info',
        p_title: params.title,
        p_organization_id: params.organization_id,
        p_site_id: params.site_id || null,
        p_area_id: params.area_id || null,
        p_unit_id: params.unit_id || null,
        p_event_data: {
          ...params.event_data,
          impersonation_session_id: params.impersonationContext.sessionId,
          acting_admin_id: params.impersonationContext.actingUserId,
        },
      });

      if (error) {
        console.error("Failed to log impersonated event:", error);
        return { error: new Error(error.message) };
      }

      return { error: null };
    }

    // Regular path for non-impersonated writes
    const { error } = await supabase.from("event_logs").insert({
      event_type: params.event_type,
      category: params.category || "system",
      severity: params.severity || "info",
      title: params.title,
      organization_id: params.organization_id,
      site_id: params.site_id || null,
      area_id: params.area_id || null,
      unit_id: params.unit_id || null,
      actor_id: params.actor_id || null,
      actor_type: params.actor_type || "user",
      event_data: params.event_data || {},
      recorded_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to log event:", error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    console.error("Failed to log event:", err);
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Log an alert lifecycle event
 */
export async function logAlertEvent(
  action: "created" | "activated" | "acknowledged" | "resolved" | "escalated",
  alertId: string,
  alertType: string,
  organizationId: string,
  unitId: string,
  siteId?: string | null,
  areaId?: string | null,
  actorId?: string | null,
  additionalData?: Record<string, any>
): Promise<void> {
  const actionLabels: Record<string, string> = {
    created: "Alert Created",
    activated: "Alert Activated",
    acknowledged: "Alert Acknowledged",
    resolved: "Alert Resolved",
    escalated: "Alert Escalated",
  };

  const severityMap: Record<string, EventSeverity> = {
    created: "warning",
    activated: "critical",
    acknowledged: "info",
    resolved: "success",
    escalated: "critical",
  };

  await logEvent({
    event_type: `alert_${action}`,
    category: "alert",
    severity: severityMap[action] || "info",
    title: actionLabels[action] || `Alert ${action}`,
    organization_id: organizationId,
    site_id: siteId,
    area_id: areaId,
    unit_id: unitId,
    actor_id: actorId,
    actor_type: actorId ? "user" : "system",
    event_data: {
      alert_id: alertId,
      alert_type: alertType,
      ...additionalData,
    },
  });
}

/**
 * Log a manual temperature log event
 */
export async function logManualTempEvent(
  temperature: number,
  unitId: string,
  unitName: string,
  organizationId: string,
  siteId?: string | null,
  areaId?: string | null,
  actorId?: string | null,
  isInRange?: boolean
): Promise<void> {
  await logEvent({
    event_type: "manual_temp_logged",
    category: "compliance",
    severity: isInRange === false ? "warning" : "success",
    title: `Temperature Logged: ${temperature}°F`,
    organization_id: organizationId,
    site_id: siteId,
    area_id: areaId,
    unit_id: unitId,
    actor_id: actorId,
    actor_type: "user",
    event_data: {
      temperature,
      unit_name: unitName,
      is_in_range: isInRange,
    },
  });
}

/**
 * Log a settings change event
 */
export async function logSettingsEvent(
  settingsType: "unit" | "alert_rules" | "notification" | "thresholds",
  organizationId: string,
  actorId: string,
  changes: Record<string, { from: unknown; to: unknown }>,
  unitId?: string | null,
  siteId?: string | null,
  areaId?: string | null
): Promise<void> {
  const typeLabels: Record<string, string> = {
    unit: "Unit Settings Updated",
    alert_rules: "Alert Rules Updated",
    notification: "Notification Settings Updated",
    thresholds: "Temperature Thresholds Updated",
  };

  await logEvent({
    event_type: `${settingsType}_settings_updated`,
    category: "settings",
    severity: "info",
    title: typeLabels[settingsType] || "Settings Updated",
    organization_id: organizationId,
    site_id: siteId,
    area_id: areaId,
    unit_id: unitId,
    actor_id: actorId,
    actor_type: "user",
    event_data: { changes },
  });
}
