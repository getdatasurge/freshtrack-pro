# FreshTrack Pro User Flows

> End-to-end user journey documentation for major workflows

---

## Table of Contents

1. [Authentication Flows](#authentication-flows)
2. [Setup & Onboarding Flows](#setup-onboarding-flows)
3. [Monitoring Flows](#monitoring-flows)
4. [Alert Management Flows](#alert-management-flows)
5. [Configuration Flows](#configuration-flows)
6. [Compliance Flows](#compliance-flows)

---

## Authentication Flows

### Flow 1: New User Registration

**Name**: User Sign Up and Onboarding

**Goal**: New user creates account and sets up their organization

**Actors**:
- Primary: New User (Food Safety Manager)
- System: FreshTrack Pro, Supabase Auth

**Preconditions**:
- User has a valid email address
- User is not already registered

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to `/auth` | Displays sign up form |
| 2 | User | Enters email, password | Validates input (Zod schema) |
| 3 | System | Checks password breach | `check-password-breach` edge function |
| 4 | User | Clicks "Create Account" | Shows loading state |
| 5 | System | Creates auth user | Supabase Auth `signUp()` |
| 6 | System | Creates profile record | Database trigger |
| 7 | System | Redirects to `/onboarding` | |
| 8 | User | Enters organization name | Validates slug availability |
| 9 | User | Completes onboarding steps | Creates org, site, area, unit |
| 10 | System | Redirects to `/dashboard` | Shows empty dashboard |

**APIs and Data Touched**:
- `supabase.auth.signUp()` - Creates auth user
- `check-password-breach` - Validates password
- `check-slug-available` - Validates org slug
- `create_organization_with_owner()` RPC - Creates org
- Tables: `auth.users`, `profiles`, `organizations`, `user_roles`, `sites`, `areas`, `units`

**Failure Modes**:
| Failure | Cause | Recovery |
|---------|-------|----------|
| Email already exists | Duplicate registration | Show error, suggest sign in |
| Password too weak | Requirements not met | Show requirements, allow retry |
| Network error | Connection issue | Retry button |
| Slug taken | Org name conflict | Suggest alternative |

**Sequence Diagram**: [See SEQUENCES.md#user-registration](../diagrams/SEQUENCES.md#user-registration)

---

### Flow 2: Returning User Sign In

**Name**: User Authentication

**Goal**: Existing user signs in to access their organization

**Actors**:
- Primary: Returning User
- System: FreshTrack Pro, Supabase Auth

**Preconditions**:
- User has a registered account
- User knows their credentials

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to `/auth` | Displays sign in form |
| 2 | User | Enters email, password | |
| 3 | User | Clicks "Sign In" | Shows loading state |
| 4 | System | Validates credentials | Supabase Auth |
| 5 | System | Creates session | JWT token stored |
| 6 | System | Loads organization | Fetches user's org |
| 7 | System | Redirects to `/dashboard` | Shows dashboard |

**APIs and Data Touched**:
- `supabase.auth.signInWithPassword()` - Authenticates
- Tables: `profiles`, `user_roles`, `organizations`

**Failure Modes**:
| Failure | Cause | Recovery |
|---------|-------|----------|
| Invalid credentials | Wrong email/password | Show error, retry |
| Account disabled | Admin action | Contact support |
| Session expired | Token timeout | Re-authenticate |

**Sequence Diagram**: [See SEQUENCES.md#user-sign-in](../diagrams/SEQUENCES.md#user-sign-in)

---

## Setup & Onboarding Flows

### Flow 3: TTN Sensor Setup

**Name**: Configure TTN Connection and Add Sensors

**Goal**: IT Administrator connects TTN and provisions sensors

**Actors**:
- Primary: IT Administrator
- System: FreshTrack Pro, The Things Network

**Preconditions**:
- Organization exists
- User has admin/owner role
- TTN account exists with application

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Admin | Navigates to `/settings` → TTN tab | Displays TTN setup wizard |
| 2 | Admin | Enters TTN Application ID | Validates format |
| 3 | Admin | Enters TTN API Key | |
| 4 | System | Validates API key permissions | `ttn-gateway-preflight` |
| 5 | System | Stores encrypted credentials | Saves to `ttn_connections` |
| 6 | System | Configures TTN webhook | `ttn-bootstrap` |
| 7 | Admin | Clicks "Add Sensor" | Opens sensor dialog |
| 8 | Admin | Enters DevEUI, name, type | |
| 9 | System | Queues provisioning job | `ttn_provisioning_queue` |
| 10 | System | Provisions device in TTN | `ttn-provision-device` |
| 11 | System | Updates sensor status | Shows "active" when receiving data |

**APIs and Data Touched**:
- `ttn-gateway-preflight` - Validates TTN credentials
- `ttn-bootstrap` - Configures webhook
- `ttn-provision-device` - Registers device in TTN
- Tables: `ttn_connections`, `lora_sensors`, `ttn_provisioning_queue`, `ttn_provisioning_logs`

**Failure Modes**:
| Failure | Cause | Recovery |
|---------|-------|----------|
| Invalid API key | Wrong key or insufficient permissions | Show required permissions, retry |
| Webhook setup failed | TTN API error | Manual webhook setup instructions |
| Device already exists | DevEUI registered elsewhere | Remove from TTN console first |
| Provisioning timeout | TTN slow response | Retry via provisioning logs |

**Sequence Diagram**: [See SEQUENCES.md#ttn-setup-flow](../diagrams/SEQUENCES.md#ttn-setup-flow)

---

### Flow 4: Add New Unit

**Name**: Create Refrigeration Unit

**Goal**: User adds a new monitored refrigeration unit

**Actors**:
- Primary: Manager or Owner
- System: FreshTrack Pro

**Preconditions**:
- Organization, site, and area exist
- User has manager or owner role

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to area page | Displays area with existing units |
| 2 | User | Clicks "Add Unit" | Opens unit creation dialog |
| 3 | User | Enters unit name | |
| 4 | User | Sets temperature thresholds | High limit, low limit (optional) |
| 5 | User | Configures check-in interval | Default 5 minutes |
| 6 | User | Clicks "Create" | Shows loading |
| 7 | System | Creates unit record | `create_unit_for_area()` RPC |
| 8 | System | Creates default alert rules | Inherited from org/site |
| 9 | System | Redirects to unit page | Shows empty unit |
| 10 | User | Assigns sensor (optional) | Opens sensor assignment dialog |

**APIs and Data Touched**:
- `create_unit_for_area()` RPC
- Tables: `units`, `alert_rules`

**Sequence Diagram**: [See SEQUENCES.md#add-unit](../diagrams/SEQUENCES.md#add-unit)

---

## Monitoring Flows

### Flow 5: Temperature Reading Ingestion

**Name**: Sensor Data Processing

**Goal**: System receives and processes sensor temperature reading

**Actors**:
- System: TTN, FreshTrack Pro Edge Functions

**Preconditions**:
- Sensor is provisioned and active
- Sensor is assigned to a unit
- TTN webhook is configured

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Sensor | Transmits temperature via LoRa | |
| 2 | TTN Gateway | Receives and forwards | |
| 3 | TTN | Decodes payload | |
| 4 | TTN | Calls webhook | POST to `ttn-webhook` |
| 5 | System | Validates webhook secret | Per-org secret check |
| 6 | System | Looks up sensor by DevEUI | Scoped to org |
| 7 | System | Inserts reading | `sensor_readings` table |
| 8 | System | Updates unit state | `last_reading_at`, `last_temp_reading` |
| 9 | System | Triggers state processing | Calls `process-unit-states` |
| 10 | System | Evaluates thresholds | Checks temp limits |
| 11 | System | Creates/resolves alerts | If threshold exceeded |
| 12 | System | Triggers notifications | Calls `process-escalations` |

**APIs and Data Touched**:
- `ttn-webhook` - Receives TTN uplink
- `process-unit-states` - Evaluates state
- `process-escalations` - Sends notifications
- Tables: `sensor_readings`, `units`, `alerts`, `notification_events`

**Failure Modes**:
| Failure | Cause | Recovery |
|---------|-------|----------|
| Invalid webhook secret | Misconfigured TTN | Check TTN webhook config |
| Unknown device | Sensor not registered | Register sensor first |
| Database error | Connection issue | TTN retries automatically |

**Sequence Diagram**: [See SEQUENCES.md#temperature-reading-flow](../diagrams/SEQUENCES.md#temperature-reading-flow)

---

### Flow 6: Manual Temperature Logging

**Name**: Manual Temperature Entry

**Goal**: Staff logs temperature reading manually when sensor unavailable

**Actors**:
- Primary: Kitchen Staff
- System: FreshTrack Pro

**Preconditions**:
- User is authenticated
- User has operator role or higher
- Unit exists

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to `/manual-log` | Displays unit selector |
| 2 | User | Selects site → area → unit | Hierarchical selection |
| 3 | User | Enters temperature reading | Validates range |
| 4 | User | Adds notes (optional) | |
| 5 | User | Clicks "Log Temperature" | Shows loading |
| 6 | System | Checks connectivity | |
| 7a | Online | Saves to database | `manual_temperature_logs` |
| 7b | Offline | Saves to IndexedDB | Local queue |
| 8 | System | Shows success toast | |
| 9 | System | Clears form | Ready for next log |
| 10 | Offline→Online | Syncs queued logs | Background sync |

**APIs and Data Touched**:
- Direct insert to `manual_temperature_logs`
- `src/lib/offlineStorage.ts` for IndexedDB
- `event_logs` for audit trail

**Failure Modes**:
| Failure | Cause | Recovery |
|---------|-------|----------|
| Network offline | No connection | Queue locally, sync later |
| Invalid temperature | Out of range | Show validation error |
| Sync failure | Server error | Retry automatically |

**Sequence Diagram**: [See SEQUENCES.md#manual-logging-flow](../diagrams/SEQUENCES.md#manual-logging-flow)

---

### Flow 7: Dashboard Monitoring

**Name**: Real-time Unit Status Monitoring

**Goal**: User monitors all units from dashboard

**Actors**:
- Primary: Food Safety Manager
- System: FreshTrack Pro

**Preconditions**:
- User is authenticated
- Organization has units configured

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to `/dashboard` | Fetches all units |
| 2 | System | Displays unit cards | Shows status, temp, last reading |
| 3 | System | Applies status styling | Green/orange/red based on status |
| 4 | User | Scans for issues | Identifies warning/alarm states |
| 5 | User | Clicks unit card | Navigates to unit detail |
| 6 | System | Polls for updates | Refreshes data periodically |

**APIs and Data Touched**:
- Supabase direct queries: `units`, `alerts`, `lora_sensors`
- `useUnitStatus` hook for status computation

**Sequence Diagram**: [See SEQUENCES.md#dashboard-monitoring](../diagrams/SEQUENCES.md#dashboard-monitoring)

---

## Alert Management Flows

### Flow 8: Alert Acknowledgment

**Name**: Acknowledge Active Alert

**Goal**: User acknowledges they've seen an alert and are responding

**Actors**:
- Primary: Manager or Operator
- System: FreshTrack Pro

**Preconditions**:
- Active alert exists
- User has permission to acknowledge

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | System | Displays alert notification | Push/email/SMS |
| 2 | User | Clicks notification or navigates to alerts | Shows alert list |
| 3 | User | Clicks "Acknowledge" button | Opens acknowledge dialog |
| 4 | User | Enters notes (optional) | Describes action being taken |
| 5 | User | Confirms acknowledgment | |
| 6 | System | Updates alert record | Sets `acknowledged_at`, `acknowledged_by` |
| 7 | System | Logs event | Audit trail entry |
| 8 | System | Stops escalation timer | No further escalation |

**APIs and Data Touched**:
- Update `alerts` table
- Insert `event_logs`

**Failure Modes**:
| Failure | Cause | Recovery |
|---------|-------|----------|
| Alert already resolved | Condition cleared | Show info message |
| Permission denied | Wrong role | Show error |

**Sequence Diagram**: [See SEQUENCES.md#alert-acknowledgment](../diagrams/SEQUENCES.md#alert-acknowledgment)

---

### Flow 9: Temperature Excursion Detection

**Name**: Temperature Alert Creation and Resolution

**Goal**: System detects temperature excursion and creates alert

**Actors**:
- System: FreshTrack Pro Edge Functions

**Preconditions**:
- Unit has active sensor
- Temperature thresholds configured

**Steps**:

| Step | System | Action |
|------|--------|--------|
| 1 | `ttn-webhook` | Receives temperature reading |
| 2 | `process-unit-states` | Compares to thresholds |
| 3 | Detection | Temp > high limit OR < low limit |
| 4 | State Change | Unit status → `excursion` |
| 5 | Alert Creation | Creates `temp_excursion` alert |
| 6 | Timer Start | Begins confirm time countdown |
| 7 | Confirm Wait | If temp stays out of range for confirm time |
| 8 | Escalation | Status → `alarm_active`, severity → `critical` |
| 9 | Notification | `process-escalations` sends alerts |
| 10 | Resolution (if temp returns) | Status → `restoring` → `ok` |
| 11 | Alert Resolved | Alert status → `resolved` |

**State Transitions**:
```
ok → excursion → alarm_active → restoring → ok
                              └─────────────┘
```

**APIs and Data Touched**:
- `process-unit-states` - State evaluation
- `process-escalations` - Notifications
- Tables: `units`, `alerts`, `notification_events`, `event_logs`

**Sequence Diagram**: [See SEQUENCES.md#excursion-detection](../diagrams/SEQUENCES.md#excursion-detection)

---

### Flow 10: Alert Escalation

**Name**: Unacknowledged Alert Escalation

**Goal**: System escalates alert to additional contacts when not acknowledged

**Actors**:
- System: FreshTrack Pro Edge Functions

**Preconditions**:
- Active alert exists
- Alert not acknowledged within escalation period
- Escalation contacts configured

**Steps**:

| Step | System | Action |
|------|--------|--------|
| 1 | Alert Created | Level 1 notification sent |
| 2 | Timer | Escalation period expires |
| 3 | Check | Alert still not acknowledged |
| 4 | Level Up | Increment `escalation_level` |
| 5 | Notify | Send to level 2 contacts |
| 6 | Repeat | Continue until max level or acknowledged |

**APIs and Data Touched**:
- `process-escalations` edge function
- Tables: `alerts`, `escalation_contacts`, `notification_events`

**Sequence Diagram**: [See SEQUENCES.md#alert-escalation](../diagrams/SEQUENCES.md#alert-escalation)

---

## Configuration Flows

### Flow 11: Configure Alert Thresholds

**Name**: Modify Temperature Thresholds

**Goal**: Manager adjusts temperature limits for a unit

**Actors**:
- Primary: Manager or Owner
- System: FreshTrack Pro

**Preconditions**:
- User has manager or owner role
- Unit exists

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to unit detail | Shows unit page |
| 2 | User | Opens settings section | Displays threshold form |
| 3 | User | Modifies high/low limits | Validates input |
| 4 | User | Clicks "Save" | Shows loading |
| 5 | System | Updates unit record | `units` table |
| 6 | System | Logs change | `event_logs` and `alert_rules_history` |
| 7 | System | Shows success toast | |

**APIs and Data Touched**:
- Update `units` table
- Insert `alert_rules_history` if cascade level changed
- Insert `event_logs`

**Sequence Diagram**: [See SEQUENCES.md#configure-thresholds](../diagrams/SEQUENCES.md#configure-thresholds)

---

### Flow 12: Configure Notification Policy

**Name**: Set Up Notification Preferences

**Goal**: Configure how alerts trigger notifications

**Actors**:
- Primary: Manager or Owner
- System: FreshTrack Pro

**Preconditions**:
- User has manager or owner role
- Organization exists

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to `/settings` → Notifications | Displays policy editor |
| 2 | User | Selects alert type | Shows current policy |
| 3 | User | Toggles notification channels | Email, SMS, Push |
| 4 | User | Sets escalation timing | Minutes between escalations |
| 5 | User | Configures quiet hours (optional) | Time ranges |
| 6 | User | Clicks "Save" | Shows loading |
| 7 | System | Updates policy | `notification_policies` table |
| 8 | System | Shows success toast | |

**APIs and Data Touched**:
- Update `notification_policies` table
- `get_effective_notification_policy()` RPC for cascade

**Sequence Diagram**: [See SEQUENCES.md#configure-notifications](../diagrams/SEQUENCES.md#configure-notifications)

---

## Compliance Flows

### Flow 13: Generate Compliance Report

**Name**: Export HACCP Compliance Report

**Goal**: Generate compliance documentation for health inspection

**Actors**:
- Primary: Food Safety Manager
- System: FreshTrack Pro

**Preconditions**:
- Organization has compliance mode set
- Temperature data exists for period

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Navigates to `/reports` | Displays report options |
| 2 | User | Selects report type | Compliance summary |
| 3 | User | Sets date range | Start and end dates |
| 4 | User | Selects units/sites | Filter scope |
| 5 | User | Clicks "Generate" | Shows loading |
| 6 | System | Aggregates data | Queries readings, alerts |
| 7 | System | Displays preview | Shows report content |
| 8 | User | Clicks "Export PDF" | Triggers download |
| 9 | System | Generates PDF | `export-temperature-logs` function |

**APIs and Data Touched**:
- `export-temperature-logs` edge function
- Tables: `sensor_readings`, `manual_temperature_logs`, `alerts`, `corrective_actions`

**Sequence Diagram**: [See SEQUENCES.md#generate-report](../diagrams/SEQUENCES.md#generate-report)

---

### Flow 14: Document Corrective Action

**Name**: Record Corrective Action for Excursion

**Goal**: Document steps taken to address temperature violation

**Actors**:
- Primary: Manager or Operator
- System: FreshTrack Pro

**Preconditions**:
- Temperature excursion occurred
- Alert exists (active or resolved)

**Steps**:

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | User | Views alert detail | Shows alert info |
| 2 | User | Clicks "Add Corrective Action" | Opens form |
| 3 | User | Describes root cause | Text input |
| 4 | User | Describes action taken | Required field |
| 5 | User | Describes preventive measures | Optional |
| 6 | User | Uploads photos (optional) | File upload |
| 7 | User | Clicks "Save" | Shows loading |
| 8 | System | Creates record | `corrective_actions` table |
| 9 | System | Links to alert | `alert_id` foreign key |
| 10 | System | Logs event | Audit trail |

**APIs and Data Touched**:
- Insert `corrective_actions` table
- Insert `event_logs`

**Sequence Diagram**: [See SEQUENCES.md#corrective-action](../diagrams/SEQUENCES.md#corrective-action)

---

## Flow Diagrams Reference

All sequence diagrams are located in [SEQUENCES.md](../diagrams/SEQUENCES.md).

| Flow | Diagram Section |
|------|-----------------|
| User Registration | [#user-registration](../diagrams/SEQUENCES.md#user-registration) |
| User Sign In | [#user-sign-in](../diagrams/SEQUENCES.md#user-sign-in) |
| TTN Setup | [#ttn-setup-flow](../diagrams/SEQUENCES.md#ttn-setup-flow) |
| Temperature Reading | [#temperature-reading-flow](../diagrams/SEQUENCES.md#temperature-reading-flow) |
| Manual Logging | [#manual-logging-flow](../diagrams/SEQUENCES.md#manual-logging-flow) |
| Alert Acknowledgment | [#alert-acknowledgment](../diagrams/SEQUENCES.md#alert-acknowledgment) |
| Excursion Detection | [#excursion-detection](../diagrams/SEQUENCES.md#excursion-detection) |
| Alert Escalation | [#alert-escalation](../diagrams/SEQUENCES.md#alert-escalation) |
