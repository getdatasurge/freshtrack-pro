# FrostGuard Codebase Audit Report

**Date:** 2026-01-02
**Scope:** Full codebase review (frontend + backend + Supabase edge functions + DB/RLS + TTN integration)
**Auditor:** Claude Code

---

## Executive Summary

The FrostGuard codebase is a well-structured refrigeration monitoring application with solid architectural foundations. The application follows good practices including RLS enforcement, TypeScript throughout, and a clear separation between frontend components and backend edge functions.

However, the audit identified several areas requiring attention:

| Category | P0 (Critical) | P1 (Important) | P2 (Nice-to-have) |
|----------|---------------|----------------|-------------------|
| Error Handling | 2 | 3 | 1 |
| Code Duplication | 0 | 2 | 1 |
| Security | 2 | 1 | 0 |
| TTN Integration | 1 | 2 | 1 |
| Dead Code | 0 | 0 | 6 |
| **Total** | **5** | **8** | **9** |

---

## Phase 1: Architecture Audit

### 1.1 Repository Structure

```
freshtrack-pro/
├── src/                          # Frontend React application
│   ├── App.tsx                   # Main router & providers
│   ├── pages/                    # 22 route pages
│   ├── components/               # UI components (organized by feature)
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── dashboard/            # Dashboard widgets
│   │   ├── settings/             # TTNConnectionSettings, etc.
│   │   ├── alerts/               # Alert display components
│   │   └── billing/              # Stripe integration
│   ├── hooks/                    # 24 custom hooks
│   ├── lib/                      # Utilities, configs, validation
│   ├── types/                    # TypeScript types
│   ├── contexts/                 # React contexts (TTNConfigContext, etc.)
│   └── integrations/supabase/    # Supabase client & types
├── supabase/
│   ├── functions/                # 31 edge functions
│   │   ├── _shared/              # Shared utilities
│   │   │   ├── cors.ts           # CORS headers (underutilized)
│   │   │   ├── response.ts       # Standard response helpers
│   │   │   ├── ttnConfig.ts      # TTN configuration utilities
│   │   │   ├── ttnPermissions.ts # TTN permission checking
│   │   │   └── validation.ts     # Input validation
│   │   ├── manage-ttn-settings/  # TTN settings CRUD
│   │   ├── ttn-bootstrap/        # TTN validation & provisioning
│   │   ├── ttn-provision-org/    # TTN application creation
│   │   ├── ttn-provision-device/ # Device registration
│   │   ├── ttn-provision-gateway/# Gateway registration
│   │   ├── ttn-webhook/          # TTN uplink receiver
│   │   └── ... (25 more functions)
│   └── migrations/               # ~50 SQL migrations
└── docs/                         # Documentation
```

### 1.2 Critical User Flows

#### Flow 1: TTN Developer Panel Configuration
```
UI (TTNConnectionSettings.tsx)
  → Edge: manage-ttn-settings (action: get/update)
  → Edge: ttn-bootstrap (action: validate)
  → Edge: ttn-provision-org (action: provision)
  → Edge: update-ttn-webhook (configure webhook)
  → DB: ttn_connections table
```

#### Flow 2: Gateway Provisioning
```
UI (GatewayProvisionCard.tsx)
  → Hook: useGatewayProvisioningPreflight
  → Edge: ttn-gateway-preflight (check permissions)
  → Edge: ttn-provision-gateway (register in TTN)
  → DB: gateways table
```

#### Flow 3: Sensor Data Ingestion
```
TTN Webhook POST
  → Edge: ttn-webhook (validate secret, lookup device)
  → DB: lora_sensors, sensor_readings, units
  → Trigger: process-unit-states (alert creation)
```

#### Flow 4: Alert Processing & Escalation
```
Edge: process-unit-states (SSOT for alerts)
  → DB: alerts table (create/resolve)
  → Edge: process-escalations
  → Edge: send-sms-alert
  → DB: notification_deliveries
```

### 1.3 Hotspots & Complexity

#### Top 10 Largest Files (by LOC)
| File | Lines | Concern |
|------|-------|---------|
| `src/components/settings/TTNConnectionSettings.tsx` | ~1200 | Large, but feature-complete |
| `supabase/functions/ttn-provision-org/index.ts` | ~630 | Complex provisioning logic |
| `supabase/functions/org-state-api/index.ts` | ~410 | Sync API endpoint |
| `supabase/functions/sensor-simulator/index.ts` | ~650 | Development tool |
| `src/pages/Settings.tsx` | ~580 | Settings hub |
| `supabase/functions/ttn-webhook/index.ts` | ~540 | Webhook processing |
| `supabase/functions/ttn-provision-gateway/index.ts` | ~510 | Gateway provisioning |
| `src/lib/KNOWLEDGE.md` | ~688 | Documentation (good!) |
| `supabase/functions/update-sensor-assignment/index.ts` | ~490 | Sensor management |
| `supabase/functions/ttn-bootstrap/index.ts` | ~380 | TTN validation |

#### Central Modules (widely imported)
1. `src/integrations/supabase/client.ts` - Supabase client singleton
2. `supabase/functions/_shared/ttnConfig.ts` - TTN configuration utilities
3. `supabase/functions/_shared/cors.ts` - CORS headers (underutilized)
4. `src/lib/validation.ts` - Zod schemas
5. `src/lib/alertConfig.ts` - Alert type configurations

### 1.4 Separation of Concerns

**Strengths:**
- Clear page/component/hook separation
- Feature-grouped components (`settings/`, `alerts/`, `dashboard/`)
- Shared utilities in `_shared/` for edge functions
- State machine types in `types/ttnState.ts`
- Context providers for global state (`TTNConfigContext`)

**Concerns:**
- `TTNConnectionSettings.tsx` handles too many responsibilities (validate, save, provision, test, webhook)
- Some edge functions duplicate CORS header definitions instead of importing from `_shared/cors.ts`
- Response envelope patterns inconsistent (`ok` vs `success`)

### 1.5 Integration Health Checklist

#### Supabase Auth/Session
- **Status:** ✅ Correct
- Auth header extraction and token verification consistent across edge functions
- `getUser(token)` pattern used properly

#### RLS Coverage
- **Status:** ✅ Comprehensive
- All 30+ tables have RLS enabled
- Org membership enforced via `user_roles` table
- Critical tables: `ttn_connections`, `lora_sensors`, `gateways`, `sensor_readings`

#### Edge Function Patterns
- **Status:** ⚠️ Inconsistent
- CORS: 31 functions define local `corsHeaders`, only 1 imports from `_shared/cors.ts`
- Response shapes: Mix of `ok: true/false` and `success: true/false`
- `request_id`: Present in ~60% of error responses, missing in ~40%

#### TTN Integration
- **Status:** ⚠️ Needs stabilization
- Permission checking via `/api/v3/applications/{id}/rights` ✅
- Webhook secret validation with constant-time comparison ✅
- Multi-strategy gateway provisioning (user/org/admin fallback) ✅
- **Issues:** Response envelope inconsistency, error detail leakage

---

## Phase 2: Prioritized Remediation Plan

### P0 — Must Fix Now (Critical)

#### P0-1: Stack Traces Exposed in Error Responses
**Problem:** Two edge functions include `error.stack` in API responses, leaking internal implementation details.

**Files:**
- `supabase/functions/org-state-api/index.ts:392-410`
- `supabase/functions/update-sensor-assignment/index.ts:484-488`

**Root Cause:** Debug code left in production error handlers.

**Fix:**
```typescript
// Replace:
error_stack: error instanceof Error ? error.stack : undefined,

// With:
// Remove entirely - never expose stack traces
```

**Validation:**
1. Deploy updated functions
2. Trigger an error condition
3. Verify response contains no `error_stack` or `error_type` fields

---

#### P0-2: Sensitive Variable Names in Errors
**Problem:** Stripe-related functions expose environment variable names in thrown errors.

**Files:**
- `supabase/functions/stripe-webhook/index.ts:25`
- `supabase/functions/stripe-portal/index.ts:24`
- `supabase/functions/stripe-checkout/index.ts:24`

**Root Cause:** Generic error messages that reveal configuration details.

**Fix:**
```typescript
// Replace:
throw new Error("STRIPE_SECRET_KEY is not set");

// With:
throw new Error("Payment service configuration error");
```

**Validation:** Trigger the error and verify message is generic.

---

#### P0-3: Missing `request_id` in Error Responses (Critical Functions)
**Problem:** TTN integration errors lack `request_id`, making production debugging extremely difficult.

**Files (high-priority subset):**
- `supabase/functions/ttn-provision-org/index.ts` - 12 error responses missing `request_id`
- `supabase/functions/manage-ttn-settings/index.ts` - 6 error responses missing `request_id`
- `supabase/functions/ttn-webhook/index.ts` - 4 error responses missing `request_id`

**Root Cause:** `request_id` generated but not consistently included in all response paths.

**Fix:** Add `request_id` to ALL JSON.stringify responses:
```typescript
return new Response(
  JSON.stringify({ error: "...", request_id: requestId }),
  { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

**Validation:**
1. Trigger each error condition
2. Verify response contains `request_id` field
3. Check logs correlate with response `request_id`

---

#### P0-4: TTN Error Details Leaking to Clients
**Problem:** Raw TTN API error responses passed directly to clients, potentially exposing API structure.

**Files:**
- `supabase/functions/ttn-provision-org/index.ts:243` - `details: errorText`
- `supabase/functions/ttn-provision-device/index.ts:262,406` - `details: errorText`

**Root Cause:** Debug convenience that became production code.

**Fix:** Sanitize TTN error details before returning:
```typescript
// Replace:
details: errorText

// With:
details: sanitizeTTNError(errorText) // Only return safe hints, not raw API response
```

**Validation:** Trigger TTN errors and verify sanitized output.

---

#### P0-5: Response Envelope Inconsistency (TTN Functions)
**Problem:** Frontend code must handle two different response shapes (`ok` vs `success`), causing potential parsing failures.

**Files with `success` instead of `ok`:**
- `supabase/functions/ttn-bootstrap/index.ts` (10+ instances)
- `supabase/functions/manage-ttn-settings/index.ts` (3 instances)
- `supabase/functions/ttn-provision-org/index.ts` (8+ instances)
- `supabase/functions/ingest-readings/index.ts` (5 instances)
- `supabase/functions/org-state-api/index.ts` (2 instances)

**Root Cause:** No enforced response standard; different developers, different patterns.

**Fix:** Standardize on `_shared/response.ts` helpers:
```typescript
import { successResponse, errorResponse } from "../_shared/response.ts";

// Replace:
return new Response(JSON.stringify({ success: true, ... }));

// With:
return successResponse({ ... }, { requestId });
```

**Validation:**
1. Update frontend to expect `ok` field consistently
2. Add TypeScript types for response shapes
3. Test all TTN flows end-to-end

---

### P1 — Important (Reliability/UX)

#### P1-1: CORS Headers Duplication
**Problem:** 30 edge functions define their own `corsHeaders` constant instead of importing from `_shared/cors.ts`.

**Files:** All 30 functions listed in grep results.

**Root Cause:** Copy-paste development, shared module not consistently used.

**Fix:**
```typescript
// Replace local definition:
const corsHeaders = { ... };

// With import:
import { corsHeaders } from "../_shared/cors.ts";
```

**Validation:** `grep -r "const corsHeaders" supabase/functions/` should only match `_shared/cors.ts`.

---

#### P1-2: Export Temperature Logs Missing `request_id`
**Problem:** User-facing export function lacks traceability.

**File:** `supabase/functions/export-temperature-logs/index.ts` - 5 error responses without `request_id`

**Fix:** Add `request_id` generation and include in all responses.

---

#### P1-3: Sensor Simulator Error Responses
**Problem:** Development tool has inconsistent error handling.

**File:** `supabase/functions/sensor-simulator/index.ts` - 10+ error responses without `request_id`

**Fix:** Add consistent error envelope with `request_id`.

---

#### P1-4: TTN Webhook Authentication Errors
**Problem:** Webhook returns 401/202 without consistent structure.

**File:** `supabase/functions/ttn-webhook/index.ts:135,154,165`

**Fix:** Standardize webhook error responses (though 202 for "accepted but not processed" is correct for webhooks).

---

#### P1-5: Inconsistent HTTP Status Codes
**Problem:** Similar error conditions return different status codes across functions.

| Error Type | Status Codes Found |
|------------|-------------------|
| Missing config | 400, 500 |
| Auth failure | 401, 403 |
| Not found | 404, 202, 400 |

**Fix:** Create status code mapping in `_shared/response.ts` and use consistently.

---

#### P1-6: TTNConnectionSettings.tsx Size
**Problem:** 1200+ line component handles too many responsibilities.

**Root Cause:** Incremental feature additions without refactoring.

**Fix (future):** Extract into smaller components:
- `TTNValidationForm.tsx`
- `TTNProvisioningStatus.tsx`
- `TTNWebhookConfig.tsx`
- `TTNConnectionTestPanel.tsx`

---

#### P1-7: Validation Helpers Missing `request_id`
**Problem:** `_shared/validation.ts` response helpers don't include `request_id`.

**File:** `supabase/functions/_shared/validation.ts:384-413`

**Fix:** Add optional `requestId` parameter to helper functions.

---

#### P1-8: Ingest Readings Error Handling
**Problem:** Critical data ingestion path has inconsistent error responses.

**File:** `supabase/functions/ingest-readings/index.ts`

**Fix:** Standardize all error responses with `request_id` and consistent `ok` field.

---

### P2 — Nice-to-Have (Refactors/Polish)

#### P2-1: Remove Dead Code - edgeFunctionList.ts
**Files:**
- `src/lib/health/edgeFunctionList.ts:219` - `getTestableEdgeFunctions()` unused
- `src/lib/health/edgeFunctionList.ts:226` - `getSkippedEdgeFunctions()` unused
- `src/lib/health/edgeFunctionList.ts:233` - `getCriticalEdgeFunctions()` unused

**Proof:** No imports found in codebase.

---

#### P2-2: Remove Dead Code - statusConfig.ts
**File:** `src/lib/statusConfig.ts:32` - `compareStatusPriority()` unused

**Proof:** No imports found in codebase.

---

#### P2-3: Remove Dead Code - guards.ts
**File:** `src/lib/ttn/guards.ts:207` - `getRequiredPermissions()` unused

**Proof:** No imports found in codebase.

---

#### P2-4: Remove Dead Type Export
**File:** `src/lib/instrumentedSupabase.ts:241` - `InstrumentedSupabase` type unused

**Proof:** No imports found in codebase.

---

#### P2-5: Centralize Response Envelope Types
**Problem:** No TypeScript types for API response shapes.

**Fix:** Create `types/apiResponse.ts` with standardized types.

---

#### P2-6: Add Edge Function Response Validation
**Problem:** No runtime validation of edge function responses on frontend.

**Fix:** Add Zod schemas for expected response shapes.

---

#### P2-7: Document TTN Integration Contract
**Problem:** No formal documentation of TTN edge function request/response shapes.

**Fix:** Add OpenAPI-style documentation or TypeScript interface documentation.

---

#### P2-8: TTN Webhook Idempotency
**Problem:** No explicit idempotency handling for webhook updates.

**Fix:** Add `If-Match` / ETag support or implement proper upsert semantics.

---

#### P2-9: Gateway Provisioning Key Type Guidance
**Problem:** UI doesn't clearly explain which TTN API key type is needed for gateway provisioning.

**Fix:** Add contextual help explaining personal vs. organization API keys.

---

## TTN Integration Stabilization Plan

### Contract Normalization
1. Define response envelope: `{ ok: boolean, data?: T, error?: { code: string, message: string, hint?: string }, request_id: string }`
2. Update all TTN edge functions to use this envelope
3. Add TypeScript types for all request/response shapes
4. Update frontend hooks to expect normalized responses

### Permission Preflights
1. `ttn-gateway-preflight` correctly checks key type and gateway rights
2. Ensure UI disables gateway provisioning button when preflight fails
3. Add clear messaging for "wrong key type" scenarios

### Webhook Lifecycle
1. `update-ttn-webhook` handles create/update idempotently
2. Add webhook event type selection (uplink_message, join_accept, etc.)
3. Store webhook configuration in `ttn_connections.ttn_webhook_events`

### Request ID Propagation
1. Generate `request_id` at entry point of each function
2. Include in all log statements: `console.log(`[func] [${requestId}] ...`)`
3. Include in ALL responses (success and error)
4. Pass to sub-function calls for correlation

---

## Validation Checklist

### Commands
```bash
# Lint check
npm run lint

# Type check
npm run typecheck

# Build
npm run build

# Tests (if available)
npm test
```

### Manual Smoke Test
- [ ] Load app and authenticate
- [ ] Open Developer → TTN panel
- [ ] Validate TTN config (success state)
- [ ] Validate TTN config (failure state)
- [ ] Save config (verify persistence)
- [ ] Configure webhook (verify idempotency)
- [ ] Test connection (verify clear output with `request_id`)
- [ ] Attempt gateway provisioning (verify permission guidance if blocked)
- [ ] Trigger a webhook uplink (verify sensor data recorded)
- [ ] Check event_logs for audit trail

---

## Implementation Order

1. **P0 items first** (security fixes)
2. **P1 items** (grouped by file to minimize PR churn)
3. **P2 items** (can be done opportunistically)

### Recommended PR Sequence

| PR | Items | Files Changed | Risk |
|----|-------|---------------|------|
| 1 | P0-1, P0-2 | 5 edge functions | Low |
| 2 | P0-3, P0-4, P0-5 | TTN edge functions | Medium |
| 3 | P1-1 | 30 edge functions | Low |
| 4 | P1-2 to P1-5 | 5 edge functions | Low |
| 5 | P1-6, P1-7, P1-8 | Components + shared | Medium |
| 6 | P2-1 to P2-4 | Dead code removal | Low |
| 7 | P2-5 to P2-9 | Documentation + types | Low |

---

## Appendix: Dead Code Candidates

| File | Export | Evidence |
|------|--------|----------|
| `src/lib/health/edgeFunctionList.ts` | `getTestableEdgeFunctions()` | No imports |
| `src/lib/health/edgeFunctionList.ts` | `getSkippedEdgeFunctions()` | No imports |
| `src/lib/health/edgeFunctionList.ts` | `getCriticalEdgeFunctions()` | No imports |
| `src/lib/statusConfig.ts` | `compareStatusPriority()` | No imports |
| `src/lib/ttn/guards.ts` | `getRequiredPermissions()` | No imports |
| `src/lib/instrumentedSupabase.ts` | `InstrumentedSupabase` type | No imports |

**Note:** All hooks, pages, and components are actively used. All edge functions are either invoked from frontend or configured as background workers/webhooks.

---

*End of Audit Report*
