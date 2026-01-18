/**
 * Centralized cache invalidation for org-scoped queries.
 * 
 * @deprecated Use functions from src/lib/invalidation.ts instead.
 * This file is kept for backward compatibility during migration.
 */

import { QueryClient } from "@tanstack/react-query";
import { invalidateAllOrgData } from "./invalidation";

/**
 * @deprecated Use invalidateAllOrgData from src/lib/invalidation.ts
 * 
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
 * @deprecated Use invalidateAllOrgData from src/lib/invalidation.ts
 * 
 * Invalidates all org-scoped caches.
 * Call this when starting or stopping impersonation to ensure fresh data.
 */
export async function invalidateAllOrgScopedCaches(
  queryClient: QueryClient,
  reason?: string
): Promise<void> {
  // Delegate to new centralized function
  await invalidateAllOrgData(queryClient, reason);
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

  // Remove all org-scoped query keys using prefix matching
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return key === 'org' || key === 'unit' || key === 'site' || key === 'sensor';
    },
  });
  
  // Also remove legacy keys
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

  // Count new-style keys
  const allQueries = queryClient.getQueryCache().getAll();
  for (const query of allQueries) {
    const scope = query.queryKey[0];
    if (typeof scope === 'string' && ['org', 'unit', 'site', 'sensor'].includes(scope)) {
      stats[scope] = (stats[scope] || 0) + 1;
      totalCached++;
    }
  }

  // Also count legacy keys
  ORG_SCOPED_QUERY_KEYS.forEach((key) => {
    const queries = queryClient.getQueriesData({ queryKey: key });
    const count = queries.length;
    if (count > 0) {
      stats[key[0]] = (stats[key[0]] || 0) + count;
      totalCached += count;
    }
  });

  return {
    totalCached,
    byKey: stats,
  };
}
