
# FrostGuard Gateway Data Pipeline Repair

## Diagnosis

After investigating logs, database state, and code, here is what is actually broken:

### Issue 1: Edge functions were never redeployed
The code in the repository (v3 with EUI search fallback via `findTtnGatewayByEui`) is correct, but the **deployed** version is still `v2.0-eu1-orgkey-20260212` which only does direct `eui-{eui}` lookups. Previous deployment attempts failed due to duplicate TypeScript properties in `ttnConfig.ts` (now fixed). All four edge functions need to be redeployed.

### Issue 2: Missing `signal_quality` column
The `ttn-gateway-status` function tries to write `signal_quality` (JSONB) to the gateways table, but the column does not exist. This causes the status update to fail silently.

### Issue 3: `ttn-gateway-preflight` uses deprecated import
The preflight function still uses `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` instead of `Deno.serve()`, which may cause deployment issues.

### What is already correct (no changes needed)
- `ttnConfig.ts`: Already decrypts `orgApiKey` from `ttn_org_api_key_encrypted` and returns it (once, no duplicates)
- `check-ttn-gateway-exists/index.ts`: Already uses `findTtnGatewayByEui` with 3-step lookup (direct, auth_info, list search) and multi-key fallback
- `ttnGatewayLookup.ts`: Already implements the full EUI search strategy
- `ttn-gateway-status/index.ts`: Already uses org API key priority and correct NAM1 cluster for GS stats
- `GatewayHealthWidget.tsx`: Already auto-verifies unlinked gateways and triggers status sync
- `SiteGatewaysCard.tsx`: Already handles all 5 status types (online, degraded, offline, pending, maintenance)
- DB columns `provisioning_state`, `last_provision_check_at`, `last_provision_check_error`: Already exist

## Changes Required

### 1. Database Migration: Add `signal_quality` column
Add the missing JSONB column so `ttn-gateway-status` can persist signal data (RTT, uplink count, etc.).

```sql
ALTER TABLE public.gateways
ADD COLUMN IF NOT EXISTS signal_quality jsonb;
```

### 2. Fix `ttn-gateway-preflight/index.ts`
- Replace deprecated `import { serve }` with `Deno.serve()`
- Update build version string

### 3. Deploy all four edge functions
After the migration and preflight fix:
- `check-ttn-gateway-exists` (v3 with EUI search — the key fix)
- `ttn-gateway-status` (org API key priority)
- `ttn-gateway-preflight` (fixed import)
- `ttn-provision-gateway` (uses shared ttnConfig)

### 4. Verify via health checks
Hit each function's GET endpoint to confirm the new build versions are live.

## Expected Result After Deployment

1. Auto-verify fires for Orlando Burgers gateway (`ttn_gateway_id` is NULL)
2. `findTtnGatewayByEui` tries `GET /gateways/eui-2cf7f1117280001e` on EU1 -- 404
3. Falls back to `auth_info` to determine key scope (org-scoped)
4. Lists org gateways, finds `orlandoburgersgateways` matching EUI `2CF7F1117280001E`
5. Updates DB: `ttn_gateway_id = 'orlandoburgersgateways'`, `provisioning_state = 'exists_in_ttn'`
6. Status sync fires for linked gateway via NAM1 Gateway Server
7. Dashboard shows: Online with last seen timestamp
