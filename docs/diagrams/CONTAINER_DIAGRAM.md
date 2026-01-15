# Container Diagram

> Internal container-level architecture of FreshTrack Pro

---

## C4 Container Diagram

```mermaid
graph TB
    subgraph "Users"
        U[Users<br/>Web Browser/Mobile]
    end

    subgraph "Frontend Container"
        SPA[React SPA<br/>TypeScript, Vite<br/>Port 8080]
    end

    subgraph "Supabase Platform"
        subgraph "API Gateway"
            GW[Kong Gateway<br/>HTTPS, JWT Validation]
        end

        subgraph "Auth Container"
            AUTH[Supabase Auth<br/>GoTrue<br/>JWT, Sessions]
        end

        subgraph "Database Container"
            DB[(PostgreSQL 14.1<br/>60+ Tables<br/>RLS Policies)]
        end

        subgraph "Edge Functions Container"
            subgraph "Data Ingestion"
                TTN_WH[ttn-webhook]
                INGEST[ingest-readings]
                SIM[sensor-simulator]
            end

            subgraph "Alert Processing"
                PROC[process-unit-states<br/>SSOT: Alerts]
                ESC[process-escalations<br/>SSOT: Notifications]
            end

            subgraph "TTN Management"
                TTN_BOOT[ttn-bootstrap]
                TTN_PROV[ttn-provision-*]
            end

            subgraph "Billing"
                STR_CO[stripe-checkout]
                STR_WH[stripe-webhook]
            end

            subgraph "Utilities"
                SMS[send-sms-alert]
                HEALTH[health-check]
            end
        end

        subgraph "Storage"
            STOR[File Storage<br/>Photos, Exports]
        end
    end

    subgraph "External Services"
        TTN[The Things Network]
        STRIPE[Stripe]
        TELNYX[Telnyx]
    end

    U -->|"HTTPS"| SPA
    SPA -->|"Supabase JS SDK"| GW
    SPA -->|"Auth"| AUTH
    GW --> DB
    GW --> AUTH

    TTN -->|"Webhook"| TTN_WH
    TTN_WH --> DB
    TTN_WH --> PROC
    PROC --> DB
    PROC --> ESC
    ESC --> SMS
    SMS --> TELNYX

    TTN_PROV --> TTN
    STR_CO --> STRIPE
    STRIPE --> STR_WH
    STR_WH --> DB
```

---

## Container Details

### Frontend Container

| Property | Value |
|----------|-------|
| Technology | React 18.3.1, TypeScript, Vite |
| Build | `npm run build` → `dist/` |
| Hosting | Lovable platform (CDN) |
| Port | 8080 (development) |

**Responsibilities**:
- User interface rendering
- Client-side routing
- Form handling and validation
- Offline data caching (IndexedDB)
- PWA functionality

### Auth Container

| Property | Value |
|----------|-------|
| Technology | Supabase Auth (GoTrue) |
| Protocol | JWT (HS256) |
| Session | localStorage |

**Responsibilities**:
- User authentication
- Session management
- Password reset
- OAuth providers (if configured)

### Database Container

| Property | Value |
|----------|-------|
| Technology | PostgreSQL 14.1 |
| Tables | 60+ |
| Access Control | Row-Level Security |

**Key Features**:
- RLS policies for multi-tenancy
- Database functions (RPC)
- Triggers for event handling
- Foreign key relationships

### Edge Functions Container

| Property | Value |
|----------|-------|
| Runtime | Deno |
| Functions | 33 |
| Invocation | HTTP, Scheduled |

**Function Categories**:

```mermaid
pie title Edge Functions by Category
    "Data Ingestion" : 3
    "Alert Processing" : 2
    "TTN Management" : 12
    "User/Data Mgmt" : 6
    "Billing" : 3
    "Utilities" : 7
```

---

## Data Flow Patterns

### Sensor Data Flow

```mermaid
sequenceDiagram
    participant S as Sensor
    participant G as Gateway
    participant T as TTN
    participant W as ttn-webhook
    participant D as Database
    participant P as process-unit-states
    participant E as process-escalations

    S->>G: LoRa transmission
    G->>T: Forward uplink
    T->>W: Webhook POST
    W->>D: Insert sensor_reading
    W->>D: Update unit state
    W->>P: Trigger processing
    P->>D: Evaluate thresholds
    P->>D: Create/resolve alerts
    P->>E: Trigger notifications
    E->>D: Record delivery
```

### User Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant S as SPA
    participant G as API Gateway
    participant A as Auth
    participant D as Database

    U->>S: Navigate to page
    S->>A: Get session
    A-->>S: JWT token
    S->>G: Query with JWT
    G->>A: Validate JWT
    A-->>G: User context
    G->>D: Query with RLS
    D-->>G: Filtered data
    G-->>S: Response
    S-->>U: Render page
```

---

## Container Communication

### Protocols

| From | To | Protocol | Auth |
|------|----|---------|----- |
| SPA | Gateway | HTTPS | JWT |
| SPA | Auth | HTTPS | API Key |
| TTN | ttn-webhook | HTTPS | Webhook Secret |
| Stripe | stripe-webhook | HTTPS | Signature |
| Edge → Database | TCP | Service Role Key |
| Edge → Telnyx | HTTPS | API Credentials |
| Edge → TTN | HTTPS | Org API Key |

### Internal Communication

```mermaid
flowchart LR
    subgraph "Edge Functions"
        A[ttn-webhook] -->|HTTP| B[process-unit-states]
        B -->|HTTP| C[process-escalations]
        C -->|HTTP| D[send-sms-alert]
    end
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "CDN (Lovable)"
        SPA[React SPA<br/>Static Assets]
    end

    subgraph "Supabase Region"
        subgraph "Edge Network"
            EDGE[Edge Functions<br/>Deno Workers]
        end

        subgraph "Database Cluster"
            PRIMARY[(Primary<br/>PostgreSQL)]
            REPLICA[(Read Replica)]
        end

        AUTH[Auth Service]
        STOR[Storage]
    end

    SPA --> EDGE
    SPA --> AUTH
    EDGE --> PRIMARY
    SPA -.->|"Read queries"| REPLICA
```

---

## Scalability Considerations

| Component | Scaling Method |
|-----------|----------------|
| SPA | CDN distribution |
| Edge Functions | Auto-scaling workers |
| Database | Vertical scaling, read replicas |
| Auth | Managed by Supabase |

---

## Related Diagrams

- [SYSTEM_CONTEXT.md](./SYSTEM_CONTEXT.md) - External context
- [FLOWCHARTS.md](../charts/FLOWCHARTS.md) - Process flows
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - Full documentation
