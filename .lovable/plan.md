

# Fix Plan: Battery Health Widget Still Shows Spinner

## Problem Summary

The Battery Health widget continues to show a loading spinner (pinwheel) even after all network requests complete successfully. Based on the debug analysis:

1. All Supabase queries return 200 OK
2. The sensor `ab0ba0e2-fa8a-4888-be8c-e0664dd6b6bc` has model `SENSOR-A840415A` 
3. No battery profile exists for this model (returns empty array)
4. The widget should show "MISSING_PROFILE" state but shows the spinner instead

## Root Cause Analysis

After tracing through the code, the most likely issue is that the `useMemo` dependency array includes all the state values, but there's a potential timing issue where:

1. The hook's `useEffect` starts fetching data (`loading = true`)
2. Component re-renders, `useMemo` returns early with `loading: true`
3. Fetch completes, `setLoading(false)` is called
4. BUT - if the component unmounts/remounts during this cycle (due to parent re-renders from `refreshTick` or other state changes), the `loading` state resets to `true`

Additionally, the console shows the widget rendered 3 times in quick succession, suggesting parent re-renders may be causing repeated hook initializations.

## Solution

### Part 1: Stabilize the sensor ID reference

In `BatteryHealthWidget.tsx`, memoize the `sensorId` to prevent unnecessary re-computations:

**File:** `src/features/dashboard-layout/widgets/BatteryHealthWidget.tsx`

```typescript
// Before:
const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
const sensorId = primarySensor?.id || device?.id || null;

// After:
const sensorId = useMemo(() => {
  const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
  return primarySensor?.id || device?.id || null;
}, [sensor?.id, loraSensors, device?.id]);
```

### Part 2: Add early return for stable sensorId in the hook

In `useBatteryEstimate.ts`, cache the initial sensorId and only refetch if it truly changes (not just object reference changes):

**File:** `src/hooks/useBatteryEstimate.ts`

Add a `useRef` to track if the initial fetch has completed, preventing re-fetch on remounts within the same session:

```typescript
const hasFetchedRef = useRef<string | null>(null);

useEffect(() => {
  // Skip if we've already fetched for this exact sensorId
  if (hasFetchedRef.current === sensorId) {
    return;
  }
  
  if (!sensorId) {
    setLoading(false);
    return;
  }

  // ... existing fetch logic ...
  
  // Mark as fetched when complete
  hasFetchedRef.current = sensorId;
}, [sensorId]);
```

### Part 3: Include missing fields in loraSensors mapping

In `UnitDetail.tsx`, include `is_primary` and `sensor_type` when passing `loraSensors` to EntityDashboard:

**File:** `src/pages/UnitDetail.tsx` (lines 1098-1105)

```typescript
// Before:
loraSensors={loraSensors?.map(s => ({
  id: s.id,
  name: s.name,
  battery_level: s.battery_level,
  signal_strength: s.signal_strength,
  last_seen_at: s.last_seen_at,
  status: s.status,
})) || []}

// After:
loraSensors={loraSensors?.map(s => ({
  id: s.id,
  name: s.name,
  battery_level: s.battery_level,
  signal_strength: s.signal_strength,
  last_seen_at: s.last_seen_at,
  status: s.status,
  sensor_type: s.sensor_type,
  is_primary: s.is_primary,
})) || []}
```

## Files to Update

| File | Change |
|------|--------|
| `src/features/dashboard-layout/widgets/BatteryHealthWidget.tsx` | Memoize `sensorId` computation |
| `src/hooks/useBatteryEstimate.ts` | Add `hasFetchedRef` to prevent redundant fetches |
| `src/pages/UnitDetail.tsx` | Include `is_primary` and `sensor_type` in loraSensors mapping |

## Expected Behavior After Fix

1. Widget renders once with stable `sensorId`
2. Hook fetches data only once per page load
3. When no battery profile exists, widget shows "Battery estimate unavailable" (MISSING_PROFILE state)
4. No spinner loop

## Technical Notes

- The `refreshTick` prop is designed to trigger widget data refreshes, but Battery Health should only fetch on page load per the user's preference
- The memoization ensures `sensorId` doesn't change reference between renders
- The `hasFetchedRef` acts as a guard against redundant fetches when the component tree re-renders

