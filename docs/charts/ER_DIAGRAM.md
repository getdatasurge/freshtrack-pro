# Entity-Relationship Diagram

> Database entity-relationship diagrams for FreshTrack Pro

---

## Core Entity Relationships

```mermaid
erDiagram
    organizations ||--o{ sites : "has many"
    organizations ||--o{ user_roles : "has many"
    organizations ||--o{ lora_sensors : "owns"
    organizations ||--o{ gateways : "owns"
    organizations ||--|| ttn_connections : "has one"
    organizations ||--o{ alert_rules : "configures"
    organizations ||--o{ notification_policies : "configures"
    organizations ||--o{ escalation_contacts : "has many"
    organizations ||--o{ subscriptions : "has one"

    sites ||--o{ areas : "has many"
    sites ||--o{ gateways : "located at"
    sites ||--o{ alert_rules : "configures"
    sites ||--o{ escalation_contacts : "has many"

    areas ||--o{ units : "has many"

    units ||--o{ sensor_readings : "has many"
    units ||--o{ manual_temperature_logs : "has many"
    units ||--o{ alerts : "has many"
    units ||--o{ door_events : "has many"
    units ||--o{ corrective_actions : "has many"
    units ||--o{ alert_rules : "configures"

    lora_sensors ||--o{ sensor_readings : "provides"
    lora_sensors }o--o| units : "assigned to"

    alerts ||--o{ notification_events : "triggers"
    alerts ||--o{ corrective_actions : "requires"

    profiles ||--o{ user_roles : "has many"
    profiles ||--o{ manual_temperature_logs : "logs"

    organizations {
        uuid id PK
        text name
        text slug UK
        enum compliance_mode
        text timezone
        timestamp created_at
        timestamp deleted_at
    }

    sites {
        uuid id PK
        uuid organization_id FK
        text name
        text address
        boolean is_active
        timestamp created_at
    }

    areas {
        uuid id PK
        uuid site_id FK
        text name
        text description
        int sort_order
        timestamp created_at
    }

    units {
        uuid id PK
        uuid area_id FK
        text name
        text status
        numeric temp_limit_high
        numeric temp_limit_low
        numeric last_temp_reading
        timestamp last_reading_at
        int checkin_interval_minutes
        text door_state
        timestamp created_at
    }

    lora_sensors {
        uuid id PK
        uuid organization_id FK
        uuid unit_id FK
        text name
        text dev_eui UK
        enum sensor_type
        enum status
        boolean is_primary
        numeric battery_level
        timestamp last_seen_at
    }

    sensor_readings {
        uuid id PK
        uuid unit_id FK
        uuid lora_sensor_id FK
        numeric temperature
        numeric humidity
        boolean door_open
        text source
        timestamp recorded_at
    }

    alerts {
        uuid id PK
        uuid organization_id FK
        uuid unit_id FK
        enum alert_type
        enum severity
        enum status
        text title
        numeric temp_reading
        timestamp triggered_at
        timestamp acknowledged_at
        uuid acknowledged_by FK
        timestamp resolved_at
        int escalation_level
    }

    profiles {
        uuid id PK
        text email
        text full_name
        text phone
        timestamp created_at
    }

    user_roles {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        enum role
    }
```

---

## Sensor & Reading Relationships

```mermaid
erDiagram
    lora_sensors ||--o{ sensor_readings : "generates"
    lora_sensors }o--|| organizations : "owned by"
    lora_sensors }o--o| sites : "located at"
    lora_sensors }o--o| units : "assigned to"

    gateways }o--|| organizations : "owned by"
    gateways }o--o| sites : "located at"

    devices ||--o{ sensor_readings : "generates"
    devices ||--o{ calibration_records : "has"

    units ||--o{ sensor_readings : "receives"
    units ||--o{ manual_temperature_logs : "receives"
    units ||--o{ door_events : "has"

    lora_sensors {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        uuid unit_id FK
        text dev_eui
        text ttn_device_id
        text ttn_application_id
        enum sensor_type
        enum status
        boolean is_primary
        numeric battery_level
        int signal_strength
        timestamp last_seen_at
        timestamp last_join_at
    }

    gateways {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        text name
        text eui
        enum status
        text ttn_gateway_id
        text frequency_plan
        timestamp last_seen_at
    }

    sensor_readings {
        uuid id PK
        uuid unit_id FK
        uuid lora_sensor_id FK
        uuid device_id FK
        numeric temperature
        numeric humidity
        numeric battery_level
        int signal_strength
        boolean door_open
        text source
        timestamp recorded_at
        timestamp created_at
    }

    manual_temperature_logs {
        uuid id PK
        uuid unit_id FK
        numeric temperature
        text notes
        uuid logged_by FK
        timestamp logged_at
    }

    door_events {
        uuid id PK
        uuid unit_id FK
        text state
        timestamp occurred_at
        text source
        jsonb metadata
    }
```

---

## Alert & Notification Relationships

```mermaid
erDiagram
    alerts ||--o{ notification_events : "triggers"
    alerts }o--|| organizations : "belongs to"
    alerts }o--|| units : "for"
    alerts }o--o| corrective_actions : "has"

    alert_rules }o--o| organizations : "at org level"
    alert_rules }o--o| sites : "at site level"
    alert_rules }o--o| units : "at unit level"
    alert_rules ||--o{ alert_rules_history : "has history"

    notification_policies }o--o| organizations : "at org level"
    notification_policies }o--o| sites : "at site level"
    notification_policies }o--o| units : "at unit level"

    escalation_contacts }o--|| organizations : "belongs to"
    escalation_contacts }o--o| sites : "scoped to"

    alerts {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        uuid area_id FK
        uuid unit_id FK
        enum alert_type
        enum severity
        enum status
        text title
        text message
        numeric temp_reading
        numeric temp_limit
        text source
        timestamp triggered_at
        timestamp first_active_at
        timestamp acknowledged_at
        uuid acknowledged_by FK
        text acknowledgment_notes
        timestamp resolved_at
        uuid resolved_by FK
        int escalation_level
        timestamp last_notified_at
        timestamp next_escalation_at
        jsonb escalation_steps_sent
        jsonb metadata
    }

    alert_rules {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        uuid unit_id FK
        int offline_warning_missed_checkins
        int offline_critical_missed_checkins
        int manual_interval_minutes
        int manual_grace_minutes
        int door_open_warning_minutes
        int door_open_critical_minutes
        int excursion_confirm_minutes_door_closed
        int excursion_confirm_minutes_door_open
        timestamp created_at
        timestamp updated_at
    }

    notification_policies {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        uuid unit_id FK
        enum alert_type
        boolean enabled
        jsonb channels
        int[] escalation_minutes
        time quiet_start
        time quiet_end
    }

    notification_events {
        uuid id PK
        uuid alert_id FK
        text channel
        text recipient
        text status
        timestamp sent_at
        text error_message
        jsonb metadata
    }

    escalation_contacts {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        text name
        text email
        text phone
        int escalation_level
        boolean is_active
    }
```

---

## TTN Integration Relationships

```mermaid
erDiagram
    organizations ||--|| ttn_connections : "has config"
    organizations ||--o{ ttn_provisioning_queue : "has jobs"
    organizations ||--o{ ttn_provisioning_logs : "has logs"
    organizations ||--o{ ttn_deprovision_jobs : "has cleanup"

    lora_sensors ||--o{ ttn_provisioning_queue : "provisioned via"
    gateways ||--o{ ttn_provisioning_queue : "provisioned via"

    ttn_provisioning_queue ||--o{ ttn_provisioning_logs : "has logs"

    ttn_connections {
        uuid id PK
        uuid organization_id FK UK
        text application_id
        text api_key
        text webhook_secret
        text cluster
        text webhook_url
        boolean is_configured
        timestamp last_sync_at
        timestamp created_at
        timestamp updated_at
    }

    ttn_provisioning_queue {
        uuid id PK
        uuid organization_id FK
        uuid sensor_id FK
        uuid gateway_id FK
        text action
        text status
        int attempts
        text last_error
        timestamp processed_at
        timestamp created_at
    }

    ttn_provisioning_logs {
        uuid id PK
        uuid queue_id FK
        uuid organization_id FK
        text action
        boolean success
        jsonb response
        text error
        timestamp created_at
    }

    ttn_deprovision_jobs {
        uuid id PK
        uuid organization_id FK
        uuid sensor_id FK
        text dev_eui
        text status
        timestamp created_at
        timestamp processed_at
    }
```

---

## User & Billing Relationships

```mermaid
erDiagram
    profiles ||--o{ user_roles : "has roles"
    user_roles }o--|| organizations : "in organization"

    organizations ||--o| subscriptions : "has subscription"
    organizations ||--o{ invoices : "has invoices"

    profiles ||--o{ event_logs : "actor in"
    profiles ||--o{ manual_temperature_logs : "logs"
    profiles ||--o{ alerts : "acknowledges"

    profiles {
        uuid id PK
        text email
        text full_name
        text phone
        text avatar_url
        timestamp created_at
        timestamp updated_at
    }

    user_roles {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        enum role
        timestamp created_at
        timestamp updated_at
    }

    subscriptions {
        uuid id PK
        uuid organization_id FK
        text stripe_subscription_id
        text stripe_customer_id
        text plan_id
        text status
        timestamp current_period_start
        timestamp current_period_end
        timestamp cancel_at
        timestamp created_at
        timestamp updated_at
    }

    invoices {
        uuid id PK
        uuid organization_id FK
        text stripe_invoice_id
        int amount
        text status
        timestamp paid_at
        timestamp created_at
    }

    event_logs {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        uuid unit_id FK
        text event_type
        text category
        text severity
        text title
        jsonb event_data
        uuid actor_id FK
        text actor_type
        timestamp created_at
    }
```

---

## Compliance Relationships

```mermaid
erDiagram
    units ||--o{ corrective_actions : "has"
    alerts }o--o| corrective_actions : "related to"

    devices ||--o{ calibration_records : "has"

    corrective_actions {
        uuid id PK
        uuid unit_id FK
        uuid alert_id FK
        text action_taken
        text root_cause
        text preventive_measures
        text[] photo_urls
        uuid created_by FK
        timestamp completed_at
        timestamp created_at
    }

    calibration_records {
        uuid id PK
        uuid device_id FK
        numeric reference_temp
        numeric measured_temp
        numeric offset_applied
        uuid performed_by FK
        timestamp calibrated_at
        timestamp next_calibration_due
        text notes
        timestamp created_at
    }

    event_logs {
        uuid id PK
        uuid organization_id FK
        uuid site_id FK
        uuid unit_id FK
        text event_type
        text category
        text severity
        text title
        jsonb event_data
        uuid actor_id FK
        text actor_type
        timestamp created_at
    }
```

---

## Related Documentation

- [DATA_MODEL.md](../engineering/DATA_MODEL.md) - Complete schema documentation
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - Database architecture
