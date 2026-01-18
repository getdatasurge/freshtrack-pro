import { QueryClient } from "@tanstack/react-query";

const DEV = import.meta.env.DEV;

/**
 * Invalidates all React Query caches related to a specific unit.
 * Call this after realtime events or data refreshes to ensure widgets update.
 */
export async function invalidateUnitCaches(
  queryClient: QueryClient,
  unitId: string
): Promise<void> {
  DEV && console.log(`[CACHE] invalidateUnitCaches unitId=${unitId}`);
  
  await Promise.all([
    // Core sensor data
    queryClient.invalidateQueries({ queryKey: ['lora-sensors-by-unit', unitId] }),
    
    // Alert rules
    queryClient.invalidateQueries({ queryKey: ['alert-rules', 'unit', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['alert-rules', 'unit-override', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['unit-alert-rules', unitId] }),
    queryClient.invalidateQueries({ queryKey: ['unit-alert-rules-override', unitId] }),
    
    // Door events (for DoorActivityWidget)
    queryClient.invalidateQueries({ queryKey: ['door-events', unitId] }),
    
    // Notification policies (all alert types for this unit)
    queryClient.invalidateQueries({ 
      queryKey: ['notification-policies', 'unit', unitId],
      exact: true 
    }),
    queryClient.invalidateQueries({ 
      queryKey: ['notification-policies', 'effective', unitId],
      exact: false  // Catch all alertType variations
    }),
  ]);
  
  DEV && console.log(`[CACHE] invalidateUnitCaches complete`);
}
