# Getting Started with FreshTrack Pro

> Your mental model for understanding this codebase

---

## What This System Does

FreshTrack Pro is a **refrigeration monitoring platform** that:

1. **Collects temperature data** from wireless sensors in commercial refrigerators
2. **Detects problems** when temperatures go out of safe ranges
3. **Alerts the right people** via email, SMS, and push notifications
4. **Maintains compliance records** for health inspections (HACCP/FDA)

Think of it as a **24/7 automated food safety system** that replaces manual temperature checks with continuous monitoring.

---

## The Mental Model

### The Data Flow

```
Sensors → TTN (IoT Network) → Our Webhooks → Database → Alerts → Notifications
```

**Step by step:**

1. **Sensors** in refrigerators transmit temperature readings via LoRa radio
2. **Gateways** receive the radio signals and forward to The Things Network (TTN)
3. **TTN** sends the data to our `ttn-webhook` edge function
4. **Database** stores the reading and updates unit state
5. **process-unit-states** evaluates if temperature is out of range
6. **process-escalations** sends notifications if needed

### The Hierarchy

Everything is organized hierarchically:

```
Organization (tenant/customer)
    └── Sites (physical locations)
        └── Areas (zones within a site)
            └── Units (refrigerators/freezers)
                └── Sensors (monitoring devices)
```

**Why this matters:**
- Settings cascade down (org defaults → site overrides → unit overrides)
- Users see only their organization's data (multi-tenancy via RLS)
- Reports can roll up at any level

### The Three Pillars

| Pillar | What It Does | Key Files |
|--------|--------------|-----------|
| **Frontend** | React SPA for user interaction | `src/` |
| **Edge Functions** | Deno serverless backend logic | `supabase/functions/` |
| **Database** | PostgreSQL with RLS | `supabase/migrations/` |

---

## How to Think About This App

### Think: Safety-Critical

This is **not** a typical CRUD app. Temperature monitoring is safety-critical:

- A missed alert can mean $10,000+ in spoiled inventory
- A false negative is worse than a false positive
- All changes must be logged for compliance audits

**Implication**: Always consider failure modes. What happens if this breaks?

### Think: Event-Driven

The system reacts to events, not user clicks:

- Sensor reading arrives → Process state → Maybe create alert
- Alert created → Escalation timer starts
- Escalation timeout → Notify next level

**Implication**: Follow the data flow. Changes ripple through the system.

### Think: Single Source of Truth

Critical operations have ONE place that does them:

| Operation | SSOT |
|-----------|------|
| Creating/resolving alerts | `process-unit-states` edge function |
| Sending notifications | `process-escalations` edge function |
| Alert rule resolution | `get_effective_alert_rules` RPC |

**Implication**: Never duplicate this logic. Always call the SSOT.

### Think: Hierarchical Cascade

Settings flow down the hierarchy:

```
Org sets: "Alert if temp > 40°F"
    └── Site A inherits: "Alert if temp > 40°F"
        └── Unit 1 overrides: "Alert if temp > 45°F"  ← This applies
        └── Unit 2 inherits: "Alert if temp > 40°F"   ← Org default applies
```

**Implication**: When reading settings, use `get_effective_*` RPCs.

---

## Key Concepts You'll Encounter

### Unit Status

Units have a status that reflects their current state:

| Status | Meaning | Priority |
|--------|---------|----------|
| `ok` | Normal operation | 5 |
| `excursion` | Temp out of range (unconfirmed) | 2 |
| `alarm_active` | Confirmed temp alarm | 1 (highest) |
| `restoring` | Recovering from issue | 4 |
| `offline` | Warning-level offline | 6 |
| `monitoring_interrupted` | Critical offline | 3 |
| `manual_required` | Manual logging needed | 4 |

Status is computed by `process-unit-states` (backend) and mirrored in `useUnitStatus` (frontend).

### Alerts

Alerts represent conditions that need attention:

- **Types**: `temp_excursion`, `monitoring_interrupted`, `door_open`, `low_battery`, etc.
- **Severity**: `warning` or `critical`
- **Status**: `triggered` → `acknowledged` → `resolved`

Alerts escalate to higher-level contacts if not acknowledged.

### LoRa Sensors

Wireless sensors using LoRa radio technology via The Things Network:

- **DevEUI**: Unique device identifier (16 hex chars)
- **Status**: `pending` → `joining` → `active` → `offline` → `fault`
- **Provisioning**: Registered in both our DB and TTN

---

## What You'll Be Working On

### Most Common Tasks

1. **UI changes** — Components in `src/components/`
2. **New pages** — Add route in `src/App.tsx`, create page in `src/pages/`
3. **Data fetching** — Custom hooks in `src/hooks/`
4. **Backend logic** — Edge functions in `supabase/functions/`
5. **Bug fixes** — Usually in state computation or data flow

### Where Bugs Hide

1. **State sync** — Frontend status doesn't match backend reality
2. **Cascade logic** — Wrong effective rules being applied
3. **TTN integration** — DevEUI normalization, webhook secrets
4. **Timing issues** — Confirm times, escalation delays

---

## Your First Day Checklist

1. [ ] Read this document completely
2. [ ] Set up your local environment ([LOCAL_DEV.md](./LOCAL_DEV.md))
3. [ ] Take the repository tour ([REPO_TOUR.md](./REPO_TOUR.md))
4. [ ] Review common tasks ([COMMON_TASKS.md](./COMMON_TASKS.md))
5. [ ] Bookmark the debugging guide ([DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md))
6. [ ] Read `KNOWLEDGE.md` in the repo root (coding conventions)
7. [ ] Log into the app and explore the UI
8. [ ] Find a "good first issue" and fix it

---

## Key Files to Bookmark

| Purpose | File |
|---------|------|
| Coding conventions | `/KNOWLEDGE.md` |
| All routes | `/src/App.tsx` |
| Supabase client | `/src/integrations/supabase/client.ts` |
| Database types | `/src/integrations/supabase/types.ts` |
| Alert configuration | `/src/lib/alertConfig.ts` |
| Status configuration | `/src/lib/statusConfig.ts` |
| Unit status computation | `/src/hooks/useUnitStatus.ts` |
| Alert processing (backend) | `/supabase/functions/process-unit-states/index.ts` |
| TTN webhook | `/supabase/functions/ttn-webhook/index.ts` |

---

## Terminology Quick Reference

| Term | Meaning |
|------|---------|
| **Unit** | A refrigerator/freezer being monitored |
| **Excursion** | Temperature outside safe limits |
| **Alarm** | Confirmed excursion (beyond confirm time) |
| **Escalation** | Notifying higher-level contacts |
| **TTN** | The Things Network (LoRa infrastructure) |
| **DevEUI** | Device Extended Unique Identifier |
| **RLS** | Row-Level Security (Postgres access control) |
| **SSOT** | Single Source of Truth |
| **HACCP** | Hazard Analysis Critical Control Point (food safety) |

See the full glossary: `/docs/GLOSSARY.md`

---

## Next Steps

1. [REPO_TOUR.md](./REPO_TOUR.md) — Walk through the codebase
2. [LOCAL_DEV.md](./LOCAL_DEV.md) — Set up your environment
3. [COMMON_TASKS.md](./COMMON_TASKS.md) — Learn common development patterns
4. [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) — Troubleshooting tips
