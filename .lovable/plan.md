

# Fix Gateway Auto-Verify: Missing DB Columns + API Key Fallback

## Problem 1: Missing Database Columns

The `gateways` table is missing three columns that the verify function tries to write to:
- `provisioning_state`
- `last_provision_check_at`
- `last_provision_check_error`

The migration file exists (`20260212000000_add_gateway_provisioning_state.sql`) but was never applied. Every verify call logs:
```
Could not find the 'last_provision_check_at' column of 'gateways' in the schema cache
```

**Fix**: Apply a database migration to add these three columns to the `gateways` table.

## Problem 2: TTN Lookup Uses Wrong API Key

The verify function uses the Organization API key (CM6Q) to look up the gateway. But TTN returns 404 because the gateway is likely registered under your personal TTN account (`freshtracker`), not the TTN organization. The org key can only see org-owned gateways.

**Fix**: Update `check-ttn-gateway-exists` to try multiple API keys:
1. Try the org API key first (CM6Q)
2. If 404, retry with the application/personal API key (GAOA)
3. Only report "missing" if both return 404

## Technical Changes

### 1. Database Migration
```sql
ALTER TABLE public.gateways
ADD COLUMN IF NOT EXISTS provisioning_state text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_provision_check_at timestamptz,
ADD COLUMN IF NOT EXISTS last_provision_check_error text;
```

### 2. Edge Function: `check-ttn-gateway-exists/index.ts`

In the per-gateway lookup loop (around lines 163-205), after getting a 404 with the primary API key, add a retry block that tries `ttnConfig.apiKey` as a fallback before concluding "missing_in_ttn".

Update the build version string so we can verify the new code is deployed.

### 3. Redeploy
Redeploy `check-ttn-gateway-exists` after edits.

### Expected Result
- DB columns exist, so state updates succeed
- Verify tries org key, then falls back to app key
- Gateway is found on TTN and auto-linked
- Status updates from "unlinked" to "exists_in_ttn"
