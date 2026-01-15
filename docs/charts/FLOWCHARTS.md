# Flowcharts

> Process flowcharts for data ingestion, alert processing, and system operations

---

## Table of Contents

1. [Data Ingestion Flow](#data-ingestion-flow)
2. [Alert Processing Flow](#alert-processing-flow)
3. [Notification Flow](#notification-flow)
4. [TTN Provisioning Flow](#ttn-provisioning-flow)
5. [Manual Logging Flow](#manual-logging-flow)
6. [Authentication Flow](#authentication-flow)
7. [Cascade Resolution Flow](#cascade-resolution-flow)

---

## Data Ingestion Flow

### TTN Webhook Processing

```mermaid
flowchart TD
    A[TTN Uplink] --> B{Has X-Webhook-Secret?}
    B -->|No| C[Return 401]
    B -->|Yes| D[Lookup org by secret]

    D --> E{Org found?}
    E -->|No| F[Return 401]
    E -->|Yes| G[Extract DevEUI]

    G --> H{Valid DevEUI?}
    H -->|No| I[Return 202 - Accepted]
    H -->|Yes| J[Normalize DevEUI]

    J --> K[Lookup sensor by DevEUI]
    K --> L{Sensor found?}

    L -->|No| M[Lookup legacy device]
    M --> N{Device found?}
    N -->|No| O[Return 202 - Unknown]
    N -->|Yes| P[Process legacy device]

    L -->|Yes| Q{Assigned to unit?}
    Q -->|No| R[Update sensor only]
    Q -->|Yes| S[Insert sensor_reading]

    S --> T[Update unit state]
    T --> U[Trigger process-unit-states]
    U --> V[Return 200 OK]

    R --> W[Return 200 OK]
    P --> V
```

### Sensor Reading Processing

```mermaid
flowchart TD
    A[New Reading] --> B[Extract temperature]
    B --> C{Temperature present?}

    C -->|No| D[Check door state]
    C -->|Yes| E[Apply scaling if needed]

    E --> F[Insert sensor_readings]
    F --> G[Update unit.last_temp_reading]
    G --> H[Update unit.last_reading_at]
    H --> I[Update unit.last_checkin_at]

    D --> J{Door state present?}
    J -->|No| K[Update sensor only]
    J -->|Yes| L[Update unit.door_state]
    L --> M{State changed?}
    M -->|Yes| N[Insert door_event]
    M -->|No| O[Continue]

    I --> P[Trigger state processing]
    N --> P
    O --> P
```

---

## Alert Processing Flow

### Unit State Evaluation (process-unit-states)

```mermaid
flowchart TD
    A[Process Unit States] --> B[Fetch all active units]
    B --> C[For each unit]

    C --> D[Compute missed check-ins]
    D --> E{Missed >= critical?}

    E -->|Yes| F[Check manual log required]
    F --> G{Manual overdue?}
    G -->|Yes| H[Status: manual_required]
    G -->|No| I[Status: monitoring_interrupted]

    E -->|No| J{Missed >= warning?}
    J -->|Yes| K[Status: offline]
    J -->|No| L[Check temperature]

    L --> M{Temp out of range?}
    M -->|Yes| N{Door open grace?}
    N -->|Yes| O[Skip - grace period]
    N -->|No| P{Currently ok?}
    P -->|Yes| Q[Status: excursion]
    P -->|No| R{In excursion?}
    R -->|Yes| S{Confirm time passed?}
    S -->|Yes| T[Status: alarm_active]
    S -->|No| U[Stay in excursion]

    M -->|No| V{Was in excursion?}
    V -->|Yes| W[Status: restoring]
    V -->|No| X{Was restoring?}
    X -->|Yes| Y{2 good readings?}
    Y -->|Yes| Z[Status: ok]
    Y -->|No| AA[Stay restoring]

    Q --> AB[Create temp_excursion alert]
    T --> AC[Update alert to critical]
    H --> AD[Create monitoring_interrupted alert]
    I --> AD

    AB --> AE[Trigger process-escalations]
    AC --> AE
    AD --> AE
```

### Temperature Excursion Detection

```mermaid
flowchart TD
    A[Temperature Reading] --> B[Get unit thresholds]
    B --> C{Temp > high_limit?}
    C -->|Yes| D[Out of range - HIGH]
    C -->|No| E{low_limit set?}
    E -->|Yes| F{Temp < low_limit?}
    F -->|Yes| G[Out of range - LOW]
    F -->|No| H[In range]
    E -->|No| H

    D --> I{Door state?}
    G --> I

    I -->|Open| J{Within grace period?}
    J -->|Yes| K[Skip - door grace]
    J -->|No| L[Create excursion]

    I -->|Closed/Unknown| L

    L --> M[Start confirm timer]
    M --> N{Temp returns to range?}
    N -->|Yes| O[Resolve excursion]
    N -->|No| P{Confirm time passed?}
    P -->|Yes| Q[Escalate to alarm_active]
    P -->|No| R[Continue monitoring]
```

---

## Notification Flow

### Escalation Processing (process-escalations)

```mermaid
flowchart TD
    A[New/Updated Alert] --> B[Get notification policy]
    B --> C{Policy enabled?}

    C -->|No| D[Skip notification]
    C -->|Yes| E{In quiet hours?}

    E -->|Yes| F[Delay until quiet end]
    E -->|No| G[Get escalation level]

    G --> H[Get contacts for level]
    H --> I[For each contact]

    I --> J{Channel: email?}
    J -->|Yes| K[Send email]

    I --> L{Channel: SMS?}
    L -->|Yes| M[Send SMS]

    I --> N{Channel: push?}
    N -->|Yes| O[Send push]

    K --> P[Record notification_event]
    M --> P
    O --> P

    P --> Q[Update alert.last_notified_at]
    Q --> R[Calculate next_escalation_at]
    R --> S[Update alert]

    subgraph "Escalation Timer"
        T[Wait escalation_minutes]
        T --> U{Alert acknowledged?}
        U -->|Yes| V[Stop escalation]
        U -->|No| W{Max level?}
        W -->|Yes| X[Repeat current level]
        W -->|No| Y[Increment level]
        Y --> H
    end
```

### SMS Delivery

```mermaid
flowchart TD
    A[Send SMS Request] --> B[Validate phone E.164]
    B --> C{Valid format?}

    C -->|No| D[Log error]
    C -->|Yes| E[Call Telnyx API]

    E --> F{Delivery success?}
    F -->|Yes| G[Log success]
    F -->|No| H[Log failure]

    G --> I[Insert sms_alert_log]
    H --> I

    I --> J[Update notification_event]
```

---

## TTN Provisioning Flow

### Device Provisioning

```mermaid
flowchart TD
    A[Add Sensor Request] --> B[Normalize DevEUI]
    B --> C[Insert lora_sensors]
    C --> D[Queue provisioning job]

    D --> E[Worker picks up job]
    E --> F[Get TTN credentials]
    F --> G{Credentials valid?}

    G -->|No| H[Mark job failed]
    G -->|Yes| I[Call TTN API]

    I --> J{Device exists?}
    J -->|Yes| K[Update device]
    J -->|No| L[Create device]

    K --> M{API success?}
    L --> M

    M -->|Yes| N[Update sensor status: joining]
    M -->|No| O{Retry count < max?}

    O -->|Yes| P[Increment retry, requeue]
    O -->|No| Q[Mark job failed]

    N --> R[Log provisioning success]
    Q --> S[Log provisioning failure]

    subgraph "Join Process"
        T[Wait for uplink]
        T --> U{First uplink received?}
        U -->|Yes| V[Update status: active]
        U -->|No| W{Timeout?}
        W -->|Yes| X[Update status: fault]
        W -->|No| T
    end
```

### Webhook Bootstrap

```mermaid
flowchart TD
    A[Bootstrap Request] --> B[Get TTN credentials]
    B --> C{Valid API key?}

    C -->|No| D[Return error]
    C -->|Yes| E[Check existing webhook]

    E --> F{Webhook exists?}
    F -->|Yes| G[Update webhook]
    F -->|No| H[Create webhook]

    G --> I[Set webhook URL]
    H --> I

    I --> J[Set webhook secret]
    J --> K[Enable uplink messages]
    K --> L[Save to TTN]

    L --> M{Success?}
    M -->|Yes| N[Update ttn_connections]
    M -->|No| O[Return error]

    N --> P[Return success]
```

---

## Manual Logging Flow

```mermaid
flowchart TD
    A[User submits log] --> B[Validate temperature]
    B --> C{Valid range?}

    C -->|No| D[Show validation error]
    C -->|Yes| E{Online?}

    E -->|Yes| F[Insert manual_temperature_logs]
    E -->|No| G[Store in IndexedDB]

    F --> H{Success?}
    H -->|Yes| I[Update unit.last_manual_log_at]
    H -->|No| J[Show error toast]

    G --> K[Show "saved offline" toast]
    I --> L[Show success toast]

    K --> M[Queue sync]

    subgraph "Background Sync"
        N[Connection restored]
        N --> O[Get queued logs]
        O --> P[For each log]
        P --> Q[Insert to database]
        Q --> R{Success?}
        R -->|Yes| S[Remove from queue]
        R -->|No| T[Retry later]
        S --> U{More logs?}
        U -->|Yes| P
        U -->|No| V[Show "synced" toast]
    end
```

---

## Authentication Flow

```mermaid
flowchart TD
    A[Auth Request] --> B{Sign In or Sign Up?}

    B -->|Sign In| C[Validate credentials]
    C --> D{Valid?}
    D -->|Yes| E[Create session]
    D -->|No| F[Show error]

    B -->|Sign Up| G[Validate email format]
    G --> H{Valid?}
    H -->|No| I[Show error]
    H -->|Yes| J[Check password breach]

    J --> K{Breached?}
    K -->|Yes| L[Show breach warning]
    K -->|No| M[Check password strength]

    M --> N{Strong enough?}
    N -->|No| O[Show requirements]
    N -->|Yes| P[Create auth user]

    P --> Q[Trigger: create profile]
    Q --> R[Create session]

    E --> S{Has organization?}
    R --> S

    S -->|Yes| T[Redirect to /dashboard]
    S -->|No| U[Redirect to /onboarding]
```

---

## Cascade Resolution Flow

### Alert Rules Cascade

```mermaid
flowchart TD
    A[get_effective_alert_rules] --> B[Get unit_id]
    B --> C[Get unit's area_id]
    C --> D[Get area's site_id]
    D --> E[Get site's organization_id]

    E --> F[Query unit-level rules]
    F --> G{Found?}
    G -->|Yes| H[Use unit rules]

    G -->|No| I[Query site-level rules]
    I --> J{Found?}
    J -->|Yes| K[Merge with defaults]

    J -->|No| L[Query org-level rules]
    L --> M{Found?}
    M -->|Yes| N[Merge with defaults]
    M -->|No| O[Use system defaults]

    H --> P[Return merged rules]
    K --> P
    N --> P
    O --> P

    subgraph "Merge Logic"
        Q[Unit overrides Site]
        R[Site overrides Org]
        S[Org overrides System]
        S --> R --> Q
    end
```

### Notification Policy Cascade

```mermaid
flowchart TD
    A[get_effective_notification_policy] --> B[Input: unit_id, alert_type]

    B --> C[Query unit-level policy]
    C --> D{Found?}
    D -->|Yes| E[Return unit policy]

    D -->|No| F[Get site_id from unit]
    F --> G[Query site-level policy]
    G --> H{Found?}
    H -->|Yes| I[Return site policy]

    H -->|No| J[Get org_id from site]
    J --> K[Query org-level policy]
    K --> L{Found?}
    L -->|Yes| M[Return org policy]
    L -->|No| N[Return default policy]
```

---

## Related Documentation

- [API.md](../engineering/API.md) - Edge function details
- [SEQUENCES.md](../diagrams/SEQUENCES.md) - Sequence diagrams
- [STATE_MACHINES.md](../diagrams/STATE_MACHINES.md) - State machines
