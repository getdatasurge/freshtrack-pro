# FreshTrack Pro Pages Documentation

> Comprehensive documentation for all routes, pages, and UI components

---

## Table of Contents

1. [Route Overview](#route-overview)
2. [Public Pages](#public-pages)
3. [Authentication Pages](#authentication-pages)
4. [Core Application Pages](#core-application-pages)
5. [Admin Pages](#admin-pages)
6. [Utility Pages](#utility-pages)

---

## Route Overview

| Route | Page Component | Purpose | Auth Required |
|-------|----------------|---------|---------------|
| `/` | `Index.tsx` | Landing page | No |
| `/auth` | `Auth.tsx` | Sign in/Sign up | No |
| `/auth/callback` | `AuthCallback.tsx` | OAuth callback | No |
| `/dashboard` | `Dashboard.tsx` | Main monitoring view | Yes |
| `/organization` | `OrganizationDashboard.tsx` | Organization overview | Yes |
| `/onboarding` | `Onboarding.tsx` | Initial setup flow | Yes |
| `/sites` | `Sites.tsx` | Site listing | Yes |
| `/sites/:siteId` | `SiteDetail.tsx` | Site details | Yes |
| `/sites/:siteId/areas/:areaId` | `AreaDetail.tsx` | Area details | Yes |
| `/units/:unitId` | `UnitDetail.tsx` | Unit monitoring | Yes |
| `/manual-log` | `ManualLog.tsx` | Manual temperature entry | Yes |
| `/alerts` | `Alerts.tsx` | Alert management | Yes |
| `/reports` | `Reports.tsx` | Compliance reports | Yes |
| `/settings` | `Settings.tsx` | Multi-tab settings | Yes |
| `/inspector` | `Inspector.tsx` | Debug inspection | Yes |
| `/pilot-setup` | `PilotSetup.tsx` | Pilot program setup | Yes |
| `/events` | `EventHistory.tsx` | Audit event log | Yes |
| `/admin/recently-deleted` | `RecentlyDeleted.tsx` | Soft-deleted items | Yes |
| `/admin/ttn-cleanup` | `TTNCleanup.tsx` | TTN management | Yes |
| `/admin/data-maintenance` | `DataMaintenance.tsx` | Database maintenance | Yes |
| `/admin/health` | `HealthDashboard.tsx` | System health | Yes |
| `/account-deleted` | `AccountDeleted.tsx` | Deletion confirmation | No |
| `*` | `NotFound.tsx` | 404 handler | No |

---

## Public Pages

### Landing Page (`/`)

**File**: `src/pages/Index.tsx`

**Purpose**: Marketing landing page for unauthenticated users, redirects authenticated users to dashboard.

**Layout**:
- Hero section with value proposition
- Feature highlights
- Pricing information
- Call-to-action buttons

**State Machine**:
```
[Loading] → (check auth)
   ├─ authenticated → [Redirect to /dashboard]
   └─ unauthenticated → [Render Landing]
```

**API Calls**:
- `supabase.auth.getSession()` - Check authentication status

**Diagram Reference**: [Landing Page Diagram](../diagrams/PAGE_DIAGRAMS.md#landing-page)

---

## Authentication Pages

### Auth Page (`/auth`)

**File**: `src/pages/Auth.tsx`

**Purpose**: User authentication (sign in and sign up).

**Layout**:
- Tabbed interface: Sign In / Sign Up
- Email/password form
- Social auth options (if configured)
- Password requirements display

**Preconditions**: User is not authenticated

**State Machine**:
```
[Idle] → (submit form)
   → [Submitting] → (success)
      ├─ sign in → [Redirect to /dashboard]
      └─ sign up → [Redirect to /onboarding]
   → [Error] → (retry) → [Idle]
```

**Data Dependencies**:
- None (creates new session)

**API Calls**:
- `supabase.auth.signInWithPassword()` - Sign in
- `supabase.auth.signUp()` - Sign up
- `supabase.functions.invoke('check-password-breach')` - Password validation

**Error States**:
- Invalid credentials
- Email already registered
- Password requirements not met
- Network error

**Files Involved**:
- `src/pages/Auth.tsx`
- `src/hooks/useAuthAndOnboarding.ts`
- `src/lib/validation.ts`

**Diagram Reference**: [Auth Page Diagram](../diagrams/PAGE_DIAGRAMS.md#auth-page)

---

### Auth Callback (`/auth/callback`)

**File**: `src/pages/AuthCallback.tsx`

**Purpose**: Handle OAuth callback and magic link authentication.

**State Machine**:
```
[Processing] → (validate token)
   ├─ valid → [Redirect to /dashboard or /onboarding]
   └─ invalid → [Redirect to /auth with error]
```

---

## Core Application Pages

### Dashboard (`/dashboard`)

**File**: `src/pages/Dashboard.tsx`

**Purpose**: Main monitoring view showing all units across all sites with their status.

**Layout**:
| Section | Content |
|---------|---------|
| Header | Organization name, notification dropdown, theme toggle |
| Sidebar | Navigation links (Sites, Alerts, Reports, Settings) |
| Main | Unit cards grouped by site/area |
| Widgets | Low battery alerts, offline sensors |

**Preconditions**:
- User authenticated
- User belongs to an organization
- Organization has completed onboarding

**State Machine**:
```
[Loading] → (fetch data)
   ├─ success → [Ready]
   ├─ no org → [Redirect to /onboarding]
   └─ error → [Error State]

[Ready] → (unit status changes) → [Ready]
       → (refresh) → [Loading]
```

**Data Dependencies**:
| Data | Source | Query Key |
|------|--------|-----------|
| Organization | `organizations` | `['organization', orgId]` |
| Sites | `sites` | `['sites', { organizationId }]` |
| Areas | `areas` | `['areas', { siteId }]` |
| Units | `units` | `['units', { organizationId }]` |
| Active Alerts | `alerts` | `['alerts', { status: 'active' }]` |
| Sensors | `lora_sensors` | `['lora-sensors', { organizationId }]` |

**API Calls**:
- Supabase direct queries via TanStack Query
- Real-time subscriptions for unit status updates

**Actions**:
| Action | Description | Side Effects |
|--------|-------------|--------------|
| Navigate to unit | Click unit card | Route to `/units/:unitId` |
| Quick log temp | "Log Temp" button | Opens `LogTempModal` |
| Acknowledge alert | Click acknowledge | Updates alert status |

**Error States**:
- Failed to load organization
- Failed to load units
- No units configured

**Recovery**:
- Retry button for failed queries
- Link to Settings for configuration

**Files Involved**:
- `src/pages/Dashboard.tsx`
- `src/components/DashboardLayout.tsx`
- `src/components/dashboard/LowBatteryWidget.tsx`
- `src/hooks/useUnitStatus.ts`

**Diagram Reference**: [Dashboard Diagram](../diagrams/PAGE_DIAGRAMS.md#dashboard)

---

### Organization Dashboard (`/organization`)

**File**: `src/pages/OrganizationDashboard.tsx`

**Purpose**: High-level organization overview with aggregated statistics.

**Layout**:
- Organization header with branding
- Summary statistics (total units, active alerts, compliance score)
- Site overview cards
- Quick actions

**Data Dependencies**:
- Organization details
- Site summaries
- Alert counts
- Compliance metrics

**Diagram Reference**: [Organization Dashboard Diagram](../diagrams/PAGE_DIAGRAMS.md#organization-dashboard)

---

### Onboarding (`/onboarding`)

**File**: `src/pages/Onboarding.tsx`

**Purpose**: Guide new users through initial organization setup.

**Layout**:
- Step-by-step wizard
- Progress indicator
- Form sections for each step

**Steps**:
1. Organization details (name, slug)
2. First site creation
3. First area creation
4. First unit creation
5. Sensor setup (optional)

**State Machine**:
```
[Step 1: Org] → (submit) → [Step 2: Site]
                         → [Step 3: Area]
                         → [Step 4: Unit]
                         → [Step 5: Sensor]
                         → [Complete] → [Redirect to /dashboard]
```

**API Calls**:
- `create_organization_with_owner()` RPC
- `create_site_for_org()` RPC
- `create_area_for_site()` RPC
- `create_unit_for_area()` RPC

**Diagram Reference**: [Onboarding Diagram](../diagrams/PAGE_DIAGRAMS.md#onboarding)

---

### Sites List (`/sites`)

**File**: `src/pages/Sites.tsx`

**Purpose**: List all sites in the organization.

**Layout**:
- Site cards with address and status summary
- Add site button
- Filter/search options

**Data Dependencies**:
- `sites` table
- Unit counts per site
- Alert counts per site

**Actions**:
- Navigate to site detail
- Create new site
- Edit site

**Diagram Reference**: [Sites Page Diagram](../diagrams/PAGE_DIAGRAMS.md#sites)

---

### Site Detail (`/sites/:siteId`)

**File**: `src/pages/SiteDetail.tsx`

**Purpose**: Detailed view of a single site with its areas and units.

**URL Parameters**: `siteId` (UUID)

**Layout**:
| Section | Content |
|---------|---------|
| Header | Site name, address, breadcrumb |
| Areas List | Collapsible area sections |
| Units Grid | Unit cards within each area |
| Gateways | Site gateway status |
| Settings | Site-level configuration |

**Data Dependencies**:
- Site details
- Areas within site
- Units within areas
- Gateway status

**Actions**:
- Add area
- Add unit
- Configure site settings
- Manage gateways

**Files Involved**:
- `src/pages/SiteDetail.tsx`
- `src/components/site/SiteComplianceSettings.tsx`
- `src/components/site/SiteGatewaysCard.tsx`

**Diagram Reference**: [Site Detail Diagram](../diagrams/PAGE_DIAGRAMS.md#site-detail)

---

### Area Detail (`/sites/:siteId/areas/:areaId`)

**File**: `src/pages/AreaDetail.tsx`

**Purpose**: Detailed view of a single area with its units.

**URL Parameters**: `siteId`, `areaId` (UUIDs)

**Layout**:
- Breadcrumb navigation
- Unit cards
- Area settings
- Add unit button

**Data Dependencies**:
- Area details
- Units in area
- Site (for breadcrumb)

**Diagram Reference**: [Area Detail Diagram](../diagrams/PAGE_DIAGRAMS.md#area-detail)

---

### Unit Detail (`/units/:unitId`)

**File**: `src/pages/UnitDetail.tsx`

**Purpose**: Comprehensive view of a refrigeration unit with temperature history, alerts, and settings.

**URL Parameters**: `unitId` (UUID)

**Layout**:
| Section | Component |
|---------|-----------|
| Header | Unit name, status badge, breadcrumb |
| Current Status | Temperature, last reading time, status indicator |
| Alert Banner | Active alerts with acknowledge/resolve actions |
| Temperature Chart | Historical temperature graph |
| Sensors | Assigned sensors with battery/signal status |
| Settings | Temperature thresholds, manual log settings |
| History | Recent readings and events |

**Preconditions**:
- Unit exists and is accessible to user

**State Machine**:
```
[Loading] → (fetch)
   ├─ success → [Ready]
   │     ├─ has alerts → [Show Alert Banner]
   │     ├─ temp in range → [Normal Display]
   │     └─ temp out of range → [Warning Display]
   └─ not found → [404]

[Ready] → (new reading) → [Update Display]
       → (alert change) → [Update Banner]
       → (settings change) → [Refresh]
```

**Data Dependencies**:
| Data | Source | Query Key |
|------|--------|-----------|
| Unit | `units` | `['units', unitId]` |
| Sensors | `lora_sensors` | `['lora-sensors', { unitId }]` |
| Readings | `sensor_readings` | `['sensor-readings', { unitId }]` |
| Alerts | `alerts` | `['alerts', { unitId }]` |
| Alert Rules | `alert_rules` RPC | `['alert-rules', { unitId }]` |

**API Calls**:
- `get_effective_alert_rules()` RPC
- Direct table queries via Supabase

**Actions**:
| Action | Component | Side Effects |
|--------|-----------|--------------|
| Log temperature | `LogTempModal` | Insert to `manual_temperature_logs` |
| Acknowledge alert | `UnitAlertsBanner` | Update `alerts.acknowledged_at` |
| Change thresholds | `UnitSettingsSection` | Update `units` |
| Assign sensor | `AssignSensorToUnitDialog` | Update `lora_sensors.unit_id` |

**Error States**:
- Unit not found (404)
- Failed to load readings
- Failed to load alerts

**Files Involved**:
- `src/pages/UnitDetail.tsx`
- `src/components/unit/UnitAlertsBanner.tsx`
- `src/components/unit/UnitSensorsCard.tsx`
- `src/components/unit/BatteryHealthCard.tsx`
- `src/components/unit/DeviceReadinessCard.tsx`
- `src/components/unit/LastKnownGoodCard.tsx`
- `src/components/unit/UnitAlertThresholdsSection.tsx`
- `src/components/unit/UnitSettingsSection.tsx`
- `src/components/unit/AssignSensorToUnitDialog.tsx`
- `src/hooks/useUnitStatus.ts`
- `src/hooks/useUnitAlerts.ts`

**Diagram Reference**: [Unit Detail Diagram](../diagrams/PAGE_DIAGRAMS.md#unit-detail)

---

### Manual Log (`/manual-log`)

**File**: `src/pages/ManualLog.tsx`

**Purpose**: Quick manual temperature logging interface with offline support.

**Layout**:
- Unit selector (hierarchical: Site → Area → Unit)
- Temperature input
- Notes field
- Submit button
- Offline indicator

**Preconditions**:
- User authenticated
- At least one unit exists

**State Machine**:
```
[Select Unit] → (unit selected) → [Enter Temperature]
                                → (submit) → [Submitting]
   ┌─ online ─┬─ success → [Success Toast] → [Select Unit]
   │          └─ error → [Error Toast] → [Enter Temperature]
   └─ offline → [Queue Locally] → [Success Toast] → [Select Unit]

[Offline Queue] → (online) → [Sync] → [Queue Empty]
```

**Data Dependencies**:
- Sites, areas, units (for selector)
- Offline queue (IndexedDB)

**API Calls**:
- Insert to `manual_temperature_logs`
- `src/lib/offlineStorage.ts` for offline queue

**Offline Behavior**:
- Logs stored in IndexedDB
- Automatic sync when connection restored
- Pending count indicator

**Files Involved**:
- `src/pages/ManualLog.tsx`
- `src/components/LogTempModal.tsx`
- `src/lib/offlineStorage.ts`
- `src/hooks/useOfflineSync.ts`

**Diagram Reference**: [Manual Log Diagram](../diagrams/PAGE_DIAGRAMS.md#manual-log)

---

### Alerts (`/alerts`)

**File**: `src/pages/Alerts.tsx`

**Purpose**: Centralized alert management with filtering and bulk actions.

**Layout**:
| Section | Content |
|---------|---------|
| Filters | Status, severity, type, date range |
| Alert List | Sortable table with alert details |
| Detail Panel | Selected alert details |

**State Machine**:
```
[Loading] → (fetch) → [Ready]

[Ready] → (filter change) → [Filtering] → [Ready]
       → (select alert) → [Detail View]
       → (acknowledge) → [Updating] → [Ready]
       → (resolve) → [Updating] → [Ready]
```

**Data Dependencies**:
- `alerts` table with filters
- Related units, sites, areas

**Actions**:
| Action | Description |
|--------|-------------|
| Filter by status | Show active/acknowledged/resolved |
| Filter by severity | Show warning/critical |
| Acknowledge | Mark alert as seen |
| Resolve | Close alert |
| View unit | Navigate to unit detail |

**Files Involved**:
- `src/pages/Alerts.tsx`
- `src/components/alerts/AlertRow.tsx`
- `src/lib/alertConfig.ts`

**Diagram Reference**: [Alerts Page Diagram](../diagrams/PAGE_DIAGRAMS.md#alerts)

---

### Reports (`/reports`)

**File**: `src/pages/Reports.tsx`

**Purpose**: Generate and export compliance reports.

**Layout**:
- Report type selector
- Date range picker
- Unit/site filter
- Generate button
- Report preview
- Export options (PDF, CSV)

**Report Types**:
| Report | Description |
|--------|-------------|
| Temperature Log | All readings for period |
| Excursion Report | All temperature excursions |
| Compliance Summary | HACCP compliance metrics |
| Corrective Actions | Actions taken for violations |

**Data Dependencies**:
- `sensor_readings`
- `manual_temperature_logs`
- `alerts`
- `corrective_actions`

**API Calls**:
- `export-temperature-logs` edge function

**Files Involved**:
- `src/pages/Reports.tsx`
- `src/components/reports/ComplianceReportCard.tsx`

**Diagram Reference**: [Reports Page Diagram](../diagrams/PAGE_DIAGRAMS.md#reports)

---

### Settings (`/settings`)

**File**: `src/pages/Settings.tsx`

**Purpose**: Multi-tab settings interface for organization configuration.

**Layout**: Tabbed interface with the following tabs:

#### General Tab
- Organization name and branding
- Timezone settings
- Compliance mode selection

#### Alert Rules Tab
- Default temperature thresholds
- Offline detection settings
- Manual log requirements

**Component**: `AlertRulesEditor.tsx`, `AlertRulesScopedEditor.tsx`

#### Notification Policies Tab
- Per-alert-type notification configuration
- Escalation timing settings
- Quiet hours

**Component**: `NotificationPolicyEditor.tsx`, `AlertTypePolicyCard.tsx`

#### Sensors Tab
- LoRa sensor inventory
- Add/edit/remove sensors
- Provisioning status

**Component**: `SensorManager.tsx`, `AddSensorDialog.tsx`, `EditSensorDialog.tsx`

#### Gateways Tab
- LoRa gateway inventory
- Add/edit/remove gateways
- Connection status

**Component**: `GatewayManager.tsx`, `AddGatewayDialog.tsx`, `EditGatewayDialog.tsx`

#### TTN Connection Tab
- TTN credentials
- Webhook configuration
- Provisioning logs

**Component**: `TTNConnectionSettings.tsx`, `TTNCredentialsPanel.tsx`, `TTNProvisioningLogs.tsx`

#### Billing Tab
- Current plan
- Usage metrics
- Invoice history
- Upgrade/downgrade

**Component**: `BillingTab.tsx`, `PlanCard.tsx`, `InvoiceHistory.tsx`

#### Account Tab
- User profile
- Password change
- Account deletion

**State Machine**:
```
[Loading] → (fetch settings) → [Ready]

[Ready] → (change setting) → [Saving] → [Ready]
       → (error) → [Error Toast] → [Ready]
       → (switch tab) → [Ready]
```

**Files Involved**:
- `src/pages/Settings.tsx`
- `src/components/settings/*.tsx` (20+ components)
- `src/hooks/useAlertRules.ts`
- `src/hooks/useNotificationPolicies.ts`
- `src/hooks/useLoraSensors.ts`
- `src/hooks/useGateways.ts`

**Diagram Reference**: [Settings Page Diagram](../diagrams/PAGE_DIAGRAMS.md#settings)

---

### Event History (`/events`)

**File**: `src/pages/EventHistory.tsx`

**Purpose**: Audit trail viewer for all system events.

**Layout**:
- Filterable event list
- Event type icons
- Timestamp display
- Event details expandable

**Data Dependencies**:
- `event_logs` table

**Filters**:
- Event type (alert, temperature, configuration, user)
- Severity (info, warning, error)
- Date range
- Actor (user, system)

**Diagram Reference**: [Event History Diagram](../diagrams/PAGE_DIAGRAMS.md#event-history)

---

## Admin Pages

### Health Dashboard (`/admin/health`)

**File**: `src/pages/HealthDashboard.tsx`

**Purpose**: System health monitoring and diagnostics.

**Layout**:
| Section | Content |
|---------|---------|
| Overall Status | Aggregate health indicator |
| Edge Functions | Per-function health checks |
| Database | Connection status |
| TTN | Webhook status |

**Components**:
- `HealthCheckList.tsx`
- `HealthStatusBadge.tsx`
- `HealthStatusCard.tsx`
- `OverallHealthSummary.tsx`

**API Calls**:
- `health-check` edge function
- Database connectivity check

**Diagram Reference**: [Health Dashboard Diagram](../diagrams/PAGE_DIAGRAMS.md#health-dashboard)

---

### TTN Cleanup (`/admin/ttn-cleanup`)

**File**: `src/pages/TTNCleanup.tsx`

**Purpose**: Manage TTN device cleanup and deprovisioning.

**Actions**:
- View pending cleanup jobs
- Trigger manual cleanup
- View cleanup history

---

### Data Maintenance (`/admin/data-maintenance`)

**File**: `src/pages/DataMaintenance.tsx`

**Purpose**: Database maintenance operations.

**Actions**:
- Find orphan organizations
- Cleanup old data
- Repair data integrity

---

### Recently Deleted (`/admin/recently-deleted`)

**File**: `src/pages/RecentlyDeleted.tsx`

**Purpose**: View and restore soft-deleted items.

**Layout**:
- List of deleted items by type
- Restore button
- Permanent delete option

---

### Inspector (`/inspector`)

**File**: `src/pages/Inspector.tsx`

**Purpose**: Debug tool for examining organization data.

**Features**:
- View raw database records
- Examine sensor states
- Check TTN configuration
- Debug alerts

---

### Pilot Setup (`/pilot-setup`)

**File**: `src/pages/PilotSetup.tsx`

**Purpose**: Configuration interface for pilot program participants.

---

## Utility Pages

### Account Deleted (`/account-deleted`)

**File**: `src/pages/AccountDeleted.tsx`

**Purpose**: Confirmation page shown after account deletion.

**Layout**:
- Confirmation message
- Link to sign up again

---

### Not Found (`*`)

**File**: `src/pages/NotFound.tsx`

**Purpose**: 404 error page for unknown routes.

**Layout**:
- Error message
- Link to dashboard/home

---

## Page Diagrams Reference

All page-specific diagrams are located in [PAGE_DIAGRAMS.md](../diagrams/PAGE_DIAGRAMS.md).

| Page | Diagram Section |
|------|-----------------|
| Dashboard | [#dashboard](../diagrams/PAGE_DIAGRAMS.md#dashboard) |
| Unit Detail | [#unit-detail](../diagrams/PAGE_DIAGRAMS.md#unit-detail) |
| Alerts | [#alerts](../diagrams/PAGE_DIAGRAMS.md#alerts) |
| Settings | [#settings](../diagrams/PAGE_DIAGRAMS.md#settings) |
| Manual Log | [#manual-log](../diagrams/PAGE_DIAGRAMS.md#manual-log) |
| Reports | [#reports](../diagrams/PAGE_DIAGRAMS.md#reports) |
| Auth | [#auth-page](../diagrams/PAGE_DIAGRAMS.md#auth-page) |
