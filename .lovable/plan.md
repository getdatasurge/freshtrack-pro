# TTN Dual-Endpoint Architecture - IMPLEMENTED

## Summary
Fixed TTN provisioning by implementing dual-endpoint routing per TTN Cloud architecture:
- **Identity Server (IS)**: `eu1.cloud.thethings.network` - Global registry for auth, apps, devices, orgs
- **Data Planes (NS/AS/JS)**: `nam1.cloud.thethings.network` - Regional LoRaWAN operations

## Key Changes
- `_shared/ttnBase.ts`: Added `IDENTITY_SERVER_URL` + `CLUSTER_BASE_URL`, `getEndpointForPath()`, `assertValidTtnHost()`
- `_shared/ttnPermissions.ts`: Routes `auth_info` to EU1 Identity Server
- All TTN edge functions updated to use dual-endpoint routing
- Diagnostics and UI updated to show both endpoints

## Endpoint Routing
| Path Pattern | Server | URL |
|--------------|--------|-----|
| `/api/v3/auth_info` | IS | eu1.cloud.thethings.network |
| `/api/v3/applications/*` | IS | eu1.cloud.thethings.network |
| `/api/v3/as/*` | AS | nam1.cloud.thethings.network |
| `/api/v3/ns/*` | NS | nam1.cloud.thethings.network |
| `/api/v3/js/*` | JS | nam1.cloud.thethings.network |
