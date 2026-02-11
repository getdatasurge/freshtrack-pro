

# Auto-Verify All Sensors on Load and After Changes

## Problem

The "Verify All Sensors" button on the Sensors settings page is manual-only. There is no automatic verification when the page first loads or after any mutation (add, provision, edit, delete, assign). Users must remember to click it themselves to see current TTN registration status.

## Solution

Add a `useEffect` in `SensorManager` that automatically triggers `handleCheckAllTtn` in two scenarios:

1. **On initial load** -- once sensors have loaded and TTN is configured
2. **After mutations** -- after provisioning, adding, editing, or deleting a sensor (when the sensor list refetches)

To avoid spamming TTN, the auto-verify will be debounced and will only run once per page load (not on every re-render).

## Technical Approach

### File: `src/components/settings/SensorManager.tsx`

1. **Add a `useRef` flag** (`hasAutoVerified`) to track whether the initial auto-verify has already run, preventing repeated calls on re-renders.

2. **Add a `useEffect` for initial load auto-verify**:
   - Depends on `sensors`, `isTtnConfiguredNow`, and `checkTtnStatus.isPending`
   - Fires once when sensors are loaded, TTN is configured, and no check is already in progress
   - Calls `handleCheckAllTtn()` and sets `hasAutoVerified` to `true`

3. **Add auto-verify after mutations**: After each successful mutation (provision, add, edit, delete), the sensor query is already invalidated and refetches. We need to trigger a verify after the refetch settles.
   - Add a second `useEffect` that watches `dataUpdatedAt` (from `useLoraSensors`). When it changes after the initial load, it means data was refreshed (likely from a mutation). This triggers `handleCheckAllTtn()` with a short delay (1.5s) to let the refetch complete.
   - Use a `useRef` to store the previous `dataUpdatedAt` so we only trigger on actual changes, not the initial load (which is handled by the first effect).

4. **Guard against concurrent calls**: Both effects check `checkTtnStatus.isPending` before triggering to avoid overlapping requests.

### Behavioral Summary

```text
Page Load
  -> sensors load
  -> useEffect fires -> handleCheckAllTtn() 
  -> all sensors verified automatically

User provisions/adds/edits/deletes a sensor
  -> mutation succeeds -> query invalidates -> sensors refetch
  -> dataUpdatedAt changes -> useEffect fires -> handleCheckAllTtn()
  -> verification re-runs with updated sensor list
```

### Edge Cases Handled

- **No sensors**: Early return in `handleCheckAllTtn` already handles this
- **TTN not configured**: Guard in `handleCheckAllTtn` shows toast and returns
- **Already checking**: `isPending` guard prevents concurrent calls
- **Component unmount during check**: React Query handles cleanup

### Files Changed

| File | Change |
|------|--------|
| `src/components/settings/SensorManager.tsx` | Add `useRef` + two `useEffect` hooks for auto-verify on load and after data changes |

