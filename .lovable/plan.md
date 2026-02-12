

# Fix: Route Gateway Registration to EU1 Identity Server

## Problem

Gateway registration calls are going to `nam1.cloud.thethings.network` (Gateway Server / radio plane), but gateway CRUD is an Identity Server operation that must go to `eu1.cloud.thethings.network`. This causes 404 errors.

## Solution

Three surgical edits to `supabase/functions/ttn-provision-gateway/index.ts`, then redeploy.

## Edits

### Edit 1 -- Line 45: Update build version
Change `BUILD_VERSION` from `"ttn-provision-gateway-v2-multi-strategy-20250102"` to `"ttn-provision-gateway-v3-eu1-identity-20250211"`.

### Edit 2 -- Lines 175-182: Switch baseUrl from NAM1 to EU1
Replace the NAM1 cluster base URL assignment with `IDENTITY_SERVER_URL` imported from the shared `ttnBase.ts` module. This makes all `ttnFetch` calls (used by every registration strategy) go to the EU1 Identity Server. The `gateway_server_address` field in the payload already correctly points to NAM1 for radio traffic.

### Edit 3 -- Lines 266-268: Remove duplicate import
The `IDENTITY_SERVER_URL` and `assertValidTtnHost` imports now happen in Edit 2 (line 175 area). Remove the duplicate import at line 268 and update the comment to note it was already imported above.

## Post-Deploy Verification
- Health check should return version `ttn-provision-gateway-v3-eu1-identity-20250211`
- Function logs should show requests going to `eu1.cloud.thethings.network`
- Adding a gateway in the UI should succeed using Strategy C (org-scoped)

