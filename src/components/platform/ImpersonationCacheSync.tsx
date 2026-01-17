/**
 * ImpersonationCacheSync
 * 
 * This component registers a callback with SuperAdminContext to invalidate
 * all org-scoped caches when impersonation is stopped. This ensures that
 * when a Super Admin stops impersonating and returns to Platform Admin,
 * no stale data from the impersonated org bleeds into the admin view.
 * 
 * Place this component inside both QueryClientProvider and SuperAdminProvider.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import { invalidateAllOrgScopedCaches } from "@/lib/orgScopedInvalidation";

export function ImpersonationCacheSync() {
  const queryClient = useQueryClient();
  const { registerImpersonationCallback } = useSuperAdmin();

  useEffect(() => {
    // Register callback to invalidate caches when impersonation changes
    const unregister = registerImpersonationCallback(async (isImpersonating) => {
      // When stopping impersonation (isImpersonating becomes false),
      // invalidate all org-scoped caches
      if (!isImpersonating) {
        await invalidateAllOrgScopedCaches(queryClient, 'stopImpersonation');
      }
    });

    return () => {
      unregister();
    };
  }, [queryClient, registerImpersonationCallback]);

  // This component doesn't render anything
  return null;
}
