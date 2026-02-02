
# Fix Plan: LastKnownGoodWidget Disappears After Load

## Problem Summary

The **Last Known Good** widget (middle card in your screenshot) shows "No Temperature History" initially, then becomes a blank white card after the page fully loads.

## Root Cause

The `LastKnownGoodWidget` component intentionally returns `null` when the sensor is online and has valid temperature data:

```tsx
// lines 25-28 of LastKnownGoodWidget.tsx
if (isCurrentlyOnline && lastValidTemp !== null) {
  return null;
}
```

However, the `WidgetWrapper` still renders its Card container around this `null` content, producing an empty white box.

This directly violates the project design principle:
> "No widget may render as a blank container"

## Solution

Instead of returning `null`, the widget should display a **healthy state** message when the sensor is online. This maintains visual consistency and provides positive feedback.

### When sensor is online and has readings

Show a brief "Real-time monitoring active" card with:
- A green checkmark icon
- "Monitoring Active" title
- Current temperature snapshot
- "Live data from sensor" subtext

### Code Change

In `src/features/dashboard-layout/widgets/LastKnownGoodWidget.tsx`:

**Before (lines 25-28):**
```tsx
if (isCurrentlyOnline && lastValidTemp !== null) {
  return null;
}
```

**After:**
```tsx
if (isCurrentlyOnline && lastValidTemp !== null) {
  return (
    <div className="h-full p-4 bg-safe/5">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="w-5 h-5 text-safe" />
        <h3 className="text-lg font-semibold">Monitoring Active</h3>
      </div>
      <div className="space-y-1">
        <span className="text-3xl font-bold text-safe">
          {lastValidTemp.toFixed(1)}°F
        </span>
        <p className="text-sm text-muted-foreground">
          Live data from sensor
        </p>
      </div>
    </div>
  );
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/features/dashboard-layout/widgets/LastKnownGoodWidget.tsx` | Replace `null` return with healthy state UI |

## Technical Notes

1. **Design alignment**: This follows the "widget-empty-state-v1" memory which states widgets should never render blank
2. **Icon consistency**: Uses `CheckCircle` from lucide-react (already imported in the file)
3. **Color palette**: Uses `text-safe` and `bg-safe/5` which are the project's "healthy" status colors

## Manual Verification

After fix:
1. Navigate to Unit dashboard
2. If sensor is online, the Last Known Good widget should show "Monitoring Active" with a green icon and current temp
3. If sensor is offline, the widget should show the last known reading (existing behavior)
4. If no history exists, the widget should show "No Temperature History" (existing behavior)
