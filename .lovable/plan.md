
# Plan: Fix "Adopt Device" for Missing TTN Application + Orphaned Devices

## Problem Summary

Your manually-added device shows "Split Brain (Orphaned)" because:

1. **TTN Application doesn't exist**: The FrostGuard app `fg-7873654e-yq` was never actually created in TTN (404 on app probe)
2. **Device exists elsewhere**: Your device shows 200 OK in JS/NS/AS, meaning it exists in a **different TTN application**
3. **Adopt fails**: The adopt function tries to search `fg-7873654e-yq` which doesn't exist

## Root Cause

The database shows:
- `provisioning_status: ready` 
- `ttn_application_provisioned_at: NULL`

This is inconsistent - the application provisioning never completed but was marked ready.

## Solution: Two-Part Fix

### Part 1: Improve Adopt Error Handling

Update `ttn-provision-device` adopt action to detect when the application doesn't exist and return a clear error with actionable guidance.

```text
IF app probe returns 404:
  RETURN {
    success: false,
    error: "TTN application not found",
    hint: "The FrostGuard TTN application doesn't exist. 
           Go to Settings → TTN Connection and click 'Provision' 
           to create it. Then try 'Adopt' again.",
    needs_provisioning: true
  }
```

### Part 2: Fix Database Inconsistency

Reset the provisioning status since the application was never actually created:

```sql
UPDATE ttn_connections 
SET provisioning_status = 'needs_app',
    provisioning_error = 'Application was not created - needs reprovisioning'
WHERE organization_id = '7873654e-017b-43cd-9a52-351222dfdff4';
```

### Part 3: Add Organization-Wide Device Search (Optional Enhancement)

If the device was added to a different application within the same TTN organization, the adopt flow could search across all applications:

```text
1. List all applications in TTN org
2. For each app, search for DevEUI
3. If found, return which app it's in
4. User can then manually move device or FrostGuard can re-register
```

However, this requires organization-level API access which may not be available.

## Implementation Details

### A) Update `ttn-provision-device/index.ts` - Adopt Action

Add app existence check at the start of adopt:

```typescript
// Before searching for devices, verify app exists
const appCheck = await ttnFetch(
  `/api/v3/applications/${ttnAppId}`,
  { method: "GET" },
  "adopt_check_app"
);

if (!appCheck.ok) {
  return new Response(JSON.stringify({
    success: false,
    adopted: false,
    error: "TTN application not found",
    hint: "The FrostGuard TTN application doesn't exist. Go to Settings → TTN Connection and click 'Provision' to create it first.",
    needs_provisioning: true,
    app_id: ttnAppId,
    app_status: appCheck.status,
  }), { status: 404, headers: corsHeaders });
}
```

### B) Update `TtnDiagnoseModal.tsx`

Show specific guidance when app doesn't exist:

```typescript
const appMissing = result?.checks?.appProbe?.status === 404;

{appMissing && (
  <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
    <p className="text-sm font-medium text-warning">
      TTN Application Not Found
    </p>
    <p className="text-xs text-muted-foreground">
      The FrostGuard TTN application needs to be created first.
      Go to Settings → TTN Connection to provision it.
    </p>
    <Button onClick={handleGoToSettings}>
      Go to TTN Settings
    </Button>
  </div>
)}
```

### C) Hide "Adopt Device" Button When App Missing

```typescript
const canAdopt = result && !result.error && 
  result.checks?.appProbe?.ok &&  // ADD THIS CHECK
  (result.diagnosis === "split_brain_orphaned" || ...);
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/ttn-provision-device/index.ts` | Add app existence check in adopt action |
| `src/components/settings/TtnDiagnoseModal.tsx` | Show "App Not Found" message, hide adopt when app missing |

## What You Need To Do

1. **Fix the TTN application**: Go to Settings → TTN Connection and re-provision the application
2. **Re-add your device**: After the app is created, either:
   - Use "Provision" to auto-register the device, OR
   - Add it manually in TTN Console to the correct application (`fg-7873654e-yq`)
3. **Then adopt works**: Once the device is in the correct FrostGuard app, adopt will find it

## Version Update

| Function | Version |
|----------|---------|
| `ttn-provision-device` | `ttn-provision-device-v12-adopt-fix-20260129` |

## Technical Details

The current adopt flow:
```text
1. Check for device with standard ID → 404 (expected for manual devices)
2. List all devices in app → 404 (because APP doesn't exist!)
3. Return error "Failed to search"
```

After fix:
```text
1. Check if app exists → 404
2. Return clear error: "App not found, needs provisioning"
3. UI shows guidance to create app first
```
