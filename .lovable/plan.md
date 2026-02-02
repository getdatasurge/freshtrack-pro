

# Fix Plan: Battery Profile Query Causing 406 Errors

## Problem Summary

The Battery Health widget is causing an infinite loop of **406 (Not Acceptable)** errors when loading the Unit Detail page. The console shows repeated failed requests:

```
GET .../battery_profiles?select=*&model=eq.SENSOR-A840415A 406 (Not Acceptable)
```

## Root Cause

In `useBatteryEstimate.ts`, the battery profile query uses `.single()`:

```typescript
supabase
  .from("battery_profiles")
  .select("*")
  .eq("model", sensor.model)
  .single()  // <- PROBLEM: throws 406 when 0 rows match
```

When `.single()` is used and **zero rows** are returned, PostgREST returns a 406 error instead of null. Since:
1. The sensor's model is `SENSOR-A840415A` (auto-generated, not a real model name)
2. No matching profile exists in `battery_profiles` table
3. The error triggers a re-render cycle, causing infinite retries

## Solution

Change `.single()` to `.maybeSingle()` for queries that may legitimately return zero rows:

| Query | Issue | Fix |
|-------|-------|-----|
| `battery_profiles` by model | No profile exists for auto-generated models | `.maybeSingle()` |
| `sensor_configurations` by sensor_id | Config may not exist | `.maybeSingle()` |

## Code Changes

**File:** `src/hooks/useBatteryEstimate.ts`

### Change 1: Battery profile query (lines 97-103)

**Before:**
```typescript
sensor?.model
  ? supabase
      .from("battery_profiles")
      .select("*")
      .eq("model", sensor.model)
      .single()
  : Promise.resolve({ data: null, error: null }),
```

**After:**
```typescript
sensor?.model
  ? supabase
      .from("battery_profiles")
      .select("*")
      .eq("model", sensor.model)
      .maybeSingle()
  : Promise.resolve({ data: null, error: null }),
```

### Change 2: Sensor configuration query (lines 114-119)

**Before:**
```typescript
supabase
  .from("sensor_configurations")
  .select("uplink_interval_s")
  .eq("sensor_id", sensorId)
  .single(),
```

**After:**
```typescript
supabase
  .from("sensor_configurations")
  .select("uplink_interval_s")
  .eq("sensor_id", sensorId)
  .maybeSingle(),
```

## Expected Behavior After Fix

When the sensor model doesn't match any battery profile:
1. Query returns `{ data: null, error: null }` (no 406 error)
2. Hook sets `profileSource: "fallback"` and uses the fallback profile from `getFallbackProfile()`
3. Widget displays battery estimate using the conservative fallback
4. Per user preference: When no profile exists, widget shows "Battery estimate unavailable - battery profile not configured" (MISSING_PROFILE state)

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useBatteryEstimate.ts` | Replace `.single()` with `.maybeSingle()` for profile and config queries |

## Technical Notes

- **`.single()` behavior**: Expects exactly 1 row; returns 406 for 0 or 2+ rows
- **`.maybeSingle()` behavior**: Returns null for 0 rows, data for 1 row, error for 2+ rows
- This is a common pattern issue in Supabase queries for lookup tables
- The fallback profile logic in `getFallbackProfile()` already handles missing profiles correctly

