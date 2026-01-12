# FreshTrack Pro Data Model

> Complete database schema documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationships](#entity-relationships)
3. [Hierarchy Tables](#hierarchy-tables)
4. [Sensor Tables](#sensor-tables)
5. [Alert Tables](#alert-tables)
6. [Notification Tables](#notification-tables)
7. [Compliance Tables](#compliance-tables)
8. [TTN Tables](#ttn-tables)
9. [User Tables](#user-tables)
10. [Billing Tables](#billing-tables)
11. [System Tables](#system-tables)
12. [Enums](#enums)
13. [RLS Policies](#rls-policies)

---

## Overview

### Database

- **Engine**: PostgreSQL 14.1
- **Platform**: Supabase
- **Schema**: `public`
- **Total Tables**: 60+
- **Migrations**: 100+ files in `supabase/migrations/`

### Type Definitions

Auto-generated TypeScript types: `src/integrations/supabase/types.ts`

### Key Patterns

1. **UUID Primary Keys**: All tables use UUID `id` columns
2. **Timestamps**: `created_at`, `updated_at` on most tables
3. **Soft Delete**: `deleted_at`, `deleted_by` on hierarchy tables
4. **Audit Trail**: `event_logs` for significant changes
5. **RLS**: Row-Level Security on all user-accessible tables

---

## Entity Relationships

See [ER_DIAGRAM.md](../charts/ER_DIAGRAM.md) for visual diagram.

### Core Hierarchy

```
organizations (tenant)
    │
    ├── sites (physical location)
    │       │
    │       └── areas (zone/room)
    │               │
    │               └── units (refrigeration unit)
    │                       │
    │                       ├── lora_sensors (assigned)
    │                       ├── sensor_readings
    │                       ├── manual_temperature_logs
    │                       └── alerts
    │
    ├── lora_sensors (inventory)
    ├── gateways (inventory)
    ├── ttn_connections
    └── user_roles
```

---

## Hierarchy Tables

### `organizations`

**Purpose**: Top-level tenant entity

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Organization name |
| `slug` | TEXT | URL-safe identifier (unique) |
| `compliance_mode` | ENUM | `HACCP`, `FDA`, `GENERAL` |
| `timezone` | TEXT | IANA timezone |
| `temp_unit` | TEXT | `fahrenheit` or `celsius` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | Soft delete marker |
| `deleted_by` | UUID | User who deleted |

**Indexes**:
- `organizations_slug_key` (unique)

---

### `sites`

**Purpose**: Physical location within organization

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `name` | TEXT | Site name |
| `address` | TEXT | Physical address |
| `timezone` | TEXT | Site timezone override |
| `is_active` | BOOLEAN | Active status |
| `sort_order` | INTEGER | Display order |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | Soft delete |
| `deleted_by` | UUID | |

**Relationships**:
- `organization_id` → `organizations.id`

---

### `areas`

**Purpose**: Logical zone within a site

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `site_id` | UUID | FK to sites |
| `name` | TEXT | Area name |
| `description` | TEXT | Optional description |
| `is_active` | BOOLEAN | Active status |
| `sort_order` | INTEGER | Display order |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | |
| `deleted_by` | UUID | |

**Relationships**:
- `site_id` → `sites.id`

---

### `units`

**Purpose**: Monitored refrigeration unit

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `area_id` | UUID | FK to areas |
| `name` | TEXT | Unit name |
| `status` | TEXT | Current status (ok, excursion, etc.) |
| `temp_limit_high` | NUMERIC | High temperature threshold |
| `temp_limit_low` | NUMERIC | Low temperature threshold (optional) |
| `temp_hysteresis` | NUMERIC | Hysteresis buffer |
| `last_temp_reading` | NUMERIC | Cached last temperature |
| `last_reading_at` | TIMESTAMP | Last sensor reading time |
| `last_checkin_at` | TIMESTAMP | Last check-in time |
| `checkin_interval_minutes` | INTEGER | Expected reading interval |
| `last_manual_log_at` | TIMESTAMP | Last manual log time |
| `manual_log_cadence` | INTEGER | Manual log interval (seconds) |
| `door_state` | TEXT | `open`, `closed`, `unknown` |
| `door_last_changed_at` | TIMESTAMP | Door state change time |
| `door_open_grace_minutes` | INTEGER | Door open grace period |
| `confirm_time_door_closed` | INTEGER | Confirm time (door closed) |
| `confirm_time_door_open` | INTEGER | Confirm time (door open) |
| `last_status_change` | TIMESTAMP | Status change time |
| `sensor_reliable` | BOOLEAN | Sensor reliability flag |
| `is_active` | BOOLEAN | Active status |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | |
| `deleted_by` | UUID | |

**Relationships**:
- `area_id` → `areas.id`

**Indexes**:
- `units_area_id_idx`
- `units_status_idx`

---

## Sensor Tables

### `lora_sensors`

**Purpose**: LoRa sensor inventory and assignment

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Owner organization |
| `site_id` | UUID | Assigned site (optional) |
| `unit_id` | UUID | Assigned unit (optional) |
| `name` | TEXT | Sensor name |
| `dev_eui` | TEXT | Device EUI (normalized) |
| `ttn_device_id` | TEXT | TTN device ID |
| `ttn_application_id` | TEXT | TTN application |
| `sensor_type` | ENUM | Sensor type |
| `status` | ENUM | `pending`, `joining`, `active`, `offline`, `fault` |
| `is_primary` | BOOLEAN | Primary sensor for unit |
| `battery_level` | NUMERIC | Battery percentage |
| `signal_strength` | INTEGER | RSSI |
| `last_seen_at` | TIMESTAMP | Last data received |
| `last_join_at` | TIMESTAMP | Last TTN join |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Relationships**:
- `organization_id` → `organizations.id`
- `site_id` → `sites.id`
- `unit_id` → `units.id`

**Indexes**:
- `lora_sensors_dev_eui_idx`
- `lora_sensors_organization_id_idx`
- `lora_sensors_unit_id_idx`

---

### `gateways`

**Purpose**: LoRa gateway inventory

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Owner organization |
| `site_id` | UUID | Assigned site |
| `name` | TEXT | Gateway name |
| `eui` | TEXT | Gateway EUI |
| `status` | ENUM | `pending`, `online`, `offline`, `maintenance` |
| `ttn_gateway_id` | TEXT | TTN gateway ID |
| `frequency_plan` | TEXT | Frequency plan |
| `last_seen_at` | TIMESTAMP | Last seen |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Relationships**:
- `organization_id` → `organizations.id`
- `site_id` → `sites.id`

---

### `sensor_readings`

**Purpose**: Raw sensor data

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `unit_id` | UUID | FK to units |
| `lora_sensor_id` | UUID | FK to lora_sensors |
| `device_id` | UUID | FK to devices (legacy) |
| `temperature` | NUMERIC | Temperature reading |
| `humidity` | NUMERIC | Humidity reading |
| `battery_level` | NUMERIC | Battery at time of reading |
| `signal_strength` | INTEGER | Signal strength |
| `door_open` | BOOLEAN | Door state |
| `source` | TEXT | `ttn`, `simulator`, `manual` |
| `recorded_at` | TIMESTAMP | Reading timestamp |
| `created_at` | TIMESTAMP | Insert time |

**Relationships**:
- `unit_id` → `units.id`
- `lora_sensor_id` → `lora_sensors.id`

**Indexes**:
- `sensor_readings_unit_id_recorded_at_idx`
- `sensor_readings_lora_sensor_id_idx`

---

### `manual_temperature_logs`

**Purpose**: User-entered temperature readings

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `unit_id` | UUID | FK to units |
| `temperature` | NUMERIC | Logged temperature |
| `notes` | TEXT | Optional notes |
| `logged_by` | UUID | User who logged |
| `logged_at` | TIMESTAMP | Log timestamp |
| `created_at` | TIMESTAMP | |

**Relationships**:
- `unit_id` → `units.id`
- `logged_by` → `profiles.id`

---

### `door_events`

**Purpose**: Door open/close events

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `unit_id` | UUID | FK to units |
| `state` | TEXT | `open` or `closed` |
| `occurred_at` | TIMESTAMP | Event time |
| `source` | TEXT | Event source |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMP | |

---

## Alert Tables

### `alerts`

**Purpose**: Active and historical alerts

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `site_id` | UUID | FK |
| `area_id` | UUID | FK |
| `unit_id` | UUID | FK |
| `alert_type` | ENUM | Alert type |
| `severity` | ENUM | `warning`, `critical` |
| `status` | ENUM | `triggered`, `acknowledged`, `resolved` |
| `title` | TEXT | Alert title |
| `message` | TEXT | Alert message |
| `temp_reading` | NUMERIC | Temperature at trigger |
| `temp_limit` | NUMERIC | Threshold that was exceeded |
| `source` | TEXT | `sensor`, `system` |
| `triggered_at` | TIMESTAMP | Trigger time |
| `first_active_at` | TIMESTAMP | First active time |
| `acknowledged_at` | TIMESTAMP | Acknowledgment time |
| `acknowledged_by` | UUID | User who acknowledged |
| `acknowledgment_notes` | TEXT | Acknowledgment notes |
| `resolved_at` | TIMESTAMP | Resolution time |
| `resolved_by` | UUID | User or `system` |
| `escalation_level` | INTEGER | Current escalation level |
| `last_notified_at` | TIMESTAMP | Last notification time |
| `next_escalation_at` | TIMESTAMP | Next escalation time |
| `escalation_steps_sent` | JSONB | Sent escalation steps |
| `metadata` | JSONB | Additional data |
| `ack_required` | BOOLEAN | Requires acknowledgment |
| `created_at` | TIMESTAMP | |

**Relationships**:
- All hierarchy FKs

**Indexes**:
- `alerts_unit_id_status_idx`
- `alerts_organization_id_status_idx`
- `alerts_triggered_at_idx`

---

### `alert_rules`

**Purpose**: Configurable alert thresholds

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Org-level rule |
| `site_id` | UUID | Site-level rule |
| `unit_id` | UUID | Unit-level rule |
| `offline_warning_missed_checkins` | INTEGER | Warning threshold |
| `offline_critical_missed_checkins` | INTEGER | Critical threshold |
| `offline_trigger_multiplier` | NUMERIC | Multiplier |
| `offline_trigger_additional_minutes` | INTEGER | Additional minutes |
| `manual_interval_minutes` | INTEGER | Manual log interval |
| `manual_grace_minutes` | INTEGER | Grace period |
| `manual_log_missed_checkins_threshold` | INTEGER | Threshold |
| `door_open_warning_minutes` | INTEGER | Door warning |
| `door_open_critical_minutes` | INTEGER | Door critical |
| `door_open_max_mask_minutes_per_day` | INTEGER | Max mask time |
| `excursion_confirm_minutes_door_closed` | INTEGER | Confirm time |
| `excursion_confirm_minutes_door_open` | INTEGER | Confirm time |
| `max_excursion_minutes` | INTEGER | Max excursion |
| `expected_reading_interval_seconds` | INTEGER | Expected interval |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Notes**:
- Only one of `organization_id`, `site_id`, `unit_id` should be set
- Use `get_effective_alert_rules()` RPC for cascade resolution

---

### `alert_rules_history`

**Purpose**: Audit trail for alert rule changes

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `alert_rules_id` | UUID | FK to alert_rules |
| `organization_id` | UUID | Scope |
| `site_id` | UUID | Scope |
| `unit_id` | UUID | Scope |
| `action` | TEXT | `create`, `update`, `delete` |
| `changes` | JSONB | Changed fields |
| `changed_by` | UUID | User |
| `changed_at` | TIMESTAMP | |
| `note` | TEXT | Optional note |
| `created_at` | TIMESTAMP | |

---

## Notification Tables

### `notification_policies`

**Purpose**: Per-alert-type notification configuration

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Scope |
| `site_id` | UUID | Scope |
| `unit_id` | UUID | Scope |
| `alert_type` | ENUM | Alert type |
| `enabled` | BOOLEAN | Policy enabled |
| `channels` | JSONB | `{email: true, sms: false, push: true}` |
| `escalation_minutes` | INTEGER[] | Escalation intervals |
| `quiet_start` | TIME | Quiet hours start |
| `quiet_end` | TIME | Quiet hours end |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `escalation_contacts`

**Purpose**: Contacts for alert escalation

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `site_id` | UUID | FK (optional) |
| `name` | TEXT | Contact name |
| `email` | TEXT | Email address |
| `phone` | TEXT | Phone (E.164) |
| `escalation_level` | INTEGER | Level (1, 2, 3...) |
| `is_active` | BOOLEAN | Active status |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `notification_events`

**Purpose**: Record of notification attempts

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `alert_id` | UUID | FK to alerts |
| `channel` | TEXT | `email`, `sms`, `push` |
| `recipient` | TEXT | Email/phone |
| `status` | TEXT | `pending`, `sent`, `failed` |
| `sent_at` | TIMESTAMP | Send time |
| `error_message` | TEXT | Error if failed |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMP | |

---

### `sms_alert_log`

**Purpose**: SMS delivery log

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `alert_id` | UUID | FK to alerts |
| `phone_number` | TEXT | Recipient (masked) |
| `message` | TEXT | Message content |
| `provider_message_id` | TEXT | SMS provider message ID |
| `status` | TEXT | Delivery status |
| `created_at` | TIMESTAMP | |

---

## Compliance Tables

### `corrective_actions`

**Purpose**: HACCP corrective action documentation

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `unit_id` | UUID | FK to units |
| `alert_id` | UUID | FK to alerts (optional) |
| `action_taken` | TEXT | Description of action |
| `root_cause` | TEXT | Root cause analysis |
| `preventive_measures` | TEXT | Future prevention |
| `photo_urls` | TEXT[] | Photo evidence |
| `created_by` | UUID | User |
| `completed_at` | TIMESTAMP | Completion time |
| `created_at` | TIMESTAMP | |

---

### `calibration_records`

**Purpose**: Sensor calibration history

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `device_id` | UUID | FK to devices |
| `reference_temp` | NUMERIC | Reference thermometer |
| `measured_temp` | NUMERIC | Sensor reading |
| `offset_applied` | NUMERIC | Calibration offset |
| `performed_by` | UUID | User |
| `calibrated_at` | TIMESTAMP | |
| `next_calibration_due` | TIMESTAMP | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMP | |

---

### `event_logs`

**Purpose**: Comprehensive audit trail

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `site_id` | UUID | FK (optional) |
| `unit_id` | UUID | FK (optional) |
| `event_type` | TEXT | Event type code |
| `category` | TEXT | `alert`, `temperature`, `configuration`, `user` |
| `severity` | TEXT | `info`, `warning`, `error` |
| `title` | TEXT | Human-readable title |
| `event_data` | JSONB | Event details |
| `actor_id` | UUID | User or system |
| `actor_type` | TEXT | `user`, `system` |
| `created_at` | TIMESTAMP | |

**Indexes**:
- `event_logs_organization_id_created_at_idx`
- `event_logs_unit_id_idx`
- `event_logs_event_type_idx`

---

## TTN Tables

### `ttn_connections`

**Purpose**: Per-organization TTN credentials

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK (unique) |
| `application_id` | TEXT | TTN application ID |
| `api_key` | TEXT | Encrypted API key |
| `webhook_secret` | TEXT | Webhook secret (hashed) |
| `cluster` | TEXT | TTN cluster (e.g., `eu1`) |
| `webhook_url` | TEXT | Configured webhook URL |
| `is_configured` | BOOLEAN | Setup complete |
| `last_sync_at` | TIMESTAMP | Last sync |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `ttn_provisioning_queue`

**Purpose**: Device provisioning job queue

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `sensor_id` | UUID | FK to lora_sensors |
| `gateway_id` | UUID | FK to gateways |
| `action` | TEXT | `provision`, `deprovision` |
| `status` | TEXT | `pending`, `processing`, `complete`, `failed` |
| `attempts` | INTEGER | Retry count |
| `last_error` | TEXT | Error message |
| `processed_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

---

### `ttn_provisioning_logs`

**Purpose**: Provisioning history

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `queue_id` | UUID | FK to queue |
| `organization_id` | UUID | FK |
| `action` | TEXT | Action performed |
| `success` | BOOLEAN | Success flag |
| `response` | JSONB | API response |
| `error` | TEXT | Error if failed |
| `created_at` | TIMESTAMP | |

---

### `ttn_deprovision_jobs`

**Purpose**: Deprovisioning job tracking

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `sensor_id` | UUID | FK |
| `dev_eui` | TEXT | Device EUI |
| `status` | TEXT | Job status |
| `created_at` | TIMESTAMP | |
| `processed_at` | TIMESTAMP | |

---

## User Tables

### `profiles`

**Purpose**: User account information

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (= auth.users.id) |
| `email` | TEXT | Email address |
| `full_name` | TEXT | Display name |
| `phone` | TEXT | Phone number |
| `avatar_url` | TEXT | Profile picture |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `user_roles`

**Purpose**: Role-based access control

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to profiles |
| `organization_id` | UUID | FK to organizations |
| `role` | ENUM | `owner`, `manager`, `operator`, `viewer` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Unique**: `(user_id, organization_id)`

---

## Billing Tables

### `subscriptions`

**Purpose**: Stripe subscription records

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `stripe_subscription_id` | TEXT | Stripe ID |
| `stripe_customer_id` | TEXT | Stripe customer |
| `plan_id` | TEXT | Plan identifier |
| `status` | TEXT | Subscription status |
| `current_period_start` | TIMESTAMP | |
| `current_period_end` | TIMESTAMP | |
| `cancel_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `invoices`

**Purpose**: Billing invoice records

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `stripe_invoice_id` | TEXT | Stripe ID |
| `amount` | INTEGER | Amount in cents |
| `status` | TEXT | Invoice status |
| `paid_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

---

## System Tables

### `org_sync_state`

**Purpose**: Emulator sync state tracking

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK |
| `last_sync_at` | TIMESTAMP | |
| `sync_version` | INTEGER | |
| `state_hash` | TEXT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `account_deletion_jobs`

**Purpose**: GDPR deletion job tracking

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User to delete |
| `organization_id` | UUID | |
| `status` | TEXT | Job status |
| `current_step` | TEXT | Current step |
| `steps_completed` | JSONB | Completed steps |
| `error_message` | TEXT | |
| `completed_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

---

## Enums

### `alert_type`

```sql
CREATE TYPE alert_type AS ENUM (
  'temp_excursion',
  'monitoring_interrupted',
  'door_open',
  'low_battery',
  'sensor_fault',
  'suspected_cooling_failure',
  'calibration_due',
  'missed_manual_entry'
);
```

### `alert_severity`

```sql
CREATE TYPE alert_severity AS ENUM (
  'warning',
  'critical'
);
```

### `alert_status`

```sql
CREATE TYPE alert_status AS ENUM (
  'triggered',
  'acknowledged',
  'resolved'
);
```

### `app_role`

```sql
CREATE TYPE app_role AS ENUM (
  'owner',
  'manager',
  'operator',
  'viewer'
);
```

### `compliance_mode`

```sql
CREATE TYPE compliance_mode AS ENUM (
  'HACCP',
  'FDA',
  'GENERAL'
);
```

### `lora_sensor_type`

```sql
CREATE TYPE lora_sensor_type AS ENUM (
  'temperature',
  'temperature_humidity',
  'door',
  'combo',
  'contact'
);
```

### `lora_sensor_status`

```sql
CREATE TYPE lora_sensor_status AS ENUM (
  'pending',
  'joining',
  'active',
  'offline',
  'fault'
);
```

### `gateway_status`

```sql
CREATE TYPE gateway_status AS ENUM (
  'pending',
  'online',
  'offline',
  'maintenance'
);
```

---

## RLS Policies

### Common Pattern

```sql
-- Users can only access their organization's data
CREATE POLICY "Organization members can view" ON table_name
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );
```

### Table-Specific Policies

| Table | Policy | Description |
|-------|--------|-------------|
| `organizations` | org_member | User in org via user_roles |
| `sites` | org_member | Org owns site |
| `areas` | site_member | Site → Org chain |
| `units` | area_member | Area → Site → Org chain |
| `alerts` | org_member | Org owns alert |
| `sensor_readings` | unit_member | Unit → Area → Site → Org chain |
| `lora_sensors` | org_member | Org owns sensor |

### Role-Based Policies

```sql
-- Only managers and owners can modify
CREATE POLICY "Managers can update" ON units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND organization_id = (
          SELECT organization_id FROM sites s
          JOIN areas a ON a.site_id = s.id
          WHERE a.id = units.area_id
        )
        AND role IN ('owner', 'manager')
    )
  );
```

---

## Related Documentation

- [ER_DIAGRAM.md](../charts/ER_DIAGRAM.md) - Visual entity-relationship diagram
- [API.md](./API.md) - RPC function documentation
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - Database architecture
