import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { useOrgScope } from "@/hooks/useOrgScope";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  alert_id: string;
  organization_id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_type: string;
  details: Record<string, any>;
  created_at: string;
  actor?: { full_name: string | null; email: string | null } | null;
}

export interface OrgAuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  eventType?: string;
  limit?: number;
}

// ─── Join select string ──────────────────────────────────────────────────────

const AUDIT_LOG_SELECT =
  "*, actor:profiles!alert_audit_log_actor_user_id_fkey(full_name, email)";

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch audit-log events for a single alert (timeline view).
 * Results are ordered by created_at ascending so the caller gets a
 * chronological timeline from oldest to newest.
 */
export function useAlertAuditLog(alertId: string | null) {
  const { orgId } = useOrgScope();

  return useQuery({
    queryKey: qk.org(orgId).alertAuditLog({ alertId }),
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!orgId || !alertId) return [];

      const { data, error } = await supabase
        .from("alert_audit_log")
        .select(AUDIT_LOG_SELECT)
        .eq("alert_id", alertId)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
    enabled: !!orgId && !!alertId,
  });
}

/**
 * Fetch all audit-log events for the current organization.
 * Results are ordered by created_at descending (most recent first).
 *
 * Accepts optional filters for date range, event type, and row limit.
 */
export function useOrgAuditLog(filters?: OrgAuditLogFilters) {
  const { orgId } = useOrgScope();
  const limit = filters?.limit ?? 200;

  return useQuery({
    queryKey: qk.org(orgId).alertAuditLog(filters as Record<string, unknown>),
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!orgId) return [];

      let query = supabase
        .from("alert_audit_log")
        .select(AUDIT_LOG_SELECT)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }
      if (filters?.eventType) {
        query = query.eq("event_type", filters.eventType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
    enabled: !!orgId,
  });
}
