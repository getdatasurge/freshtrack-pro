import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlertRulesHistoryEntry {
  id: string;
  alert_rules_id: string | null;
  organization_id: string | null;
  site_id: string | null;
  unit_id: string | null;
  changed_by: string;
  changed_at: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  note: string | null;
  user_email?: string;
  user_name?: string;
}

/**
 * Fetch alert rules history for a specific scope
 */
export function useAlertRulesHistory(
  scope: { organization_id?: string; site_id?: string; unit_id?: string },
  limit: number = 20
) {
  return useQuery({
    queryKey: ["alert-rules-history", scope, limit],
    queryFn: async (): Promise<AlertRulesHistoryEntry[]> => {
      let query = supabase
        .from("alert_rules_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (scope.unit_id) {
        query = query.eq("unit_id", scope.unit_id);
      } else if (scope.site_id) {
        query = query.eq("site_id", scope.site_id);
      } else if (scope.organization_id) {
        query = query.eq("organization_id", scope.organization_id);
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching alert rules history:", error);
        return [];
      }

      // Fetch user info for each entry
      const userIds = [...new Set((data || []).map((d) => d.changed_by))];
      let profilesMap: Record<string, { email: string; full_name: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = Object.fromEntries(
            profiles.map((p) => [p.user_id, { email: p.email, full_name: p.full_name }])
          );
        }
      }

      return (data || []).map((entry) => ({
        ...entry,
        changes: (entry.changes as Record<string, { from: unknown; to: unknown }>) || {},
        user_email: profilesMap[entry.changed_by]?.email,
        user_name: profilesMap[entry.changed_by]?.full_name || undefined,
      }));
    },
    enabled: !!(scope.organization_id || scope.site_id || scope.unit_id),
  });
}

/**
 * Insert a history entry
 */
export async function insertAlertRulesHistory(
  scope: { organization_id?: string; site_id?: string; unit_id?: string },
  alertRulesId: string | null,
  action: "CREATE" | "UPDATE" | "DELETE" | "CLEAR_FIELD",
  changes: Record<string, { from: unknown; to: unknown }>,
  userId: string,
  note?: string
): Promise<{ error: Error | null }> {
  const insertData: Record<string, unknown> = {
    changed_by: userId,
    action,
    changes,
  };
  
  if (alertRulesId) insertData.alert_rules_id = alertRulesId;
  if (scope.organization_id) insertData.organization_id = scope.organization_id;
  if (scope.site_id) insertData.site_id = scope.site_id;
  if (scope.unit_id) insertData.unit_id = scope.unit_id;
  if (note) insertData.note = note;

  const { error } = await supabase.from("alert_rules_history").insert(insertData as any);

  return { error: error as Error | null };
}
