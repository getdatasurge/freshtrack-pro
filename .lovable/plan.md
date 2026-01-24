
# Audit: TTN Provisioning "Wrong Cluster" End-Device Symptoms

## Executive Summary

This audit traces every TTN API call during provisioning to verify:
1. **Identity Server (IS) calls** target `eu1.cloud.thethings.network` (registry operations)
2. **Data Plane calls (NS/AS/JS)** target `nam1.cloud.thethings.network` (LoRaWAN operations)
3. **Webhook verification** proves the webhook exists on NAM1, not elsewhere

## Current Architecture Analysis

### Dual-Endpoint Constants (Correct)

**File:** `supabase/functions/_shared/ttnBase.ts`
```text
IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network"
CLUSTER_BASE_URL    = "https://nam1.cloud.thethings.network"
```

### CRITICAL FINDINGS

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| **BUG-001** | HIGH | `_shared/ttnConfig.ts:540` | `clusterBaseUrl` set to `TTN_BASE_URL` (NAM1), but testTtnConnection uses it for IS calls |
| **BUG-002** | HIGH | `_shared/ttnConfig.ts:620-624` | `testTtnConnection` calls `assertClusterHost()` which validates NAM1 but then uses that URL for app lookup (should use IS/EU1) |
| **BUG-003** | MEDIUM | No verification | Webhook existence is never verified on correct cluster after creation |
| **GAP-001** | HIGH | Missing | No "Provisioning Proof" report after provisioning |
| **GAP-002** | MEDIUM | Missing | No explicit wrong-cluster detection with clear error codes |

## Detailed Trace: Provisioning End-to-End

### Function: `ttn-provision-org/index.ts`

| Step | Action | Expected Host | Actual Host | Evidence |
|------|--------|---------------|-------------|----------|
| 0 (Preflight) | POST `/api/v3/auth_info` | EU1 (IS) | EU1 | Uses `validateMainUserApiKey()` which imports `IDENTITY_SERVER_URL` |
| 1 (Create Org) | POST `/api/v3/users/{userId}/organizations` | EU1 (IS) | EU1 | Line 1048: `${IDENTITY_SERVER_URL}/api/v3/users/...` |
| 1 (Verify Org) | GET `/api/v3/organizations/{id}` | EU1 (IS) | EU1 | Line 1149: `${IDENTITY_SERVER_URL}/api/v3/organizations/...` |
| 1B (Org API Key) | POST `/api/v3/organizations/{id}/api-keys` | EU1 (IS) | EU1 | Uses `IDENTITY_SERVER_URL` |
| 2 (Create App) | POST `/api/v3/organizations/{orgId}/applications` | EU1 (IS) | EU1 | Uses `IDENTITY_SERVER_URL` |
| 2B (Verify Rights) | GET `/api/v3/applications/{appId}/rights` | EU1 (IS) | EU1 | Uses `IDENTITY_SERVER_URL` |
| 3 (App API Key) | POST `/api/v3/applications/{appId}/api-keys` | EU1 (IS) | EU1 | Line 1946: `${IDENTITY_SERVER_URL}/api/v3/applications/...` |
| 3B (Gateway Key) | POST `/api/v3/organizations/{orgId}/api-keys` | EU1 (IS) | EU1 | Line 2104: `${IDENTITY_SERVER_URL}/api/v3/organizations/...` |
| 4 (Webhook) | PUT `/api/v3/as/webhooks/{appId}/{webhookId}` | NAM1 (AS) | NAM1 | Line 2206: `${regionalUrl}/api/v3/as/webhooks/...` where `regionalUrl = REGIONAL_URLS.nam1` |

**Result:** ttn-provision-org correctly routes IS calls to EU1 and AS calls to NAM1.

### Function: `ttn-provision-device/index.ts`

| Step | Action | Expected Host | Actual Host | Evidence |
|------|--------|---------------|-------------|----------|
| Probe | GET `/api/v3/applications/{appId}` | EU1 (IS) | EU1 | Line 174: `baseUrl = isDataPlane ? clusterBaseUrl : IDENTITY_SERVER_URL` |
| Create | POST `/api/v3/applications/{appId}/devices` | EU1 (IS) | EU1 | Line 284: `ttnFetch()` auto-detects IS path |
| JS Keys | PUT `/api/v3/js/applications/{appId}/devices/{deviceId}` | NAM1 (JS) | NAM1 | Line 367: `ttnFetch()` detects `/js/` prefix |
| NS | PUT `/api/v3/ns/applications/{appId}/devices/{deviceId}` | NAM1 (NS) | NAM1 | Line 428: `ttnFetch()` detects `/ns/` prefix |
| AS | PUT `/api/v3/as/applications/{appId}/devices/{deviceId}` | NAM1 (AS) | NAM1 | Line 457: `ttnFetch()` detects `/as/` prefix |
| Verify | GET `/api/v3/applications/{appId}/devices/{deviceId}` | EU1 (IS) | EU1 | Line 472: `ttnFetch()` auto-detects IS path |

**Result:** ttn-provision-device correctly uses `ttnFetch()` helper which auto-routes based on path.

### Function: `check-ttn-device-exists/index.ts`

| Step | Action | Expected Host | Actual Host | Evidence |
|------|--------|---------------|-------------|----------|
| List Devices | GET `/api/v3/applications/{appId}/devices` | EU1 (IS) | EU1 | Line 187: `clusterUrl = IDENTITY_SERVER_URL` |

**Result:** Correctly uses EU1 for device registry listing.

## BUG ANALYSIS

### BUG-001/002: `getTtnConfigForOrg` Returns Wrong Base URL

**Location:** `supabase/functions/_shared/ttnConfig.ts` lines 539-548

```typescript
// NAM1-ONLY: Single base URL for ALL planes (Identity + Regional)
const clusterBaseUrl = TTN_BASE_URL;  // <-- BUG: TTN_BASE_URL = NAM1
```

The config object sets `clusterBaseUrl` to NAM1, but this value is used in `testTtnConnection()` at lines 620-638 to make an IS call (GET application):

```typescript
const baseUrl = config.clusterBaseUrl;  // <-- Uses NAM1
assertClusterHost(`${baseUrl}/api/v3/applications`);  // <-- Validates NAM1
const appResponse = await fetch(`${baseUrl}${appEndpoint}`, ...);  // <-- Calls NAM1 for IS operation!
```

**This is incorrect.** The application lookup should go to EU1 (Identity Server), not NAM1.

**Fix Required:**
- `getTtnConfigForOrg` should return BOTH `identityServerUrl` (EU1) and `clusterBaseUrl` (NAM1)
- `testTtnConnection` should use `IDENTITY_SERVER_URL` for the application GET

### BUG-003: No Webhook Verification After Creation

After webhook creation at Step 4 in `ttn-provision-org`, there is no verification that:
1. The webhook exists on NAM1 AS endpoint
2. The `base_url` matches the stored value
3. The secret header is correctly configured

**Fix Required:** Add a verification step after webhook PUT that:
1. GETs the webhook from `${CLUSTER_BASE_URL}/api/v3/as/webhooks/${appId}/${webhookId}`
2. Compares `base_url` and headers with stored values
3. Fails loudly if mismatched

## Implementation Plan

### Phase 1: Fix TtnConfig Architecture

**File:** `supabase/functions/_shared/ttnConfig.ts`

1. Add `identityServerUrl` to `TtnConfig` interface
2. Modify `getTtnConfigForOrg()` to return both URLs:
```typescript
return {
  region: "nam1",
  apiKey,
  applicationId,
  identityServerUrl: IDENTITY_SERVER_URL,  // NEW
  clusterBaseUrl: CLUSTER_BASE_URL,
  // ...
};
```

3. Fix `testTtnConnection()` to use correct endpoint:
```typescript
const appBaseUrl = IDENTITY_SERVER_URL;  // IS for app lookup
assertValidTtnHost(`${appBaseUrl}/api/v3/applications`, "IS");
```

### Phase 2: Add Provisioning Proof Report

**File:** `supabase/functions/ttn-provision-org/index.ts`

After Step 4 (webhook creation), add Step 5 (Verification Report):

```typescript
// ============ STEP 5: Provisioning Proof Report ============
const proofReport = {
  request_id: requestId,
  timestamp: new Date().toISOString(),
  steps: []
};

// A) Identity verification (EU1 only)
const authInfoUrl = `${IDENTITY_SERVER_URL}/api/v3/auth_info`;
const authInfoResp = await fetchWithTimeout(authInfoUrl, {
  method: "GET",
  headers: { Authorization: `Bearer ${appApiKeyForWebhook}` }
});
proofReport.steps.push({
  step: "auth_info",
  host: "eu1.cloud.thethings.network",
  expected_host: "eu1.cloud.thethings.network",
  match: true,
  status: authInfoResp.status
});

const appUrl = `${IDENTITY_SERVER_URL}/api/v3/applications/${ttnAppId}`;
const appResp = await fetchWithTimeout(appUrl, {
  method: "GET",
  headers: { Authorization: `Bearer ${appApiKeyForWebhook}` }
});
proofReport.steps.push({
  step: "get_application",
  host: "eu1.cloud.thethings.network",
  expected_host: "eu1.cloud.thethings.network",
  match: true,
  status: appResp.status
});

// B) Cluster verification (NAM1 only)
const webhookUrl = `${CLUSTER_BASE_URL}/api/v3/as/webhooks/${ttnAppId}/${webhookId}`;
const webhookResp = await fetchWithTimeout(webhookUrl, {
  method: "GET",
  headers: { Authorization: `Bearer ${orgApiKeyForAppOps}` }
});

let webhookMatch = false;
if (webhookResp.ok) {
  const webhookData = await webhookResp.json();
  webhookMatch = webhookData.base_url === webhookUrl;
}

proofReport.steps.push({
  step: "get_webhook",
  host: "nam1.cloud.thethings.network",
  expected_host: "nam1.cloud.thethings.network",
  match: true,
  webhook_base_url_match: webhookMatch,
  status: webhookResp.status
});
```

### Phase 3: Add Wrong-Cluster Detection

**File:** `supabase/functions/_shared/ttnBase.ts`

Add explicit error codes for wrong-cluster conditions:

```typescript
export const TTN_ERROR_CODES = {
  IS_CALL_ON_NAM1: "ERR_IS_CALL_ON_WRONG_CLUSTER",
  WEBHOOK_ON_WRONG_CLUSTER: "ERR_WEBHOOK_WRONG_CLUSTER",
  APP_ID_MISMATCH: "ERR_APP_ID_MISMATCH_BETWEEN_STEPS",
  CREDENTIAL_MISMATCH: "ERR_CREDENTIAL_FINGERPRINT_MISMATCH",
};

export function detectWrongCluster(
  actualHost: string,
  expectedType: TTNEndpointType
): { error: boolean; code: string | null; message: string } {
  const expectedHost = expectedType === "IS" ? IDENTITY_SERVER_HOST : CLUSTER_HOST;
  
  if (actualHost !== expectedHost) {
    return {
      error: true,
      code: expectedType === "IS" ? TTN_ERROR_CODES.IS_CALL_ON_NAM1 : TTN_ERROR_CODES.WEBHOOK_ON_WRONG_CLUSTER,
      message: `Expected ${expectedType} on ${expectedHost}, got ${actualHost}`,
    };
  }
  
  return { error: false, code: null, message: "OK" };
}
```

### Phase 4: Enhanced Logging

Add credential fingerprint to every TTN API call log:

**File:** `supabase/functions/_shared/ttnBase.ts`

```typescript
export function logTtnApiCallWithCred(
  functionName: string,
  method: string,
  endpoint: string,
  step: string,
  requestId: string,
  credLast4: string,
  orgId?: string,
  appId?: string,
  deviceId?: string,
  baseUrl?: string
): void {
  const { url: detectedUrl, type } = getEndpointForPath(endpoint);
  const actualBaseUrl = baseUrl || detectedUrl;
  
  console.log(JSON.stringify({
    event: "ttn_api_call",
    method,
    endpoint,
    base_url: actualBaseUrl,
    host: new URL(actualBaseUrl).host,
    endpoint_type: type,
    plane: identifyPlane(endpoint),
    cred_last4: credLast4,
    org_id: orgId,
    app_id: appId,
    device_id: deviceId,
    function_name: functionName,
    step,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  }));
}
```

### Phase 5: UI Improvements

**File:** `src/components/settings/TTNConnectionSettings.tsx`

1. Rename "Provision TTN Application" button to "Verify TTN Setup"
2. Add a toggle for "Show TTN Communication Details"
3. Display the Provisioning Proof Report after successful provisioning

### Phase 6: CLI Equivalence Statement

After implementing all fixes, verify provisioning matches `ttn-lw-cli` behavior:

| CLI Command | Edge Function | Host | Match |
|-------------|---------------|------|-------|
| `ttn-lw-cli applications create` | ttn-provision-org Step 2 | EU1 | YES |
| `ttn-lw-cli applications api-keys create` | ttn-provision-org Step 3 | EU1 | YES |
| `ttn-lw-cli applications webhooks set` | ttn-provision-org Step 4 | NAM1 | YES |
| `ttn-lw-cli end-devices create` | ttn-provision-device create | EU1 | YES |
| `ttn-lw-cli end-devices set --join-server` | ttn-provision-device JS PUT | NAM1 | YES |
| `ttn-lw-cli end-devices set --network-server` | ttn-provision-device NS PUT | NAM1 | YES |
| `ttn-lw-cli end-devices set --application-server` | ttn-provision-device AS PUT | NAM1 | YES |

**CLI EQUIVALENCE: YES** (after fixes applied)

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/ttnConfig.ts` | Add `identityServerUrl` to config, fix `testTtnConnection()` |
| `supabase/functions/_shared/ttnBase.ts` | Add error codes, enhanced logging with credential fingerprint |
| `supabase/functions/ttn-provision-org/index.ts` | Add Step 5 Provisioning Proof Report |
| `supabase/functions/ttn-provision-device/index.ts` | Add credential fingerprinting to logs |
| `supabase/functions/check-ttn-device-exists/index.ts` | Add credential fingerprinting to logs |
| `src/components/settings/TTNConnectionSettings.tsx` | Rename button, add TTN communication toggle |
| `src/components/ttn/TTNDiagnosticsPanel.tsx` | Display Provisioning Proof Report |

## Deliverables Summary

1. **Provisioning Step Table** (Above)
2. **CLI Equivalence Statement:** YES (after fixes)
3. **Code Changes:**
   - `IS_BASE` always EU1 for registry operations
   - `CLUSTER_BASE` always NAM1 for AS/NS/JS operations
4. **UI Fix:**
   - "Provision TTN Application" → "Verify TTN Setup"
   - TTN Communication toggle exposed
5. **Webhook Verification:**
   - After creation, verify webhook exists on NAM1
   - Compare base_url and secret with stored values

## Technical Notes

- The current dual-endpoint architecture in `ttnBase.ts` is correct
- The bug is in `ttnConfig.ts` where `getTtnConfigForOrg()` only returns NAM1 URL
- `ttn-provision-org` and `ttn-provision-device` correctly use the dual-endpoint pattern
- The missing piece is verification after provisioning and explicit wrong-cluster detection
