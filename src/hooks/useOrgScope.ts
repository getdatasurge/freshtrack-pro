/**
 * useOrgScope - THE canonical hook for org-scoped data fetching
 * 
 * This is the single source of truth for determining which organization
 * and user context should be used for data queries. It correctly handles
 * impersonation scenarios where a Super Admin is viewing as another user.
 * 
 * USAGE: Replace all patterns of:
 * - profiles.organization_id lookups for data queries
 * - session.user.id for org derivation
 * - useUserRole().organizationId for queries
 * 
 * With:
 *   const { orgId, userId, isReady, isImpersonating } = useOrgScope();
 * 
 * IMPORTANT: For audit trail fields (logged_by, created_by, etc.), continue
 * using session.user.id to track WHO actually performed the action.
 */

import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

export interface OrgScope {
  /** The organization ID to use for data queries. Null if not yet available. */
  orgId: string | null;
  
  /** The user ID to use for user-scoped data queries. Null if not yet available. */
  userId: string | null;
  
  /** True when both orgId is available and identity has been initialized. Safe to fetch data. */
  isReady: boolean;
  
  /** True if currently impersonating another user. Useful for showing debug info. */
  isImpersonating: boolean;
  
  /** The organization name (if available during impersonation). */
  orgName: string | null;
  
  /** The user email (if available during impersonation). */
  userEmail: string | null;
}

/**
 * Returns the current organization and user scope for data fetching.
 * Automatically handles impersonation - when a Super Admin is impersonating,
 * returns the target user/org, not the admin's real identity.
 * 
 * @example
 * ```tsx
 * function MySitesPage() {
 *   const { orgId, isReady } = useOrgScope();
 *   
 *   const { data: sites } = useQuery({
 *     queryKey: ['sites', orgId],
 *     queryFn: () => fetchSites(orgId!),
 *     enabled: isReady, // Wait until org scope is available
 *   });
 * }
 * ```
 */
export function useOrgScope(): OrgScope {
  const {
    effectiveOrgId,
    effectiveUserId,
    effectiveOrgName,
    effectiveUserEmail,
    isInitialized,
    isImpersonating,
  } = useEffectiveIdentity();

  return {
    orgId: effectiveOrgId,
    userId: effectiveUserId,
    isReady: isInitialized && !!effectiveOrgId,
    isImpersonating,
    orgName: effectiveOrgName,
    userEmail: effectiveUserEmail,
  };
}

/**
 * @deprecated Prefer useOrgScope() for new code.
 * This alias exists for gradual migration.
 */
export const useEffectiveOrgId = useOrgScope;
