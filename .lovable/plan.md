
# Fix: Use Organization API Key for Gateway Provisioning

## Problem
The `getTtnConfigForOrg()` shared function in `supabase/functions/_shared/ttnConfig.ts` only decrypts `ttn_api_key_encrypted` (the **Application** API key, last4=GAOA) into `ttnConfig.apiKey`. The **Organization** API key (last4=CM6Q) is stored in `ttn_org_api_key_encrypted` but is never loaded.

The `gatewayApiKey` field on line 548 tries to read `ttn_gateway_api_key_encrypted`, which does not exist in the database. So `ttnConfig.gatewayApiKey` is always `undefined` and `ttnConfig.hasGatewayKey` is always `false`.

This means `ttn-provision-gateway` always uses the Application API key, which lacks gateway registration rights.

## Database Evidence

```text
ttn_api_key_last4:     GAOA  (Application key - no gateway rights)
ttn_org_api_key_last4: CM6Q  (Organization key - HAS gateway rights)
```

## Solution: 2 edits in `ttnConfig.ts`, 0 edits in `ttn-provision-gateway`

### Edit 1: Add `orgApiKey` field to `TtnConfig` interface (~line 72-89)

Add a new `orgApiKey` field so consumers can access the Organization API key:

```typescript
export interface TtnConfig {
  region: string;
  apiKey: string;               // Application API key
  orgApiKey?: string;           // Organization API key (has gateway rights)
  hasOrgApiKey: boolean;        // Whether org API key is available
  applicationId: string;
  identityServerUrl: string;
  clusterBaseUrl: string;
  webhookSecret?: string;
  webhookUrl?: string;
  isEnabled: boolean;
  provisioningStatus: string;
  gatewayApiKey?: string;
  hasGatewayKey: boolean;
}
```

### Edit 2: Decrypt `ttn_org_api_key_encrypted` in `getTtnConfigForOrg()` (~line 547-578)

Replace the non-existent `ttn_gateway_api_key_encrypted` reference with `ttn_org_api_key_encrypted`:

```typescript
// Decrypt organization API key (org-scoped key for gateway provisioning)
const orgApiKey = settings.ttn_org_api_key_encrypted
  ? deobfuscateKey(settings.ttn_org_api_key_encrypted, encryptionSalt)
  : undefined;
```

And include it in the return object:

```typescript
return {
  region,
  apiKey,
  orgApiKey,
  hasOrgApiKey: !!orgApiKey && orgApiKey.length > 0,
  applicationId: applicationId || "",
  // ... rest unchanged
};
```

### Edit 3: Update `ttn-provision-gateway` to prefer org API key

In `ttn-provision-gateway/index.ts`, update the `ttnFetch` helper (around line 185) to prefer the org API key:

```typescript
const key = apiKey || ttnConfig.orgApiKey || ttnConfig.apiKey;
```

And update Strategy A (around line 330) to use `ttnConfig.orgApiKey` instead of `ttnConfig.gatewayApiKey`:

```typescript
if (ttnConfig.hasOrgApiKey && ttnConfig.orgApiKey) {
```

### Deploy

After edits, deploy `ttn-provision-gateway` (the only function that changed behavior). The shared `ttnConfig.ts` will be picked up automatically.

## Why This Works

- The Organization API key (CM6Q) is already stored in the database
- It was created by `ttn-provision-org` with gateway registration rights
- The `auth_info` endpoint will detect it as an organization-scoped key
- Strategy C (`/api/v3/organizations/{org_id}/gateways`) will be selected automatically
- No UI changes needed -- the key is already provisioned and visible in Settings
