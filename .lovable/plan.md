

# Fix TTN Provision Device 502 + Frontend Build Errors

This plan addresses two distinct issues: the TTN edge function returning 502 Bad Gateway, and multiple frontend TypeScript build errors.

---

## Part 1: TTN Provision Device 502 Fix

### Root Cause

The edge function logs reveal the actual error:

```
TTN probe failed: 404 - {"name":"404_route_not_found","attributes":{"flags":"NR","cluster":"nam1.cloud.thethings.network"}}
```

The probe (Step 0) calls `/api/v3/applications/{appId}` which routes to **EU1** (Identity Server) via the cross-cluster logic. However, the application may not exist on EU1's Identity Server, or the API key lacks rights there. The "NR" flag means "Not Registered" -- the application ID isn't found.

This suggests either:
- The TTN application was never fully provisioned
- The application ID stored in `ttn_connections` is wrong
- The API key stored doesn't have rights for this application

### Secrets Status

The following TTN-related secrets are configured:
- `TTN_ADMIN_API_KEY` -- present
- `TTN_API_BASE_URL` -- present
- `TTN_API_KEY` -- present
- `TTN_APPLICATION_ID` -- present
- `TTN_IS_BASE_URL` -- present
- `TTN_USER_ID` -- present
- `TTN_WEBHOOK_API_KEY` -- present

The edge function does NOT use these global secrets -- it reads per-org config from the `ttn_connections` table via `getTtnConfigForOrg()`. The 502 comes from TTN returning 404 for the application probe.

### Changes to `ttn-provision-device/index.ts`

1. **Improve the outer catch block** (line 886-893) to include `build_version`, `request_url`, and stack trace in the error response
2. **Improve the probe failure response** (line 233-241) to include the raw TTN error body, the exact URL that was called, and the application ID being probed
3. **Add the raw TTN response body to all error responses** throughout the function -- currently some error paths return generic messages and lose the TTN details
4. **Fix the probe endpoint routing**: The probe calls `/api/v3/applications/{appId}` which the cross-cluster logic routes to EU1 (Identity Server). For application lookup, this should work on EU1, but if the app was created on NAM1 only, we should try NAM1 as fallback

### Specific Code Changes

**Outer catch (lines 886-893):** Add build version, function name, and structured error format with `ok: false`

**Probe failure response (lines 233-241):** Include `ttn_response`, `probe_url`, `identity_server`, `regional_server`, and `app_id` in the JSON response body

**Add fallback probe:** If EU1 probe returns 404, retry on NAM1 (regional) before failing -- this handles apps that were created before the cross-cluster architecture

---

## Part 2: Frontend Build Errors

Multiple TypeScript errors across UI components need fixing:

### 2a. `StatCard` -- `trendDirection` prop doesn't exist

**Files:** `DashboardLayout.tsx` (lines 81, 86, 92)

`StatCard` interface has `trend` but no `trendDirection`. Remove the `trendDirection` prop from all three usages in DashboardLayout.

### 2b. `SelectMenu` -- `label` prop doesn't exist

**Files:** `LayoutManager.tsx` (line 191), `WidgetPreview.tsx` (line 165)

`SelectMenuProps` extends `React.SelectHTMLAttributes` which doesn't have a `label` prop. Either add `label` to `SelectMenuProps` or remove it from call sites.

**Fix:** Add `label?: string` to `SelectMenuProps` and render it as a `<label>` element.

### 2c. `TrendIndicator` -- color type mismatch

**File:** `TrendIndicator.tsx` (lines 22-23)

`status.success.text` is `"text-emerald-400"` (from tokens) but TypeScript infers `colorClass` must be `"text-zinc-400"` (from `status.neutral.text`). Fix by typing `colorClass` as `string` instead of letting it infer from the initial value.

### 2d. `StatCard` -- same color type mismatch

**File:** `StatCard.tsx` (lines 23-24)

Same issue: `trendColor` initialized as `textTokens.tertiary` (`"text-zinc-500"`) then reassigned to `"text-emerald-400"`. Fix by typing as `string`.

### 2e. `InputWithInlineAddon` -- truncated error

Likely the same `as const` type narrowing issue. Will check and fix.

### 2f. `widgetRegistry` -- component type casting

**File:** `widgetRegistry.ts` (lines 26, 39, 52, 65, 106, 119, 132, 145, 158)

The `as React.ComponentType<Record<string, unknown>>` cast fails because widget props have required fields. Fix by casting through `unknown` first: `as unknown as React.ComponentType<Record<string, unknown>>`.

---

## Summary of Files to Change

| File | Change |
|------|--------|
| `supabase/functions/ttn-provision-device/index.ts` | Better error responses with raw TTN data, probe fallback to NAM1 |
| `src/components/frostguard/layouts/DashboardLayout.tsx` | Remove `trendDirection` props |
| `src/components/frostguard/layouts/LayoutManager.tsx` | Fix `SelectMenu` label usage |
| `src/components/frostguard/layouts/WidgetPreview.tsx` | Fix `SelectMenu` label usage |
| `src/lib/components/forms/SelectMenu.tsx` | Add `label` prop to interface |
| `src/components/frostguard/primitives/TrendIndicator.tsx` | Type `colorClass` as `string` |
| `src/lib/components/data-display/StatCard.tsx` | Type `trendColor` as `string` |
| `src/components/frostguard/registry/widgetRegistry.ts` | Fix component type casts with `unknown` intermediate |
| `src/lib/components/forms/InputWithInlineAddon.tsx` | Fix any type narrowing issues |

