/**
 * Centralized cache invalidation for org-scoped queries.
 * 
 * Used when switching between impersonation contexts to ensure
 * no stale data from a previous org bleeds into the new view.
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * All query keys that are scoped to an organization.
 * These caches must be invalidated when switching orgs (via impersonation).
 */
export const ORG_SCOPED_QUERY_KEYS = [
  // Core entity caches
  ["sites"],
  ["units"],
  ["areas"],
  ["alerts"],
  ["sensors"],
  ["lora-sensors"],
  ["devices"],
  
  // Navigation & layout caches
  ["nav-tree"],
  ["nav-tree-all-sites"],
  ["nav-tree-areas"],
  ["nav-tree-units"],
  ["nav-tree-layouts"],
  ["nav-tree-sensors"],
  ["entity-layouts"],
  ["navTree"], // Legacy key format
  
  // Organization & profile caches
  ["organizations"],
  ["organization"],
  ["profile"],
  ["branding"],
  ["user-role"],
  
  // Alert & notification caches
  ["alert-rules"],
  ["notification-policies"],
  ["notification-settings"],
  ["escalation-contacts"],
  ["escalation-policies"],
  
  // Health & status caches
  ["health-check"],
  ["unit-status"],
  ["pipeline-status"],
  
  // Event & audit caches
  ["events"],
  ["event-logs"],
  ["audit-logs"],
  
  // Report caches
  ["reports"],
  ["compliance-reports"],
  
  // Gateway & sensor caches
  ["gateways"],
  ["ttn-settings"],
  ["provisioning"],
  
  // Dashboard & widget caches
  ["dashboard-layouts"],
  ["widget-data"],
  ["temperature-readings"],
  ["manual-logs"],
] as const;

/**
 * Invalidates all org-scoped caches.
 * Call this when starting or stopping impersonation to ensure fresh data.
 * 
 * @param queryClient - The React Query client instance
 * @param reason - Optional reason for logging (e.g., 'startImpersonation', 'stopImpersonation')
 */
export async function invalidateAllOrgScopedCaches(
  queryClient: QueryClient,
  reason?: string
): Promise<void> {
  const startTime = performance.now();
  
  console.log(
    `[OrgCache] Invalidating all org-scoped caches${reason ? ` (${reason})` : ""}`
  );

  // Invalidate all org-scoped query keys in parallel
  await Promise.all(
    ORG_SCOPED_QUERY_KEYS.map((key) =>
      queryClient.invalidateQueries({ queryKey: key })
    )
  );

  const elapsed = Math.round(performance.now() - startTime);
  console.log(`[OrgCache] Cache invalidation complete (${elapsed}ms)`);
}

/**
 * Clears (removes) all org-scoped caches entirely.
 * More aggressive than invalidation - use when you need to force fresh fetches.
 * 
 * @param queryClient - The React Query client instance
 */
export async function clearAllOrgScopedCaches(
  queryClient: QueryClient
): Promise<void> {
  console.log("[OrgCache] Clearing all org-scoped caches");

  // Remove all org-scoped query keys
  ORG_SCOPED_QUERY_KEYS.forEach((key) => {
    queryClient.removeQueries({ queryKey: key });
  });

  console.log("[OrgCache] Cache clear complete");
}

/**
 * Gets statistics about cached org-scoped queries.
 * Useful for the Support Diagnostics panel.
 */
export function getOrgCacheStats(queryClient: QueryClient): {
  totalCached: number;
  byKey: Record<string, number>;
} {
  const stats: Record<string, number> = {};
  let totalCached = 0;

  ORG_SCOPED_QUERY_KEYS.forEach((key) => {
    const queries = queryClient.getQueriesData({ queryKey: key });
    const count = queries.length;
    if (count > 0) {
      stats[key[0]] = count;
      totalCached += count;
    }
  });

  return {
    totalCached,
    byKey: stats,
  };
}
