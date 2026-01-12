# Test Strategy

> FreshTrack Pro Quality Assurance Philosophy and Approach

---

## Executive Summary

FreshTrack Pro is a **safety-critical refrigeration monitoring platform**. A missed alert can result in $10,000+ of spoiled inventory and potential health code violations. This test strategy prioritizes **reliability over speed** and **coverage of critical paths over cosmetic features**.

---

## Testing Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Safety First** | Test alert paths, escalations, and data integrity above all else |
| **Follow the Data** | Trace data from sensor → webhook → database → UI → notification |
| **SSOT Validation** | Verify single-source-of-truth components (process-unit-states, process-escalations) |
| **Regression Prevention** | Every bug fix should include a test that would have caught it |
| **Test at Boundaries** | Most bugs occur at integration points—focus testing there |

### Risk-Based Prioritization

| Risk Level | Feature Category | Testing Approach |
|------------|------------------|------------------|
| **Critical** | Alerts, notifications, data ingestion | Automated + Manual + E2E |
| **High** | Device provisioning, TTN integration, auth | Automated + Manual |
| **Medium** | Dashboard, reports, settings | Automated unit + Manual |
| **Low** | UI polish, branding, theming | Manual only |

---

## Testing Layers

### The Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Few, slow, high confidence
                    │   (Manual/Auto) │
                    └────────┬────────┘
                   ┌─────────┴─────────┐
                   │  Integration Tests │  ← Medium coverage
                   │  (API, Database)   │
                   └─────────┬─────────┘
              ┌──────────────┴──────────────┐
              │        Unit Tests           │  ← Many, fast, focused
              │  (Functions, Components)    │
              └─────────────────────────────┘
```

### Layer Definitions

#### 1. Unit Tests (Automated)

**Scope:** Individual functions, hooks, and components in isolation.

**Current Framework:**
- Frontend: Vitest + React Testing Library
- Edge Functions: Deno standard library testing

**What to Test:**
- Pure functions (eligibility checks, data transformations)
- Validation logic
- State computations (e.g., unit status)
- Utility functions

**What NOT to Test:**
- UI styling
- Third-party library internals
- Generated types

**Example:**
```typescript
describe("canProvisionGateway", () => {
  it("returns ALLOWED when all conditions are met", () => {
    const result = canProvisionGateway(validGateway, validTtnConfig);
    expect(result.allowed).toBe(true);
  });
});
```

#### 2. Integration Tests (Automated + Manual)

**Scope:** Multiple components/services working together.

**What to Test:**
- API calls → Database → Response chain
- Hook + Supabase client interactions
- Edge function + Database operations
- RLS policy enforcement

**Approaches:**
- Mock Supabase client for deterministic testing
- Use local Supabase for realistic integration tests
- Test RLS policies with different user roles

#### 3. End-to-End Tests (Primarily Manual)

**Scope:** Complete user journeys through the application.

**What to Test:**
- Onboarding flow (signup → org setup → device provisioning)
- Alert lifecycle (trigger → acknowledge → resolve)
- Escalation chain (primary → secondary → manager notification)
- Report generation

**Execution:**
- Manual testing with documented checklists
- Consider Playwright for critical paths in future

---

## Testing Responsibilities

### What is Automated

| Category | What's Tested | Framework |
|----------|--------------|-----------|
| **Eligibility Logic** | Gateway/sensor provisioning rules | Vitest |
| **TTN Permissions** | API key permission validation | Deno |
| **Data Transformations** | DevEUI normalization, temperature conversion | Vitest |
| **Validation Schemas** | Input validation (Zod schemas) | Vitest |

### What is Manual

| Category | Why Manual | Documentation |
|----------|-----------|---------------|
| **Device Provisioning** | Requires TTN account, real hardware | [MANUAL_TESTING.md](./MANUAL_TESTING.md) |
| **Alert Flow** | Complex timing, escalation chains | [E2E_SCENARIOS.md](./E2E_SCENARIOS.md) |
| **Onboarding Wizard** | Multi-step UI with external dependencies | [MANUAL_TESTING.md](./MANUAL_TESTING.md) |
| **Mobile Responsiveness** | Visual verification required | [MANUAL_TESTING.md](./MANUAL_TESTING.md) |
| **Stripe Integration** | Payment flows, webhooks | [MANUAL_TESTING.md](./MANUAL_TESTING.md) |

---

## Test Environments

### Local Development

```bash
# Start local Supabase
supabase start

# Run frontend tests
npm run test

# Run edge function tests
cd supabase/functions/_shared
deno test
```

### Staging Environment

- Shared Supabase project for integration testing
- Test TTN application (separate from production)
- Stripe test mode

### Production

- No testing in production
- Canary deployments for new features
- Feature flags for gradual rollout

---

## Test Data Management

### Principles

1. **Isolation:** Each test creates its own data
2. **Cleanup:** Tests clean up after themselves
3. **Determinism:** Same test, same result (no random data in assertions)
4. **Factories:** Use factory functions for test data

### Test Data Factories (Recommended Pattern)

```typescript
// src/test/factories.ts
export function createTestTTNConfig(overrides = {}): TTNConfigState {
  return {
    isEnabled: true,
    hasApiKey: true,
    applicationId: "test-app-id",
    ...overrides,
  };
}

export function createTestGateway(overrides = {}): GatewayForEligibility {
  return {
    gateway_eui: "AABBCCDDEEFF0011",
    ttn_gateway_id: null,
    status: "pending",
    ...overrides,
  };
}
```

---

## Critical Path Coverage

These paths MUST have both automated and manual testing:

### 1. Data Ingestion Pipeline

```
Sensor → TTN → ttn-webhook → sensor_readings table → process-unit-states
```

| Step | Test Type | Coverage |
|------|-----------|----------|
| TTN webhook receives data | Integration | Manual |
| DevEUI normalization | Unit | Automated |
| Reading stored in database | Integration | Manual |
| Unit status computed | Unit | Automated (planned) |

### 2. Alert Lifecycle

```
Excursion detected → Alert created → Notification sent → Acknowledged → Resolved
```

| Step | Test Type | Coverage |
|------|-----------|----------|
| Temperature threshold breach | Unit | Automated (planned) |
| Confirm time elapsed | Integration | Manual |
| Alert record created | Integration | Manual |
| Escalation triggered | E2E | Manual |

### 3. Device Provisioning

```
User enters DevEUI → Validate → Register with TTN → Save to database → Status: Active
```

| Step | Test Type | Coverage |
|------|-----------|----------|
| DevEUI validation | Unit | Automated |
| Permission check | Unit | Automated |
| TTN API call | Integration | Manual |
| Database update | Integration | Manual |

---

## Quality Gates

### Before Merging (PR Checklist)

- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed for UI changes
- [ ] No TypeScript errors (`npm run lint`)
- [ ] No console errors in browser

### Before Release

- [ ] All automated tests pass
- [ ] Manual E2E scenarios completed
- [ ] Staging environment tested
- [ ] Performance acceptable (page load < 3s)
- [ ] Critical path manual testing signed off

---

## Metrics and Goals

### Current State (Baseline)

| Metric | Value |
|--------|-------|
| Test files | 3 |
| Lines of test code | 476 |
| Components with tests | 0/112 (0%) |
| Hooks with tests | 0/26 (0%) |
| Edge functions with tests | 1/32 (3%) |
| Pages with tests | 0/23 (0%) |

### Target State (6-Month Goal)

| Metric | Target |
|--------|--------|
| Test files | 50+ |
| Lines of test code | 5,000+ |
| Critical path unit coverage | 80% |
| Edge function coverage | 50% |
| Manual test documentation | Complete |

---

## Running Tests

### Frontend Tests (Vitest)

```bash
# Run all tests
npm run test

# Run in watch mode
npm run test -- --watch

# Run with UI
npm run test -- --ui

# Run specific file
npm run test -- gatewayEligibility

# Run with coverage (when configured)
npm run test -- --coverage
```

### Edge Function Tests (Deno)

```bash
# Navigate to function
cd supabase/functions/_shared

# Run tests
deno test

# Run specific test file
deno test ttnPermissions.test.ts

# Run with permissions
deno test --allow-net --allow-env
```

---

## Adding Tests (For Developers)

### New Feature Checklist

1. **Identify the critical logic** — What could break?
2. **Write unit tests first** — Test edge cases
3. **Add integration test if external service involved**
4. **Update manual test documentation** if UI-heavy
5. **Update COVERAGE_MAP.md** with new coverage

### Test File Naming

```
# Unit tests - co-located with source
src/lib/actions/gatewayEligibility.ts
src/lib/actions/gatewayEligibility.test.ts

# Edge function tests
supabase/functions/_shared/ttnPermissions.ts
supabase/functions/_shared/ttnPermissions.test.ts
```

---

## Related Documents

- [COVERAGE_MAP.md](./COVERAGE_MAP.md) — Feature-to-test mapping
- [MANUAL_TESTING.md](./MANUAL_TESTING.md) — Step-by-step manual QA checklists
- [E2E_SCENARIOS.md](./E2E_SCENARIOS.md) — Critical user flow testing
- [KNOWN_GAPS.md](./KNOWN_GAPS.md) — Missing coverage and risks
