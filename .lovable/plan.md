

# Plan: Update and Deploy All 3 TTN Deprovisioning Functions

## Summary

The TTN deprovisioning functions need to be updated and redeployed to use the **single-cluster architecture** (NAM1 for all operations). Currently, the deployed versions are outdated.

## Current State Analysis

| Function | Codebase Version | Deployed Version | Status |
|----------|-----------------|------------------|--------|
| `ttn-deprovision-worker` | `v5-single-cluster-20260124` | `v4-multi-endpoint-20260115` | ⚠️ Outdated |
| `ttn-deprovision` | `v1.1-single-cluster-20260124` | Unknown (needs deploy) | ⚠️ Outdated |
| `ttn-force-release-eui` | `v1.1-20260124` | Unknown (needs deploy) | ✅ Already uses all clusters |
| `ttn-bootstrap` | `v3.1-single-cluster-20260124` | Unknown (needs deploy) | ⚠️ Outdated |

## Architecture Issue

The `ttn-deprovision` and `ttn-force-release-eui` functions currently import from `_shared/ttnBase.ts` which now uses single-cluster architecture. However:

1. **`ttn-deprovision`**: Uses `IDENTITY_SERVER_URL` which is now mapped to NAM1 (correct for single-cluster)
2. **`ttn-force-release-eui`**: Intentionally searches ALL clusters (nam1, eu1, au1) to find orphaned devices - this is correct behavior for a "force release" utility
3. **`ttn-bootstrap`**: Hardcodes `TTN_BASE_URL = "https://nam1.cloud.thethings.network"` - already correct

## Changes Required

### 1. Update `ttn-deprovision-worker/index.ts`
- **Current**: Imports dual-endpoint constants but uses single-cluster logic
- **Fix**: Already correctly implemented in codebase (v5-single-cluster)
- **Action**: Deploy the updated version

### 2. Update `ttn-deprovision/index.ts`
- **Current**: Uses `IDENTITY_SERVER_URL` and `CLUSTER_BASE_URL` from ttnBase.ts
- **Status**: Already correctly uses single-cluster via the shared imports
- **Action**: Deploy the updated version

### 3. Keep `ttn-force-release-eui/index.ts` as-is
- **Current**: Searches all clusters (nam1, eu1, au1)
- **Rationale**: This is intentional - it's a recovery tool to find devices on wrong clusters
- **Action**: Deploy to ensure version sync

### 4. Update `ttn-bootstrap/index.ts`
- **Current**: Uses hardcoded `TTN_BASE_URL = "https://nam1.cloud.thethings.network"`
- **Status**: Already correct for single-cluster
- **Action**: Deploy the updated version

## Implementation Steps

### Step 1: Verify ttn-deprovision-worker Code
The codebase already has the correct v5 single-cluster implementation:
- Uses `IDENTITY_SERVER_URL` for IS operations (now NAM1)
- Uses `CLUSTER_BASE_URL` for data plane operations (NAM1)
- Validates hosts with `assertValidTtnHost()`

### Step 2: Add Version Check to Health Endpoint
Add a simple version verification to all three functions' GET endpoints to make it easier to confirm deployments.

### Step 3: Deploy All Functions
Deploy all four functions in the correct order:
1. `ttn-bootstrap` (provisions TTN resources)
2. `ttn-deprovision-worker` (background worker for device cleanup)
3. `ttn-deprovision` (full org deprovisioning)
4. `ttn-force-release-eui` (emergency DevEUI release)

## Technical Details

### Single-Cluster Architecture (Current ttnBase.ts)

```text
TTN_BASE_URL         = "https://nam1.cloud.thethings.network"
TTN_HOST             = "nam1.cloud.thethings.network"
CLUSTER_BASE_URL     = TTN_BASE_URL (same)
IDENTITY_SERVER_URL  = TTN_BASE_URL (same - key change!)
```

### Why Single-Cluster Works

TTN Cloud uses co-located servers where IS, JS, NS, and AS all reside on the same regional cluster. The previous dual-endpoint approach (EU1 for IS, NAM1 for data) caused "other cluster" warnings because devices were being registered with split-brain state.

### ttn-deprovision-worker Deletion Flow

```text
1. DELETE from IS: nam1/api/v3/applications/{appId}/devices/{deviceId}
2. DELETE from NS: nam1/api/v3/ns/applications/{appId}/devices/{deviceId}
3. DELETE from AS: nam1/api/v3/as/applications/{appId}/devices/{deviceId}
4. DELETE from JS: nam1/api/v3/js/applications/{appId}/devices/{deviceId}
```

All on the same cluster = correct behavior.

### ttn-force-release-eui Multi-Cluster Search

```text
Search for DevEUI on: nam1, eu1, au1
For each device found:
  - DELETE from AS, NS, JS, IS on that cluster
  - PURGE from IS on that cluster
Verify release by re-searching all clusters
```

This multi-cluster approach is intentional for finding orphaned devices.

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/functions/ttn-deprovision-worker/index.ts` | None | Already correct - just needs deploy |
| `supabase/functions/ttn-deprovision/index.ts` | None | Already correct - just needs deploy |
| `supabase/functions/ttn-force-release-eui/index.ts` | None | Already correct - just needs deploy |
| `supabase/functions/ttn-bootstrap/index.ts` | None | Already correct - just needs deploy |

## Deployment Commands

The following functions need to be deployed:

```bash
supabase functions deploy ttn-bootstrap
supabase functions deploy ttn-deprovision-worker
supabase functions deploy ttn-deprovision
supabase functions deploy ttn-force-release-eui
```

## Verification After Deployment

1. Check function logs for correct version strings:
   - `ttn-bootstrap-v3.1-single-cluster-20260124`
   - `deprovision-worker-v5-single-cluster-20260124`
   - `ttn-deprovision-v1.1-single-cluster-20260124`
   - `ttn-force-release-eui-v1.1-20260124`

2. Test deprovisioning by:
   - Creating a test sensor
   - Deleting the sensor (should create deprovision job)
   - Triggering worker (should delete from NAM1)
   - Verifying job status is SUCCEEDED

## Risk Assessment

- **Low risk**: All functions already have correct code in codebase
- **Issue**: Just need to deploy the updated versions
- **Rollback**: If issues occur, previous versions are in git history

