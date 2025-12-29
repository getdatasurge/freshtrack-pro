# FrostGuard System Map

> Internal architecture documentation for backend organization and data flow.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SENSOR DATA INGESTION                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
    ┌───────────────────────────────────┼───────────────────────────────────┐
    │                                   │                                   │
    ▼                                   ▼                                   ▼
┌─────────────┐                 ┌─────────────────┐               ┌─────────────────┐
│   Sensors   │                 │    Simulator    │               │   Manual Logs   │
│ (Hardware)  │                 │ (Dev/Testing)   │               │   (UI Entry)    │
└─────────────┘                 └─────────────────┘               └─────────────────┘
    │                                   │                                   │
    ▼                                   ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ingest-readings (Edge Function)                              │
│  - Validates payload                                                            │
│  - Inserts sensor_readings                                                      │
│  - Updates units.last_reading_at, last_temp_reading                            │
│  - Triggers process-unit-states                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    process-unit-states (Edge Function)                          │
│  SINGLE SOURCE OF TRUTH FOR:                                                    │
│  - Offline detection (data gap threshold calculation)                           │
│  - Manual log requirement detection                                             │
│  - Temperature excursion detection                                              │
│  - Door open alerts                                                             │
│  - Suspected cooling failure detection                                          │
│                                                                                 │
│  - Creates/resolves alerts in DB                                                │
│  - Updates unit.status                                                          │
│  - Logs events to event_logs                                                    │
│  - Triggers process-escalations for new alerts                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    process-escalations (Edge Function)                          │
│  SINGLE SOURCE OF TRUTH FOR:                                                    │
│  - Notification dispatch (email, SMS, push)                                     │
│  - Escalation policy enforcement                                                │
│  - Quiet hours handling                                                         │
│                                                                                 │
│  - Uses get_effective_notification_policy() RPC                                 │
│  - Creates notification_events records                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UI / DASHBOARD                                      │
│  - computeUnitStatus() - Frontend status computation                            │
│  - computeUnitAlerts() - Frontend alert aggregation                             │
│  - Both use same logic as backend for consistency                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Canonical Modules / Functions

| Module | Location | Purpose | Single Source Of |
|--------|----------|---------|------------------|
| `ingest-readings` | `supabase/functions/ingest-readings/` | Ingests sensor data | Sensor data ingestion |
| `process-unit-states` | `supabase/functions/process-unit-states/` | Evaluates unit state, creates/resolves alerts | Alert creation/resolution, offline/excursion detection |
| `process-escalations` | `supabase/functions/process-escalations/` | Sends notifications per policy | Notification dispatch |
| `get_effective_alert_rules` | DB RPC | Resolves effective rules (unit→site→org cascade) | Alert threshold resolution |
| `get_effective_notification_policy` | DB RPC | Resolves effective policy (unit→site→org cascade) | Notification policy resolution |
| `computeUnitStatus()` | `src/hooks/useUnitStatus.ts` | Frontend unit status computation | Frontend status display |
| `computeUnitAlerts()` | `src/hooks/useUnitAlerts.ts` | Frontend alert aggregation | Frontend alert display |
| `logEvent()` | `src/lib/eventLogger.ts` | Event logging to audit trail | Event history writes |

## Database Tables by Stage

### Ingestion Stage
| Table | Purpose |
|-------|---------|
| `sensor_readings` | Raw sensor data (temperature, humidity, battery, door state) |
| `manual_temperature_logs` | User-entered temperature readings |
| `door_events` | Door open/close events |
| `units` | Unit metadata + cached state (last_reading_at, last_temp_reading, status) |

### Alert Engine Stage
| Table | Purpose |
|-------|---------|
| `alert_rules` | Configurable thresholds (org/site/unit level) |
| `alerts` | Active and historical alerts |
| `event_logs` | Audit trail for state changes |

### Notification Stage
| Table | Purpose |
|-------|---------|
| `notification_policies` | Per-alert-type notification configuration |
| `notification_events` | Delivery attempts and results |
| `escalation_contacts` | Contact list for escalations |

### Configuration
| Table | Purpose |
|-------|---------|
| `organizations` | Tenant configuration (compliance_mode, timezone) |
| `sites` | Site-level settings |
| `areas` | Logical groupings within sites |
| `profiles` | User accounts |
| `user_roles` | Role-based access control |

## Shared Configuration Objects

| Config | Location | Used By |
|--------|----------|---------|
| `ALERT_TYPE_CONFIG` | `src/lib/alertConfig.ts` | AlertRow, Alerts page, UnitAlertsBanner |
| `STATUS_CONFIG` | `src/lib/statusConfig.ts` | Dashboard, AreaDetail, UnitDetail |
| `SEVERITY_CONFIG` | `src/lib/alertConfig.ts` | AlertRow, Alerts page |

## Important Invariants

1. **Alert Creation**: Only `process-unit-states` creates alerts in the database
2. **Alert Resolution**: Only `process-unit-states` resolves alerts automatically
3. **Notifications**: Only `process-escalations` sends external notifications
4. **Event Logging**: All significant state changes logged via `logEvent()` or edge function logging
5. **Status Computation**: Frontend uses `computeUnitStatus()` for consistency with backend logic
