
# Fix: TTN Dual-Endpoint Architecture (IS on EU1, Data Planes on NAM1)

## Root Cause Analysis

The recent "Single Cluster Base URL Enforcement" implementation broke TTN provisioning by routing **all** TTN API calls to `nam1.cloud.thethings.network`, including Identity Server calls.

According to [TTN documentation](https://www.thethingsindustries.com/docs/cloud/addresses/):

> **The Identity Server APIs (`/api/is/*`) are only available in the `eu1` cluster.** This is because `eu1` is the central cluster where entity registrations are stored.

The error `404_route_not_found` with `cluster: "nam1.cloud.thethings.network"` occurs because NAM1 doesn't host the Identity Server endpoints.

---

## TTN Architecture (Correct)

| Server Component | Endpoint | Purpose |
|------------------|----------|---------|
| **Identity Server (IS)** | `eu1.cloud.thethings.network` | auth_info, applications, devices, organizations, API keys |
| **Network Server (NS)** | `nam1.cloud.thethings.network` | LoRaWAN MAC layer, data routing |
| **Application Server (AS)** | `nam1.cloud.thethings.network` | Webhooks, integrations, uplink delivery |
| **Join Server (JS)** | `nam1.cloud.thethings.network` | OTAA join handling |

---

## Implementation Plan

### Phase 1: Update `_shared/ttnBase.ts` - Dual Endpoint Constants

```typescript
// Identity Server - ALWAYS EU1 (global registry)
export const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";
export const IDENTITY_SERVER_HOST = "eu1.cloud.thethings.network";

// Data Planes - NAM1 (regional cluster)
export const CLUSTER_BASE_URL = "https://nam1.cloud.thethings.network";
export const CLUSTER_HOST = "nam1.cloud.thethings.network";

// Endpoint routing helper
export function getEndpointForPath(path: string): string {
  // Identity Server paths
  if (path.includes("/api/v3/applications/") && !path.includes("/as/")) ||
     path.includes("/api/v3/organizations/") ||
     path.includes("/api/v3/users/") ||
     path.includes("/api/v3/gateways/") ||
     path.includes("/api/v3/auth_info") ||
     path.includes("/devices") && !path.includes("/ns/") && !path.includes("/as/") && !path.includes("/js/")) {
    return IDENTITY_SERVER_URL;
  }
  // Data plane paths
  return CLUSTER_BASE_URL;
}
```

### Phase 2: Update Identity Server Calls

**Files requiring changes:**

1. **`_shared/ttnPermissions.ts`** - `validateMainUserApiKey()`:
   - Change: `${CLUSTER_BASE_URL}/api/v3/auth_info` → `${IDENTITY_SERVER_URL}/api/v3/auth_info`

2. **`ttn-gateway-preflight/index.ts`**:
   - Change: Line 212 `authInfoUrl` must use `IDENTITY_SERVER_URL`

3. **`ttn-provision-org/index.ts`**:
   - Step 0 (Preflight): Use `IDENTITY_SERVER_URL` for auth_info
   - Step 1 (Create Org): Use `IDENTITY_SERVER_URL`
   - Step 1B (Create Org API Key): Use `IDENTITY_SERVER_URL`
   - Step 2 (Create App): Use `IDENTITY_SERVER_URL`
   - Step 2B (Verify App): Use `IDENTITY_SERVER_URL`
   - Step 3 (Create App API Key): Use `IDENTITY_SERVER_URL`
   - Step 4 (Webhook): Use `CLUSTER_BASE_URL` (AS endpoint)

4. **`ttn-provision-device/index.ts`**:
   - Device registration (IS): Use `IDENTITY_SERVER_URL`
   - NS/AS/JS endpoints: Use `CLUSTER_BASE_URL`

5. **`ttn-list-devices/index.ts`**:
   - Device listing (IS): Use `IDENTITY_SERVER_URL`

6. **`ttn-manage-application/index.ts`**:
   - App info (IS): Use `IDENTITY_SERVER_URL`
   - Webhook management (AS): Use `CLUSTER_BASE_URL`

7. **`ttn-deprovision-worker/index.ts`**:
   - Device deletion (IS): Use `IDENTITY_SERVER_URL`
   - NS/AS/JS cleanup: Use `CLUSTER_BASE_URL`

8. **`check-ttn-device-exists/index.ts`**:
   - Device check (IS): Use `IDENTITY_SERVER_URL`

9. **`update-ttn-webhook/index.ts`**:
   - Webhook operations (AS): Use `CLUSTER_BASE_URL`

10. **`manage-ttn-settings/index.ts`**:
    - Connection test (IS): Use `IDENTITY_SERVER_URL`
    - Cluster validation: Update to check both endpoints

---

### Phase 3: Update Guards

Replace single-host assertion with dual-host validation:

```typescript
export function assertValidTtnHost(url: string, expectedType: "IS" | "DATA"): void {
  const host = new URL(url).host;
  
  if (expectedType === "IS" && host !== IDENTITY_SERVER_HOST) {
    throw new Error(`FATAL: IS endpoint must use ${IDENTITY_SERVER_HOST}, got ${host}`);
  }
  
  if (expectedType === "DATA" && host !== CLUSTER_HOST) {
    throw new Error(`FATAL: Data plane endpoint must use ${CLUSTER_HOST}, got ${host}`);
  }
}
```

---

### Phase 4: Update Diagnostics & UI

**`diagnosticsBuilder.ts`**:
```typescript
config: {
  identity_server_url: "https://eu1.cloud.thethings.network",
  cluster_base_url: "https://nam1.cloud.thethings.network",
  // Show both endpoints clearly
}
```

**`TTNDiagnosticsPanel.tsx`**:
- Display both Identity Server and Data Plane endpoints
- Show verification status for each

---

### Phase 5: Update Logging

Ensure every TTN API call logs which endpoint type it's using:

```json
{
  "event": "ttn_api_call",
  "endpoint_type": "IS" | "NS" | "AS" | "JS",
  "base_url": "https://eu1.cloud.thethings.network" | "https://nam1.cloud.thethings.network",
  "path": "/api/v3/auth_info",
  ...
}
```

---

## Endpoint Routing Table

| API Path Pattern | Server | Base URL |
|------------------|--------|----------|
| `/api/v3/auth_info` | IS | `eu1.cloud.thethings.network` |
| `/api/v3/applications/{app_id}` (GET/PUT/DELETE) | IS | `eu1.cloud.thethings.network` |
| `/api/v3/applications/{app_id}/devices` | IS | `eu1.cloud.thethings.network` |
| `/api/v3/applications/{app_id}/api-keys` | IS | `eu1.cloud.thethings.network` |
| `/api/v3/organizations/*` | IS | `eu1.cloud.thethings.network` |
| `/api/v3/gateways/*` | IS | `eu1.cloud.thethings.network` |
| `/api/v3/as/applications/{app_id}/*` | AS | `nam1.cloud.thethings.network` |
| `/api/v3/ns/applications/{app_id}/*` | NS | `nam1.cloud.thethings.network` |
| `/api/v3/js/applications/{app_id}/*` | JS | `nam1.cloud.thethings.network` |

---

## Files to Modify

| File | Changes |
|------|---------|
| `_shared/ttnBase.ts` | Add `IDENTITY_SERVER_URL`, update guards |
| `_shared/ttnPermissions.ts` | Use `IDENTITY_SERVER_URL` for auth_info |
| `_shared/ttnConfig.ts` | Add IS URL to config interface |
| `ttn-gateway-preflight/index.ts` | Use `IDENTITY_SERVER_URL` for auth_info |
| `ttn-provision-org/index.ts` | Route IS calls to EU1, data calls to NAM1 |
| `ttn-provision-device/index.ts` | Route IS calls to EU1, NS/AS/JS to NAM1 |
| `ttn-provision-gateway/index.ts` | Route IS calls to EU1 |
| `ttn-list-devices/index.ts` | Use `IDENTITY_SERVER_URL` for listing |
| `ttn-manage-application/index.ts` | Split IS vs AS calls |
| `ttn-deprovision-worker/index.ts` | Route IS calls to EU1 |
| `check-ttn-device-exists/index.ts` | Use `IDENTITY_SERVER_URL` |
| `update-ttn-webhook/index.ts` | Use `CLUSTER_BASE_URL` (AS) |
| `manage-ttn-settings/index.ts` | Update connection test and validation |
| `src/lib/ttn/diagnosticsBuilder.ts` | Show both endpoints |
| `src/components/ttn/TTNDiagnosticsPanel.tsx` | Display dual endpoints |

---

## Definition of Done

1. `IDENTITY_SERVER_URL` = `https://eu1.cloud.thethings.network` (global IS)
2. `CLUSTER_BASE_URL` = `https://nam1.cloud.thethings.network` (data planes)
3. All auth_info, application, device, org calls use IS (EU1)
4. All webhook, NS, AS, JS calls use DATA planes (NAM1)
5. Preflight check passes (no more 404)
6. Device provisioning works end-to-end
7. Runtime logs show correct endpoint for each call type
8. Diagnostics UI shows both endpoints
