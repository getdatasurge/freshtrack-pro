

# Fix Duplicate Properties in ttnConfig.ts

## Problem
The `TtnConfig` interface and the object literal that builds it both declare `orgApiKey` and `hasOrgApiKey` twice, causing TypeScript errors that block all edge function deployments.

## Fix (single file: `supabase/functions/_shared/ttnConfig.ts`)

### 1. Remove duplicate interface properties (lines 88-90)
Delete lines 88-90 from the `TtnConfig` interface. The first declarations at lines 75-76 already cover `orgApiKey` and `hasOrgApiKey`. Keep the `gatewayApiKey` and `hasGatewayKey` lines (91-93).

**Before (lines 87-93):**
```typescript
  // Organization API key (org-scoped, has gateway rights)
  orgApiKey?: string;
  hasOrgApiKey: boolean;
  // Gateway-specific API key (user-scoped, has gateway rights)
  gatewayApiKey?: string;
  hasGatewayKey: boolean;
```

**After:**
```typescript
  // Gateway-specific API key (user-scoped, has gateway rights)
  gatewayApiKey?: string;
  hasGatewayKey: boolean;
```

### 2. Remove duplicate object literal properties (lines 589-590)
Delete lines 589-590 from the return object. The first assignments at lines 580-581 already set these values.

**Before (lines 588-592):**
```typescript
    provisioningStatus: settings.provisioning_status || "not_started",
    orgApiKey,
    hasOrgApiKey: !!orgApiKey && orgApiKey.length > 0,
    gatewayApiKey,
    hasGatewayKey: !!gatewayApiKey && gatewayApiKey.length > 0,
```

**After:**
```typescript
    provisioningStatus: settings.provisioning_status || "not_started",
    gatewayApiKey,
    hasGatewayKey: !!gatewayApiKey && gatewayApiKey.length > 0,
```

### 3. Redeploy all four edge functions
After fixing, deploy:
- `check-ttn-gateway-exists`
- `ttn-gateway-preflight`
- `ttn-provision-gateway`
- `ttn-gateway-status`

