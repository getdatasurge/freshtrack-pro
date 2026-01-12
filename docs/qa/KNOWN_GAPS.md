# Known Test Coverage Gaps

> Risk assessment and recommended future tests

---

## Executive Summary

FreshTrack Pro has **minimal automated test coverage** (~5% estimated). The existing tests cover only eligibility logic and TTN permission validation. Critical paths including alert processing, data ingestion, and the entire frontend remain untested.

### Current Coverage Statistics

| Area | Files | Tested | Coverage |
|------|-------|--------|----------|
| Pages | 23 | 0 | 0% |
| Components | 112 | 0 | 0% |
| Hooks | 26 | 0 | 0% |
| Edge Functions | 32 | 1 | 3% |
| Lib/Actions | 6 | 6 | 100% |
| **Total** | **199+** | **7** | **~3%** |

---

## Critical Gaps (P0 - Immediate Risk)

### Gap 1: Alert Processing Engine

| Attribute | Value |
|-----------|-------|
| **File** | `supabase/functions/process-unit-states/index.ts` |
| **Risk Level** | **CRITICAL** |
| **Business Impact** | Missed alerts → spoiled inventory ($10K+), health violations |
| **Current Testing** | None |

**What Could Go Wrong:**
- Temperature threshold comparisons fail
- Confirm time logic broken
- Alert state transitions incorrect
- Database writes silently fail

**Recommended Tests:**
```typescript
// Unit tests for alert logic
describe("process-unit-states", () => {
  it("creates alert when temp exceeds threshold for confirm_time");
  it("does not create alert for brief excursions");
  it("resolves alert when temp returns to normal");
  it("handles multiple simultaneous excursions");
  it("respects unit-specific override rules");
});
```

**Priority:** Implement within 1 week

---

### Gap 2: Notification Dispatch

| Attribute | Value |
|-----------|-------|
| **File** | `supabase/functions/process-escalations/index.ts` |
| **Risk Level** | **CRITICAL** |
| **Business Impact** | Alerts triggered but no one notified |
| **Current Testing** | None |

**What Could Go Wrong:**
- Escalation timing incorrect
- Wrong contacts notified
- Email/SMS delivery fails silently
- Duplicate notifications sent

**Recommended Tests:**
```typescript
describe("process-escalations", () => {
  it("sends notification to level 1 contacts immediately");
  it("escalates to level 2 after delay if unacknowledged");
  it("stops escalation when alert acknowledged");
  it("handles contact with no email gracefully");
  it("respects notification policy channel settings");
});
```

**Priority:** Implement within 1 week

---

### Gap 3: TTN Webhook Data Ingestion

| Attribute | Value |
|-----------|-------|
| **File** | `supabase/functions/ttn-webhook/index.ts` |
| **Risk Level** | **CRITICAL** |
| **Business Impact** | Temperature data not recorded → compliance gaps |
| **Current Testing** | None |

**What Could Go Wrong:**
- DevEUI normalization fails
- Webhook secret validation bypassed
- Payload parsing errors
- Database insert fails
- Duplicate readings accepted

**Recommended Tests:**
```typescript
describe("ttn-webhook", () => {
  it("accepts valid uplink with correct webhook secret");
  it("rejects requests with invalid webhook secret");
  it("normalizes DevEUI to uppercase no-separator format");
  it("parses temperature from various payload formats");
  it("stores reading with correct sensor association");
  it("handles unknown DevEUI gracefully");
});
```

**Priority:** Implement within 1 week

---

### Gap 4: Frontend Unit Status Computation

| Attribute | Value |
|-----------|-------|
| **File** | `src/hooks/useUnitStatus.ts` |
| **Risk Level** | **HIGH** |
| **Business Impact** | Dashboard shows wrong status → delayed response |
| **Current Testing** | None |

**What Could Go Wrong:**
- Status priority ordering wrong
- Excursion vs alarm distinction broken
- Offline detection timing wrong
- Status doesn't update when data changes

**Recommended Tests:**
```typescript
describe("useUnitStatus", () => {
  it("returns 'ok' when temperature in range");
  it("returns 'excursion' during unconfirmed excursion");
  it("returns 'alarm_active' after confirm time");
  it("returns 'offline' when sensor stops reporting");
  it("priority: alarm_active > excursion > offline > ok");
});
```

**Priority:** Implement within 2 weeks

---

## High-Priority Gaps (P1 - Significant Risk)

### Gap 5: Row-Level Security Policies

| Attribute | Value |
|-----------|-------|
| **Files** | All migrations with RLS policies |
| **Risk Level** | **HIGH** |
| **Business Impact** | Data leakage between organizations |
| **Current Testing** | None |

**Risk Scenarios:**
- User A can see User B's organization data
- Deleted user retains access
- Role changes not enforced
- Cross-tenant data in reports

**Recommended Tests:**
```sql
-- Test RLS for units table
SET request.jwt.claim.sub = 'user-org-a';
SELECT * FROM units WHERE organization_id = 'org-b'; -- Should return 0
```

**Priority:** Implement within 2 weeks

---

### Gap 6: Device Provisioning Flow

| Attribute | Value |
|-----------|-------|
| **Files** | `ttn-provision-device`, `ttn-provision-gateway` |
| **Risk Level** | **HIGH** |
| **Business Impact** | Devices not registered → no data collection |
| **Current Testing** | Eligibility only (logic before API call) |

**What Could Go Wrong:**
- TTN API call format wrong
- Error handling insufficient
- Rollback on partial failure missing
- Status not updated after provisioning

**Priority:** Implement within 3 weeks

---

### Gap 7: Offline Sync Mechanism

| Attribute | Value |
|-----------|-------|
| **File** | `src/hooks/useOfflineSync.ts` |
| **Risk Level** | **HIGH** |
| **Business Impact** | Manual logs lost during field work |
| **Current Testing** | None |

**What Could Go Wrong:**
- IndexedDB writes fail
- Sync conflicts not resolved
- Data loss during sync
- Timestamps corrupted

**Priority:** Implement within 3 weeks

---

### Gap 8: Alert Rules Cascading

| Attribute | Value |
|-----------|-------|
| **Files** | `get_effective_alert_rules` RPC, `useAlertRules.ts` |
| **Risk Level** | **MEDIUM-HIGH** |
| **Business Impact** | Wrong thresholds applied → false positives/negatives |
| **Current Testing** | None |

**What Could Go Wrong:**
- Unit override not applied
- Site settings ignored
- Inheritance chain broken
- Default rules missing

**Priority:** Implement within 4 weeks

---

## Medium-Priority Gaps (P2)

### Gap 9: Component Testing

| Files | Count | Risk |
|-------|-------|------|
| Settings components | 20+ | Forms may break silently |
| Dashboard widgets | 10+ | Data display errors |
| Alert components | 5+ | Status not reflected |

**Recommended Approach:**
- Use React Testing Library
- Start with forms that save data
- Test error states

**Priority:** Implement over 2 months

---

### Gap 10: Page-Level Integration

| Pages | Risk |
|-------|------|
| Dashboard | Data loading, filtering, refresh |
| Settings | Form submission, validation |
| Unit Detail | Real-time updates, graph rendering |
| Reports | Report generation, export |

**Recommended Approach:**
- Mock Supabase client
- Test component composition
- Verify data flow

**Priority:** Implement over 2 months

---

### Gap 11: Stripe Integration

| Functions | Risk |
|-----------|------|
| `stripe-checkout` | Payment failures |
| `stripe-portal` | Customer access issues |
| `stripe-webhook` | Subscription state sync |

**Recommended Approach:**
- Use Stripe test mode
- Mock webhook events
- Test state transitions

**Priority:** Implement over 2 months

---

## Low-Priority Gaps (P3)

### Gap 12: UI/Visual Testing

| Area | Current State |
|------|---------------|
| Responsive design | Manual only |
| Browser compatibility | Manual only |
| Theme/branding | Manual only |
| Accessibility | Not tested |

**Recommended Approach:**
- Consider Playwright for visual regression
- Use axe-core for accessibility

**Priority:** Quarterly review

---

### Gap 13: Performance Testing

| Metric | Current State |
|--------|---------------|
| Page load times | Not measured |
| API response times | Not measured |
| Database query performance | Not measured |
| Concurrent user load | Not tested |

**Recommended Approach:**
- Lighthouse CI for page performance
- k6 for API load testing
- pg_stat_statements for query analysis

**Priority:** Before scaling

---

## Risk Matrix

| Gap | Likelihood | Impact | Risk Score | Priority |
|-----|------------|--------|------------|----------|
| Alert Processing | Medium | Critical | **P0** | Week 1 |
| Notification Dispatch | Medium | Critical | **P0** | Week 1 |
| TTN Webhook | Low | Critical | **P0** | Week 1 |
| Unit Status | Medium | High | **P1** | Week 2 |
| RLS Policies | Low | Critical | **P1** | Week 2 |
| Device Provisioning | Medium | High | **P1** | Week 3 |
| Offline Sync | Medium | High | **P1** | Week 3 |
| Alert Cascading | Low | High | **P1** | Week 4 |
| Components | High | Medium | **P2** | Month 2 |
| Page Integration | High | Medium | **P2** | Month 2 |
| Stripe | Low | Medium | **P2** | Month 2 |
| UI/Visual | High | Low | **P3** | Quarterly |
| Performance | Low | Medium | **P3** | Pre-scale |

---

## Immediate Action Items

### Week 1

1. **Add npm test script to package.json**
   ```json
   "test": "vitest",
   "test:watch": "vitest --watch",
   "test:coverage": "vitest --coverage"
   ```

2. **Create test utilities file**
   ```typescript
   // src/test/utils.ts
   export function createMockSupabaseClient() { ... }
   export function createTestAlertRule() { ... }
   export function createTestUnit() { ... }
   ```

3. **Write first critical path tests**
   - `process-unit-states` alert logic
   - `ttn-webhook` payload parsing
   - `useUnitStatus` status computation

### Week 2-4

1. Add integration tests for database operations
2. Create RLS policy test suite
3. Document manual test procedures for gaps

---

## Testing Debt Tracking

### Definition of Done for Test Debt

A gap is "closed" when:
- [ ] Automated tests exist for happy path
- [ ] Automated tests exist for error cases
- [ ] Tests run in CI
- [ ] Coverage documented in COVERAGE_MAP.md

### Quarterly Review Checklist

- [ ] Review this document
- [ ] Update gap priorities based on incidents
- [ ] Track coverage metrics
- [ ] Plan next quarter's test debt reduction

---

## Appendix: Test Infrastructure Improvements

### Immediate Needs

1. **npm test script** — Currently missing from package.json
2. **CI integration** — Tests should run on every PR
3. **Coverage reporting** — Track progress over time

### Future Considerations

1. **Playwright for E2E** — Automate critical user journeys
2. **Visual regression** — Catch UI breakage
3. **Load testing** — Validate scaling before growth

---

## Related Documents

- [TEST_STRATEGY.md](./TEST_STRATEGY.md) — Overall testing philosophy
- [COVERAGE_MAP.md](./COVERAGE_MAP.md) — Feature-to-test mapping
- [MANUAL_TESTING.md](./MANUAL_TESTING.md) — Step-by-step manual QA checklists
- [E2E_SCENARIOS.md](./E2E_SCENARIOS.md) — Critical user flow testing
