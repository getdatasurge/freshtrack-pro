# State Machines

> State machine diagrams for units, alerts, sensors, and application states

---

## Table of Contents

1. [Unit Status](#unit-status)
2. [Alert Status](#alert-status)
3. [Sensor Status](#sensor-status)
4. [Gateway Status](#gateway-status)
5. [Provisioning Job Status](#provisioning-job-status)
6. [Page States](#page-states)

---

## Unit Status

**Source**: `src/lib/statusConfig.ts`, `supabase/functions/process-unit-states/index.ts`

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> ok: Initial state

    ok --> excursion: Temp out of range
    ok --> offline: Missed check-ins (1-4)
    ok --> monitoring_interrupted: Missed check-ins (5+)

    excursion --> alarm_active: Confirm time exceeded
    excursion --> restoring: Temp returns to range
    excursion --> ok: Temp in range + hysteresis

    alarm_active --> restoring: Temp returns to range

    restoring --> ok: 2 consecutive good readings
    restoring --> excursion: Temp out of range again

    offline --> ok: Data received
    offline --> monitoring_interrupted: Critical threshold

    monitoring_interrupted --> manual_required: Manual log overdue
    monitoring_interrupted --> restoring: Data received

    manual_required --> restoring: Manual log or sensor data
    manual_required --> monitoring_interrupted: Manual log received

    note right of excursion: Unconfirmed temp violation
    note right of alarm_active: Confirmed critical alert
    note right of restoring: Recovering from issue
```

### State Descriptions

| Status | Description | Priority | Color |
|--------|-------------|----------|-------|
| `ok` | Normal operation | 5 | Green |
| `excursion` | Temp out of range (unconfirmed) | 2 | Orange-red |
| `alarm_active` | Confirmed temp alarm | 1 (highest) | Red |
| `restoring` | Recovering from issue | 4 | Blue |
| `offline` | Warning-level offline (1-4 missed) | 6 | Gray |
| `monitoring_interrupted` | Critical offline (5+ missed) | 3 | Gray |
| `manual_required` | Manual logging needed | 4 | Orange |

### Transitions

| From | To | Trigger |
|------|----|---------|
| `ok` → `excursion` | Temperature exceeds threshold |
| `excursion` → `alarm_active` | Confirm time (10-20 min) passed |
| `alarm_active` → `restoring` | Temperature returns to safe range |
| `restoring` → `ok` | 2 consecutive in-range readings |
| `ok` → `offline` | 1-4 missed check-ins |
| `offline` → `monitoring_interrupted` | 5+ missed check-ins |
| `monitoring_interrupted` → `manual_required` | 4+ hours since last reading |
| `*` → `restoring` | Sensor data received |

---

## Alert Status

**Source**: `src/integrations/supabase/types.ts` (alert_status enum)

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> triggered: Alert created

    triggered --> acknowledged: User acknowledges
    triggered --> resolved: Condition clears (auto)

    acknowledged --> resolved: Condition clears (auto)
    acknowledged --> resolved: User resolves

    resolved --> [*]

    note right of triggered: Active, needs attention
    note right of acknowledged: Seen, being handled
    note right of resolved: Closed
```

### State Descriptions

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| `triggered` | Active alert, not yet acknowledged | Acknowledge, Resolve |
| `acknowledged` | User has seen and is handling | Resolve |
| `resolved` | Alert closed (auto or manual) | None (archived) |

### Escalation Behavior

```mermaid
stateDiagram-v2
    state triggered {
        [*] --> level1: Alert created
        level1 --> level2: Escalation timeout
        level2 --> level3: Escalation timeout
        level3 --> level3: Max level
    }

    triggered --> acknowledged: Any level

    note right of level1: Initial notification
    note right of level2: Second tier contacts
    note right of level3: Final escalation
```

---

## Sensor Status

**Source**: `src/integrations/supabase/types.ts` (lora_sensor_status enum)

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> pending: Sensor registered

    pending --> joining: TTN provisioning started
    pending --> fault: Provisioning failed

    joining --> active: First uplink received
    joining --> fault: Join timeout
    joining --> pending: Retry provisioning

    active --> offline: No data for threshold
    active --> fault: Sensor error

    offline --> active: Data received
    offline --> fault: Extended offline

    fault --> pending: Reset/retry

    note right of pending: Registered, not provisioned
    note right of joining: Waiting for TTN join
    note right of active: Receiving data
    note right of offline: No recent data
    note right of fault: Error state
```

### State Descriptions

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `pending` | Registered in FreshTrack, not in TTN | Provision |
| `joining` | Provisioned in TTN, waiting for join | Wait for uplink |
| `active` | Receiving data normally | Monitor |
| `offline` | No recent data | Investigate |
| `fault` | Error condition | Troubleshoot |

---

## Gateway Status

**Source**: `src/integrations/supabase/types.ts` (gateway_status enum)

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> pending: Gateway registered

    pending --> online: First connection
    pending --> offline: Connection failed

    online --> offline: Connection lost
    online --> maintenance: Maintenance mode

    offline --> online: Connection restored
    offline --> maintenance: Manual maintenance

    maintenance --> online: Maintenance complete
    maintenance --> offline: Maintenance failed

    note right of pending: Awaiting connection
    note right of online: Operational
    note right of offline: Not connected
    note right of maintenance: Intentionally offline
```

---

## Provisioning Job Status

**Source**: `ttn_provisioning_queue` table

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> pending: Job created

    pending --> processing: Worker picks up

    processing --> complete: TTN API success
    processing --> failed: TTN API error
    processing --> pending: Retry (if attempts < max)

    failed --> pending: Manual retry

    complete --> [*]

    note right of pending: Queued for processing
    note right of processing: Worker handling
    note right of complete: Successfully provisioned
    note right of failed: Max retries exceeded
```

---

## Page States

### Generic Page State Machine

```mermaid
stateDiagram-v2
    [*] --> loading: Navigate to page

    loading --> ready: Data loaded
    loading --> error: Load failed
    loading --> empty: No data

    ready --> refreshing: Stale data
    refreshing --> ready: Fresh data

    ready --> editing: User action
    editing --> saving: Submit
    saving --> ready: Success
    saving --> editing: Validation error

    error --> loading: Retry

    empty --> ready: Data added
```

### Dashboard Specific

```mermaid
stateDiagram-v2
    [*] --> loading

    loading --> ready: Units loaded
    loading --> noOrg: No organization
    loading --> error: Load failed

    noOrg --> [*]: Redirect to onboarding

    state ready {
        [*] --> monitoring
        monitoring --> alertVisible: Active alerts
        alertVisible --> monitoring: All resolved
    }

    ready --> unitDetail: Click unit
```

### Settings Specific

```mermaid
stateDiagram-v2
    [*] --> loading

    loading --> generalTab: Default tab

    state "Tab States" as tabs {
        generalTab --> alertRulesTab: Switch
        alertRulesTab --> notificationTab: Switch
        notificationTab --> sensorsTab: Switch
        sensorsTab --> gatewaysTab: Switch
        gatewaysTab --> ttnTab: Switch
        ttnTab --> billingTab: Switch
        billingTab --> accountTab: Switch
    }

    state "Edit Mode" as edit {
        viewing --> editing: Modify
        editing --> saving: Submit
        saving --> viewing: Success
        saving --> editing: Error
    }
```

### Manual Log Specific

```mermaid
stateDiagram-v2
    [*] --> selectUnit

    selectUnit --> enterTemp: Unit selected
    enterTemp --> selectUnit: Change unit

    enterTemp --> validating: Submit
    validating --> submitting: Valid
    validating --> enterTemp: Invalid

    state submitting {
        [*] --> checkConnection
        checkConnection --> online: Connected
        checkConnection --> offline: Disconnected

        online --> success: DB insert ok
        online --> error: DB error

        offline --> queued: IndexedDB save
    }

    success --> selectUnit: Clear form
    queued --> selectUnit: Clear form
    error --> enterTemp: Show error

    state "Background Sync" as sync {
        queued --> syncing: Connection restored
        syncing --> synced: All uploaded
    }
```

---

## Related Documentation

- [PAGE_DIAGRAMS.md](./PAGE_DIAGRAMS.md) - Page component diagrams
- [SEQUENCES.md](./SEQUENCES.md) - Sequence diagrams
- [PAGES.md](../product/PAGES.md) - Page documentation
- [API.md](../engineering/API.md) - Alert processing details
