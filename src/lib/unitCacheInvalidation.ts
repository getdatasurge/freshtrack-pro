import { QueryClient } from "@tanstack/react-query";
import { invalidateUnit } from "./invalidation";

/**
 * Invalidates all React Query caches related to a specific unit.
 * Call this after realtime events or data refreshes to ensure widgets update.
 *
 * This is a convenience wrapper around invalidateUnit from the centralized
 * invalidation module, maintaining backward compatibility.
 */
export async function invalidateUnitCaches(
  queryClient: QueryClient,
  unitId: string,
  orgId?: string | null
): Promise<void> {
  // Use centralized invalidation which handles both new and legacy keys
  await invalidateUnit(queryClient, unitId, {
    includeNavTree: !!orgId,
    includeOrgSensors: false,
    orgId,
  });
}
