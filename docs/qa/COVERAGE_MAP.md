# Coverage Map

> Feature-to-test mapping for FreshTrack Pro

---

## Overview

This document maps every major feature and component to its test coverage status. Use this to quickly identify what's tested and what requires manual verification.

### Legend

| Symbol | Meaning |
|--------|---------|
| :white_check_mark: | Automated tests exist |
| :large_orange_diamond: | Partial coverage |
| :red_circle: | No automated tests |
| **M** | Manual testing required |
| **U** | Unit test |
| **I** | Integration test |
| **E** | E2E test |

---

## Pages

| Page | Route | Test Status | Test Type | Notes |
|------|-------|-------------|-----------|-------|
| Landing | `/` | :red_circle: | M | Visual verification only |
| Auth | `/auth` | :red_circle: | M | Supabase Auth dependency |
| Onboarding | `/onboarding` | :red_circle: | M | Multi-step wizard |
| Dashboard | `/dashboard` | :red_circle: | M | Complex state management |
| Settings | `/settings` | :red_circle: | M | Tabs, forms, permissions |
| Unit Detail | `/units/:unitId` | :red_circle: | M | Real-time data, sensors |
| Site Detail | `/sites/:siteId` | :red_circle: | M | Hierarchy display |
| Area Detail | `/sites/:siteId/areas/:areaId` | :red_circle: | M | Unit listing |
| Alerts | `/alerts` | :red_circle: | M | Alert CRUD, acknowledgment |
| Reports | `/reports` | :red_circle: | M | Report generation |
| Manual Log | `/manual-log` | :red_circle: | M | Offline capability |
| Admin Health | `/admin/health` | :red_circle: | M | System diagnostics |
| Inspector | `/inspector` | :red_circle: | M | Debug tools |

**Coverage: 0/23 pages have automated tests**

---

## Components by Feature Area

### Settings Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| TTN Connection Settings | `TTNConnectionSettings.tsx` | :red_circle: | Critical |
| Sensor Manager | `SensorManager.tsx` | :red_circle: | Critical |
| Gateway Manager | `GatewayManager.tsx` | :red_circle: | Critical |
| Alert Rules Editor | `AlertRulesEditor.tsx` | :red_circle: | High |
| Notification Policy Editor | `NotificationPolicyEditor.tsx` | :red_circle: | High |
| Organization Settings | `OrganizationSettings.tsx` | :red_circle: | Medium |
| Escalation Contacts | `EscalationContactsManager.tsx` | :red_circle: | High |
| Branding Settings | `BrandingSettings.tsx` | :red_circle: | Low |

### Dashboard Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| Low Battery Widget | `LowBatteryWidget.tsx` | :red_circle: | Medium |
| Dashboard Layout | `DashboardLayout.tsx` | :red_circle: | Medium |
| Site Overview | `SiteOverview.tsx` | :red_circle: | Medium |
| Unit Status Card | `UnitStatusCard.tsx` | :red_circle: | High |

### Unit Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| Unit Alerts Banner | `UnitAlertsBanner.tsx` | :red_circle: | High |
| Unit Sensors Card | `UnitSensorsCard.tsx` | :red_circle: | High |
| Battery Health Card | `BatteryHealthCard.tsx` | :red_circle: | Medium |
| Temperature Graph | `TemperatureGraph.tsx` | :red_circle: | Medium |
| Unit Settings Section | `UnitSettingsSection.tsx` | :red_circle: | Medium |

### Alert Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| Alert Row | `AlertRow.tsx` | :red_circle: | High |
| Alert Detail Modal | `AlertDetailModal.tsx` | :red_circle: | High |
| Notification Dropdown | `NotificationDropdown.tsx` | :red_circle: | Medium |

### UI Components (shadcn/ui)

| Component | Test Status | Notes |
|-----------|-------------|-------|
| All 43 shadcn components | :large_orange_diamond: | Third-party, tested upstream |

---

## Hooks

| Hook | File | Test Status | Priority | Notes |
|------|------|-------------|----------|-------|
| useUnitStatus | `useUnitStatus.ts` | :red_circle: | Critical | Mirrors backend logic |
| useAlertRules | `useAlertRules.ts` | :red_circle: | Critical | CRUD operations |
| useLoraSensors | `useLoraSensors.ts` | :red_circle: | Critical | Sensor management |
| useGateways | `useGateways.ts` | :red_circle: | Critical | Gateway management |
| useNotificationPolicies | `useNotificationPolicies.ts` | :red_circle: | High | Notification config |
| useAuthAndOnboarding | `useAuthAndOnboarding.ts` | :red_circle: | High | Auth state |
| useUserRole | `useUserRole.ts` | :red_circle: | High | RBAC |
| useTTNSetupWizard | `useTTNSetupWizard.ts` | :red_circle: | High | Multi-step flow |
| useGatewayProvisioningPreflight | `useGatewayProvisioningPreflight.ts` | :red_circle: | High | TTN validation |
| useHealthCheck | `useHealthCheck.ts` | :red_circle: | Medium | System health |
| useOfflineSync | `useOfflineSync.ts` | :red_circle: | High | Offline capability |
| useBatteryForecast | `useBatteryForecast.ts` | :red_circle: | Medium | Predictions |
| useSoftDelete | `useSoftDelete.ts` | :red_circle: | Medium | Soft delete logic |
| useTTNDeprovision | `useTTNDeprovision.ts` | :red_circle: | Medium | Cleanup operations |

**Coverage: 0/26 hooks have automated tests**

---

## Library Functions (src/lib/)

### Eligibility Logic (TESTED)

| Function | File | Test Status | Tests |
|----------|------|-------------|-------|
| canProvisionGateway | `gatewayEligibility.ts` | :white_check_mark: | 9 cases |
| canEditGateway | `gatewayEligibility.ts` | :white_check_mark: | 3 cases |
| canDeleteGateway | `gatewayEligibility.ts` | :white_check_mark: | 3 cases |
| canProvisionSensor | `sensorEligibility.ts` | :white_check_mark: | 9 cases |
| canEditSensor | `sensorEligibility.ts` | :white_check_mark: | 3 cases |
| canDeleteSensor | `sensorEligibility.ts` | :white_check_mark: | 3 cases |

### Configuration (NOT TESTED)

| File | Test Status | Priority |
|------|-------------|----------|
| alertConfig.ts | :red_circle: | Medium |
| statusConfig.ts | :red_circle: | Medium |
| entityStatusConfig.ts | :red_circle: | Medium |
| validation.ts | :red_circle: | High |
| utils.ts | :red_circle: | Low |
| stripe.ts | :red_circle: | Medium |

---

## Edge Functions (supabase/functions/)

### Critical Functions

| Function | Test Status | Priority | Risk |
|----------|-------------|----------|------|
| `process-unit-states` | :red_circle: | **Critical** | Alert SSOT - untested |
| `process-escalations` | :red_circle: | **Critical** | Notification SSOT - untested |
| `ttn-webhook` | :red_circle: | **Critical** | Data ingestion - untested |
| `ingest-readings` | :red_circle: | **Critical** | Data pipeline - untested |

### TTN Management

| Function | Test Status | Priority |
|----------|-------------|----------|
| `ttn-bootstrap` | :red_circle: | High |
| `ttn-provision-device` | :red_circle: | High |
| `ttn-provision-gateway` | :red_circle: | High |
| `ttn-gateway-preflight` | :red_circle: | High |
| `ttn-list-devices` | :red_circle: | Medium |
| `ttn-deprovision-worker` | :red_circle: | Medium |

### Shared Utilities

| File | Test Status | Tests |
|------|-------------|-------|
| `ttnPermissions.ts` | :white_check_mark: | 5 cases |
| `ttnConfig.ts` | :red_circle: | - |
| `validation.ts` | :red_circle: | - |
| `response.ts` | :red_circle: | - |
| `cors.ts` | :red_circle: | - |

### Billing Functions

| Function | Test Status | Priority |
|----------|-------------|----------|
| `stripe-checkout` | :red_circle: | High |
| `stripe-portal` | :red_circle: | High |
| `stripe-webhook` | :red_circle: | High |

### Other Functions

| Function | Test Status | Priority |
|----------|-------------|----------|
| `health-check` | :red_circle: | Medium |
| `sensor-simulator` | :red_circle: | Low |
| `create-organization` | :red_circle: | Medium |
| `soft-delete-cleanup` | :red_circle: | Low |

**Coverage: 1/32 edge functions have tests (3%)**

---

## Database (Migrations & RLS)

### Tables with RLS Policies

| Table | RLS Tested | Notes |
|-------|------------|-------|
| organizations | :red_circle: | Multi-tenant isolation |
| profiles | :red_circle: | User access |
| units | :red_circle: | Org-scoped access |
| alerts | :red_circle: | Status filtering |
| sensor_readings | :red_circle: | Time-series data |
| lora_sensors | :red_circle: | Device management |
| gateways | :red_circle: | Gateway management |
| alert_rules | :red_circle: | Cascading settings |
| notification_policies | :red_circle: | Notification config |
| escalation_contacts | :red_circle: | Contact management |

**No automated RLS policy tests exist**

---

## External Integrations

| Integration | Test Status | Testing Approach |
|-------------|-------------|------------------|
| Supabase Auth | :red_circle: | Manual testing |
| Supabase Database | :red_circle: | Local instance for integration |
| The Things Network (TTN) | :red_circle: | Test TTN application |
| Stripe | :red_circle: | Test mode + webhooks |
| Telnyx (SMS) | :red_circle: | Manual testing |
| Resend (Email) | :red_circle: | Manual testing |

---

## Feature Coverage Summary

| Feature Area | Files | Tested | Coverage |
|--------------|-------|--------|----------|
| **Pages** | 23 | 0 | 0% |
| **Components** | 112 | 0 | 0% |
| **Hooks** | 26 | 0 | 0% |
| **Edge Functions** | 32 | 1 | 3% |
| **Lib/Actions** | 6 functions | 6 | 100% |
| **Lib/Config** | 6 files | 0 | 0% |

### Overall Automated Test Coverage

| Metric | Count |
|--------|-------|
| Total test files | 3 |
| Total test cases | ~35 |
| Lines of test code | 476 |
| **Estimated code coverage** | **< 5%** |

---

## Test File Inventory

### Existing Test Files

```
src/lib/actions/gatewayEligibility.test.ts   (178 lines, 15 tests)
src/lib/actions/sensorEligibility.test.ts    (193 lines, 15 tests)
supabase/functions/_shared/ttnPermissions.test.ts (105 lines, 5 tests)
```

### Testing Infrastructure

```
src/test/setup.ts                 # Jest-DOM matchers
vite.config.ts                    # Vitest configuration
package.json                      # Dependencies (vitest, testing-library)
```

---

## Priority Matrix

### Immediate Priority (Week 1-2)

| What | Why | Type |
|------|-----|------|
| `process-unit-states` | Alert SSOT, safety-critical | Unit + Integration |
| `ttn-webhook` | Data ingestion entry point | Integration |
| `useUnitStatus` | Frontend status computation | Unit |

### High Priority (Week 3-4)

| What | Why | Type |
|------|-----|------|
| `process-escalations` | Notification SSOT | Unit + Integration |
| `useAlertRules` | Alert configuration | Unit |
| `useLoraSensors` | Device management | Unit |
| Onboarding flow | Critical user journey | E2E Manual |

### Medium Priority (Month 2)

| What | Why | Type |
|------|-----|------|
| RLS policy tests | Security validation | Integration |
| Dashboard components | User-facing | Component |
| Settings components | Configuration | Component |

---

## How to Read This Map

1. **Identify the feature** you're working on
2. **Check the test status** in this document
3. **If :red_circle:**, either:
   - Write automated tests before making changes
   - Follow manual testing procedures in [MANUAL_TESTING.md](./MANUAL_TESTING.md)
4. **If :white_check_mark:**, ensure existing tests still pass
5. **Update this document** when adding new tests

---

## Related Documents

- [TEST_STRATEGY.md](./TEST_STRATEGY.md) — Overall testing philosophy
- [MANUAL_TESTING.md](./MANUAL_TESTING.md) — Step-by-step manual QA checklists
- [E2E_SCENARIOS.md](./E2E_SCENARIOS.md) — Critical user flow testing
- [KNOWN_GAPS.md](./KNOWN_GAPS.md) — Missing coverage and risks
