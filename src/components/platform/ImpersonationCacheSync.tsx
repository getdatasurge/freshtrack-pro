/**
 * ImpersonationCacheSync
 * 
 * This component registers a callback with SuperAdminContext to invalidate
 * all org-scoped caches when impersonation is started or stopped. This ensures
 * no stale data from a previous org bleeds into the new view.
 * 
 * Place this component inside both QueryClientProvider and SuperAdminProvider.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { invalidateAllOrgData } from "@/lib/invalidation";

export function ImpersonationCacheSync() {
  const queryClient = useQueryClient();
  const { registerImpersonationCallback } = useSuperAdmin();

  useEffect(() => {
    // Register callback to invalidate caches when impersonation changes
    const unregister = registerImpersonationCallback(async (isImpersonating) => {
      // Invalidate ALL org-scoped caches on BOTH start and stop
      // This ensures fresh data is fetched for the new context
      await invalidateAllOrgData(
        queryClient, 
        isImpersonating ? 'startImpersonation' : 'stopImpersonation'
      );
    });

    return () => {
      unregister();
    };
  }, [queryClient, registerImpersonationCallback]);

  // This component doesn't render anything
  return null;
}
