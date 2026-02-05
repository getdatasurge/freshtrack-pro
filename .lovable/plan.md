

# Fix Plan: TypeScript Type Mismatch in EntityDashboard

## Problem

The build error occurs because of a type mismatch:

| Location | Function | Expected Type | Receiving |
|----------|----------|---------------|-----------|
| `TimelineControls.tsx:40` | `onChange` prop | `Partial<TimelineState>` | ✅ (passes partial updates) |
| `EntityDashboard.tsx:246` | `handleTimelineChange` | `Partial<TimelineState>` | ✅ (correct for TimelineControls) |
| `useLayoutManager.ts:258` | `updateTimelineState` | **Full `TimelineState`** | ❌ Receives `Partial<TimelineState>` |

The `handleTimelineChange` callback correctly receives partial updates from `TimelineControls`, but then passes them directly to `actions.updateTimelineState()` which expects a complete `TimelineState` object.

---

## Solution

Update `handleTimelineChange` in `EntityDashboard.tsx` to merge the partial updates with the current timeline state before passing to `updateTimelineState`.

### Code Change

**File:** `src/features/dashboard-layout/components/EntityDashboard.tsx`

**Current (broken):**
```typescript
const handleTimelineChange = useCallback((newState: Partial<TimelineState>) => {
  actions.updateTimelineState(newState);  // ❌ Type error
  if (newState.range && onTimeRangeChange) {
    onTimeRangeChange(newState.range);
  }
}, [actions, onTimeRangeChange]);
```

**Fixed:**
```typescript
const handleTimelineChange = useCallback((newState: Partial<TimelineState>) => {
  // Merge partial updates with current state to create full TimelineState
  const mergedState: TimelineState = {
    ...state.activeLayout.timelineState,
    ...newState,
  };
  actions.updateTimelineState(mergedState);  // ✅ Full object
  if (newState.range && onTimeRangeChange) {
    onTimeRangeChange(newState.range);
  }
}, [actions, onTimeRangeChange, state.activeLayout.timelineState]);
```

---

## Why This Works

1. `TimelineControls` sends partial updates like `{ range: "24h" }` or `{ zoomLevel: 2 }`
2. We merge the partial update with the current complete `timelineState` using spread
3. The result is a full `TimelineState` object with all required properties
4. This matches what `updateTimelineState` expects

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/dashboard-layout/components/EntityDashboard.tsx` | Merge partial state with current state before calling `updateTimelineState` |

---

## Risk Assessment

- **Low risk** - This is a standard pattern for handling partial updates
- The current state always has all required properties (initialized with defaults)
- No behavioral change, just fixes the type contract

