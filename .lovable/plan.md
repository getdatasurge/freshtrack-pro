
## What’s happening (why the Battery Health widget stays on the pinwheel)

From the code and your network snapshot:

- The `battery_profiles` request is now **200** (good; the 406 loop is fixed).
- The Battery Health widget still shows the spinner because `estimate.loading` keeps flipping back to `true`.

The reason is in `BatteryHealthWidget.tsx`:

```ts
const estimate = useBatteryEstimate(sensorId, primarySensor ? {
  id: primarySensor.id,
  model: null,
  last_seen_at: primarySensor.last_seen_at,
  battery_level: primarySensor.battery_level,
} : null);
```

That inline object is **a brand-new object every render**.  
`useBatteryEstimate` has:

```ts
useEffect(..., [sensorId, sensorData])
```

So every re-render (and Unit Detail re-renders frequently due to realtime refreshTick + state replacement) retriggers the effect, which calls `setLoading(true)` again. Result: the widget never “settles” and looks stuck on the pinwheel.

---

## Goals for the fix (aligned with your approved preferences)

1. **Stop the infinite “loading” loop** (battery widget should resolve to a stable UI).
2. **Missing profile behavior:** show **no estimate** when the model has no configured profile (show the MISSING_PROFILE UI).
3. **No voltage available:** show battery percent as **(Reported)** in Device Readiness (not Estimated).
4. **Update frequency:** Battery Health calculations should refresh **only on page load** (not on realtime ticks).

---

## Implementation approach

### A) Fix the pinwheel: make the hook call stable (page-load only)
We will change the dashboard Battery Health widget to **stop passing an inline `sensorData` object**.

Best option (and simplest):  
- Call `useBatteryEstimate(sensorId)` with **only** the id.
- The hook already fetches the sensor row from the backend, so it does not need the extra partial object.

This prevents re-fetching on every re-render and matches your “only on page load” requirement.

**File**
- `src/features/dashboard-layout/widgets/BatteryHealthWidget.tsx`

**Change**
- Replace the current call with:
  - `const estimate = useBatteryEstimate(sensorId);`

(Alternative we will not use unless needed: memoize that object via `useMemo`, but removing it is cleaner and more deterministic.)

---

### B) Enforce “No estimate without profile” in the hook
Right now, `useBatteryEstimate` still sets a fallback profile when the profile lookup returns no rows:

```ts
} else if (sensor?.model) {
  const fallbackProfile = getFallbackProfile(sensor.model);
  setBatteryProfile(fallbackProfile);
  setProfileSource("fallback");
}
```

That conflicts with your approved behavior. We will change it to:

- If no profile row exists → `batteryProfile = null`, `profileSource = "none"`, `sensorChemistry = null`.

That ensures:
- Widget state becomes `MISSING_PROFILE`
- No days-remaining estimate is computed

**File**
- `src/hooks/useBatteryEstimate.ts`

**Change**
- Remove/disable fallback profile assignment for missing profiles (keep helper for future if you ever want a toggle).

---

### C) Make the hook truly “page load only”
To align with “only on page load” and avoid accidental loops in other callers:

- Change the effect dependency from `[sensorId, sensorData]` to **only** `[sensorId]`.

Because after step A we won’t pass `sensorData` anymore, this is also defensive and prevents future regressions if someone passes a new inline object again.

**File**
- `src/hooks/useBatteryEstimate.ts`

**Change**
- `useEffect(..., [sensorId])`

Note: This means if some parent passes updated sensor fields later, Battery Health won’t refetch (which is exactly what you requested).

---

### D) Device Readiness: label % as (Reported) when voltage is missing
Currently `DeviceReadinessWidget` always renders:

```ts
const levelLabel = `${level}% (Est.)`;
```

We will update it so:
- If `battery_voltage_filtered` or `battery_voltage` exists (non-null) → label `% (Est.)`
- Otherwise → label `% (Reported)`

Because `WidgetSensor` doesn’t currently type these voltage fields, we’ll safely read them from the existing `any` cast you already have (`const loraSensor = primarySensor as any;`) without changing the broader typing surface.

**File**
- `src/features/dashboard-layout/widgets/DeviceReadinessWidget.tsx`

**Change**
- Add `const effectiveVoltage = loraSensor?.battery_voltage_filtered ?? loraSensor?.battery_voltage ?? null;`
- Pass that into `getBatteryStatus(level, effectiveVoltage)` and format the label accordingly.

---

## Verification checklist (what we’ll test after implementing)

1. Open `/units/8d9a7c25-8340-45b2-82dd-52c6fe29e484`:
   - Battery Health widget should stop spinning and resolve quickly.
2. For model `SENSOR-A840415A` with no battery profile row:
   - Battery Health should show **Battery estimate unavailable** (MISSING_PROFILE state), not an estimate.
3. Device Readiness battery:
   - Should show `4% (Reported)` (since voltage is null in your current data).
4. Confirm no repeated backend calls:
   - Battery-related calls should happen once on page load, not on realtime refresh ticks.
5. Regression check:
   - Switch between tabs (Dashboard/Settings/History) and back; Battery Health should still behave predictably.

---

## Files that will be updated (no new files required)
- `src/features/dashboard-layout/widgets/BatteryHealthWidget.tsx`
- `src/hooks/useBatteryEstimate.ts`
- `src/features/dashboard-layout/widgets/DeviceReadinessWidget.tsx`
