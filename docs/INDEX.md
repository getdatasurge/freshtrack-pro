# FreshTrack Pro Documentation Index

> Complete navigation guide for all project documentation

---

## Getting Started

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | Project overview, tech stack, quick start guide |
| [GLOSSARY.md](./GLOSSARY.md) | Domain terminology, acronyms, and definitions |

---

## Architecture

| Document | Description | Key Diagrams |
|----------|-------------|--------------|
| [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) | Full system architecture, security boundaries, environment separation | [System Context](./diagrams/SYSTEM_CONTEXT.md), [Container Diagram](./diagrams/CONTAINER_DIAGRAM.md) |

---

## Product Documentation

| Document | Description | Related Diagrams |
|----------|-------------|------------------|
| [PAGES.md](./product/PAGES.md) | All routes, pages, UI layouts, state management | [Page Diagrams](./diagrams/PAGE_DIAGRAMS.md) |
| [USER_FLOWS.md](./product/USER_FLOWS.md) | Major user workflows end-to-end | [Sequence Diagrams](./diagrams/SEQUENCES.md) |

---

## Engineering Documentation

| Document | Description | Related Diagrams |
|----------|-------------|------------------|
| [API.md](./engineering/API.md) | All edge functions, inputs/outputs, auth requirements | [Flowcharts](./charts/FLOWCHARTS.md) |
| [DATA_MODEL.md](./engineering/DATA_MODEL.md) | Database schema, tables, relationships, RLS | [ER Diagram](./charts/ER_DIAGRAM.md) |
| [INTEGRATIONS.md](./engineering/INTEGRATIONS.md) | TTN, Stripe, Twilio configuration | - |
| [OBSERVABILITY.md](./engineering/OBSERVABILITY.md) | Logging, debugging, incident playbooks | - |

---

## Diagrams (Mermaid)

### System Diagrams

| Diagram | Description |
|---------|-------------|
| [SYSTEM_CONTEXT.md](./diagrams/SYSTEM_CONTEXT.md) | High-level system context showing external actors |
| [CONTAINER_DIAGRAM.md](./diagrams/CONTAINER_DIAGRAM.md) | Container-level architecture (C4 model) |

### Application Diagrams

| Diagram | Description |
|---------|-------------|
| [PAGE_DIAGRAMS.md](./diagrams/PAGE_DIAGRAMS.md) | Per-page component and data flow diagrams |
| [SEQUENCES.md](./diagrams/SEQUENCES.md) | Sequence diagrams for user flows |
| [STATE_MACHINES.md](./diagrams/STATE_MACHINES.md) | State machines for units, alerts, sensors |

---

## Charts

| Chart | Description |
|-------|-------------|
| [ER_DIAGRAM.md](./charts/ER_DIAGRAM.md) | Entity-Relationship diagram for database |
| [FLOWCHARTS.md](./charts/FLOWCHARTS.md) | Process flowcharts for data ingestion, alerts |

---

## Cross-Reference: Pages → Diagrams

| Page | Route | Diagrams |
|------|-------|----------|
| Dashboard | `/dashboard` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#dashboard), [Unit Status State Machine](./diagrams/STATE_MACHINES.md#unit-status) |
| Site Detail | `/sites/:siteId` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#site-detail) |
| Area Detail | `/sites/:siteId/areas/:areaId` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#area-detail) |
| Unit Detail | `/units/:unitId` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#unit-detail), [Temperature Flow](./diagrams/SEQUENCES.md#temperature-reading-flow) |
| Alerts | `/alerts` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#alerts), [Alert State Machine](./diagrams/STATE_MACHINES.md#alert-status) |
| Settings | `/settings` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#settings), [TTN Setup Flow](./diagrams/SEQUENCES.md#ttn-setup-flow) |
| Manual Log | `/manual-log` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#manual-log), [Manual Log Flow](./diagrams/SEQUENCES.md#manual-logging-flow) |
| Reports | `/reports` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#reports) |
| Health Dashboard | `/admin/health` | [Page Diagram](./diagrams/PAGE_DIAGRAMS.md#health-dashboard) |

---

## Cross-Reference: Features → Files

| Feature | Key Files |
|---------|-----------|
| Alert Processing | `supabase/functions/process-unit-states/index.ts`, `src/hooks/useUnitStatus.ts` |
| TTN Integration | `supabase/functions/ttn-*/`, `src/components/settings/TTNConnectionSettings.tsx` |
| Notification Dispatch | `supabase/functions/process-escalations/index.ts`, `src/hooks/useNotificationPolicies.ts` |
| Sensor Management | `src/components/settings/SensorManager.tsx`, `supabase/functions/ttn-provision-device/` |
| Gateway Management | `src/components/settings/GatewayManager.tsx`, `supabase/functions/ttn-provision-gateway/` |
| Manual Logging | `src/pages/ManualLog.tsx`, `src/lib/offlineStorage.ts` |
| Compliance Reports | `src/pages/Reports.tsx`, `supabase/functions/export-temperature-logs/` |
| User Authentication | `src/pages/Auth.tsx`, `src/hooks/useAuthAndOnboarding.ts` |
| Billing/Subscriptions | `src/components/billing/BillingTab.tsx`, `supabase/functions/stripe-*/` |

---

## Cross-Reference: Database Tables → Documentation

| Table Category | Tables | Documentation |
|----------------|--------|---------------|
| Hierarchy | `organizations`, `sites`, `areas`, `units` | [DATA_MODEL.md#hierarchy](./engineering/DATA_MODEL.md#hierarchy-tables) |
| Sensors | `lora_sensors`, `gateways`, `sensor_readings` | [DATA_MODEL.md#sensors](./engineering/DATA_MODEL.md#sensor-tables) |
| Alerts | `alerts`, `alert_rules`, `escalation_contacts` | [DATA_MODEL.md#alerts](./engineering/DATA_MODEL.md#alert-tables) |
| Notifications | `notification_policies`, `notification_events` | [DATA_MODEL.md#notifications](./engineering/DATA_MODEL.md#notification-tables) |
| TTN | `ttn_connections`, `ttn_provisioning_queue` | [INTEGRATIONS.md#ttn](./engineering/INTEGRATIONS.md#ttn-integration) |
| Audit | `event_logs`, `alert_rules_history` | [OBSERVABILITY.md#audit](./engineering/OBSERVABILITY.md#audit-trail) |

---

## Navigation by Role

### For New Engineers

1. Start with [README.md](./README.md) for project overview
2. Read [GLOSSARY.md](./GLOSSARY.md) for domain terminology
3. Review [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) for system design
4. Explore [DATA_MODEL.md](./engineering/DATA_MODEL.md) for database understanding
5. Check [API.md](./engineering/API.md) for backend functions

### For Product/Design

1. Start with [README.md](./README.md) for product overview
2. Review [USER_FLOWS.md](./product/USER_FLOWS.md) for user journeys
3. Browse [PAGES.md](./product/PAGES.md) for UI documentation
4. Check [SEQUENCES.md](./diagrams/SEQUENCES.md) for interaction flows

### For DevOps/SRE

1. Start with [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) for infrastructure
2. Review [INTEGRATIONS.md](./engineering/INTEGRATIONS.md) for external services
3. Check [OBSERVABILITY.md](./engineering/OBSERVABILITY.md) for monitoring
4. Browse [API.md](./engineering/API.md) for edge function details

### For Stakeholders

1. Start with [README.md](./README.md) for executive overview
2. Review [USER_FLOWS.md](./product/USER_FLOWS.md) for feature understanding
3. Check [SYSTEM_CONTEXT.md](./diagrams/SYSTEM_CONTEXT.md) for high-level view

---

## Document Maintenance

| Document | Last Updated | Owner |
|----------|--------------|-------|
| All documentation | 2026-01-12 | Engineering Team |

### TBD Items

For a list of all TBD items requiring verification, see individual documents:
- [API.md](./engineering/API.md) - Edge function documentation
- [INTEGRATIONS.md](./engineering/INTEGRATIONS.md) - Environment variable requirements
- [OBSERVABILITY.md](./engineering/OBSERVABILITY.md) - Production monitoring setup
