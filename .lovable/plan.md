

# Auto-Verify Gateways: Remove Manual Buttons, Add Automatic Checks

## What Changes

The manual "Verify" and "Verify All" buttons will be removed. Instead, the system will automatically check unlinked gateways:
- On every page load of the Registered Gateways tab
- After a provisioning attempt fails

## Technical Details

### 1. Fix `check-ttn-gateway-exists` edge function (2 line changes)

**File:** `supabase/functions/check-ttn-gateway-exists/index.ts`

- **Line 130:** Change `ttnConfig.clusterBaseUrl` to `ttnConfig.identityServerUrl` (gateway registry is on EU1, not the regional cluster)
- **Line 131:** Change `ttnConfig.gatewayApiKey || ttnConfig.apiKey` to `ttnConfig.orgApiKey || ttnConfig.apiKey` (use the Organization API key that has gateway read rights)

### 2. Auto-verify on page load

**File:** `src/pages/platform/PlatformGateways.tsx`

Add a `useEffect` in `RegisteredGatewaysTab` that fires after gateways load. If any gateways lack `ttn_gateway_id`, it automatically calls `checkTtn.mutate()` with those IDs. A `useRef` guard prevents repeated calls.

### 3. Auto-verify after provisioning fails

In the same file, update `handleProvisionOne` to trigger a verify check in its `onError` callback, so if provisioning fails the system still checks whether the gateway already exists on TTN.

### 4. Remove manual Verify UI

**File:** `src/pages/platform/PlatformGateways.tsx`

- Remove the "Verify All" button and banner (lines 657-671)
- Remove the per-row Verify icon button (lines 702-714)
- Remove the `handleVerifyAll` and `handleVerifyOne` functions (lines 571-589)

The auto-verify will show a subtle loading state in the TTN badge column while checking is in progress.

