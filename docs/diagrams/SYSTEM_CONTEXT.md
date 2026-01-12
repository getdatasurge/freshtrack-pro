# System Context Diagram

> High-level view of FreshTrack Pro and its external actors

---

## C4 System Context

```mermaid
graph TB
    subgraph "External Users"
        FSM[Food Safety Manager]
        OM[Operations Manager]
        KS[Kitchen Staff]
        IT[IT Administrator]
    end

    subgraph "FreshTrack Pro System"
        FT[FreshTrack Pro<br/>Refrigeration Monitoring Platform]
    end

    subgraph "External Systems"
        TTN[The Things Network<br/>LoRaWAN Infrastructure]
        STRIPE[Stripe<br/>Payment Processing]
        TELNYX[Telnyx<br/>SMS Delivery]
        EMAIL[Email Service<br/>Supabase SMTP]
    end

    subgraph "IoT Devices"
        SENSORS[LoRa Sensors<br/>Temperature/Humidity/Door]
        GATEWAYS[LoRa Gateways<br/>Network Access Points]
    end

    FSM -->|"Views dashboard,<br/>generates reports"| FT
    OM -->|"Configures policies,<br/>reviews trends"| FT
    KS -->|"Logs temperatures,<br/>acknowledges alerts"| FT
    IT -->|"Provisions sensors,<br/>configures TTN"| FT

    SENSORS -->|"LoRa radio"| GATEWAYS
    GATEWAYS -->|"HTTPS"| TTN
    TTN -->|"Webhook<br/>uplink data"| FT
    FT -->|"API calls<br/>device mgmt"| TTN

    FT -->|"Checkout,<br/>subscriptions"| STRIPE
    STRIPE -->|"Webhook<br/>events"| FT

    FT -->|"SMS alerts"| TELNYX
    FT -->|"Email alerts"| EMAIL
```

---

## Actor Descriptions

| Actor | Description | Key Interactions |
|-------|-------------|------------------|
| Food Safety Manager | Strategic oversight of food safety | Dashboard, reports, policy configuration |
| Operations Manager | Facilities and equipment management | Trends, escalations, equipment health |
| Kitchen Staff | Day-to-day operations | Manual logging, alert acknowledgment |
| IT Administrator | Technical setup and maintenance | Sensor provisioning, TTN configuration |

---

## External System Descriptions

| System | Purpose | Integration Type |
|--------|---------|------------------|
| The Things Network | LoRaWAN sensor network | Bidirectional API + Webhook |
| Stripe | Subscription billing | API + Webhook |
| Telnyx | SMS alert delivery | Outbound API |
| Email (Supabase) | Email notifications | SMTP |

---

## Data Flow Summary

### Inbound Data

```mermaid
flowchart LR
    S[Sensors] --> G[Gateways]
    G --> T[TTN]
    T -->|Webhook| F[FreshTrack Pro]
    U[Users] -->|Manual Logs| F
    ST[Stripe] -->|Payment Events| F
```

### Outbound Data

```mermaid
flowchart LR
    F[FreshTrack Pro] -->|Device Provisioning| T[TTN]
    F -->|SMS Alerts| TW[Telnyx]
    F -->|Email Alerts| E[Email]
    F -->|Checkout| ST[Stripe]
```

---

## Security Boundaries

```mermaid
graph TB
    subgraph "Trust Boundary: Internet"
        U[Users]
        TTN[TTN]
        STRIPE[Stripe]
    end

    subgraph "Trust Boundary: Supabase"
        subgraph "Public Access"
            AUTH[Auth Service]
            ANON[Anon API]
        end

        subgraph "Protected Access"
            EDGE[Edge Functions]
            DB[(PostgreSQL)]
        end
    end

    U -->|"HTTPS + JWT"| AUTH
    U -->|"HTTPS + JWT"| ANON
    TTN -->|"Webhook + Secret"| EDGE
    STRIPE -->|"Webhook + Signature"| EDGE
    EDGE -->|"Service Role"| DB
    ANON -->|"RLS Policies"| DB
```

---

## Related Diagrams

- [CONTAINER_DIAGRAM.md](./CONTAINER_DIAGRAM.md) - Internal container architecture
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - Detailed architecture documentation
