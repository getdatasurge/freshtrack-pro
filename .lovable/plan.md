
# Plan: Support Manually Added TTN Devices ("Adopt" Feature)

## Problem Analysis

Your TTN diagnostics shows a "Split Brain (Orphaned)" state where:
- Device exists in Join Server, Network Server, Application Server (200 OK)
- Device is NOT found in Identity Server/Application endpoint (404)

This typically happens in one of these scenarios:

1. **Different Application ID**: The device was manually added to TTN under a different application ID than FrostGuard uses (`fg-7873654e-yq`). The data planes can see it, but the IS query fails because it's searching in the wrong app.

2. **API Key Scope Issue**: The FrostGuard API key doesn't have read rights to the application where the device actually lives.

3. **Cross-Cluster Registration**: The device might be registered on a different cluster (e.g., EU1 instead of NAM1).

## Proposed Solution: Add "Adopt Manual Device" Action

Create a new `action: "adopt"` in the `ttn-provision-device` edge function that:

### Step 1: Search for DevEUI Across TTN
Instead of checking a specific app, search for the DevEUI globally to find where it actually lives.

### Step 2: Verify Device Exists in Target App
If found in FrostGuard's app, simply update the local database to recognize it.

### Step 3: Handle Cross-App Situation
If the device is in a different app, provide clear guidance to the user.

## Implementation Details

### A) Update `ttn-provision-device/index.ts`

Add new action `"adopt"` that:

```text
1. Takes sensor_id and organization_id
2. Uses the DevEUI search endpoint: GET /api/v3/end_devices?dev_eui=<EUI>
3. If found in FrostGuard's app:
   - Update lora_sensors with ttn_device_id, provisioning_state = 'exists_in_ttn'
   - Set provisioned_source = 'manual'
4. If found in different app:
   - Return error with the app ID where device lives
5. If not found anywhere:
   - Return "device not in TTN" message
```

### B) Update TtnDiagnoseModal UI

Add an "Adopt Device" button that appears when:
- Diagnosis is `split_brain_orphaned` OR
- Device exists in data planes but not IS

### C) Database Updates

When adopting a manual device:
```sql
UPDATE lora_sensors SET
  ttn_device_id = 'sensor-<dev_eui>',
  ttn_application_id = '<found_app_id>',
  ttn_cluster = 'nam1',
  provisioning_state = 'exists_in_ttn',
  provisioned_source = 'manual',
  status = 'active'
WHERE id = <sensor_id>;
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/ttn-provision-device/index.ts` | MODIFY | Add `adopt` action |
| `src/components/settings/TtnDiagnoseModal.tsx` | MODIFY | Add "Adopt Device" button |
| `src/components/settings/SensorManager.tsx` | MODIFY | Wire up adopt action handler |

## Alternative Quick Fix

If the device was added to the **same FrostGuard application** (`fg-7873654e-yq`) but IS just can't find it, the issue might be:

1. **Timing**: TTN's Identity Server cache hasn't synced yet (wait 1-2 minutes)
2. **Device ID mismatch**: You registered it with a different device ID than `sensor-a840415a61897757`

### Manual Verification Steps

In TTN Console, check:
1. Which application is the device actually in?
2. What is the device ID you gave it?
3. Does the DevEUI match exactly: `A840415A61897757`?

If the device is in the **correct application** but with a **different device ID**, the adopt flow can still work by matching on DevEUI.

## Version Constants

| Function | New Version |
|----------|-------------|
| `ttn-provision-device` | `ttn-provision-device-v11-adopt-20260128` |

## Deployment

```bash
supabase functions deploy ttn-provision-device
```

## User Flow

1. User adds sensor in FrostGuard with DevEUI
2. User manually registers device in TTN Console
3. User runs diagnostics, sees "Split Brain (Orphaned)"
4. User clicks "Adopt Device" button
5. System searches for DevEUI, finds device
6. Database updated to recognize manual registration
7. Sensor shows "Provisioned (Manual)" status
