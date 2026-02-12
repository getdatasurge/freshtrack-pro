

# Fix: Preflight Check Must Also Use Organization API Key

## Problem
We fixed `ttn-provision-gateway` to use the Organization API key, but `ttn-gateway-preflight` still uses the Application API key (`ttnConfig.apiKey`) for its `auth_info` check. This is why the banner still says "Application API keys cannot provision gateways."

Two lines need to change in `ttn-gateway-preflight/index.ts`:

## Edits

### Edit 1 -- Line 187: Check for org API key instead of gateway key
Change:
```typescript
if (ttnConfig.hasGatewayKey && ttnConfig.gatewayApiKey) {
```
To:
```typescript
if (ttnConfig.hasOrgApiKey && ttnConfig.orgApiKey) {
```

Also update the log message on line 188 and the `key_type` on line 196 from `"personal"` to `"organization"`, and `owner_scope` to `"organization"`.

### Edit 2 -- Line 218: Use org API key for auth_info call
Change:
```typescript
Authorization: `Bearer ${ttnConfig.apiKey}`,
```
To:
```typescript
Authorization: `Bearer ${ttnConfig.orgApiKey || ttnConfig.apiKey}`,
```

This ensures that when an Organization API key exists, the preflight checks it (instead of the Application key), detects it as org-scoped with gateway rights, and returns `allowed: true`.

### Deploy
Redeploy `ttn-gateway-preflight` after edits.

### Expected Result
- Preflight returns `allowed: true`, `key_type: "organization"`
- The red "Application API keys cannot provision gateways" banner disappears
- The "+ Add Gateway" flow proceeds to registration

