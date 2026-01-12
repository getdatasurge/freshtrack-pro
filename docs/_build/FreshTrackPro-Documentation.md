# FreshTrack Pro Documentation

## Complete System Documentation

---

**Generated:** 2026-01-12 02:24:44 UTC

**Version:** 1.0

---

This document contains the complete documentation for the FreshTrack Pro
temperature monitoring and food safety compliance system.

---

\newpage

<a id="readme"></a>

# FreshTrack Pro (FrostGuard)

> Real-time Refrigeration Monitoring & Food Safety Compliance Platform

## Overview

FreshTrack Pro (internally codenamed **FrostGuard**) is a comprehensive IoT-based refrigeration monitoring platform designed for food service, healthcare, and retail organizations. The system provides real-time temperature monitoring, automated alerts, HACCP compliance tracking, and multi-level escalation notifications.

### Core Capabilities

- **Real-time Temperature Monitoring**: Automated sensor readings via LoRa/TTN IoT network
- **Alert & Escalation System**: Multi-tier notifications (email, SMS, push) with configurable escalation policies
- **HACCP Compliance**: Audit trails, corrective action tracking, and compliance reporting
- **Manual Temperature Logging**: Offline-capable manual entry with automatic sync
- **Multi-Tenant Architecture**: Organization → Site → Area → Unit hierarchy
- **Equipment Health**: Battery forecasting, calibration tracking, and connectivity monitoring

### What This System Is NOT

- Not a consumer/home refrigerator app
- Not a general IoT platform
- Not a food inventory/ordering system

---

## Goals & Use Cases

### Primary Use Cases

1. **Continuous Monitoring**: Automated temperature readings every 5 minutes (configurable)
2. **Excursion Detection**: Immediate alerts when temperatures exceed safe thresholds
3. **Compliance Documentation**: Immutable audit trails for health inspections
4. **Shift Handoff**: Staff can acknowledge and hand off alerts with notes
5. **Predictive Maintenance**: Battery forecasts and calibration reminders

### Target Users

| Persona | Role | Primary Tasks |
|---------|------|---------------|
| Food Safety Manager | Strategic oversight | Dashboard review, report generation, policy configuration |
| Operations Manager | Facilities management | Equipment monitoring, escalation setup, trend analysis |
| Kitchen Staff | Day-to-day operations | Manual logging, alert acknowledgment, unit status checks |
| IT Administrator | Technical setup | Sensor provisioning, TTN configuration, debugging |

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.8.3 | Type-safe JavaScript |
| Vite | 5.4.19 | Build tool and dev server |
| React Router | 6.30.1 | Client-side routing |
| TanStack Query | 5.83.0 | Server state management |
| React Hook Form | 7.61.1 | Form handling |
| Zod | 3.25.76 | Schema validation |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| shadcn/ui | - | Component library (Radix-based) |
| Recharts | 2.15.4 | Data visualization |
| Framer Motion | 12.23.26 | Animations |
| Lucide React | 0.462.0 | Icons |

### Backend

| Technology | Purpose |
|------------|---------|
| Supabase | PostgreSQL database, Auth, Edge Functions |
| Deno | Edge function runtime |
| PostgreSQL | 14.1 - Primary database |
| Row-Level Security (RLS) | Data access control |

### External Integrations

| Service | Purpose |
|---------|---------|
| The Things Network (TTN) | LoRa sensor network |
| Stripe | Payment processing |
| Telnyx | SMS alert delivery (toll-free) |

### Development Tools

| Tool | Purpose |
|------|---------|
| Vitest | Unit testing |
| ESLint | Code linting |
| Workbox | PWA service workers |
| lovable-tagger | Deployment tagging |

---

## Repository Structure

```
freshtrack-pro/
├── src/                          # Frontend React application
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── alerts/               # Alert display components
│   │   ├── dashboard/            # Dashboard widgets
│   │   ├── settings/             # Settings panels
│   │   ├── unit/                 # Unit monitoring components
│   │   ├── ttn/                  # TTN-specific components
│   │   ├── health/               # System health components
│   │   ├── admin/                # Admin tools
│   │   └── debug/                # Debug utilities
│   ├── pages/                    # Route-level page components
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities and configuration
│   ├── types/                    # TypeScript type definitions
│   ├── contexts/                 # React contexts
│   └── integrations/             # External service clients
├── supabase/                     # Backend configuration
│   ├── functions/                # Edge functions (Deno)
│   │   ├── _shared/              # Shared utilities
│   │   ├── process-unit-states/  # Alert engine (SSOT)
│   │   ├── process-escalations/  # Notification dispatch
│   │   ├── ttn-webhook/          # TTN data ingestion
│   │   ├── ingest-readings/      # Generic data ingestion
│   │   └── [33 more functions]   # See API.md for full list
│   ├── migrations/               # Database migrations
│   └── config.toml               # Supabase configuration
├── docs/                         # Documentation (this folder)
├── public/                       # Static assets
├── scripts/                      # Build utilities
└── [config files]                # vite, tailwind, tsconfig, etc.
```

---

## Running Locally

### Prerequisites

- Node.js 18+ or Bun
- Supabase CLI (for local backend)
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd freshtrack-pro

# Install dependencies
npm install
# or: bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
# or: bun dev
```

The app will be available at `http://localhost:8080`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (safe for client) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

### Running with Local Supabase

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db push

# Start edge functions
supabase functions serve
```

---

## Build & Deployment

### Production Build

```bash
# Build for production
npm run build
# or: bun run build

# Preview production build
npm run preview
```

### Deployment

The application is configured for deployment via the Lovable platform. Production deployments are triggered automatically via git push.

### Build Outputs

- **dist/**: Production bundle (optimized JS, CSS, assets)
- **dist/sw.js**: Service worker for PWA functionality
- **dist/manifest.webmanifest**: PWA manifest

---

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                      │
│  - Dashboard, Settings, Reports, Manual Logging                  │
│  - Offline-capable manual temperature logging                    │
│  - Real-time status updates via polling                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Backend)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PostgreSQL │  │ Edge Funcs  │  │    Auth     │              │
│  │  Database   │  │  (Deno)     │  │  (Supabase) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                │                                       │
│         └────────────────┼───────────────────────────────────┐  │
│                          │                                   │  │
│  ┌───────────────────────┴───────────────────────────────┐   │  │
│  │              Edge Functions Pipeline                   │   │  │
│  │  ingest-readings → process-unit-states → escalations   │   │  │
│  └────────────────────────────────────────────────────────┘   │  │
└─────────────────────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
   │     TTN     │       │   Stripe    │       │   Twilio    │
   │  (Sensors)  │       │ (Payments)  │       │   (SMS)     │
   └─────────────┘       └─────────────┘       └─────────────┘
```

### Key Data Flow

1. **Sensor Data Ingestion**: TTN → `ttn-webhook` → `sensor_readings` table
2. **State Processing**: `ingest-readings` → `process-unit-states` → creates/resolves alerts
3. **Notifications**: `process-unit-states` → `process-escalations` → email/SMS/push
4. **Manual Logging**: UI → Supabase direct → `manual_temperature_logs` table

---

## Documentation Index

See [INDEX.md](#index) for a complete navigation guide to all documentation.

### Quick Links

- [Architecture Overview](#architecture-architecture)
- [API Reference](#engineering-api)
- [Data Model](#engineering-data_model)
- [User Flows](#product-user_flows)
- [Page Documentation](#product-pages)
- [Integrations Guide](#engineering-integrations)
- [Glossary](#glossary)

---

## Contributing

1. Read the [KNOWLEDGE.md](#knowledge) file for coding conventions and guidelines
2. Follow the existing patterns for components, hooks, and edge functions
3. Ensure all significant state changes are logged to `event_logs`
4. Never duplicate alert creation logic - use `process-unit-states` as the single source of truth
5. Run tests before committing: `npm run test`

---

## License

Proprietary - All rights reserved.


---

\newpage

<a id="index"></a>

# FreshTrack Pro Documentation Index

> Complete navigation guide to all project documentation

**Last Updated:** 2026-01-12 02:24:44 UTC
**Total Documents:** 49

---

## Quick Links

| Document | Description |
|----------|-------------|
| [README](#readme) | Project overview and quick start |
| [GLOSSARY](#glossary) | Terminology and definitions |
| [CI Checklist](#ci_checklist) | Documentation CI validation rules |

---
## Executive Summary

High-level overviews for stakeholders and decision-makers.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro: Frequently Asked Questions](#executive-faq) | Frequently asked questions |
| [FreshTrack Pro Overview](#executive-overview) | What FreshTrack Pro is and does |
| [FreshTrack Pro: System at a Glance](#executive-system_at_a_glance) | High-level system overview |
| [FreshTrack Pro User Journeys](#executive-user_journeys) | Day-in-the-life scenarios |
| [FreshTrack Pro Value Proposition](#executive-value_proposition) | Business value and benefits |

## Architecture

System design, components, and technical decisions.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro System Architecture](#architecture-architecture) | System architecture and design |

## Product

Pages, user flows, and product functionality.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro Pages Documentation](#product-pages) | All application pages and routes |
| [FreshTrack Pro User Flows](#product-user_flows) | User interaction workflows |

## Engineering

API, data model, integrations, and technical details.

| Document | Description |
|----------|-------------|
| [FreshTrack Pro API Documentation](#engineering-api) | Edge functions and API endpoints |
| [FreshTrack Pro Data Model](#engineering-data_model) | Database schema and relationships |
| [FreshTrack Pro Integrations](#engineering-integrations) | External service integrations |
| [FreshTrack Pro Observability](#engineering-observability) | Logging and monitoring |

## Onboarding

Getting started guides for new team members.

| Document | Description |
|----------|-------------|
| [Common Development Tasks](#onboarding-common_tasks) | How to do common tasks |
| [Debugging Guide](#onboarding-debugging_guide) | Troubleshooting and debugging |
| [Getting Started with FreshTrack Pro](#onboarding-getting_started) | Mental model for new developers |
| [Local Development Setup](#onboarding-local_dev) | Development environment setup |
| [Repository Tour](#onboarding-repo_tour) | Codebase walkthrough |

## Quality Assurance

Testing strategy, coverage, and quality assurance.

| Document | Description |
|----------|-------------|
| [Coverage Map](#qa-coverage_map) | Test coverage by feature |
| [End-to-End Test Scenarios](#qa-e2e_scenarios) | End-to-end test scenarios |
| [Known Test Coverage Gaps](#qa-known_gaps) | Coverage gaps and risks |
| [Manual Testing Guide](#qa-manual_testing) | Manual QA checklists |
| [Test Strategy](#qa-test_strategy) | Testing philosophy and approach |

## Security

Security model, threats, and incident response.

| Document | Description |
|----------|-------------|
| [Authentication & Authorization Model](#security-auth_model) | Authentication and authorization |
| [Data Protection](#security-data_protection) | Encryption and data handling |
| [Incident Response](#security-incident_response) | Security incident procedures |
| [Security Overview](#security-security_overview) | Security principles and controls |
| [Threat Model](#security-threat_model) | Threats and mitigations |

## Operations

Monitoring, alerting, and operational procedures.

| Document | Description |
|----------|-------------|
| [Alerting](#operations-alerting) | Alert conditions and escalation |
| [Dashboards](#operations-dashboards) | Monitoring dashboards |
| [Logging](#operations-logging) | Log sources and debugging |
| [Metrics Overview](#operations-metrics_overview) | System metrics and thresholds |
| [Runbooks](#operations-runbooks) | Operational procedures |

## Diagrams

Visual representations and flowcharts.

| Document | Description |
|----------|-------------|
| [Container Diagram](#diagrams-container_diagram) | Container architecture |
| [Page Diagrams](#diagrams-page_diagrams) | Page component diagrams |
| [Sequence Diagrams](#diagrams-sequences) | Sequence diagrams |
| [State Machines](#diagrams-state_machines) | State machine diagrams |
| [System Context Diagram](#diagrams-system_context) | System context diagram |

## Charts

Data models and entity relationships.

| Document | Description |
|----------|-------------|
| [Entity-Relationship Diagram](#charts-er_diagram) | Entity relationship diagram |
| [Flowcharts](#charts-flowcharts) | Process flowcharts |

## General

General documentation and guides.

| Document | Description |
|----------|-------------|
| [Emulator Quick Start - TTN Integration](#emulator_quick_start) | Emulator quick start |
| [Emulator TTN Integration Guide](#emulator_ttn_integration) | TTN emulator integration |
| [FreshTrack Pro (FrostGuard)](#readme) | Project overview |
| [TTN Production Secrets Setup](#ttn_production_setup) | Production TTN setup |
| [The Things Network (TTN) Setup Guide](#ttn_setup) | TTN configuration guide |
| [FrostGuard Deprecations](#deprecations) | Deprecated features |
| [FrostGuard System Map](#system-map) | System component map |

---

## Document Relationships

### Core Documentation Flow

```
Executive Overview     →  Architecture  →  Engineering Details
        ↓                      ↓                   ↓
   Value Prop           System Design        API & Data Model
        ↓                      ↓                   ↓
   User Journeys         Diagrams            Integrations
```

### Key Cross-References

| If you need... | Start with... | Then see... |
|----------------|---------------|-------------|
| System understanding | [Architecture](#architecture-architecture) | [System Context](#diagrams-system_context) |
| User flows | [User Flows](#product-user_flows) | [Sequences](#diagrams-sequences) |
| Data structures | [Data Model](#engineering-data_model) | [ER Diagram](#charts-er_diagram) |
| Getting started | [Getting Started](#onboarding-getting_started) | [Local Dev](#onboarding-local_dev) |
| Security review | [Security Overview](#security-security_overview) | [Threat Model](#security-threat_model) |
| Operations | [Metrics](#operations-metrics_overview) | [Runbooks](#operations-runbooks) |

---

## Documentation Pipeline

This index is automatically generated. To regenerate:

```bash
npm run docs:build
```

To validate documentation:

```bash
npm run docs:lint
```

To run the complete pipeline:

```bash
npm run docs:all
```

See [CI_CHECKLIST.md](#ci_checklist) for documentation standards and validation rules.


---

\newpage

<a id="executive-overview"></a>

# FreshTrack Pro Overview

> Refrigeration Monitoring & Food Safety Compliance Platform

---

## What is FreshTrack Pro?

FreshTrack Pro is a **smart refrigeration monitoring platform** that automatically tracks temperatures in commercial refrigerators, freezers, and cold storage units. When something goes wrong—like a door left open or a cooling system failure—the system immediately alerts the right people before food spoils or safety violations occur.

Think of it as a **24/7 watchdog for your cold chain** that never takes a break, never forgets to check, and always keeps a perfect record for inspectors.

---

## The Problem We Solve

Every year, businesses lose billions of dollars to:

| Problem | Impact |
|---------|--------|
| **Spoiled inventory** | A single freezer failure can destroy $10,000+ in product overnight |
| **Health code violations** | Fines, closures, and reputation damage from failed inspections |
| **Manual logging burden** | Staff waste hours on paper temperature logs that are error-prone |
| **Late discovery** | Problems found hours or days after they started, when it's too late |
| **Compliance gaps** | Missing or incomplete records during health inspections |

**FreshTrack Pro eliminates these problems** by automating temperature monitoring, alerting, and compliance documentation.

---

## Who Uses FreshTrack Pro?

FreshTrack Pro is designed for organizations that need to maintain strict temperature control:

| Industry | Use Cases |
|----------|-----------|
| **Restaurants & Food Service** | Walk-in coolers, freezers, prep stations |
| **Grocery & Retail** | Display cases, storage, receiving areas |
| **Healthcare** | Vaccine storage, blood banks, pharmaceutical storage |
| **Food Manufacturing** | Production lines, raw material storage, shipping |
| **Hospitality** | Hotel kitchens, event catering, banquet facilities |
| **Education** | School cafeterias, university dining halls |

---

## Key Capabilities

### 1. Continuous Monitoring
Wireless sensors check temperatures every 5 minutes (configurable) and transmit readings automatically. No manual checks required.

### 2. Instant Alerts
When temperatures go out of range, the system immediately notifies the right people via:
- Email
- Text message (SMS)
- Mobile push notifications

Alerts escalate to managers and supervisors if not acknowledged within configurable timeframes.

### 3. Compliance Ready
- **Automatic audit trails** that record every reading, alert, and action
- **HACCP-compliant** documentation for health inspections
- **One-click reports** showing compliance history for any time period
- **Corrective action tracking** to document how issues were resolved

### 4. Multi-Location Management
Manage all your locations from a single dashboard:
- Organization → Sites → Areas → Individual Units
- Centralized monitoring across cities, states, or countries
- Role-based access so staff only see what they need

### 5. Offline-Ready Manual Logging
When sensors aren't available, staff can log temperatures manually from any mobile device—even without internet connection. Logs sync automatically when connectivity returns.

### 6. Equipment Health Insights
- **Battery life forecasting** for wireless sensors
- **Connectivity monitoring** to catch communication issues early
- **Calibration reminders** to ensure sensor accuracy

---

## At a Glance

| Feature | Description |
|---------|-------------|
| **Monitoring** | 24/7 automated temperature tracking |
| **Alerting** | Multi-channel, escalating notifications |
| **Compliance** | HACCP/FDA-ready documentation and reports |
| **Access** | Web and mobile apps, works on any device |
| **Scale** | From 1 unit to thousands across multiple locations |
| **Deployment** | Cloud-based, no servers to maintain |

---

## What FreshTrack Pro Is NOT

To set clear expectations:

- **Not a consumer product** — Designed for commercial/industrial use, not home refrigerators
- **Not an inventory system** — Tracks temperatures, not what's inside
- **Not hardware-only** — Requires subscription for monitoring service

---

## Next Steps

- [Value Proposition](#value_proposition) — Why FreshTrack Pro matters
- [System at a Glance](#system_at_a_glance) — How it works
- [User Journeys](#user_journeys) — Day in the life with FreshTrack Pro
- [FAQ](#faq) — Common questions answered


---

\newpage

<a id="executive-value_proposition"></a>

# FreshTrack Pro Value Proposition

> The business case for automated refrigeration monitoring

---

## The Bottom Line

**FreshTrack Pro pays for itself by preventing a single spoilage event.**

A typical walk-in freezer failure can destroy $10,000–$50,000 in inventory. A health code violation can result in fines, forced closures, and lasting reputation damage. FreshTrack Pro provides 24/7 protection for a fraction of what one incident would cost.

---

## Business Value

### 1. Prevent Costly Losses

| Scenario | Without FreshTrack Pro | With FreshTrack Pro |
|----------|------------------------|---------------------|
| Freezer fails at 2 AM | Discovered at 6 AM opening. $15,000 inventory lost. | Alert sent immediately. Manager responds. $0 lost. |
| Door left ajar overnight | Product quality compromised. Partial loss. | Alert sent after 20 min grace period. Staff responds. |
| Slow cooling system decline | Not noticed until catastrophic failure. | Temperature trend detected. Preventive maintenance scheduled. |

**ROI Example**: One prevented incident = 12–24 months of subscription cost avoided.

---

### 2. Reduce Labor Costs

| Task | Manual Process | With FreshTrack Pro |
|------|----------------|---------------------|
| Temperature logging | 15–30 min/day per location | Automatic |
| Log organization | Paper filing, retrieval | Digital, searchable |
| Report generation | Hours compiling spreadsheets | One-click export |
| Inspector prep | Hunting for records | Ready in seconds |

**Savings**: 5–10 hours per week in staff time across a typical multi-unit operation.

---

### 3. Pass Inspections with Confidence

Health inspectors want to see:
- Consistent temperature records
- Evidence of monitoring
- Documentation of corrective actions

FreshTrack Pro provides:
- **Complete, unbroken temperature history** — no gaps, no missing logs
- **Timestamped alerts** showing immediate response to issues
- **Corrective action records** documenting what was done and when
- **Professional reports** ready to print or share digitally

**Result**: Faster inspections. Fewer citations. Better scores.

---

### 4. Protect Your Reputation

In the age of social media, one foodborne illness outbreak can devastate a brand. FreshTrack Pro helps you:

- **Prove due diligence** — comprehensive monitoring records
- **Respond faster** — catch problems before customers are affected
- **Demonstrate commitment** — visible evidence of food safety investment

---

## Competitive Differentiators

### What Sets FreshTrack Pro Apart

| Feature | FreshTrack Pro | Traditional Solutions |
|---------|----------------|----------------------|
| **Multi-location dashboard** | Single view of all sites | Separate systems per location |
| **Escalating alerts** | Auto-escalate if not acknowledged | Single notification, easy to miss |
| **Offline manual logging** | Works without internet | Requires connectivity |
| **Hierarchical configuration** | Set rules at org/site/unit level | One-size-fits-all settings |
| **Modern interface** | Mobile-first, intuitive | Desktop-focused, dated |
| **Compliance-ready reports** | HACCP/FDA formatted | Manual formatting required |

### Why Customers Choose Us

1. **Reliability First** — Built for mission-critical monitoring where failures matter
2. **Flexible Alerting** — Configure exactly who gets notified, when, and how
3. **True Multi-Site Support** — Designed from day one for organizations with multiple locations
4. **Modern Technology** — Cloud-native platform that's always up to date
5. **Responsive Support** — Real people who understand food safety

---

## Pricing That Makes Sense

| Plan | Monthly | Sensors | Key Features |
|------|---------|---------|--------------|
| **Starter** | $29 | Up to 5 | Basic monitoring, email alerts |
| **Pro** | $79 | Up to 25 | + SMS alerts, advanced reports |
| **HACCP** | $199 | Up to 100 | + Full compliance suite, audit tools |
| **Enterprise** | Custom | Unlimited | Custom integrations, dedicated support |

**No long-term contracts required.** Cancel anytime.

---

## Who Benefits?

### For Executives
- **Risk reduction** — Minimize exposure to spoilage, fines, and liability
- **Operational visibility** — See all locations at a glance
- **Cost control** — Predictable subscription vs. unpredictable losses

### For Operations Managers
- **Peace of mind** — Know you'll be alerted to problems immediately
- **Trend analysis** — Spot equipment issues before they become failures
- **Staff accountability** — See who acknowledged what and when

### For Frontline Staff
- **Simple interface** — Quick logging, clear status indicators
- **Mobile-friendly** — Works on any phone or tablet
- **Clear alerts** — Know exactly what needs attention

### For Compliance Teams
- **Audit-ready records** — Everything documented automatically
- **Gap-free history** — Continuous monitoring = complete records
- **Easy reporting** — Generate inspector-ready reports in seconds

---

## The Cost of NOT Acting

Consider what happens without automated monitoring:

| Risk | Potential Cost |
|------|----------------|
| Single freezer failure | $10,000–$50,000 in lost inventory |
| Health code violation | $500–$10,000 in fines |
| Forced closure | $5,000–$50,000/day in lost revenue |
| Foodborne illness lawsuit | $100,000+ in legal costs |
| Brand damage | Immeasurable |

**FreshTrack Pro subscription**: A few hundred dollars per month.

**The math is simple.**

---

## Next Steps

Ready to protect your cold chain?

1. **See a demo** — Watch FreshTrack Pro in action
2. **Start a trial** — Free 14-day trial, no credit card required
3. **Talk to sales** — Custom solutions for enterprise needs

---

## Related Documents

- [Overview](#overview) — What FreshTrack Pro is
- [System at a Glance](#system_at_a_glance) — How it works
- [User Journeys](#user_journeys) — Day in the life
- [FAQ](#faq) — Common questions


---

\newpage

<a id="executive-system_at_a_glance"></a>

# FreshTrack Pro: System at a Glance

> A simple look at how FreshTrack Pro works

---

## How It Works (The Simple Version)

FreshTrack Pro is like having a tireless employee who:
1. **Checks every refrigerator** every 5 minutes
2. **Records every reading** automatically
3. **Calls you immediately** if something is wrong
4. **Keeps perfect records** for inspectors

All of this happens automatically, 24 hours a day, 7 days a week.

---

## The Three Parts of FreshTrack Pro

```mermaid
graph LR
    subgraph "1. SENSORS"
        S[Wireless Sensors<br/>in your equipment]
    end

    subgraph "2. CLOUD PLATFORM"
        C[FreshTrack Pro<br/>processes data &<br/>sends alerts]
    end

    subgraph "3. YOUR TEAM"
        T[Dashboard, Mobile App<br/>& Notifications]
    end

    S -->|"Temperature<br/>readings"| C
    C -->|"Alerts &<br/>reports"| T
```

### 1. Wireless Sensors
Small devices placed inside refrigerators, freezers, and cold storage units that:
- Measure temperature continuously
- Send readings wirelessly (no cables needed)
- Run for years on a single battery

### 2. Cloud Platform
The "brain" of FreshTrack Pro that:
- Receives all sensor readings
- Compares temperatures to your safe limits
- Sends alerts when something is wrong
- Stores all data securely for compliance

### 3. Your Team's Access
How you and your team interact with FreshTrack Pro:
- **Web Dashboard** — Full view of all locations from any computer
- **Mobile App** — Check status and respond to alerts from anywhere
- **Notifications** — Email, text, and push alerts when action is needed

---

## The Alert Flow

What happens when a temperature problem occurs:

```mermaid
graph TD
    A[Sensor detects<br/>temperature out of range] --> B[System confirms<br/>it's not a false alarm]
    B --> C[Alert sent to<br/>primary contacts]
    C --> D{Acknowledged<br/>within time limit?}
    D -->|Yes| E[Issue tracked<br/>until resolved]
    D -->|No| F[Alert escalates to<br/>managers/supervisors]
    F --> G[Process repeats<br/>until acknowledged]
    E --> H[Resolution logged<br/>for compliance]
    G --> H
```

**Key Points:**
- Alerts aren't sent for brief fluctuations (like when someone opens a door)
- If the first person doesn't respond, alerts automatically escalate
- Everything is documented for your records

---

## Your Organization Structure

FreshTrack Pro mirrors how your business is organized:

```mermaid
graph TD
    O[Your Organization] --> S1[Site: Downtown Location]
    O --> S2[Site: Airport Location]
    O --> S3[Site: Mall Location]

    S1 --> A1[Area: Main Kitchen]
    S1 --> A2[Area: Storage Room]

    A1 --> U1[Unit: Walk-in Cooler]
    A1 --> U2[Unit: Prep Freezer]
    A2 --> U3[Unit: Dry Storage Fridge]
```

**Benefits of this structure:**
- Set rules at any level (organization-wide, per-site, or per-unit)
- Give staff access to only their locations
- Roll up reporting by site, region, or entire organization

---

## What Gets Tracked

| Data Point | How It's Captured |
|------------|-------------------|
| **Temperature** | Automatic sensor readings every 5 minutes |
| **Door events** | Sensors detect when doors open/close |
| **Sensor health** | Battery levels and signal strength |
| **Alerts** | When triggered, who responded, how long to resolve |
| **Manual logs** | Staff entries for backup or verification |
| **Changes** | Who changed settings, when, and what |

**All data is stored securely and never deleted** — available for compliance audits at any time.

---

## The Dashboard at a Glance

When you log in, you see:

| Section | What It Shows |
|---------|---------------|
| **Status Overview** | Green/yellow/red indicators for every unit |
| **Active Alerts** | Any issues needing immediate attention |
| **Recent Activity** | Latest readings and events |
| **Quick Actions** | Log temperature, acknowledge alerts, generate reports |

**Color Coding:**
- 🟢 **Green** — Everything normal
- 🟡 **Yellow/Orange** — Needs attention (warning)
- 🔴 **Red** — Immediate action required (critical)
- ⚫ **Gray** — Offline or no data

---

## Security & Reliability

| Concern | How FreshTrack Pro Addresses It |
|---------|--------------------------------|
| **Data Security** | All data encrypted, stored in secure cloud infrastructure |
| **Access Control** | Role-based permissions — staff only see what they need |
| **Uptime** | Cloud platform designed for 99.9%+ availability |
| **Data Backup** | Automatic backups, no data loss |
| **Compliance** | Meets HACCP, FDA, and industry standards |

---

## Integration Points

FreshTrack Pro can work with:

| Integration | Purpose |
|-------------|---------|
| **Email systems** | Alert delivery |
| **SMS/Text messaging** | Critical alerts to phones |
| **Payment processing** | Subscription billing |

*Enterprise customers can discuss additional integrations.*

---

## Summary

FreshTrack Pro is a complete, end-to-end solution:

1. **Sensors** collect data from your equipment
2. **Cloud platform** analyzes data and sends alerts
3. **Web & mobile apps** give you visibility and control
4. **Automatic documentation** keeps you compliant

No servers to maintain. No software to install. Just protection for your cold chain.

---

## Related Documents

- [Overview](#overview) — What FreshTrack Pro is
- [Value Proposition](#value_proposition) — Why it matters
- [User Journeys](#user_journeys) — Day in the life
- [FAQ](#faq) — Common questions


---

\newpage

<a id="executive-user_journeys"></a>

# FreshTrack Pro User Journeys

> A day in the life with FreshTrack Pro

---

## Meet Your Team

Before we explore the journeys, let's introduce the people who use FreshTrack Pro:

| Person | Role | What They Care About |
|--------|------|---------------------|
| **Alex** | Food Safety Manager | Compliance, inspections, protecting the business |
| **Jordan** | Operations Manager | Equipment health, costs, staff efficiency |
| **Sam** | Kitchen Lead | Getting work done, responding quickly to issues |
| **Morgan** | Regional Director | Multi-site oversight, big-picture trends |

---

## Journey 1: Getting Started (Onboarding)

### Day 1: Alex Sets Up FreshTrack Pro

**9:00 AM** — Alex receives an email that FreshTrack Pro is ready. She clicks the link and creates her account in under a minute.

**9:05 AM** — The setup wizard walks her through adding her organization. She enters:
- Company name: "Fresh Bites Restaurant Group"
- First location: "Downtown Flagship"

**9:10 AM** — Alex adds the areas within her location:
- Main Kitchen
- Walk-in Cooler
- Freezer Storage

**9:15 AM** — For each refrigeration unit, Alex sets:
- A name everyone will recognize ("Prep Station Fridge")
- Temperature limits (35°F to 40°F for coolers)
- Who should be notified if there's a problem

**9:30 AM** — The IT team installs the wireless sensors inside each unit. They simply stick to the wall—no wiring needed.

**9:45 AM** — Within minutes, Alex sees the first temperature readings appearing on her dashboard. Green status lights confirm everything is working.

**10:00 AM** — Alex invites Jordan (Operations) and Sam (Kitchen Lead) to the system. Each gets a role-appropriate view.

> **Outcome**: In less than an hour, FreshTrack Pro is monitoring all refrigeration units and the whole team has access.

---

## Journey 2: A Normal Day (Daily Monitoring)

### Morning: Jordan Checks the Dashboard

**6:30 AM** — Jordan arrives and opens FreshTrack Pro on his phone before even entering the building.

**The dashboard shows:**
- ✅ All units green across 3 locations
- 📊 Overnight temperature graphs look stable
- 🔋 One sensor battery at 15% (reminder to replace this week)

**6:35 AM** — Jordan feels confident everything is fine. No calls from staff overnight means the system is working.

### Midday: Sam Logs a Manual Check

**11:00 AM** — As part of HACCP requirements, Sam does a visual verification of the walk-in cooler using a handheld thermometer.

**11:02 AM** — Sam pulls out his phone, opens FreshTrack Pro, and:
1. Taps "Log Temperature"
2. Selects "Walk-in Cooler"
3. Enters "38°F"
4. Adds note: "Visual check - all product properly stored"
5. Taps "Save"

**Done in 30 seconds.** The reading is now permanently recorded with Sam's name and timestamp.

### Afternoon: Alex Prepares for a Vendor Meeting

**2:00 PM** — A food supplier asks for temperature records as part of their audit requirements.

**2:05 PM** — Alex opens FreshTrack Pro, goes to Reports, and:
1. Selects "Temperature Log Report"
2. Chooses last 30 days
3. Selects the receiving area cooler
4. Clicks "Export PDF"

**2:06 PM** — A professional, complete report downloads. Alex emails it to the vendor.

> **Outcome**: Normal operations require just a few minutes of interaction with FreshTrack Pro. Everything else is automatic.

---

## Journey 3: Responding to an Alert

### Late Night: Something Goes Wrong

**11:47 PM** — A walk-in freezer compressor fails. Temperature begins rising.

**11:52 PM** — Temperature crosses the alert threshold (above 0°F). FreshTrack Pro confirms this isn't a brief fluctuation.

**11:53 PM** — FreshTrack Pro sends:
- 📱 Push notification to Sam's phone
- 📧 Email to Sam
- 📱 Text message to Sam

**11:55 PM** — Sam's phone buzzes. She sees:

> **ALERT: Downtown - Walk-in Freezer**
> Temperature: 8°F (Limit: 0°F)
> Rising for 5 minutes
> **[Acknowledge]** **[View Details]**

**11:56 PM** — Sam taps "Acknowledge" and adds a note: "Checking now."

**11:58 PM** — Sam arrives at the freezer and finds the compressor has stopped. She calls the emergency HVAC service.

### The Escalation That Didn't Happen

**If Sam hadn't responded**, FreshTrack Pro would have:
- **12:08 PM** (15 min later) — Escalated to Jordan (Operations Manager)
- **12:23 PM** (30 min later) — Escalated to Alex (Food Safety Manager)

But because Sam acknowledged immediately, the right person was already handling it.

### Resolution

**12:30 AM** — HVAC technician arrives and restarts the compressor.

**1:00 AM** — Temperature returns to normal range. FreshTrack Pro automatically marks the alert as resolved.

**1:01 AM** — Sam opens the app and documents the corrective action:
- "Compressor failed, HVAC called immediately"
- "Tech identified loose connection"
- "No product affected - temp never exceeded 15°F"

> **Outcome**: A potentially catastrophic freezer failure was caught and resolved before any inventory was lost. Complete documentation exists for compliance records.

---

## Journey 4: Health Inspection Day

### Morning: The Inspector Arrives

**9:15 AM** — A health inspector arrives unannounced at the Downtown location.

**9:20 AM** — The inspector asks: "Can I see your temperature logs for the past 90 days?"

**9:21 AM** — Alex opens FreshTrack Pro on her tablet and:
1. Goes to Reports
2. Selects "Compliance Report"
3. Sets date range to past 90 days
4. Clicks "Generate"

**9:22 AM** — The report appears showing:
- ✅ 12,960 automatic temperature readings
- ✅ 180 manual verification logs
- ✅ 3 alerts (all acknowledged within 5 minutes)
- ✅ 3 documented corrective actions
- ✅ Zero gaps in monitoring

**9:25 AM** — The inspector reviews the report. Everything is organized, timestamped, and complete.

**Inspector's Comment**: "This is exactly what we want to see. Wish more restaurants had systems like this."

> **Outcome**: What used to be a stressful scramble through paper logs is now a 2-minute report generation. Perfect records, every time.

---

## Journey 5: Multi-Location Oversight

### Weekly: Morgan Reviews All Sites

**Monday 8:00 AM** — Morgan, the Regional Director, opens FreshTrack Pro to review all 12 locations.

**The Regional Dashboard shows:**
- 🟢 10 locations all green
- 🟡 1 location with a warning (sensor battery low)
- 🔴 1 location had a critical alert over the weekend (since resolved)

**8:05 AM** — Morgan drills into the location that had the critical alert:
- **What happened**: Freezer door was propped open for cleaning
- **How long**: 35 minutes
- **Who responded**: Kitchen manager acknowledged within 8 minutes
- **Resolution**: Door closed, temperature recovered, no product affected

**8:10 AM** — Morgan sends a quick message to that location's manager reminding them about the door-propping policy.

**8:15 AM** — Morgan generates a weekly summary report for the executive team showing:
- Total alerts across all locations: 7
- Average response time: 6 minutes
- Equipment issues requiring maintenance: 2
- Compliance score: 99.2%

> **Outcome**: Regional oversight that used to require site visits and phone calls now takes 15 minutes from anywhere.

---

## Journey 6: Long-Term Insights

### Quarterly: Alex Analyzes Trends

**End of Quarter** — Alex uses FreshTrack Pro to prepare for the quarterly operations review.

**Insights from the data:**

| Finding | Action |
|---------|--------|
| Unit 3 shows slowly rising baseline temperature | Schedule compressor inspection before failure |
| Friday evening has most door-open alerts | Adjust stocking schedule to reduce door time |
| Location B has 40% more alerts than others | Investigate — older equipment? Training issue? |
| Battery replacements needed Q2 | Order sensors now for proactive replacement |

**Alex's Report to Leadership:**
- "We've prevented an estimated $45,000 in potential spoilage this quarter"
- "Response time improved from 12 minutes to 6 minutes average"
- "Zero compliance gaps identified"
- "Recommending equipment upgrade at Location B"

> **Outcome**: FreshTrack Pro data drives operational improvements and justifies equipment investments with hard numbers.

---

## Summary: The FreshTrack Pro Difference

| Before FreshTrack Pro | With FreshTrack Pro |
|----------------------|---------------------|
| Paper logs, clipboards, filing cabinets | Digital, searchable, always accessible |
| Problems discovered hours or days later | Alerts within minutes |
| Scrambling for records during inspections | Reports generated in seconds |
| No visibility across locations | Single dashboard for everything |
| Reactive maintenance after failures | Proactive insights prevent failures |
| Hope and luck | Confidence and control |

---

## Related Documents

- [Overview](#overview) — What FreshTrack Pro is
- [Value Proposition](#value_proposition) — Why it matters
- [System at a Glance](#system_at_a_glance) — How it works
- [FAQ](#faq) — Common questions


---

\newpage

<a id="executive-faq"></a>

# FreshTrack Pro: Frequently Asked Questions

> Answers to common executive and stakeholder questions

---

## General Questions

### What exactly is FreshTrack Pro?

FreshTrack Pro is a cloud-based system that automatically monitors temperatures in commercial refrigerators, freezers, and cold storage. It uses wireless sensors to track conditions 24/7, sends alerts when problems occur, and maintains complete records for compliance purposes.

### Who is FreshTrack Pro designed for?

FreshTrack Pro is built for any organization that needs to maintain strict temperature control:
- Restaurants and food service operations
- Grocery stores and supermarkets
- Healthcare facilities (vaccine storage, blood banks)
- Food manufacturing and distribution
- Hotels and hospitality
- Schools and universities

### How is this different from a simple thermometer?

A thermometer tells you the temperature right now. FreshTrack Pro:
- Monitors **continuously** (every 5 minutes, 24/7)
- **Alerts you immediately** when something goes wrong
- **Keeps permanent records** of all readings
- **Escalates** to managers if staff don't respond
- **Generates reports** for compliance and inspections

---

## Security & Data Protection

### Is our data secure?

Yes. FreshTrack Pro employs enterprise-grade security:

| Security Measure | Description |
|------------------|-------------|
| **Encryption** | All data encrypted in transit and at rest |
| **Access Control** | Role-based permissions — users only see what they need |
| **Cloud Infrastructure** | Hosted on enterprise-grade cloud platforms |
| **Compliance** | Designed to meet HACCP, FDA, and industry standards |
| **Audit Logging** | All access and changes are logged |

### Who can see our data?

Only people you authorize. FreshTrack Pro uses role-based access:
- **Owners/Admins** — Full access to all data and settings
- **Managers** — Access to their locations and reports
- **Staff** — Access to log temperatures and acknowledge alerts

No one outside your organization can see your data.

### Where is our data stored?

Data is stored in secure cloud infrastructure with:
- Automatic backups
- Geographic redundancy
- 99.9%+ uptime guarantee

### Can data be deleted?

For compliance reasons, temperature data and audit logs are retained permanently and cannot be deleted. This ensures complete records for inspections and liability protection.

---

## Reliability & Uptime

### What happens if the internet goes down?

**Sensors continue to work.** They store readings locally and sync when connectivity returns.

**Manual logging works offline.** Staff can log temperatures on their phones even without internet — data syncs automatically when connection is restored.

**You'll know about outages.** The system alerts you if a sensor stops communicating, so you can investigate.

### What is your uptime guarantee?

FreshTrack Pro is designed for 99.9%+ availability. Our cloud infrastructure is:
- Distributed across multiple data centers
- Automatically monitored 24/7
- Designed with no single point of failure

### What if a sensor fails?

Sensors are designed for years of reliable operation, but if one fails:
- You'll receive a "sensor offline" alert
- Manual logging can cover the gap
- Replacement sensors are available for quick swap

---

## Implementation & Deployment

### How long does it take to get started?

Most organizations are up and running in a single day:
- **Account setup**: 10 minutes
- **Location configuration**: 15-30 minutes per site
- **Sensor installation**: 5-10 minutes per unit (just stick to wall)
- **Staff training**: 15-30 minutes

### Do we need to hire IT staff?

No. FreshTrack Pro is fully managed:
- No servers to maintain
- No software to install or update
- No database administration required
- Support available if you need help

### What equipment do we need?

**From FreshTrack Pro:**
- Wireless temperature sensors (included or purchased)
- Gateway device to connect sensors to internet (1 per location)

**You provide:**
- Internet connection at each location
- Smartphones/tablets/computers for staff access

### Can we add more locations later?

Yes. Adding a new location takes minutes:
1. Create the location in the dashboard
2. Install sensors
3. Configure alert settings
4. Invite local staff

---

## Costs & Pricing

### How much does FreshTrack Pro cost?

| Plan | Monthly Cost | Sensors Included | Best For |
|------|--------------|------------------|----------|
| **Starter** | $29 | Up to 5 | Single small location |
| **Pro** | $79 | Up to 25 | Multi-unit locations |
| **HACCP** | $199 | Up to 100 | Compliance-focused operations |
| **Enterprise** | Custom | Unlimited | Large organizations |

*Prices are per organization. Additional sensors available for purchase.*

### Are there long-term contracts?

No long-term contracts required. Service is month-to-month, cancel anytime.

### What's included in the subscription?

- Unlimited users
- All software features and updates
- Cloud storage for all data
- Email and in-app notifications
- Standard support

*SMS alerts and advanced features available in Pro plan and above.*

### What about hardware costs?

Sensors can be:
- **Purchased outright** — One-time cost, you own them
- **Included in Enterprise plans** — Talk to sales

Gateway devices are typically one-time purchases per location.

---

## Compliance & Reporting

### Does FreshTrack Pro meet HACCP requirements?

Yes. FreshTrack Pro provides:
- Continuous temperature monitoring
- Automatic record-keeping with timestamps
- Corrective action documentation
- Audit-ready reports

### What about FDA requirements?

FreshTrack Pro is designed to support FDA Food Safety Modernization Act (FSMA) compliance with:
- Complete temperature history
- Traceability of all records
- Evidence of monitoring and response

### Can we generate reports for inspectors?

Yes. One-click reports include:
- Temperature logs for any time period
- Alert history and response times
- Corrective actions taken
- Compliance summaries

Reports export as professional PDFs ready to share with inspectors.

### How long are records kept?

All records are retained permanently:
- Temperature readings
- Alert history
- Corrective actions
- Audit logs

This ensures complete compliance documentation for any past period.

---

## Support & Maintenance

### What support is available?

| Support Type | Availability |
|--------------|--------------|
| **Help documentation** | 24/7 online |
| **Email support** | Business hours, typically 24-hour response |
| **Phone support** | Available for Pro and above plans |
| **Dedicated success manager** | Enterprise plans |

### How are updates handled?

FreshTrack Pro is cloud-based, so:
- Updates are automatic
- No downtime required
- You always have the latest features
- No action needed from your team

### What if we have problems?

1. Check the in-app help center
2. Email support team
3. For urgent issues, call the support line (Pro+ plans)

Enterprise customers have dedicated support contacts.

---

## Technical Questions (Non-Technical Answers)

### How do the sensors communicate?

Sensors use **LoRa wireless technology** — a long-range, low-power radio signal designed for sensors. Benefits:
- Works through walls and across large facilities
- Battery life of 2+ years
- No need for WiFi in each refrigerator

### Do sensors need WiFi?

The sensors themselves don't use WiFi. They communicate with a small gateway device that does need an internet connection. One gateway typically covers an entire location.

### Can this work with our existing thermometers?

FreshTrack Pro uses its own sensors for automated monitoring. However:
- Staff can log readings from any thermometer manually
- Existing sensors can sometimes be integrated (ask sales)

### Does it work with our POS or inventory system?

Standard FreshTrack Pro operates independently. Enterprise customers can discuss integration options with our team.

---

## Competitive Questions

### Why FreshTrack Pro over alternatives?

| Feature | FreshTrack Pro | Traditional Solutions |
|---------|----------------|----------------------|
| Multi-location dashboard | ✅ Built-in | Often extra cost |
| Escalating alerts | ✅ Automatic | Usually manual |
| Offline capability | ✅ Yes | Rarely |
| Modern interface | ✅ Mobile-first | Often dated |
| HACCP reports | ✅ One-click | Manual work |
| No servers needed | ✅ Cloud-native | Often on-premise |

### Can I try before I buy?

Yes. We offer a 14-day free trial with full functionality. No credit card required to start.

---

## Getting Started

### How do I sign up?

1. Visit our website
2. Click "Start Free Trial"
3. Create your account
4. Follow the setup wizard

### Can I see a demo first?

Absolutely. Contact our sales team for a personalized demo showing FreshTrack Pro with your specific use cases.

### Who should I contact for enterprise needs?

For organizations with 10+ locations or specialized requirements, contact our enterprise sales team for a customized solution and pricing.

---

## Related Documents

- [Overview](#overview) — What FreshTrack Pro is
- [Value Proposition](#value_proposition) — Why it matters
- [System at a Glance](#system_at_a_glance) — How it works
- [User Journeys](#user_journeys) — Day in the life


---

\newpage

<a id="architecture-architecture"></a>

# FreshTrack Pro System Architecture

> Complete system architecture documentation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Database Architecture](#database-architecture)
5. [Authentication & Authorization](#authentication--authorization)
6. [Third-Party Integrations](#third-party-integrations)
7. [Environment Separation](#environment-separation)
8. [Security Boundaries](#security-boundaries)
9. [Diagrams](#diagrams)

---

## Architecture Overview

FreshTrack Pro follows a modern Jamstack architecture with:
- **React SPA** for the frontend
- **Supabase** for backend (PostgreSQL + Edge Functions + Auth)
- **Event-driven processing** for sensor data and alerts
- **Multi-tenant isolation** via Row-Level Security

### Architectural Principles

1. **Single Source of Truth (SSOT)**
   - `process-unit-states` is the only service that creates/resolves alerts
   - `process-escalations` is the only service that sends notifications
   - `get_effective_alert_rules` RPC resolves the cascade logic

2. **Event-Driven Processing**
   - Sensor data triggers state evaluation
   - State changes trigger notifications
   - All actions are logged for audit

3. **Hierarchical Configuration**
   - Settings cascade: Organization → Site → Area → Unit
   - Lower levels override higher levels

4. **Offline-First for Critical Operations**
   - Manual temperature logging works offline
   - IndexedDB for local storage with sync

---

## Frontend Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | React 18.3.1 | UI components and state |
| Routing | React Router 6.30.1 | Client-side navigation |
| State | TanStack Query 5.83.0 | Server state management |
| Forms | React Hook Form + Zod | Form handling and validation |
| Styling | Tailwind CSS 3.4.17 | Utility-first CSS |
| Components | shadcn/ui (Radix) | Accessible component library |
| Build | Vite 5.4.19 | Fast development and bundling |

### Component Architecture

```
src/
├── pages/              # Route-level components (23 pages)
│   ├── Dashboard.tsx   # Main monitoring view
│   ├── Settings.tsx    # Multi-tab configuration
│   └── ...
├── components/         # Reusable components (112+ files)
│   ├── ui/             # shadcn base components (43)
│   ├── settings/       # Settings panels
│   ├── unit/           # Unit monitoring
│   ├── alerts/         # Alert display
│   └── ...
├── hooks/              # Custom React hooks (25)
│   ├── useUnitStatus.ts
│   ├── useAlertRules.ts
│   └── ...
├── lib/                # Utilities and config
│   ├── alertConfig.ts
│   ├── statusConfig.ts
│   └── ...
├── contexts/           # React contexts
│   ├── DebugContext.tsx
│   └── TTNConfigContext.tsx
└── integrations/       # External service clients
    └── supabase/
```

### State Management Pattern

```mermaid
graph LR
    A[Server State] -->|TanStack Query| B[React Components]
    C[Form State] -->|React Hook Form| B
    D[URL State] -->|React Router| B
    E[Theme State] -->|next-themes| B
    F[Debug State] -->|React Context| B
```

### Key Patterns

1. **Query Keys**: Structured for cache invalidation
   ```typescript
   ['units', unitId]
   ['alerts', { organizationId, status: 'active' }]
   ['alert-rules', { unitId }]
   ```

2. **Component Composition**: Use shadcn components as building blocks
3. **Config Objects**: Centralized status/alert configuration in `lib/`

---

## Backend Architecture

### Edge Functions Overview

The backend consists of 33 Deno-based edge functions organized by purpose:

#### Data Ingestion (3 functions)
| Function | Purpose | Trigger |
|----------|---------|---------|
| `ttn-webhook` | Receive TTN uplink messages | HTTP POST from TTN |
| `ingest-readings` | Generic sensor data ingestion | HTTP POST |
| `sensor-simulator` | Generate test data | HTTP POST |

#### Alert Processing (2 functions)
| Function | Purpose | Trigger |
|----------|---------|---------|
| `process-unit-states` | Evaluate unit states, create/resolve alerts | Called after ingestion |
| `process-escalations` | Send notifications per policy | Called after state changes |

#### TTN Management (12 functions)
| Function | Purpose |
|----------|---------|
| `ttn-bootstrap` | Auto-configure webhooks |
| `ttn-manage-application` | Create/update TTN apps |
| `ttn-provision-device` | Register sensors with TTN |
| `ttn-provision-gateway` | Register gateways with TTN |
| `ttn-provision-org` | Provision org in TTN |
| `ttn-provision-worker` | Background provisioning |
| `ttn-list-devices` | List TTN devices |
| `ttn-gateway-preflight` | Validate gateway permissions |
| `ttn-deprovision-worker` | Cleanup deprovisioned devices |
| `update-ttn-webhook` | Update webhook config |
| `manage-ttn-settings` | TTN settings CRUD |
| `sync-ttn-settings` | Sync from emulator |

#### User & Data Management (6 functions)
| Function | Purpose |
|----------|---------|
| `user-sync-emitter` | User sync events |
| `cleanup-user-sensors` | User data cleanup |
| `update-sensor-assignment` | Sensor assignment |
| `account-deletion-jobs` | GDPR deletion |
| `export-temperature-logs` | Compliance data export |
| `check-password-breach` | Password security |

#### Billing (3 functions)
| Function | Purpose |
|----------|---------|
| `stripe-checkout` | Create checkout sessions |
| `stripe-portal` | Customer portal access |
| `stripe-webhook` | Handle Stripe events |

#### Utilities (7 functions)
| Function | Purpose |
|----------|---------|
| `health-check` | System health monitoring |
| `check-slug-available` | Org slug validation |
| `send-sms-alert` | Twilio SMS delivery |
| `org-state-api` | Pull-based state API |
| `fetch-org-state` | Org TTN state |
| `emulator-sync` | Emulator integration |
| `run-simulator-heartbeats` | Simulated heartbeats |

### Data Processing Pipeline

```mermaid
graph TD
    A[Sensor] -->|LoRa| B[TTN]
    B -->|Webhook| C[ttn-webhook]
    D[Simulator] --> E[sensor-simulator]
    F[Manual Entry] --> G[Frontend]

    C --> H[sensor_readings]
    E --> H
    G --> I[manual_temperature_logs]

    H --> J[ingest-readings]
    J --> K[process-unit-states]
    K --> L[alerts table]
    K --> M[unit status update]
    L --> N[process-escalations]
    N --> O[Email/SMS/Push]
```

### Function Security

| Security Level | Functions | Auth Method |
|----------------|-----------|-------------|
| Public | Health check endpoints | None |
| User Auth | Most API endpoints | JWT (Supabase Auth) |
| Internal Only | process-unit-states, process-escalations | INTERNAL_API_KEY header |
| Webhook | ttn-webhook, stripe-webhook | Webhook secret |

---

## Database Architecture

### PostgreSQL 14.1 on Supabase

The database contains 60+ tables organized by domain:

#### Hierarchy Tables
```
organizations
    └── sites
        └── areas
            └── units
```

#### Core Tables by Domain

| Domain | Tables |
|--------|--------|
| Hierarchy | organizations, sites, areas, units |
| Sensors | lora_sensors, gateways, devices (legacy), sensor_readings |
| Alerts | alerts, alert_rules, alert_rules_history |
| Notifications | notification_policies, notification_events, escalation_contacts |
| Compliance | corrective_actions, calibration_records, event_logs |
| TTN | ttn_connections, ttn_provisioning_queue, ttn_provisioning_logs |
| Users | profiles, user_roles, user_sync_log |
| Billing | subscriptions, invoices |

### Row-Level Security (RLS)

All tables enforce RLS policies based on:
- User's organization membership (`user_roles`)
- Data ownership chain (units → areas → sites → organizations)

Example policy pattern:
```sql
-- Users can only see units in their organization
CREATE POLICY "Users can view org units" ON units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN sites s ON s.organization_id = ur.organization_id
      JOIN areas a ON a.site_id = s.id
      WHERE a.id = units.area_id
      AND ur.user_id = auth.uid()
    )
  );
```

### Key RPC Functions

| Function | Purpose |
|----------|---------|
| `get_effective_alert_rules(p_unit_id)` | Resolve cascaded alert rules |
| `get_effective_notification_policy(...)` | Resolve cascaded notification policy |
| `create_organization_with_owner(...)` | Atomic org creation |
| `user_belongs_to_org(...)` | Access check |
| `has_role(...)` | Role authorization |
| `enqueue_deprovision_jobs_for_unit(...)` | TTN cleanup queue |

---

## Authentication & Authorization

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as Auth Page
    participant S as Supabase Auth
    participant D as Database

    U->>A: Email/Password
    A->>S: signInWithPassword()
    S->>S: Validate credentials
    S->>D: Create session
    D-->>S: Session token
    S-->>A: JWT + Refresh token
    A->>U: Redirect to /dashboard
```

### Session Management
- JWT tokens via Supabase Auth
- Automatic token refresh
- Session stored in localStorage

### Authorization Model

| Role | Capabilities |
|------|--------------|
| `owner` | Full org control, billing, user management |
| `manager` | Settings, alerts, reports |
| `operator` | Manual logging, alert acknowledgment |
| `viewer` | Read-only dashboard access |

### Permission Checks

```typescript
// Frontend hook
const { hasRole } = useUserRole();
if (hasRole('manager')) { /* show settings */ }

// Backend RPC
SELECT has_role(auth.uid(), 'manager', org_id);
```

---

## Third-Party Integrations

### The Things Network (TTN)

**Purpose**: LoRa sensor network connectivity

**Architecture**:
- Per-organization TTN Application
- Webhook-based uplink reception
- Device provisioning via TTN API

**Data Flow**:
```
Sensor → LoRa Gateway → TTN → ttn-webhook → Database
```

**Configuration**: Stored in `ttn_connections` table per organization

### Stripe

**Purpose**: Subscription billing

**Architecture**:
- Checkout sessions for new subscriptions
- Customer portal for management
- Webhook for event processing

**Plans**:
| Plan | Price | Sensors | Features |
|------|-------|---------|----------|
| Starter | $29/mo | 5 | Basic monitoring |
| Pro | $79/mo | 25 | SMS alerts |
| HACCP | $199/mo | 100 | Compliance reports |
| Enterprise | Custom | Unlimited | Custom features |

### Twilio

**Purpose**: SMS alert delivery

**Usage**: Called by `process-escalations` for critical alerts

---

## Environment Separation

### Environments

| Environment | Purpose | Database | Edge Functions |
|-------------|---------|----------|----------------|
| Local | Development | Local Supabase | `supabase functions serve` |
| Staging | Testing | Staging project | Deployed |
| Production | Live users | Production project | Deployed |

### Environment Variables

**Frontend (Vite)**:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=xxx
```

**Edge Functions**:
```env
SUPABASE_URL=<auto-injected>
SUPABASE_SERVICE_ROLE_KEY=<auto-injected>
INTERNAL_API_KEY=<secret>
TTN_API_KEY=<per-org in database>
STRIPE_SECRET_KEY=<secret>
STRIPE_WEBHOOK_SECRET=<secret>
TWILIO_ACCOUNT_SID=<secret>
TWILIO_AUTH_TOKEN=<secret>
```

### Configuration Management

- **supabase/config.toml**: Edge function settings
- **Database**: Organization-specific settings (TTN credentials)
- **Secrets**: Managed via Supabase dashboard

---

## Security Boundaries

### Network Security

```mermaid
graph TB
    subgraph "Public Internet"
        U[Users]
        TTN[TTN Cloud]
        S[Stripe]
    end

    subgraph "Supabase Edge"
        EF[Edge Functions]
        GW[API Gateway]
    end

    subgraph "Supabase Core"
        AUTH[Auth]
        DB[(PostgreSQL)]
        ST[Storage]
    end

    U --> GW
    TTN --> EF
    S --> EF
    GW --> AUTH
    GW --> DB
    EF --> DB
```

### Data Security

| Data Type | Protection |
|-----------|------------|
| User passwords | Bcrypt hash (Supabase Auth) |
| TTN API keys | Encrypted at rest in database |
| Webhook secrets | Hashed for comparison |
| Session tokens | JWT with expiration |
| Sensitive logs | Masked before logging |

### Input Validation

- **Frontend**: Zod schemas in `lib/validation.ts`
- **Backend**: Zod validation in edge functions
- **Database**: CHECK constraints and triggers

### Security Best Practices

1. **Never expose service role key** to frontend
2. **Use RLS** for all data access
3. **Validate internal API keys** for scheduled functions
4. **Constant-time comparison** for webhook secrets
5. **Log without sensitive data** (mask phone numbers, keys)

---

## Diagrams

### System Context Diagram

See: [SYSTEM_CONTEXT.md](#diagrams-system_context)

### Container Diagram

See: [CONTAINER_DIAGRAM.md](#diagrams-container_diagram)

### C4 Context (Embedded)

```mermaid
C4Context
    title System Context Diagram - FreshTrack Pro

    Person(user, "Food Safety User", "Monitors refrigeration units")
    Person(admin, "IT Administrator", "Configures sensors and TTN")

    System(freshtrack, "FreshTrack Pro", "Refrigeration monitoring platform")

    System_Ext(ttn, "The Things Network", "LoRa network infrastructure")
    System_Ext(stripe, "Stripe", "Payment processing")
    System_Ext(twilio, "Twilio", "SMS delivery")
    System_Ext(email, "Email Service", "Supabase built-in")

    Rel(user, freshtrack, "Uses", "HTTPS")
    Rel(admin, freshtrack, "Configures", "HTTPS")
    Rel(freshtrack, ttn, "Receives sensor data", "Webhook")
    Rel(freshtrack, stripe, "Processes payments", "API")
    Rel(freshtrack, twilio, "Sends SMS", "API")
    Rel(freshtrack, email, "Sends email", "SMTP")
```

### Container Diagram (Embedded)

```mermaid
C4Container
    title Container Diagram - FreshTrack Pro

    Person(user, "User", "")

    Container(spa, "React SPA", "React, TypeScript", "Single-page application")
    Container(edge, "Edge Functions", "Deno", "Serverless backend")
    ContainerDb(db, "PostgreSQL", "Supabase", "Primary database")
    Container(auth, "Auth Service", "Supabase Auth", "User authentication")

    System_Ext(ttn, "TTN", "")
    System_Ext(stripe, "Stripe", "")
    System_Ext(twilio, "Twilio", "")

    Rel(user, spa, "Uses", "HTTPS")
    Rel(spa, edge, "API calls", "HTTPS")
    Rel(spa, db, "Direct queries", "Supabase JS")
    Rel(spa, auth, "Auth", "Supabase JS")
    Rel(edge, db, "Queries", "Service Role")
    Rel(ttn, edge, "Webhooks", "HTTPS")
    Rel(stripe, edge, "Webhooks", "HTTPS")
    Rel(edge, twilio, "SMS", "API")
```

---

## Related Documentation

- [DATA_MODEL.md](#engineering-data_model) - Database schema details
- [API.md](#engineering-api) - Edge function documentation
- [INTEGRATIONS.md](#engineering-integrations) - Third-party integration guides
- [OBSERVABILITY.md](#engineering-observability) - Logging and monitoring


---

\newpage

<a id="product-pages"></a>

# FreshTrack Pro Pages Documentation

> Comprehensive documentation for all routes, pages, and UI components

---

## Table of Contents

1. [Route Overview](#route-overview)
2. [Public Pages](#public-pages)
3. [Authentication Pages](#authentication-pages)
4. [Core Application Pages](#core-application-pages)
5. [Admin Pages](#admin-pages)
6. [Utility Pages](#utility-pages)

---

## Route Overview

| Route | Page Component | Purpose | Auth Required |
|-------|----------------|---------|---------------|
| `/` | `Index.tsx` | Landing page | No |
| `/auth` | `Auth.tsx` | Sign in/Sign up | No |
| `/auth/callback` | `AuthCallback.tsx` | OAuth callback | No |
| `/dashboard` | `Dashboard.tsx` | Main monitoring view | Yes |
| `/organization` | `OrganizationDashboard.tsx` | Organization overview | Yes |
| `/onboarding` | `Onboarding.tsx` | Initial setup flow | Yes |
| `/sites` | `Sites.tsx` | Site listing | Yes |
| `/sites/:siteId` | `SiteDetail.tsx` | Site details | Yes |
| `/sites/:siteId/areas/:areaId` | `AreaDetail.tsx` | Area details | Yes |
| `/units/:unitId` | `UnitDetail.tsx` | Unit monitoring | Yes |
| `/manual-log` | `ManualLog.tsx` | Manual temperature entry | Yes |
| `/alerts` | `Alerts.tsx` | Alert management | Yes |
| `/reports` | `Reports.tsx` | Compliance reports | Yes |
| `/settings` | `Settings.tsx` | Multi-tab settings | Yes |
| `/inspector` | `Inspector.tsx` | Debug inspection | Yes |
| `/pilot-setup` | `PilotSetup.tsx` | Pilot program setup | Yes |
| `/events` | `EventHistory.tsx` | Audit event log | Yes |
| `/admin/recently-deleted` | `RecentlyDeleted.tsx` | Soft-deleted items | Yes |
| `/admin/ttn-cleanup` | `TTNCleanup.tsx` | TTN management | Yes |
| `/admin/data-maintenance` | `DataMaintenance.tsx` | Database maintenance | Yes |
| `/admin/health` | `HealthDashboard.tsx` | System health | Yes |
| `/account-deleted` | `AccountDeleted.tsx` | Deletion confirmation | No |
| `*` | `NotFound.tsx` | 404 handler | No |

---

## Public Pages

### Landing Page (`/`)

**File**: `src/pages/Index.tsx`

**Purpose**: Marketing landing page for unauthenticated users, redirects authenticated users to dashboard.

**Layout**:
- Hero section with value proposition
- Feature highlights
- Pricing information
- Call-to-action buttons

**State Machine**:
```
[Loading] → (check auth)
   ├─ authenticated → [Redirect to /dashboard]
   └─ unauthenticated → [Render Landing]
```

**API Calls**:
- `supabase.auth.getSession()` - Check authentication status

**Diagram Reference**: [Landing Page Diagram](#diagrams-page_diagrams#landing-page)

---

## Authentication Pages

### Auth Page (`/auth`)

**File**: `src/pages/Auth.tsx`

**Purpose**: User authentication (sign in and sign up).

**Layout**:
- Tabbed interface: Sign In / Sign Up
- Email/password form
- Social auth options (if configured)
- Password requirements display

**Preconditions**: User is not authenticated

**State Machine**:
```
[Idle] → (submit form)
   → [Submitting] → (success)
      ├─ sign in → [Redirect to /dashboard]
      └─ sign up → [Redirect to /onboarding]
   → [Error] → (retry) → [Idle]
```

**Data Dependencies**:
- None (creates new session)

**API Calls**:
- `supabase.auth.signInWithPassword()` - Sign in
- `supabase.auth.signUp()` - Sign up
- `supabase.functions.invoke('check-password-breach')` - Password validation

**Error States**:
- Invalid credentials
- Email already registered
- Password requirements not met
- Network error

**Files Involved**:
- `src/pages/Auth.tsx`
- `src/hooks/useAuthAndOnboarding.ts`
- `src/lib/validation.ts`

**Diagram Reference**: [Auth Page Diagram](#diagrams-page_diagrams#auth-page)

---

### Auth Callback (`/auth/callback`)

**File**: `src/pages/AuthCallback.tsx`

**Purpose**: Handle OAuth callback and magic link authentication.

**State Machine**:
```
[Processing] → (validate token)
   ├─ valid → [Redirect to /dashboard or /onboarding]
   └─ invalid → [Redirect to /auth with error]
```

---

## Core Application Pages

### Dashboard (`/dashboard`)

**File**: `src/pages/Dashboard.tsx`

**Purpose**: Main monitoring view showing all units across all sites with their status.

**Layout**:
| Section | Content |
|---------|---------|
| Header | Organization name, notification dropdown, theme toggle |
| Sidebar | Navigation links (Sites, Alerts, Reports, Settings) |
| Main | Unit cards grouped by site/area |
| Widgets | Low battery alerts, offline sensors |

**Preconditions**:
- User authenticated
- User belongs to an organization
- Organization has completed onboarding

**State Machine**:
```
[Loading] → (fetch data)
   ├─ success → [Ready]
   ├─ no org → [Redirect to /onboarding]
   └─ error → [Error State]

[Ready] → (unit status changes) → [Ready]
       → (refresh) → [Loading]
```

**Data Dependencies**:
| Data | Source | Query Key |
|------|--------|-----------|
| Organization | `organizations` | `['organization', orgId]` |
| Sites | `sites` | `['sites', { organizationId }]` |
| Areas | `areas` | `['areas', { siteId }]` |
| Units | `units` | `['units', { organizationId }]` |
| Active Alerts | `alerts` | `['alerts', { status: 'active' }]` |
| Sensors | `lora_sensors` | `['lora-sensors', { organizationId }]` |

**API Calls**:
- Supabase direct queries via TanStack Query
- Real-time subscriptions for unit status updates

**Actions**:
| Action | Description | Side Effects |
|--------|-------------|--------------|
| Navigate to unit | Click unit card | Route to `/units/:unitId` |
| Quick log temp | "Log Temp" button | Opens `LogTempModal` |
| Acknowledge alert | Click acknowledge | Updates alert status |

**Error States**:
- Failed to load organization
- Failed to load units
- No units configured

**Recovery**:
- Retry button for failed queries
- Link to Settings for configuration

**Files Involved**:
- `src/pages/Dashboard.tsx`
- `src/components/DashboardLayout.tsx`
- `src/components/dashboard/LowBatteryWidget.tsx`
- `src/hooks/useUnitStatus.ts`

**Diagram Reference**: [Dashboard Diagram](#diagrams-page_diagrams#dashboard)

---

### Organization Dashboard (`/organization`)

**File**: `src/pages/OrganizationDashboard.tsx`

**Purpose**: High-level organization overview with aggregated statistics.

**Layout**:
- Organization header with branding
- Summary statistics (total units, active alerts, compliance score)
- Site overview cards
- Quick actions

**Data Dependencies**:
- Organization details
- Site summaries
- Alert counts
- Compliance metrics

**Diagram Reference**: [Organization Dashboard Diagram](#diagrams-page_diagrams#organization-dashboard)

---

### Onboarding (`/onboarding`)

**File**: `src/pages/Onboarding.tsx`

**Purpose**: Guide new users through initial organization setup.

**Layout**:
- Step-by-step wizard
- Progress indicator
- Form sections for each step

**Steps**:
1. Organization details (name, slug)
2. First site creation
3. First area creation
4. First unit creation
5. Sensor setup (optional)

**State Machine**:
```
[Step 1: Org] → (submit) → [Step 2: Site]
                         → [Step 3: Area]
                         → [Step 4: Unit]
                         → [Step 5: Sensor]
                         → [Complete] → [Redirect to /dashboard]
```

**API Calls**:
- `create_organization_with_owner()` RPC
- `create_site_for_org()` RPC
- `create_area_for_site()` RPC
- `create_unit_for_area()` RPC

**Diagram Reference**: [Onboarding Diagram](#diagrams-page_diagrams#onboarding)

---

### Sites List (`/sites`)

**File**: `src/pages/Sites.tsx`

**Purpose**: List all sites in the organization.

**Layout**:
- Site cards with address and status summary
- Add site button
- Filter/search options

**Data Dependencies**:
- `sites` table
- Unit counts per site
- Alert counts per site

**Actions**:
- Navigate to site detail
- Create new site
- Edit site

**Diagram Reference**: [Sites Page Diagram](#diagrams-page_diagrams#sites)

---

### Site Detail (`/sites/:siteId`)

**File**: `src/pages/SiteDetail.tsx`

**Purpose**: Detailed view of a single site with its areas and units.

**URL Parameters**: `siteId` (UUID)

**Layout**:
| Section | Content |
|---------|---------|
| Header | Site name, address, breadcrumb |
| Areas List | Collapsible area sections |
| Units Grid | Unit cards within each area |
| Gateways | Site gateway status |
| Settings | Site-level configuration |

**Data Dependencies**:
- Site details
- Areas within site
- Units within areas
- Gateway status

**Actions**:
- Add area
- Add unit
- Configure site settings
- Manage gateways

**Files Involved**:
- `src/pages/SiteDetail.tsx`
- `src/components/site/SiteComplianceSettings.tsx`
- `src/components/site/SiteGatewaysCard.tsx`

**Diagram Reference**: [Site Detail Diagram](#diagrams-page_diagrams#site-detail)

---

### Area Detail (`/sites/:siteId/areas/:areaId`)

**File**: `src/pages/AreaDetail.tsx`

**Purpose**: Detailed view of a single area with its units.

**URL Parameters**: `siteId`, `areaId` (UUIDs)

**Layout**:
- Breadcrumb navigation
- Unit cards
- Area settings
- Add unit button

**Data Dependencies**:
- Area details
- Units in area
- Site (for breadcrumb)

**Diagram Reference**: [Area Detail Diagram](#diagrams-page_diagrams#area-detail)

---

### Unit Detail (`/units/:unitId`)

**File**: `src/pages/UnitDetail.tsx`

**Purpose**: Comprehensive view of a refrigeration unit with temperature history, alerts, and settings.

**URL Parameters**: `unitId` (UUID)

**Layout**:
| Section | Component |
|---------|-----------|
| Header | Unit name, status badge, breadcrumb |
| Current Status | Temperature, last reading time, status indicator |
| Alert Banner | Active alerts with acknowledge/resolve actions |
| Temperature Chart | Historical temperature graph |
| Sensors | Assigned sensors with battery/signal status |
| Settings | Temperature thresholds, manual log settings |
| History | Recent readings and events |

**Preconditions**:
- Unit exists and is accessible to user

**State Machine**:
```
[Loading] → (fetch)
   ├─ success → [Ready]
   │     ├─ has alerts → [Show Alert Banner]
   │     ├─ temp in range → [Normal Display]
   │     └─ temp out of range → [Warning Display]
   └─ not found → [404]

[Ready] → (new reading) → [Update Display]
       → (alert change) → [Update Banner]
       → (settings change) → [Refresh]
```

**Data Dependencies**:
| Data | Source | Query Key |
|------|--------|-----------|
| Unit | `units` | `['units', unitId]` |
| Sensors | `lora_sensors` | `['lora-sensors', { unitId }]` |
| Readings | `sensor_readings` | `['sensor-readings', { unitId }]` |
| Alerts | `alerts` | `['alerts', { unitId }]` |
| Alert Rules | `alert_rules` RPC | `['alert-rules', { unitId }]` |

**API Calls**:
- `get_effective_alert_rules()` RPC
- Direct table queries via Supabase

**Actions**:
| Action | Component | Side Effects |
|--------|-----------|--------------|
| Log temperature | `LogTempModal` | Insert to `manual_temperature_logs` |
| Acknowledge alert | `UnitAlertsBanner` | Update `alerts.acknowledged_at` |
| Change thresholds | `UnitSettingsSection` | Update `units` |
| Assign sensor | `AssignSensorToUnitDialog` | Update `lora_sensors.unit_id` |

**Error States**:
- Unit not found (404)
- Failed to load readings
- Failed to load alerts

**Files Involved**:
- `src/pages/UnitDetail.tsx`
- `src/components/unit/UnitAlertsBanner.tsx`
- `src/components/unit/UnitSensorsCard.tsx`
- `src/components/unit/BatteryHealthCard.tsx`
- `src/components/unit/DeviceReadinessCard.tsx`
- `src/components/unit/LastKnownGoodCard.tsx`
- `src/components/unit/UnitAlertThresholdsSection.tsx`
- `src/components/unit/UnitSettingsSection.tsx`
- `src/components/unit/AssignSensorToUnitDialog.tsx`
- `src/hooks/useUnitStatus.ts`
- `src/hooks/useUnitAlerts.ts`

**Diagram Reference**: [Unit Detail Diagram](#diagrams-page_diagrams#unit-detail)

---

### Manual Log (`/manual-log`)

**File**: `src/pages/ManualLog.tsx`

**Purpose**: Quick manual temperature logging interface with offline support.

**Layout**:
- Unit selector (hierarchical: Site → Area → Unit)
- Temperature input
- Notes field
- Submit button
- Offline indicator

**Preconditions**:
- User authenticated
- At least one unit exists

**State Machine**:
```
[Select Unit] → (unit selected) → [Enter Temperature]
                                → (submit) → [Submitting]
   ┌─ online ─┬─ success → [Success Toast] → [Select Unit]
   │          └─ error → [Error Toast] → [Enter Temperature]
   └─ offline → [Queue Locally] → [Success Toast] → [Select Unit]

[Offline Queue] → (online) → [Sync] → [Queue Empty]
```

**Data Dependencies**:
- Sites, areas, units (for selector)
- Offline queue (IndexedDB)

**API Calls**:
- Insert to `manual_temperature_logs`
- `src/lib/offlineStorage.ts` for offline queue

**Offline Behavior**:
- Logs stored in IndexedDB
- Automatic sync when connection restored
- Pending count indicator

**Files Involved**:
- `src/pages/ManualLog.tsx`
- `src/components/LogTempModal.tsx`
- `src/lib/offlineStorage.ts`
- `src/hooks/useOfflineSync.ts`

**Diagram Reference**: [Manual Log Diagram](#diagrams-page_diagrams#manual-log)

---

### Alerts (`/alerts`)

**File**: `src/pages/Alerts.tsx`

**Purpose**: Centralized alert management with filtering and bulk actions.

**Layout**:
| Section | Content |
|---------|---------|
| Filters | Status, severity, type, date range |
| Alert List | Sortable table with alert details |
| Detail Panel | Selected alert details |

**State Machine**:
```
[Loading] → (fetch) → [Ready]

[Ready] → (filter change) → [Filtering] → [Ready]
       → (select alert) → [Detail View]
       → (acknowledge) → [Updating] → [Ready]
       → (resolve) → [Updating] → [Ready]
```

**Data Dependencies**:
- `alerts` table with filters
- Related units, sites, areas

**Actions**:
| Action | Description |
|--------|-------------|
| Filter by status | Show active/acknowledged/resolved |
| Filter by severity | Show warning/critical |
| Acknowledge | Mark alert as seen |
| Resolve | Close alert |
| View unit | Navigate to unit detail |

**Files Involved**:
- `src/pages/Alerts.tsx`
- `src/components/alerts/AlertRow.tsx`
- `src/lib/alertConfig.ts`

**Diagram Reference**: [Alerts Page Diagram](#diagrams-page_diagrams#alerts)

---

### Reports (`/reports`)

**File**: `src/pages/Reports.tsx`

**Purpose**: Generate and export compliance reports.

**Layout**:
- Report type selector
- Date range picker
- Unit/site filter
- Generate button
- Report preview
- Export options (PDF, CSV)

**Report Types**:
| Report | Description |
|--------|-------------|
| Temperature Log | All readings for period |
| Excursion Report | All temperature excursions |
| Compliance Summary | HACCP compliance metrics |
| Corrective Actions | Actions taken for violations |

**Data Dependencies**:
- `sensor_readings`
- `manual_temperature_logs`
- `alerts`
- `corrective_actions`

**API Calls**:
- `export-temperature-logs` edge function

**Files Involved**:
- `src/pages/Reports.tsx`
- `src/components/reports/ComplianceReportCard.tsx`

**Diagram Reference**: [Reports Page Diagram](#diagrams-page_diagrams#reports)

---

### Settings (`/settings`)

**File**: `src/pages/Settings.tsx`

**Purpose**: Multi-tab settings interface for organization configuration.

**Layout**: Tabbed interface with the following tabs:

#### General Tab
- Organization name and branding
- Timezone settings
- Compliance mode selection

#### Alert Rules Tab
- Default temperature thresholds
- Offline detection settings
- Manual log requirements

**Component**: `AlertRulesEditor.tsx`, `AlertRulesScopedEditor.tsx`

#### Notification Policies Tab
- Per-alert-type notification configuration
- Escalation timing settings
- Quiet hours

**Component**: `NotificationPolicyEditor.tsx`, `AlertTypePolicyCard.tsx`

#### Sensors Tab
- LoRa sensor inventory
- Add/edit/remove sensors
- Provisioning status

**Component**: `SensorManager.tsx`, `AddSensorDialog.tsx`, `EditSensorDialog.tsx`

#### Gateways Tab
- LoRa gateway inventory
- Add/edit/remove gateways
- Connection status

**Component**: `GatewayManager.tsx`, `AddGatewayDialog.tsx`, `EditGatewayDialog.tsx`

#### TTN Connection Tab
- TTN credentials
- Webhook configuration
- Provisioning logs

**Component**: `TTNConnectionSettings.tsx`, `TTNCredentialsPanel.tsx`, `TTNProvisioningLogs.tsx`

#### Billing Tab
- Current plan
- Usage metrics
- Invoice history
- Upgrade/downgrade

**Component**: `BillingTab.tsx`, `PlanCard.tsx`, `InvoiceHistory.tsx`

#### Account Tab
- User profile
- Password change
- Account deletion

**State Machine**:
```
[Loading] → (fetch settings) → [Ready]

[Ready] → (change setting) → [Saving] → [Ready]
       → (error) → [Error Toast] → [Ready]
       → (switch tab) → [Ready]
```

**Files Involved**:
- `src/pages/Settings.tsx`
- `src/components/settings/*.tsx` (20+ components)
- `src/hooks/useAlertRules.ts`
- `src/hooks/useNotificationPolicies.ts`
- `src/hooks/useLoraSensors.ts`
- `src/hooks/useGateways.ts`

**Diagram Reference**: [Settings Page Diagram](#diagrams-page_diagrams#settings)

---

### Event History (`/events`)

**File**: `src/pages/EventHistory.tsx`

**Purpose**: Audit trail viewer for all system events.

**Layout**:
- Filterable event list
- Event type icons
- Timestamp display
- Event details expandable

**Data Dependencies**:
- `event_logs` table

**Filters**:
- Event type (alert, temperature, configuration, user)
- Severity (info, warning, error)
- Date range
- Actor (user, system)

**Diagram Reference**: [Event History Diagram](#diagrams-page_diagrams#event-history)

---

## Admin Pages

### Health Dashboard (`/admin/health`)

**File**: `src/pages/HealthDashboard.tsx`

**Purpose**: System health monitoring and diagnostics.

**Layout**:
| Section | Content |
|---------|---------|
| Overall Status | Aggregate health indicator |
| Edge Functions | Per-function health checks |
| Database | Connection status |
| TTN | Webhook status |

**Components**:
- `HealthCheckList.tsx`
- `HealthStatusBadge.tsx`
- `HealthStatusCard.tsx`
- `OverallHealthSummary.tsx`

**API Calls**:
- `health-check` edge function
- Database connectivity check

**Diagram Reference**: [Health Dashboard Diagram](#diagrams-page_diagrams#health-dashboard)

---

### TTN Cleanup (`/admin/ttn-cleanup`)

**File**: `src/pages/TTNCleanup.tsx`

**Purpose**: Manage TTN device cleanup and deprovisioning.

**Actions**:
- View pending cleanup jobs
- Trigger manual cleanup
- View cleanup history

---

### Data Maintenance (`/admin/data-maintenance`)

**File**: `src/pages/DataMaintenance.tsx`

**Purpose**: Database maintenance operations.

**Actions**:
- Find orphan organizations
- Cleanup old data
- Repair data integrity

---

### Recently Deleted (`/admin/recently-deleted`)

**File**: `src/pages/RecentlyDeleted.tsx`

**Purpose**: View and restore soft-deleted items.

**Layout**:
- List of deleted items by type
- Restore button
- Permanent delete option

---

### Inspector (`/inspector`)

**File**: `src/pages/Inspector.tsx`

**Purpose**: Debug tool for examining organization data.

**Features**:
- View raw database records
- Examine sensor states
- Check TTN configuration
- Debug alerts

---

### Pilot Setup (`/pilot-setup`)

**File**: `src/pages/PilotSetup.tsx`

**Purpose**: Configuration interface for pilot program participants.

---

## Utility Pages

### Account Deleted (`/account-deleted`)

**File**: `src/pages/AccountDeleted.tsx`

**Purpose**: Confirmation page shown after account deletion.

**Layout**:
- Confirmation message
- Link to sign up again

---

### Not Found (`*`)

**File**: `src/pages/NotFound.tsx`

**Purpose**: 404 error page for unknown routes.

**Layout**:
- Error message
- Link to dashboard/home

---

## Page Diagrams Reference

All page-specific diagrams are located in [PAGE_DIAGRAMS.md](#diagrams-page_diagrams).

| Page | Diagram Section |
|------|-----------------|
| Dashboard | [#dashboard](#diagrams-page_diagrams#dashboard) |
| Unit Detail | [#unit-detail](#diagrams-page_diagrams#unit-detail) |
| Alerts | [#alerts](#diagrams-page_diagrams#alerts) |
| Settings | [#settings](#diagrams-page_diagrams#settings) |
| Manual Log | [#manual-log](#diagrams-page_diagrams#manual-log) |
| Reports | [#reports](#diagrams-page_diagrams#reports) |
| Auth | [#auth-page](#diagrams-page_diagrams#auth-page) |


---

\newpage

<a id="product-user_flows"></a>

# FreshTrack Pro User Flows

> End-to-end user journey documentation for major workflows

---

## Table of Contents

1. [Authentication Flows](#authentication-flows)
2. [Setup & Onboarding Flows](#setup--onboarding-flows)
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

**Sequence Diagram**: [See SEQUENCES.md#user-registration](#diagrams-sequences#user-registration)

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

**Sequence Diagram**: [See SEQUENCES.md#user-sign-in](#diagrams-sequences#user-sign-in)

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

**Sequence Diagram**: [See SEQUENCES.md#ttn-setup-flow](#diagrams-sequences#ttn-setup-flow)

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

**Sequence Diagram**: [See SEQUENCES.md#add-unit](#diagrams-sequences#add-unit)

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

**Sequence Diagram**: [See SEQUENCES.md#temperature-reading-flow](#diagrams-sequences#temperature-reading-flow)

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

**Sequence Diagram**: [See SEQUENCES.md#manual-logging-flow](#diagrams-sequences#manual-logging-flow)

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

**Sequence Diagram**: [See SEQUENCES.md#dashboard-monitoring](#diagrams-sequences#dashboard-monitoring)

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

**Sequence Diagram**: [See SEQUENCES.md#alert-acknowledgment](#diagrams-sequences#alert-acknowledgment)

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

**Sequence Diagram**: [See SEQUENCES.md#excursion-detection](#diagrams-sequences#excursion-detection)

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

**Sequence Diagram**: [See SEQUENCES.md#alert-escalation](#diagrams-sequences#alert-escalation)

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

**Sequence Diagram**: [See SEQUENCES.md#configure-thresholds](#diagrams-sequences#configure-thresholds)

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

**Sequence Diagram**: [See SEQUENCES.md#configure-notifications](#diagrams-sequences#configure-notifications)

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

**Sequence Diagram**: [See SEQUENCES.md#generate-report](#diagrams-sequences#generate-report)

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

**Sequence Diagram**: [See SEQUENCES.md#corrective-action](#diagrams-sequences#corrective-action)

---

## Flow Diagrams Reference

All sequence diagrams are located in [SEQUENCES.md](#diagrams-sequences).

| Flow | Diagram Section |
|------|-----------------|
| User Registration | [#user-registration](#diagrams-sequences#user-registration) |
| User Sign In | [#user-sign-in](#diagrams-sequences#user-sign-in) |
| TTN Setup | [#ttn-setup-flow](#diagrams-sequences#ttn-setup-flow) |
| Temperature Reading | [#temperature-reading-flow](#diagrams-sequences#temperature-reading-flow) |
| Manual Logging | [#manual-logging-flow](#diagrams-sequences#manual-logging-flow) |
| Alert Acknowledgment | [#alert-acknowledgment](#diagrams-sequences#alert-acknowledgment) |
| Excursion Detection | [#excursion-detection](#diagrams-sequences#excursion-detection) |
| Alert Escalation | [#alert-escalation](#diagrams-sequences#alert-escalation) |


---

\newpage

<a id="engineering-api"></a>

# FreshTrack Pro API Documentation

> Complete documentation for all Edge Functions and RPC endpoints

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Data Ingestion Functions](#data-ingestion-functions)
4. [Alert Processing Functions](#alert-processing-functions)
5. [TTN Management Functions](#ttn-management-functions)
6. [User & Data Management Functions](#user--data-management-functions)
7. [Billing Functions](#billing-functions)
8. [Utility Functions](#utility-functions)
9. [Database RPC Functions](#database-rpc-functions)
10. [Error Handling](#error-handling)

---

## Overview

### Function Location

All edge functions are located in `supabase/functions/` with shared utilities in `supabase/functions/_shared/`.

### Base URL

```
https://<project-id>.supabase.co/functions/v1/<function-name>
```

### Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Varies | `Bearer <JWT>` for user-authenticated requests |
| `Content-Type` | Yes | `application/json` |
| `X-Internal-API-Key` | Some | Internal API key for scheduled/internal calls |
| `X-Webhook-Secret` | Some | Per-org webhook secret for TTN/Stripe |

---

## Authentication

### Authentication Methods

| Method | Used By | How |
|--------|---------|-----|
| JWT (Supabase Auth) | User-facing endpoints | `Authorization: Bearer <token>` |
| Internal API Key | Scheduled functions | `X-Internal-API-Key: <key>` |
| Webhook Secret | External webhooks | `X-Webhook-Secret: <secret>` |
| Service Role | Internal calls | Auto-injected by Supabase |

### JWT Authentication

```typescript
// Frontend: Token added automatically by Supabase client
const { data } = await supabase.functions.invoke('function-name', {
  body: { /* payload */ }
});
```

### Internal API Key Validation

```typescript
// Edge function validation
import { validateInternalApiKey, unauthorizedResponse } from "../_shared/validation.ts";

const apiKeyResult = validateInternalApiKey(req);
if (!apiKeyResult.valid) {
  return unauthorizedResponse(apiKeyResult.error, corsHeaders);
}
```

---

## Data Ingestion Functions

### `ttn-webhook`

**Purpose**: Receive sensor uplink messages from The Things Network

**File**: `supabase/functions/ttn-webhook/index.ts`

**Method**: `POST`

**Authentication**: Per-organization webhook secret (`X-Webhook-Secret`)

**Request Body** (TTN Uplink Format):
```json
{
  "end_device_ids": {
    "device_id": "sensor-001",
    "application_ids": { "application_id": "freshtrack-org-abc" },
    "dev_eui": "0004A30B001C1234"
  },
  "uplink_message": {
    "decoded_payload": {
      "temperature": 38.5,
      "humidity": 65,
      "battery": 98,
      "door_open": false
    },
    "rx_metadata": [{
      "gateway_ids": { "gateway_id": "gw-001" },
      "rssi": -75,
      "snr": 8.5
    }],
    "received_at": "2026-01-12T10:30:00Z"
  }
}
```

**Response**:
```json
{
  "success": true,
  "sensor_id": "uuid",
  "reading_id": "uuid",
  "temperature": 38.5,
  "unit_id": "uuid"
}
```

**Status Codes**:
| Code | Meaning |
|------|---------|
| 200 | Successfully processed |
| 202 | Accepted but not processed (unknown device) |
| 401 | Invalid webhook secret |

**Notes**:
- Returns 202 for unknown devices to prevent TTN retries
- Validates webhook secret via `lookupOrgByWebhookSecret()`
- Triggers `process-unit-states` after successful ingestion

---

### `ingest-readings`

**Purpose**: Vendor-agnostic sensor data ingestion endpoint

**File**: `supabase/functions/ingest-readings/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

**Request Body**:
```json
{
  "unit_id": "uuid",
  "temperature": 38.5,
  "humidity": 65,
  "source": "sensor",
  "recorded_at": "2026-01-12T10:30:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "reading_id": "uuid"
}
```

---

### `sensor-simulator`

**Purpose**: Generate simulated sensor data for testing

**File**: `supabase/functions/sensor-simulator/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

**Request Body**:
```json
{
  "organization_id": "uuid",
  "unit_id": "uuid",
  "temperature_range": { "min": 35, "max": 40 },
  "interval_seconds": 300
}
```

---

## Alert Processing Functions

### `process-unit-states`

**Purpose**: SINGLE SOURCE OF TRUTH for alert creation and resolution

**File**: `supabase/functions/process-unit-states/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key (`X-Internal-API-Key`)

**Request Body**: None (processes all active units)

**Response**:
```json
{
  "success": true,
  "stateChanges": 5,
  "newAlerts": 2,
  "changes": [
    {
      "unitId": "uuid",
      "from": "ok",
      "to": "excursion",
      "reason": "Temperature 45°F above limit"
    }
  ]
}
```

**Processing Logic**:
1. Fetches all active units
2. Computes missed check-ins
3. Evaluates temperature thresholds
4. Creates/resolves alerts
5. Updates unit status
6. Logs state changes to `event_logs`
7. Triggers `process-escalations` for new alerts

**Alert Types Created**:
- `temp_excursion` - Temperature out of range
- `monitoring_interrupted` - Sensor offline
- `suspected_cooling_failure` - Door closed but temp not recovering

---

### `process-escalations`

**Purpose**: SINGLE SOURCE OF TRUTH for notification dispatch

**File**: `supabase/functions/process-escalations/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

**Request Body**:
```json
{
  "alert_ids": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "success": true,
  "notifications_sent": 3
}
```

**Processing Logic**:
1. Looks up effective notification policy
2. Determines notification channels (email, SMS, push)
3. Sends notifications via appropriate service
4. Records delivery in `notification_events`
5. Updates alert `last_notified_at`

---

## TTN Management Functions

### `ttn-bootstrap`

**Purpose**: Auto-configure TTN webhook for organization

**File**: `supabase/functions/ttn-bootstrap/index.ts`

**Method**: `POST`

**Authentication**: JWT (user authenticated)

**Request Body**:
```json
{
  "organization_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "webhook_id": "freshtrack-webhook-abc"
}
```

---

### `ttn-provision-device`

**Purpose**: Register sensor in TTN

**File**: `supabase/functions/ttn-provision-device/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "sensor_id": "uuid",
  "dev_eui": "0004A30B001C1234",
  "join_eui": "0000000000000000",
  "app_key": "ABC123..."
}
```

**Response**:
```json
{
  "success": true,
  "ttn_device_id": "dev-abc123"
}
```

---

### `ttn-provision-gateway`

**Purpose**: Register gateway in TTN

**File**: `supabase/functions/ttn-provision-gateway/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "gateway_id": "uuid",
  "eui": "B827EBFFFE123456",
  "name": "Warehouse Gateway",
  "frequency_plan": "US_902_928"
}
```

---

### `ttn-gateway-preflight`

**Purpose**: Validate TTN API key permissions before gateway operations

**File**: `supabase/functions/ttn-gateway-preflight/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "organization_id": "uuid",
  "api_key": "NNSXS.xxxxx..."
}
```

**Response**:
```json
{
  "valid": true,
  "permissions": {
    "can_write_gateways": true,
    "can_write_devices": true
  }
}
```

---

### `ttn-list-devices`

**Purpose**: List devices from TTN application

**File**: `supabase/functions/ttn-list-devices/index.ts`

**Method**: `GET`

**Authentication**: JWT

**Query Parameters**:
- `organization_id` (required)

**Response**:
```json
{
  "devices": [
    {
      "device_id": "sensor-001",
      "dev_eui": "0004A30B001C1234",
      "name": "Walk-in Cooler Sensor"
    }
  ]
}
```

---

### `ttn-manage-application`

**Purpose**: Create or update TTN application

**File**: `supabase/functions/ttn-manage-application/index.ts`

**Method**: `POST`

**Authentication**: JWT

---

### `ttn-provision-org`

**Purpose**: Provision organization in TTN

**File**: `supabase/functions/ttn-provision-org/index.ts`

**Method**: `POST`

**Authentication**: JWT

---

### `ttn-provision-worker`

**Purpose**: Background worker for processing provisioning queue

**File**: `supabase/functions/ttn-provision-worker/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

**Trigger**: Scheduled (cron) or manual

---

### `ttn-deprovision-worker`

**Purpose**: Background worker for device deprovisioning

**File**: `supabase/functions/ttn-deprovision-worker/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

---

### `update-ttn-webhook`

**Purpose**: Update TTN webhook configuration

**File**: `supabase/functions/update-ttn-webhook/index.ts`

**Method**: `POST`

**Authentication**: JWT

---

### `manage-ttn-settings`

**Purpose**: CRUD operations for TTN settings

**File**: `supabase/functions/manage-ttn-settings/index.ts`

**Method**: `POST`

**Authentication**: JWT

---

### `sync-ttn-settings`

**Purpose**: Sync TTN settings from emulator

**File**: `supabase/functions/sync-ttn-settings/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

---

### `org-state-api`

**Purpose**: Pull-based API for organization TTN state

**File**: `supabase/functions/org-state-api/index.ts`

**Method**: `GET`

**Authentication**: API Key

---

### `fetch-org-state`

**Purpose**: Fetch current organization TTN state

**File**: `supabase/functions/fetch-org-state/index.ts`

**Method**: `GET`

**Authentication**: JWT

---

## User & Data Management Functions

### `user-sync-emitter`

**Purpose**: Emit user sync events (triggered by database)

**File**: `supabase/functions/user-sync-emitter/index.ts`

**Method**: `POST`

**Authentication**: Service Role (database trigger)

---

### `cleanup-user-sensors`

**Purpose**: Clean up sensor data when user is removed

**File**: `supabase/functions/cleanup-user-sensors/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

---

### `update-sensor-assignment`

**Purpose**: Assign/unassign sensor to unit

**File**: `supabase/functions/update-sensor-assignment/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "sensor_id": "uuid",
  "unit_id": "uuid",
  "is_primary": true
}
```

---

### `account-deletion-jobs`

**Purpose**: Process account deletion requests (GDPR compliance)

**File**: `supabase/functions/account-deletion-jobs/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

---

### `export-temperature-logs`

**Purpose**: Export compliance data for reporting

**File**: `supabase/functions/export-temperature-logs/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "organization_id": "uuid",
  "start_date": "2026-01-01",
  "end_date": "2026-01-31",
  "unit_ids": ["uuid1", "uuid2"],
  "format": "csv"
}
```

**Response**: CSV or JSON data

---

### `check-password-breach`

**Purpose**: Check password against breach databases

**File**: `supabase/functions/check-password-breach/index.ts`

**Method**: `POST`

**Authentication**: None (public)

**Request Body**:
```json
{
  "password": "user_password"
}
```

**Response**:
```json
{
  "breached": false
}
```

---

### `check-slug-available`

**Purpose**: Check if organization slug is available

**File**: `supabase/functions/check-slug-available/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "slug": "my-restaurant"
}
```

**Response**:
```json
{
  "available": true
}
```

---

## Billing Functions

### `stripe-checkout`

**Purpose**: Create Stripe checkout session

**File**: `supabase/functions/stripe-checkout/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Request Body**:
```json
{
  "plan_id": "pro",
  "organization_id": "uuid"
}
```

**Response**:
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

---

### `stripe-portal`

**Purpose**: Create Stripe customer portal session

**File**: `supabase/functions/stripe-portal/index.ts`

**Method**: `POST`

**Authentication**: JWT

**Response**:
```json
{
  "portal_url": "https://billing.stripe.com/..."
}
```

---

### `stripe-webhook`

**Purpose**: Handle Stripe webhook events

**File**: `supabase/functions/stripe-webhook/index.ts`

**Method**: `POST`

**Authentication**: Stripe webhook signature

**Events Handled**:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## Utility Functions

### `health-check`

**Purpose**: System health monitoring

**File**: `supabase/functions/health-check/index.ts`

**Method**: `GET`

**Authentication**: None (public)

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-12T10:30:00Z",
  "checks": {
    "database": "ok",
    "ttn_webhook": "ok"
  }
}
```

---

### `send-sms-alert`

**Purpose**: Send SMS via Twilio

**File**: `supabase/functions/send-sms-alert/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

**Request Body**:
```json
{
  "to": "+15551234567",
  "message": "Alert: Walk-in Cooler temperature at 48°F"
}
```

---

### `run-simulator-heartbeats`

**Purpose**: Generate simulated device heartbeats

**File**: `supabase/functions/run-simulator-heartbeats/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

---

### `emulator-sync`

**Purpose**: Sync with external emulator

**File**: `supabase/functions/emulator-sync/index.ts`

**Method**: `POST`

**Authentication**: Internal API Key

---

## Database RPC Functions

### `get_effective_alert_rules`

**Purpose**: Resolve cascaded alert rules for a unit

**Signature**:
```sql
get_effective_alert_rules(p_unit_id UUID) RETURNS JSON
```

**Usage**:
```typescript
const { data } = await supabase.rpc('get_effective_alert_rules', {
  p_unit_id: unitId
});
```

**Returns**: Merged alert rules with cascade priority (Unit > Site > Org)

---

### `get_effective_notification_policy`

**Purpose**: Resolve cascaded notification policy

**Signature**:
```sql
get_effective_notification_policy(
  p_unit_id UUID,
  p_alert_type TEXT
) RETURNS JSON
```

---

### `create_organization_with_owner`

**Purpose**: Create organization and assign owner role atomically

**Signature**:
```sql
create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_owner_id UUID
) RETURNS UUID
```

---

### `user_belongs_to_org`

**Purpose**: Check if user belongs to organization

**Signature**:
```sql
user_belongs_to_org(p_user_id UUID, p_org_id UUID) RETURNS BOOLEAN
```

---

### `has_role`

**Purpose**: Check if user has specific role in organization

**Signature**:
```sql
has_role(p_user_id UUID, p_role TEXT, p_org_id UUID) RETURNS BOOLEAN
```

---

### `create_site_for_org`

**Purpose**: Create site with proper hierarchy

**Signature**:
```sql
create_site_for_org(
  p_org_id UUID,
  p_name TEXT,
  p_address TEXT
) RETURNS UUID
```

---

### `create_area_for_site`

**Purpose**: Create area within site

**Signature**:
```sql
create_area_for_site(
  p_site_id UUID,
  p_name TEXT
) RETURNS UUID
```

---

### `create_unit_for_area`

**Purpose**: Create unit within area

**Signature**:
```sql
create_unit_for_area(
  p_area_id UUID,
  p_name TEXT,
  p_temp_limit_high NUMERIC,
  p_temp_limit_low NUMERIC
) RETURNS UUID
```

---

### `enqueue_deprovision_jobs_for_unit`

**Purpose**: Queue TTN deprovisioning when unit is deleted

**Signature**:
```sql
enqueue_deprovision_jobs_for_unit(p_unit_id UUID) RETURNS VOID
```

---

### `soft_delete_organization`

**Purpose**: Soft delete organization and cascade

**Signature**:
```sql
soft_delete_organization(p_org_id UUID) RETURNS VOID
```

---

### `find_orphan_organizations`

**Purpose**: Find organizations without owners

**Signature**:
```sql
find_orphan_organizations() RETURNS TABLE(id UUID, name TEXT)
```

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Retry Behavior

| Scenario | Retry |
|----------|-------|
| Network error | Yes, with exponential backoff |
| 5xx error | Yes, up to 3 times |
| 4xx error | No (fix request) |
| Timeout | Yes, once |

---

## Related Documentation

- [INTEGRATIONS.md](#integrations) - Third-party service configuration
- [DATA_MODEL.md](#data_model) - Database schema
- [FLOWCHARTS.md](#charts-flowcharts) - Visual process flows


---

\newpage

<a id="engineering-data_model"></a>

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

See [ER_DIAGRAM.md](#charts-er_diagram) for visual diagram.

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
| `twilio_sid` | TEXT | Twilio message SID |
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

- [ER_DIAGRAM.md](#charts-er_diagram) - Visual entity-relationship diagram
- [API.md](#api) - RPC function documentation
- [ARCHITECTURE.md](#architecture-architecture) - Database architecture


---

\newpage

<a id="engineering-integrations"></a>

# FreshTrack Pro Integrations

> Third-party service integration documentation

---

## Table of Contents

1. [The Things Network (TTN)](#the-things-network-ttn)
2. [Stripe](#stripe)
3. [Twilio](#twilio)
4. [Supabase Auth](#supabase-auth)
5. [Environment Variables](#environment-variables)

---

## The Things Network (TTN)

### Overview

The Things Network provides LoRaWAN infrastructure for sensor connectivity. FreshTrack Pro integrates with TTN for:
- Device registration and provisioning
- Webhook-based data ingestion
- Gateway management

### Architecture

```
┌─────────────┐     LoRa      ┌─────────────┐     HTTPS     ┌─────────────┐
│   Sensor    │ ─────────────▶│   Gateway   │ ─────────────▶│     TTN     │
└─────────────┘               └─────────────┘               └─────────────┘
                                                                   │
                                                              Webhook
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │ ttn-webhook │
                                                            └─────────────┘
```

### Per-Organization Model

Each organization has its own:
- TTN Application
- API Key
- Webhook Secret

Stored in `ttn_connections` table with:
- Encrypted API key
- Hashed webhook secret

### Setup Process

#### 1. Prerequisites

- TTN account at [console.thethingsnetwork.org](https://console.thethingsnetwork.org/)
- TTN Application created
- API Key with required permissions

#### 2. Required API Key Permissions

The TTN API key must have:

| Permission | Purpose |
|------------|---------|
| `applications:read` | Read application info |
| `applications:write` | Update application |
| `devices:read` | List devices |
| `devices:write` | Create/update devices |
| `gateways:read` | List gateways |
| `gateways:write` | Create/update gateways (if managing gateways) |

#### 3. Configuration Steps

1. **In FreshTrack Pro Settings → TTN Tab**:
   - Enter TTN Application ID
   - Enter TTN API Key
   - Click "Validate & Connect"

2. **System automatically**:
   - Validates API key permissions (`ttn-gateway-preflight`)
   - Configures webhook in TTN (`ttn-bootstrap`)
   - Stores encrypted credentials

3. **Verify webhook**:
   - TTN Application → Webhooks → Should show `freshtrack-webhook`

### Webhook Configuration

**Endpoint**: `https://<project>.supabase.co/functions/v1/ttn-webhook`

**Headers**:
| Header | Value |
|--------|-------|
| `X-Webhook-Secret` | Per-org secret from `ttn_connections.webhook_secret` |
| `Content-Type` | `application/json` |

**Enabled Messages**:
- Uplink message
- Join accept (optional)

### Device Provisioning

#### Add Sensor Flow

1. User enters DevEUI, JoinEUI, AppKey
2. System queues job in `ttn_provisioning_queue`
3. `ttn-provision-device` registers in TTN
4. Sensor status changes: `pending` → `joining` → `active`

#### DevEUI Formats Supported

The system normalizes DevEUI to lowercase hex without separators:

| Input Format | Normalized |
|--------------|------------|
| `0004A30B001C1234` | `0004a30b001c1234` |
| `00:04:A3:0B:00:1C:12:34` | `0004a30b001c1234` |
| `00-04-A3-0B-00-1C-12-34` | `0004a30b001c1234` |
| `00 04 A3 0B 00 1C 12 34` | `0004a30b001c1234` |

### TTN Cluster

Default cluster: `eu1` (Europe)

Configure via `ttn_connections.cluster`:
- `eu1` - Europe (default)
- `nam1` - North America
- `au1` - Australia

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook not receiving data | Secret mismatch | Regenerate secret, update TTN |
| Device stuck in "joining" | Wrong AppKey | Verify AppKey matches TTN |
| 401 from TTN API | Invalid API key | Generate new key with correct permissions |
| Sensor not in dashboard | DevEUI mismatch | Check DevEUI format/normalization |

### Related Files

- `supabase/functions/ttn-webhook/index.ts`
- `supabase/functions/ttn-bootstrap/index.ts`
- `supabase/functions/ttn-provision-device/index.ts`
- `supabase/functions/_shared/ttnConfig.ts`
- `supabase/functions/_shared/ttnPermissions.ts`
- `src/components/settings/TTNConnectionSettings.tsx`
- `src/types/ttn.ts`

---

## Stripe

### Overview

Stripe handles subscription billing with:
- Checkout sessions for new subscriptions
- Customer portal for management
- Webhook for event processing

### Subscription Plans

| Plan | Price ID | Monthly | Sensors | Features |
|------|----------|---------|---------|----------|
| Starter | `price_starter` | $29 | 5 | Basic monitoring |
| Pro | `price_pro` | $79 | 25 | + SMS alerts |
| HACCP | `price_haccp` | $199 | 100 | + Compliance reports |
| Enterprise | Custom | Custom | Unlimited | Custom features |

### Integration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant S as stripe-checkout
    participant ST as Stripe
    participant W as stripe-webhook
    participant D as Database

    U->>F: Click "Upgrade"
    F->>S: Create checkout session
    S->>ST: Create session
    ST-->>S: Session URL
    S-->>F: Redirect URL
    F->>ST: Redirect to Stripe
    U->>ST: Complete payment
    ST->>W: Webhook: checkout.session.completed
    W->>D: Create subscription record
    ST-->>U: Redirect to success URL
```

### Webhook Events

| Event | Handler Action |
|-------|----------------|
| `checkout.session.completed` | Create subscription, update org |
| `customer.subscription.created` | Log subscription start |
| `customer.subscription.updated` | Update plan, sensor limit |
| `customer.subscription.deleted` | Downgrade to free tier |
| `invoice.paid` | Record invoice |
| `invoice.payment_failed` | Send payment failure notification |

### Setup

#### 1. Stripe Dashboard

1. Create product and prices for each plan
2. Configure webhook endpoint
3. Set up customer portal

#### 2. Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx (frontend)
```

#### 3. Webhook URL

`https://<project>.supabase.co/functions/v1/stripe-webhook`

### Related Files

- `supabase/functions/stripe-checkout/index.ts`
- `supabase/functions/stripe-portal/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `src/components/billing/BillingTab.tsx`
- `src/lib/stripe.ts`

---

## Twilio

### Overview

Twilio provides SMS delivery for critical alerts.

### Integration

SMS sent via `process-escalations` → `send-sms-alert`

### Phone Number Format

All phone numbers must be in E.164 format:
- `+15551234567` (US)
- `+447911123456` (UK)

Validation in `src/lib/validation.ts`:
```typescript
const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/);
```

### Message Format

```
FreshTrack Alert: [Unit Name]
Temperature at [XX]°F - exceeds [High/Low] limit of [XX]°F
Acknowledge: [Link]
```

### Rate Limiting

- Max 1 SMS per alert per contact per hour
- Escalation respects quiet hours

### Setup

#### Environment Variables

```env
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+15551234567
```

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| SMS not delivered | Invalid phone format | Ensure E.164 format |
| Delivery failed | Twilio account issue | Check Twilio console |
| Rate limited | Too many SMS | Check escalation policy |

### Related Files

- `supabase/functions/send-sms-alert/index.ts`
- `supabase/functions/process-escalations/index.ts`
- `src/components/settings/SmsAlertHistory.tsx`

---

## Supabase Auth

### Overview

Supabase Auth provides:
- Email/password authentication
- Session management with JWT
- Password reset flow
- OAuth providers (if configured)

### Authentication Flow

1. User submits credentials
2. Supabase validates and returns JWT
3. JWT stored in localStorage
4. JWT included in all API requests
5. Auto-refresh before expiration

### Password Requirements

| Requirement | Validation |
|-------------|------------|
| Minimum length | 8 characters |
| Uppercase | At least 1 |
| Lowercase | At least 1 |
| Number | At least 1 |
| Special character | At least 1 |
| Breach check | `check-password-breach` function |

### Session Configuration

- Access token expiry: 1 hour
- Refresh token expiry: 7 days
- Auto-refresh: Enabled

### Profile Creation

Database trigger creates `profiles` record on user signup:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Related Files

- `src/pages/Auth.tsx`
- `src/pages/AuthCallback.tsx`
- `src/hooks/useAuthAndOnboarding.ts`
- `src/integrations/supabase/client.ts`

---

## Environment Variables

### Required for Production

| Variable | Service | Location |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase | Frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase | Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Edge Functions (auto) |
| `INTERNAL_API_KEY` | Internal | Edge Functions |
| `STRIPE_SECRET_KEY` | Stripe | Edge Functions |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Edge Functions |
| `TWILIO_ACCOUNT_SID` | Twilio | Edge Functions |
| `TWILIO_AUTH_TOKEN` | Twilio | Edge Functions |
| `TWILIO_PHONE_NUMBER` | Twilio | Edge Functions |

### Per-Organization (Database)

| Variable | Table | Column |
|----------|-------|--------|
| TTN API Key | `ttn_connections` | `api_key` (encrypted) |
| TTN Webhook Secret | `ttn_connections` | `webhook_secret` (hashed) |
| TTN Application ID | `ttn_connections` | `application_id` |

### Setting Supabase Secrets

```bash
# Via Supabase CLI
supabase secrets set INTERNAL_API_KEY=xxx
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
supabase secrets set TWILIO_AUTH_TOKEN=xxx

# List secrets
supabase secrets list
```

### Verification Steps

1. **TTN**: Check Settings → TTN tab for "Connected" status
2. **Stripe**: Check Settings → Billing tab loads plans
3. **Twilio**: Check SMS delivery in Settings → Notification History
4. **Auth**: Verify login/logout works

---

## TBD Items

| Integration | TBD | File to Verify |
|-------------|-----|----------------|
| TTN | Cluster configuration options | `supabase/functions/_shared/ttnConfig.ts` |
| Stripe | Enterprise plan setup | `src/lib/stripe.ts` |
| Twilio | Rate limit configuration | `supabase/functions/process-escalations/index.ts` |


---

\newpage

<a id="engineering-observability"></a>

# FreshTrack Pro Observability

> Logging, monitoring, debugging, and incident response documentation

---

## Table of Contents

1. [Logging Strategy](#logging-strategy)
2. [Error Handling](#error-handling)
3. [Debugging Workflows](#debugging-workflows)
4. [Health Monitoring](#health-monitoring)
5. [Known Failure Scenarios](#known-failure-scenarios)
6. [Incident Playbooks](#incident-playbooks)
7. [Audit Trail](#audit-trail)

---

## Logging Strategy

### Frontend Logging

#### Debug Logger

**File**: `src/lib/debugLogger.ts`

```typescript
// Enable debug mode
localStorage.setItem('debug', 'true');

// Usage
debugLog('Component', 'Action description', { data });
```

#### Console Patterns

| Level | Usage |
|-------|-------|
| `console.log` | General information |
| `console.warn` | Non-critical issues |
| `console.error` | Errors requiring attention |

#### Route Logging

**File**: `src/components/debug/RouteLogger.tsx`

Logs route changes when debug mode is enabled.

### Backend Logging

#### Edge Function Patterns

```typescript
// Request tracing
const requestId = crypto.randomUUID().slice(0, 8);
console.log(`[FUNCTION-NAME] ${requestId} | Starting...`);

// Structured logging
console.log(`[TTN-WEBHOOK] ${requestId} | Uplink: device=${deviceId}, temp=${temp}`);

// Error logging
console.error(`[FUNCTION-NAME] ${requestId} | Error:`, error);
```

#### Log Format

```
[FUNCTION-NAME] REQUEST_ID | message: details
```

Example:
```
[TTN-WEBHOOK] a1b2c3d4 | Uplink: device=sensor-001, dev_eui=0004a30b001c1234, app=freshtrack-org
[TTN-WEBHOOK] a1b2c3d4 | Found sensor by ttn_device_id: Walk-in Cooler
[TTN-WEBHOOK] a1b2c3d4 | Processing sensor: Walk-in Cooler, temp: 38.5
```

### Sensitive Data Handling

**Never log**:
- Full phone numbers (mask: `+1555***4567`)
- API keys
- Passwords
- Full webhook secrets

**Masking pattern**:
```typescript
const maskPhone = (phone: string) =>
  phone.slice(0, 5) + '***' + phone.slice(-4);
```

---

## Error Handling

### Frontend Error Handling

#### Toast Notifications

**File**: `src/hooks/use-toast.ts`, Sonner (`sonner`)

```typescript
import { toast } from 'sonner';

// Success
toast.success('Temperature logged successfully');

// Error
toast.error('Failed to save. Please try again.');

// Warning
toast.warning('Offline - will sync when connected');
```

#### Error Boundaries

React error boundaries catch component errors. Implement at page level.

#### API Error Handling

```typescript
try {
  const { data, error } = await supabase.from('units').select();
  if (error) throw error;
  return data;
} catch (error) {
  console.error('[ComponentName] Failed to load:', error);
  toast.error('Failed to load data');
}
```

### Backend Error Handling

#### Standard Response Pattern

```typescript
// Success
return new Response(
  JSON.stringify({ success: true, data }),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);

// Error
return new Response(
  JSON.stringify({ error: errorMessage, code: 'ERROR_CODE' }),
  { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

#### Webhook Error Handling

For TTN webhooks, always return 2xx to prevent retries:

```typescript
// Unknown device - accept but don't process
return new Response(
  JSON.stringify({ accepted: true, processed: false, reason: 'Unknown device' }),
  { status: 202, headers: corsHeaders }
);
```

---

## Debugging Workflows

### Debug Mode

**Enable**: Settings → Debug toggle (or `localStorage.setItem('debug', 'true')`)

**Features**:
- Route logging
- API call logging
- Component state display
- Debug terminal

### Debug Terminal

**File**: `src/components/debug/DebugTerminal.tsx`

Access via debug mode. Shows:
- Recent API calls
- Route changes
- Error logs
- State snapshots

### Inspector Tool

**Route**: `/inspector`

Features:
- View raw database records
- Examine sensor states
- Check TTN configuration
- Debug alerts

### Edge Function Diagnostics

**File**: `src/components/debug/EdgeFunctionDiagnostics.tsx`

Shows:
- Function health status
- Recent invocation logs
- Error counts

### TTN Diagnostics

**File**: `src/components/ttn/TTNDiagnosticsDownload.tsx`

Downloads diagnostic bundle containing:
- TTN connection status
- Sensor inventory
- Recent webhook logs
- Provisioning history

### Common Debugging Steps

#### 1. Sensor Not Receiving Data

1. Check sensor status in Settings → Sensors
2. Verify DevEUI matches TTN console
3. Check TTN Application → Live Data
4. Verify webhook in TTN → Webhooks
5. Check `ttn-webhook` logs in Supabase

#### 2. Alerts Not Triggering

1. Check unit temperature thresholds
2. Verify `process-unit-states` is running
3. Check `alert_rules` for the unit
4. Review `event_logs` for state changes

#### 3. Notifications Not Sending

1. Check escalation contacts exist
2. Verify notification policy enabled
3. Check `notification_events` for delivery status
4. Review `process-escalations` logs

---

## Health Monitoring

### Health Check Endpoint

**Function**: `health-check`
**Route**: `/admin/health`

Checks:
- Database connectivity
- Edge function availability
- TTN webhook status
- Stripe connectivity

### Health Check Components

**Files**: `src/components/health/*.tsx`

- `HealthCheckList.tsx` - List of all checks
- `HealthStatusBadge.tsx` - Status indicator
- `HealthStatusCard.tsx` - Individual check card
- `OverallHealthSummary.tsx` - Aggregate status

### Monitoring Dashboard

**Route**: `/admin/health`

Displays:
| Check | Description |
|-------|-------------|
| Database | PostgreSQL connection |
| Auth | Supabase Auth service |
| Edge Functions | Function availability |
| TTN Webhook | Recent webhook activity |
| Stripe | Payment service status |

### Automated Checks

**TBD**: Configure Supabase cron jobs for:
- Periodic health checks
- Alert on failures
- Metrics collection

---

## Known Failure Scenarios

### TTN Webhook Failures

| Scenario | Symptoms | Resolution |
|----------|----------|------------|
| Invalid secret | 401 responses | Regenerate secret, update TTN |
| Function timeout | Incomplete processing | Check function logs, optimize |
| Database error | 202 responses | Check Supabase status |

### Alert Processing Failures

| Scenario | Symptoms | Resolution |
|----------|----------|------------|
| Function not triggered | No state changes | Check cron/trigger setup |
| RPC error | Cascade not working | Check `get_effective_alert_rules` |
| Missing org_id | Alert creation fails | Verify unit hierarchy |

### Notification Failures

| Scenario | Symptoms | Resolution |
|----------|----------|------------|
| SMS delivery failed | `notification_events.status = 'failed'` | Check Twilio console |
| Email bounced | Delivery log shows bounce | Verify email address |
| Rate limited | Notifications delayed | Check escalation timing |

### Sensor Offline

| Scenario | Symptoms | Resolution |
|----------|----------|------------|
| Gateway offline | All sensors show offline | Check gateway power/network |
| Sensor battery | Single sensor offline | Replace battery |
| TTN issue | Multiple sensors affected | Check TTN status page |

---

## Incident Playbooks

### Playbook 1: All Sensors Offline

**Symptoms**: All sensors in an organization show offline status

**Steps**:
1. Check `/admin/health` for system status
2. Verify TTN webhook status
3. Check TTN console for gateway status
4. Review `ttn-webhook` logs for recent activity
5. Verify `ttn_connections.webhook_secret` is correct

**Resolution**:
- If webhook issue: Regenerate secret, update TTN
- If gateway issue: Power cycle gateway
- If TTN outage: Wait for TTN recovery

### Playbook 2: Alerts Not Triggering

**Symptoms**: Temperature excursions not creating alerts

**Steps**:
1. Check unit has sensor assigned
2. Verify sensor is receiving data (check `sensor_readings`)
3. Check `process-unit-states` function logs
4. Verify `alert_rules` exist for org/site/unit
5. Check unit `temp_limit_high` and `temp_limit_low`

**Resolution**:
- If no readings: Debug sensor connection
- If function error: Check function deployment
- If rules missing: Create default rules

### Playbook 3: Notifications Not Sending

**Symptoms**: Alerts created but no notifications received

**Steps**:
1. Check `notification_policies` for alert type
2. Verify `escalation_contacts` exist
3. Check `notification_events` for delivery status
4. Review `process-escalations` logs
5. Verify Twilio/email credentials

**Resolution**:
- If policy disabled: Enable notification policy
- If no contacts: Add escalation contacts
- If delivery failed: Check credential configuration

### Playbook 4: High Database Load

**Symptoms**: Slow queries, timeouts

**Steps**:
1. Check Supabase dashboard for metrics
2. Review recent migrations
3. Check for missing indexes
4. Review `sensor_readings` table size
5. Check for runaway queries

**Resolution**:
- Add missing indexes
- Implement data archival
- Optimize slow queries

### Playbook 5: Payment Processing Failed

**Symptoms**: Subscriptions not updating after payment

**Steps**:
1. Check Stripe dashboard for webhook deliveries
2. Verify `stripe-webhook` function logs
3. Check `subscriptions` table for updates
4. Verify webhook secret is correct

**Resolution**:
- Resend failed webhooks from Stripe
- Update webhook secret if needed
- Manually sync subscription status

---

## Audit Trail

### Event Logging

**Table**: `event_logs`

All significant events are logged:

| Event Type | Category | Description |
|------------|----------|-------------|
| `unit_state_change` | unit | Status transitions |
| `alert_created` | alert | New alert |
| `alert_acknowledged` | alert | Alert acknowledged |
| `alert_resolved` | alert | Alert resolved |
| `temperature_logged` | temperature | Manual log |
| `sensor_reading` | temperature | Auto reading |
| `setting_changed` | configuration | Config update |
| `user_login` | user | Auth event |

### Event Structure

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "site_id": "uuid (optional)",
  "unit_id": "uuid (optional)",
  "event_type": "unit_state_change",
  "category": "unit",
  "severity": "warning",
  "title": "Walk-in Cooler: ok → excursion",
  "event_data": {
    "from_status": "ok",
    "to_status": "excursion",
    "reason": "Temperature 45°F above limit",
    "temp_reading": 45.0
  },
  "actor_id": "uuid or null",
  "actor_type": "user or system",
  "created_at": "2026-01-12T10:30:00Z"
}
```

### Viewing Audit Logs

**Route**: `/events`

Features:
- Filterable by event type, category, severity
- Date range selection
- Export functionality

### Log Retention

**TBD**: Configure retention policy:
- Temperature readings: [configurable]
- Event logs: 2 years (compliance)
- Alert history: Indefinite

### Compliance Requirements

For HACCP compliance:
- All temperature logs retained
- Alert history with acknowledgment
- Corrective action documentation
- User action audit trail

---

## Metrics to Track

### Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Sensor uptime | `lora_sensors.last_seen_at` | < 95% |
| Alert response time | `alerts.acknowledged_at - triggered_at` | > 30 min |
| Webhook latency | Edge function logs | > 5 sec |
| Failed notifications | `notification_events` | > 10% |
| Database response time | Supabase metrics | > 1 sec |

### Dashboard Recommendations

**TBD**: Implement metrics dashboard showing:
- Active alerts by severity
- Sensor health overview
- Response time trends
- Notification delivery rates

---

## Related Documentation

- [API.md](#api) - Edge function details
- [DATA_MODEL.md](#data_model) - Event log schema
- [INTEGRATIONS.md](#integrations) - Third-party service status


---

\newpage

<a id="onboarding-getting_started"></a>

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
2. [ ] Set up your local environment ([LOCAL_DEV.md](#local_dev))
3. [ ] Take the repository tour ([REPO_TOUR.md](#repo_tour))
4. [ ] Review common tasks ([COMMON_TASKS.md](#common_tasks))
5. [ ] Bookmark the debugging guide ([DEBUGGING_GUIDE.md](#debugging_guide))
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

1. [REPO_TOUR.md](#repo_tour) — Walk through the codebase
2. [LOCAL_DEV.md](#local_dev) — Set up your environment
3. [COMMON_TASKS.md](#common_tasks) — Learn common development patterns
4. [DEBUGGING_GUIDE.md](#debugging_guide) — Troubleshooting tips


---

\newpage

<a id="onboarding-repo_tour"></a>

# Repository Tour

> Folder-by-folder walkthrough of the FreshTrack Pro codebase

---

## Top-Level Structure

```
freshtrack-pro/
├── src/                    # Frontend React application
├── supabase/               # Backend (edge functions, migrations)
├── docs/                   # Documentation
├── public/                 # Static assets (favicon, icons)
├── scripts/                # Build utilities
├── .env                    # Environment variables (not committed)
├── package.json            # NPM dependencies
├── vite.config.ts          # Vite build configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── KNOWLEDGE.md            # Coding conventions (READ THIS)
```

---

## `/src` — Frontend Application

The React single-page application.

### `/src/App.tsx`

**The entry point.** This file defines:
- All routes (23 pages)
- Provider hierarchy (QueryClient, Tooltip, Debug, TTN contexts)
- Global components (Toasters, Debug terminal)

**When to edit:** Adding a new route or changing provider order.

```typescript
// Route pattern
<Route path="/units/:unitId" element={<UnitDetail />} />
```

---

### `/src/pages/`

**Route-level components.** One file per page:

| File | Route | Purpose |
|------|-------|---------|
| `Index.tsx` | `/` | Landing page |
| `Auth.tsx` | `/auth` | Sign in/sign up |
| `Dashboard.tsx` | `/dashboard` | Main monitoring view |
| `Settings.tsx` | `/settings` | Multi-tab settings |
| `UnitDetail.tsx` | `/units/:unitId` | Unit monitoring detail |
| `Alerts.tsx` | `/alerts` | Alert management |
| `Reports.tsx` | `/reports` | Compliance reporting |
| `ManualLog.tsx` | `/manual-log` | Manual temp logging |
| `SiteDetail.tsx` | `/sites/:siteId` | Site view |
| `AreaDetail.tsx` | `/sites/:siteId/areas/:areaId` | Area view |
| `HealthDashboard.tsx` | `/admin/health` | System health |

**Pattern:** Pages compose components from `/src/components/`.

---

### `/src/components/`

**Reusable React components** organized by feature:

```
components/
├── ui/                    # shadcn/ui base components (43 files)
├── alerts/                # Alert display (AlertRow.tsx)
├── dashboard/             # Dashboard widgets (LowBatteryWidget.tsx)
├── settings/              # Settings panels (20+ files)
├── unit/                  # Unit monitoring (8 files)
├── site/                  # Site components
├── ttn/                   # TTN-specific components
├── health/                # Health check components
├── admin/                 # Admin tools
├── billing/               # Stripe integration
├── reports/               # Report components
├── debug/                 # Debug utilities
└── actions/               # Action button components
```

#### Key Component Directories

**`/src/components/ui/`** — shadcn/ui base components. **Do not modify these directly.** They're generated from the shadcn CLI.

**`/src/components/settings/`** — Most of the application complexity:
- `SensorManager.tsx` — LoRa sensor CRUD
- `GatewayManager.tsx` — Gateway CRUD
- `TTNConnectionSettings.tsx` — TTN configuration
- `AlertRulesEditor.tsx` — Alert threshold configuration
- `NotificationPolicyEditor.tsx` — Notification settings

**`/src/components/unit/`** — Unit detail page components:
- `UnitAlertsBanner.tsx` — Active alerts display
- `UnitSensorsCard.tsx` — Assigned sensors
- `BatteryHealthCard.tsx` — Battery status
- `UnitSettingsSection.tsx` — Unit configuration

---

### `/src/hooks/`

**Custom React hooks** (25 files). These encapsulate data fetching and business logic:

| Hook | Purpose |
|------|---------|
| `useUnitStatus.ts` | Compute unit status (mirrors backend logic) |
| `useAlertRules.ts` | Fetch/update alert rules |
| `useNotificationPolicies.ts` | Notification policy CRUD |
| `useLoraSensors.ts` | LoRa sensor data |
| `useGateways.ts` | Gateway data |
| `useAuthAndOnboarding.ts` | Auth state + onboarding flow |
| `useUserRole.ts` | Role-based access checking |
| `useTTNSetupWizard.ts` | TTN onboarding flow |
| `useOfflineSync.ts` | Offline data sync |
| `useHealthCheck.ts` | System health monitoring |

**Pattern:** Hooks use TanStack Query for caching. Query keys follow pattern:
```typescript
['units', unitId]
['alerts', { organizationId, status: 'active' }]
```

---

### `/src/lib/`

**Utilities and configuration:**

| File | Purpose |
|------|---------|
| `alertConfig.ts` | Alert type definitions, icons, colors |
| `statusConfig.ts` | Unit status definitions, priorities |
| `entityStatusConfig.ts` | Entity-level status config |
| `validation.ts` | Zod validation schemas |
| `eventLogger.ts` | Event logging utility |
| `offlineStorage.ts` | IndexedDB for offline sync |
| `utils.ts` | General utilities (cn, etc.) |
| `stripe.ts` | Stripe plan configuration |

**Key file: `alertConfig.ts`** — Defines all alert types, their icons, colors, and clear conditions. Reference this when working with alerts.

**Key file: `statusConfig.ts`** — Defines unit status values, priorities, and display properties.

---

### `/src/types/`

**TypeScript type definitions:**

| File | Purpose |
|------|---------|
| `ttn.ts` | TTN/LoRa types (Gateway, LoraSensor, permissions) |
| `ttnState.ts` | TTN config state machine types |

Most types are auto-generated in `/src/integrations/supabase/types.ts`.

---

### `/src/contexts/`

**React context providers:**

| Context | Purpose |
|---------|---------|
| `DebugContext.tsx` | Debug mode global state |
| `TTNConfigContext.tsx` | TTN configuration state |

---

### `/src/integrations/`

**External service clients:**

```
integrations/
└── supabase/
    ├── client.ts         # Supabase client instance
    └── types.ts          # Auto-generated database types (DO NOT EDIT)
```

**`types.ts`** is auto-generated from the database schema. Never edit manually.

---

## `/supabase` — Backend

### `/supabase/functions/`

**Deno edge functions** (33 functions). Each function is a folder:

```
functions/
├── _shared/               # Shared utilities
├── process-unit-states/   # Alert engine (SSOT for alerts)
├── process-escalations/   # Notification dispatch
├── ttn-webhook/           # TTN data ingestion
├── ttn-provision-device/  # Device provisioning
├── stripe-checkout/       # Stripe checkout
└── ... (28 more)
```

#### Function Categories

**Data Ingestion:**
| Function | Purpose |
|----------|---------|
| `ttn-webhook` | Receive TTN uplink messages |
| `ingest-readings` | Generic data ingestion |
| `sensor-simulator` | Generate test data |

**Alert Processing (SSOT):**
| Function | Purpose |
|----------|---------|
| `process-unit-states` | **THE** alert creation/resolution service |
| `process-escalations` | **THE** notification dispatch service |

**TTN Management:**
| Function | Purpose |
|----------|---------|
| `ttn-bootstrap` | Auto-configure webhooks |
| `ttn-provision-device` | Register devices in TTN |
| `ttn-provision-gateway` | Register gateways in TTN |
| `ttn-gateway-preflight` | Validate TTN credentials |
| `ttn-list-devices` | List devices from TTN |

**Billing:**
| Function | Purpose |
|----------|---------|
| `stripe-checkout` | Create checkout sessions |
| `stripe-portal` | Customer portal |
| `stripe-webhook` | Handle Stripe events |

#### `/supabase/functions/_shared/`

Shared utilities used across functions:

| File | Purpose |
|------|---------|
| `ttnConfig.ts` | DevEUI normalization, TTN helpers |
| `ttnPermissions.ts` | API key permission validation |
| `validation.ts` | Request validation, auth helpers |
| `response.ts` | Standardized response helpers |
| `cors.ts` | CORS headers |

---

### `/supabase/migrations/`

**Database migrations.** 100+ SQL files defining the schema.

Files are named with timestamps: `20260112001512_name.sql`

**Do not edit existing migrations.** Create new ones to make changes.

---

### `/supabase/config.toml`

**Supabase configuration.** Defines:
- Edge function settings
- JWT verification requirements
- CORS configuration

---

## `/docs` — Documentation

```
docs/
├── README.md              # Technical overview
├── INDEX.md               # Navigation guide
├── GLOSSARY.md            # Terminology
├── architecture/          # System architecture
├── engineering/           # API, data model, integrations
├── product/               # Pages, user flows
├── diagrams/              # Mermaid diagrams
├── charts/                # ER diagrams, flowcharts
├── executive/             # Non-technical docs
└── onboarding/            # This folder
```

---

## `/public` — Static Assets

```
public/
├── favicon.ico            # Browser favicon
├── icon.svg               # PWA icon
├── placeholder.svg        # Placeholder image
└── robots.txt             # SEO robots file
```

---

## Key Files to Know

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies and scripts |
| `vite.config.ts` | Vite build config, PWA plugin, test setup |
| `tailwind.config.ts` | Tailwind CSS customization |
| `tsconfig.json` | TypeScript compiler options |
| `components.json` | shadcn/ui configuration |
| `.env` | Environment variables (not in git) |

### Critical Logic Files

| File | What It Does |
|------|--------------|
| `supabase/functions/process-unit-states/index.ts` | THE alert engine. Creates/resolves all alerts. |
| `supabase/functions/ttn-webhook/index.ts` | Receives all sensor data from TTN. |
| `src/hooks/useUnitStatus.ts` | Frontend status computation (mirrors backend). |
| `src/lib/alertConfig.ts` | Alert type definitions and display config. |

---

## Where to Find Things

| I need to... | Look in... |
|--------------|------------|
| Add a new page | `src/pages/` + `src/App.tsx` |
| Add a component | `src/components/{feature}/` |
| Add a data hook | `src/hooks/` |
| Change alert logic | `supabase/functions/process-unit-states/` |
| Change TTN handling | `supabase/functions/ttn-webhook/` |
| Add a database table | `supabase/migrations/` |
| Change validation | `src/lib/validation.ts` |
| Add an edge function | `supabase/functions/{new-function}/` |

---

## Next Steps

- [LOCAL_DEV.md](#local_dev) — Set up your development environment
- [COMMON_TASKS.md](#common_tasks) — How to do common development tasks
- [DEBUGGING_GUIDE.md](#debugging_guide) — Troubleshooting and debugging


---

\newpage

<a id="onboarding-local_dev"></a>

# Local Development Setup

> Get FreshTrack Pro running on your machine

---

## Prerequisites

Before you begin, install these tools:

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ | Package manager | Included with Node |
| **Git** | 2.30+ | Version control | [git-scm.com](https://git-scm.com) |
| **Supabase CLI** | Latest | Local backend | `npm install -g supabase` |
| **Deno** | 1.40+ | Edge function runtime | [deno.land](https://deno.land) |

**Optional but recommended:**
- VS Code with extensions: ESLint, Prettier, Tailwind CSS IntelliSense
- Docker (for running Supabase locally)

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd freshtrack-pro

# 2. Install dependencies
npm install

# 3. Set up environment variables (see below)
cp .env.example .env

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

---

## Environment Variables

Create a `.env` file in the project root. Here are the required variables:

### Required Variables

```env
# Supabase Connection (required)
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Where to Find These Values

1. **Supabase Dashboard**: Go to Project Settings → API
   - `VITE_SUPABASE_PROJECT_ID`: The project reference ID
   - `VITE_SUPABASE_URL`: The project URL
   - `VITE_SUPABASE_ANON_KEY`: The `anon` public key

### Optional Variables (for local development)

```env
# Feature flags
VITE_ENABLE_DEBUG_MODE="true"    # Shows debug terminal

# Stripe (for payment testing)
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### Environment Variable Naming

All frontend variables **must** start with `VITE_` to be exposed to the browser.

```typescript
// Access in code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

---

## NPM Scripts

```bash
# Development
npm run dev           # Start dev server (port 8080)
npm run build         # Build for production
npm run preview       # Preview production build locally

# Code Quality
npm run lint          # Run ESLint
npm run typecheck     # TypeScript type checking (if configured)

# Testing
npm run test          # Run tests (Vitest)
```

---

## Running Supabase Locally

For full backend development, run Supabase locally:

### Start Local Supabase

```bash
# Start all Supabase services
supabase start

# This will output local URLs:
# - API URL: http://localhost:54321
# - Studio URL: http://localhost:54323
# - Anon Key: eyJhb...
```

### Update `.env` for Local Development

```env
VITE_SUPABASE_URL="http://localhost:54321"
VITE_SUPABASE_ANON_KEY="<local-anon-key>"
```

### Apply Migrations

```bash
# Apply all migrations to local database
supabase db reset

# This runs all migrations in /supabase/migrations/
```

### View Local Database

```bash
# Open Supabase Studio in browser
supabase studio

# Or connect directly with psql
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

---

## Running Edge Functions Locally

Edge functions are in `/supabase/functions/`. To run them locally:

### Serve All Functions

```bash
supabase functions serve
```

This runs all functions on `http://localhost:54321/functions/v1/<function-name>`.

### Serve a Specific Function

```bash
supabase functions serve process-unit-states
```

### Test a Function

```bash
# Example: Call the health check function
curl http://localhost:54321/functions/v1/health-check \
  -H "Authorization: Bearer <anon-key>"
```

### Environment Variables for Functions

Edge functions need their own environment variables:

```bash
# Create a .env file for functions
touch supabase/.env.local

# Add function-specific secrets
TTN_API_KEY="your-ttn-key"
STRIPE_SECRET_KEY="sk_test_..."
TWILIO_ACCOUNT_SID="..."
```

---

## Project Structure for Development

```
freshtrack-pro/
├── src/                    # Frontend (what you'll edit most)
│   ├── pages/              # Route components
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utilities
├── supabase/
│   ├── functions/          # Edge functions (backend logic)
│   └── migrations/         # Database schema
├── public/                 # Static assets
├── .env                    # Environment variables (DON'T COMMIT)
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite build configuration
└── tailwind.config.ts      # Tailwind CSS configuration
```

---

## IDE Setup

### VS Code (Recommended)

Install these extensions:
- **ESLint** — Linting
- **Prettier** — Code formatting
- **Tailwind CSS IntelliSense** — Autocomplete for Tailwind classes
- **TypeScript Vue Plugin (Volar)** — Better TypeScript support
- **Deno** — For edge function development

### Recommended Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Common Setup Problems

### Problem: "Module not found" errors

**Cause**: Dependencies not installed or outdated.

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: Supabase connection errors

**Cause**: Wrong environment variables or Supabase not running.

**Solutions**:
1. Check `.env` file has correct values
2. Ensure no quotes around values in some shells
3. Restart the dev server after changing `.env`

```bash
# Verify your env vars are loaded
npm run dev
# Check browser console for connection errors
```

### Problem: "Port 8080 already in use"

**Cause**: Another process using the port.

**Solution**:
```bash
# Find and kill the process
lsof -i :8080
kill -9 <PID>

# Or use a different port
npm run dev -- --port 3000
```

### Problem: Edge functions not working locally

**Cause**: Deno not installed or functions not served.

**Solutions**:
1. Install Deno: `curl -fsSL https://deno.land/install.sh | sh`
2. Start function server: `supabase functions serve`
3. Check function logs in terminal

### Problem: TypeScript errors on first run

**Cause**: Generated types may be stale.

**Solution**:
```bash
# Regenerate Supabase types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Problem: Hot reload not working

**Cause**: File watcher limits or Vite cache issues.

**Solutions**:
```bash
# Increase file watcher limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Problem: CORS errors in browser

**Cause**: Frontend calling wrong backend URL.

**Solution**: Check `VITE_SUPABASE_URL` matches your running backend:
- Local: `http://localhost:54321`
- Remote: `https://your-project.supabase.co`

---

## Development Workflow

### Typical Day

1. **Pull latest changes**
   ```bash
   git pull origin main
   npm install  # If package.json changed
   ```

2. **Start the dev server**
   ```bash
   npm run dev
   ```

3. **Make changes** — Hot reload will update the browser

4. **Check for errors**
   ```bash
   npm run lint
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Working on Backend

1. **Start Supabase locally**
   ```bash
   supabase start
   ```

2. **Make database changes** via migration:
   ```bash
   supabase migration new my_change_name
   # Edit the generated SQL file
   supabase db reset  # Apply changes
   ```

3. **Test edge functions**
   ```bash
   supabase functions serve
   # Call from frontend or curl
   ```

---

## Connecting to Remote Environments

### Development Environment

Use the development Supabase project for shared testing:

```env
VITE_SUPABASE_URL="https://dev-project.supabase.co"
VITE_SUPABASE_ANON_KEY="dev-anon-key"
```

### Production Environment

**Never develop against production.** But for debugging:

```env
# Use read-only access only
VITE_SUPABASE_URL="https://prod-project.supabase.co"
VITE_SUPABASE_ANON_KEY="prod-anon-key"
```

---

## Troubleshooting Checklist

If something isn't working, check these in order:

1. [ ] Is Node.js 18+ installed? `node --version`
2. [ ] Are dependencies installed? `npm install`
3. [ ] Does `.env` file exist with correct values?
4. [ ] Is the dev server running? `npm run dev`
5. [ ] Is Supabase running (if using local)? `supabase status`
6. [ ] Are there console errors in the browser?
7. [ ] Are there terminal errors in the dev server?
8. [ ] Did you try clearing caches? `rm -rf node_modules/.vite`

---

## Getting Help

1. Check this guide and [DEBUGGING_GUIDE.md](#debugging_guide)
2. Search existing issues in the repository
3. Ask in the team chat
4. File an issue with:
   - What you're trying to do
   - What you expected to happen
   - What actually happened
   - Error messages and logs

---

## Next Steps

- [COMMON_TASKS.md](#common_tasks) — How to do common development tasks
- [DEBUGGING_GUIDE.md](#debugging_guide) — Troubleshooting and debugging
- [REPO_TOUR.md](#repo_tour) — Understand the codebase structure


---

\newpage

<a id="onboarding-common_tasks"></a>

# Common Development Tasks

> Step-by-step guides for everyday development work

---

## Table of Contents

1. [Adding a New Page](#adding-a-new-page)
2. [Adding a New Component](#adding-a-new-component)
3. [Fetching Data from Supabase](#fetching-data-from-supabase)
4. [Adding a New Edge Function](#adding-a-new-edge-function)
5. [Creating a Database Migration](#creating-a-database-migration)
6. [Adding a New Alert Type](#adding-a-new-alert-type)
7. [Modifying the TTN Integration](#modifying-the-ttn-integration)
8. [Working with the Settings Wizard](#working-with-the-settings-wizard)
9. [Adding Role-Based Access](#adding-role-based-access)
10. [Testing Your Changes](#testing-your-changes)

---

## Adding a New Page

### Step 1: Create the Page Component

Create a new file in `/src/pages/`:

```typescript
// src/pages/MyNewPage.tsx
import { useNavigate } from "react-router-dom";

const MyNewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">My New Page</h1>
      <p>Page content goes here.</p>
    </div>
  );
};

export default MyNewPage;
```

### Step 2: Add the Route

Edit `/src/App.tsx` to add the route:

```typescript
// Import your page
import MyNewPage from "@/pages/MyNewPage";

// Add to the Routes (inside the <Routes> component)
<Route path="/my-new-page" element={<MyNewPage />} />
```

### Step 3: Add Navigation (Optional)

If the page should appear in navigation, update the appropriate navigation component:

```typescript
// In the navigation component
<Link to="/my-new-page">My New Page</Link>
```

### Protected Routes

To require authentication, wrap the page in a protected route check:

```typescript
// In App.tsx, use the auth check pattern
<Route
  path="/my-new-page"
  element={
    <ProtectedRoute>
      <MyNewPage />
    </ProtectedRoute>
  }
/>
```

---

## Adding a New Component

### Step 1: Choose the Right Location

```
src/components/
├── ui/              # Base UI components (shadcn) - DON'T ADD HERE
├── dashboard/       # Dashboard-related components
├── settings/        # Settings page components
├── unit/            # Unit detail components
├── alerts/          # Alert-related components
└── [feature]/       # Create a new folder for new features
```

### Step 2: Create the Component

```typescript
// src/components/dashboard/MyWidget.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MyWidgetProps {
  title: string;
  data: SomeDataType;
}

export function MyWidget({ title, data }: MyWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Widget content */}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Use shadcn/ui Components

Always use existing shadcn/ui components from `/src/components/ui/`:

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
```

**Adding a new shadcn component:**

```bash
npx shadcn-ui@latest add [component-name]
```

---

## Fetching Data from Supabase

### Pattern 1: Using TanStack Query (Recommended)

Create a custom hook in `/src/hooks/`:

```typescript
// src/hooks/useMyData.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyData(organizationId: string) {
  return useQuery({
    queryKey: ["my-data", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("my_table")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateMyData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newData: MyDataInsert) => {
      const { data, error } = await supabase
        .from("my_table")
        .insert(newData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-data"] });
    },
  });
}
```

### Pattern 2: Using in Components

```typescript
// In your component
import { useMyData, useCreateMyData } from "@/hooks/useMyData";

function MyComponent() {
  const { data, isLoading, error } = useMyData(organizationId);
  const createMutation = useCreateMyData();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;

  const handleCreate = async () => {
    await createMutation.mutateAsync({ name: "New Item" });
  };

  return (
    <div>
      {data.map(item => <ItemRow key={item.id} item={item} />)}
      <Button onClick={handleCreate}>Add New</Button>
    </div>
  );
}
```

### Query Key Conventions

Follow these patterns for consistent cache invalidation:

```typescript
// Entity lists
["units", organizationId]
["alerts", { organizationId, status: "active" }]
["sensors", { unitId }]

// Single entities
["unit", unitId]
["alert", alertId]

// Related data
["unit-sensors", unitId]
["unit-readings", unitId, { period: "24h" }]
```

---

## Adding a New Edge Function

### Step 1: Create the Function Directory

```bash
mkdir supabase/functions/my-new-function
touch supabase/functions/my-new-function/index.ts
```

### Step 2: Write the Function

```typescript
// supabase/functions/my-new-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with auth context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();

    // Your business logic here
    const result = await processData(body, supabaseClient);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Step 3: Call from Frontend

```typescript
// In a hook or component
const { data, error } = await supabase.functions.invoke("my-new-function", {
  body: { key: "value" },
});
```

### Step 4: Deploy

```bash
# Deploy to Supabase
supabase functions deploy my-new-function
```

---

## Creating a Database Migration

### Step 1: Create Migration File

```bash
supabase migration new add_my_table
# Creates: supabase/migrations/YYYYMMDDHHMMSS_add_my_table.sql
```

### Step 2: Write the SQL

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_my_table.sql

-- Create the table
CREATE TABLE public.my_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org's data"
    ON public.my_table
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert their org's data"
    ON public.my_table
    FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Create updated_at trigger
CREATE TRIGGER update_my_table_updated_at
    BEFORE UPDATE ON public.my_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 3: Apply Migration

```bash
# Locally
supabase db reset

# Remote (careful!)
supabase db push
```

### Step 4: Regenerate Types

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## Adding a New Alert Type

Alerts are managed by the `process-unit-states` edge function. Here's how to add a new alert type:

### Step 1: Add to Alert Config (Frontend)

Edit `/src/lib/alertConfig.ts`:

```typescript
export const ALERT_TYPES = {
  // ... existing types
  my_new_alert: {
    label: "My New Alert",
    icon: AlertCircle,
    color: "warning", // or "critical"
    description: "Description of when this triggers",
    clearCondition: "When the condition is resolved",
  },
} as const;
```

### Step 2: Add Detection Logic (Backend)

Edit `/supabase/functions/process-unit-states/index.ts`:

```typescript
// In the alert evaluation section
function evaluateAlerts(unit: Unit, reading: Reading, rules: AlertRules) {
  const alerts: Alert[] = [];

  // ... existing alert checks

  // Add your new alert check
  if (shouldTriggerMyNewAlert(unit, reading, rules)) {
    alerts.push({
      type: "my_new_alert",
      severity: "warning",
      unit_id: unit.id,
      message: `My new alert triggered for ${unit.name}`,
    });
  }

  return alerts;
}
```

### Step 3: Add Database Support

Create a migration if needed to support new alert metadata.

---

## Modifying the TTN Integration

TTN (The Things Network) integration has several components:

### Webhook Handler

`/supabase/functions/ttn-webhook/index.ts` — Receives uplink messages from TTN.

To modify how sensor data is processed:

```typescript
// In ttn-webhook/index.ts
async function processUplink(payload: TTNUplink) {
  // Normalize the DevEUI
  const devEUI = normalizeDevEUI(payload.end_device_ids.dev_eui);

  // Find the sensor
  const sensor = await findSensorByDevEUI(devEUI);

  // Extract and transform readings
  const reading = extractReading(payload);

  // Save to database
  await saveReading(sensor.id, reading);
}
```

### Device Provisioning

`/supabase/functions/ttn-provision-device/index.ts` — Registers devices with TTN.

### TTN Configuration

`/src/components/settings/TTNConnectionSettings.tsx` — UI for configuring TTN credentials.

### Key Files for TTN Work

| File | Purpose |
|------|---------|
| `/supabase/functions/_shared/ttnConfig.ts` | DevEUI normalization, TTN helpers |
| `/supabase/functions/_shared/ttnPermissions.ts` | API key permission validation |
| `/src/types/ttn.ts` | TypeScript types for TTN entities |
| `/src/hooks/useTTNSetupWizard.ts` | TTN onboarding flow logic |

---

## Working with the Settings Wizard

The settings wizard is in `/src/components/settings/`. The main orchestration happens in:

### Wizard Structure

```
settings/
├── SettingsTabs.tsx           # Main tab container
├── TTNConnectionSettings.tsx   # TTN configuration
├── SensorManager.tsx           # Sensor CRUD
├── GatewayManager.tsx          # Gateway CRUD
├── AlertRulesEditor.tsx        # Alert thresholds
└── NotificationPolicyEditor.tsx # Notification settings
```

### Adding a New Settings Section

1. Create your component:

```typescript
// src/components/settings/MyNewSettings.tsx
export function MyNewSettings({ organizationId }: Props) {
  // Your settings UI
}
```

2. Add to the tabs:

```typescript
// In SettingsTabs.tsx
<TabsContent value="my-new">
  <MyNewSettings organizationId={organizationId} />
</TabsContent>
```

### Cascading Settings Pattern

Settings cascade: Organization → Site → Unit. Use the `get_effective_*` RPCs:

```typescript
// Get effective settings for a unit (includes org/site defaults)
const { data } = await supabase.rpc("get_effective_alert_rules", {
  p_unit_id: unitId,
});
```

---

## Adding Role-Based Access

### Check User Role

Use the `useUserRole` hook:

```typescript
import { useUserRole } from "@/hooks/useUserRole";

function MyComponent() {
  const { role, isAdmin, isOwner, isLoading } = useUserRole();

  if (isLoading) return <Spinner />;

  return (
    <div>
      {isAdmin && <AdminOnlyFeature />}
      {role === "staff" && <StaffView />}
    </div>
  );
}
```

### Role Hierarchy

| Role | Can Do |
|------|--------|
| `owner` | Everything, including billing and user management |
| `admin` | All operations except billing |
| `manager` | View and manage assigned locations |
| `staff` | Log temperatures, acknowledge alerts |

### Backend Role Checks

In edge functions, check roles via the profiles table:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .single();

if (!["owner", "admin"].includes(profile.role)) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
}
```

---

## Testing Your Changes

### Frontend Testing

```bash
# Run Vitest
npm run test

# Watch mode
npm run test -- --watch
```

### Manual Testing Checklist

Before pushing, verify:

- [ ] No console errors in browser
- [ ] No TypeScript errors (`npm run lint`)
- [ ] Feature works as expected
- [ ] Mobile responsive (check at 375px width)
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Works with empty data

### Testing Edge Functions

```bash
# Start function server
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Testing Database Changes

```bash
# Reset local database (applies all migrations)
supabase db reset

# Check RLS policies work
# 1. Sign in as a user
# 2. Try to access data from another org
# 3. Should get no results (not an error)
```

---

## Quick Reference

### Import Aliases

```typescript
import { something } from "@/components/...";  // src/components
import { something } from "@/hooks/...";       // src/hooks
import { something } from "@/lib/...";         // src/lib
import { something } from "@/pages/...";       // src/pages
```

### Supabase Client

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Toast Notifications

```typescript
import { toast } from "@/hooks/use-toast";

toast({
  title: "Success",
  description: "Your changes have been saved.",
});

toast({
  title: "Error",
  description: "Something went wrong.",
  variant: "destructive",
});
```

### Common Hooks

```typescript
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnitStatus } from "@/hooks/useUnitStatus";
```

---

## Next Steps

- [DEBUGGING_GUIDE.md](#debugging_guide) — Troubleshooting common issues
- [REPO_TOUR.md](#repo_tour) — Understand the codebase structure
- [GETTING_STARTED.md](#getting_started) — Mental model for the system


---

\newpage

<a id="onboarding-debugging_guide"></a>

# Debugging Guide

> Troubleshooting common issues and debugging strategies

---

## Table of Contents

1. [Debugging Philosophy](#debugging-philosophy)
2. [Quick Diagnosis Checklist](#quick-diagnosis-checklist)
3. [Frontend Debugging](#frontend-debugging)
4. [Backend Debugging](#backend-debugging)
5. [Database Debugging](#database-debugging)
6. [TTN Integration Issues](#ttn-integration-issues)
7. [Alert System Issues](#alert-system-issues)
8. [Common Error Patterns](#common-error-patterns)
9. [Performance Issues](#performance-issues)
10. [Known Sharp Edges](#known-sharp-edges)

---

## Debugging Philosophy

### Follow the Data Flow

Most bugs occur at boundaries. Trace data through the system:

```
User Action → React State → Supabase Query → Database → Response → React Query Cache → UI
```

**Ask yourself:**
1. Where does the data enter the system?
2. Where does it transform?
3. Where does it render?

### Check These First (90% of issues)

1. **Console errors** — Browser DevTools console
2. **Network failures** — Browser DevTools Network tab
3. **Wrong environment** — Check `.env` values
4. **Stale cache** — Hard refresh or clear query cache
5. **RLS blocking** — User doesn't have access

---

## Quick Diagnosis Checklist

When something isn't working, check in this order:

```
□ Browser console (F12 → Console)
□ Network tab (F12 → Network)
□ Terminal running dev server
□ Supabase function logs
□ Database query directly in Supabase Studio
```

### One-Liner Diagnostics

```bash
# Check if frontend is running
curl http://localhost:8080

# Check if Supabase is running
supabase status

# Check function logs
supabase functions logs <function-name>

# Check database connection
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT 1"
```

---

## Frontend Debugging

### React DevTools

Install the React DevTools browser extension. It lets you:
- Inspect component hierarchy
- View props and state
- See what triggered re-renders

### TanStack Query DevTools

The app includes TanStack Query DevTools (in development mode):
- See all cached queries
- Inspect query states (loading, error, success)
- Manually invalidate queries
- Trigger refetches

**Location:** Bottom-right corner of the screen (flower icon).

### Debug Mode

FreshTrack Pro has a built-in debug mode:

1. Enable in `.env`: `VITE_ENABLE_DEBUG_MODE="true"`
2. Opens a debug terminal with system information
3. Shows real-time events and state changes

### Common Frontend Issues

#### Issue: Data not updating after mutation

**Symptom:** You save something, but the UI doesn't update.

**Cause:** Query cache not invalidated.

**Solution:**
```typescript
// In your mutation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["your-query-key"] });
},
```

#### Issue: Component re-renders infinitely

**Symptom:** Browser freezes, "Maximum update depth" error.

**Cause:** Dependency array issue in useEffect or useMemo.

**Debug:**
```typescript
// Add logging to see what's changing
useEffect(() => {
  console.log("Effect ran", { dep1, dep2 });
}, [dep1, dep2]);
```

**Solution:** Ensure dependencies are stable (use useMemo/useCallback).

#### Issue: "Cannot read property of undefined"

**Symptom:** White screen, error in console.

**Cause:** Data not loaded yet, or null check missing.

**Solution:**
```typescript
// Add loading state check
if (isLoading) return <Spinner />;
if (!data) return <EmptyState />;

// Use optional chaining
const value = data?.nested?.property;
```

#### Issue: Toast not showing

**Symptom:** Action completes but no feedback.

**Solution:**
```typescript
import { toast } from "@/hooks/use-toast";

toast({
  title: "Success",
  description: "Your action completed.",
});
```

---

## Backend Debugging

### Viewing Edge Function Logs

```bash
# Stream logs in real-time (local)
supabase functions serve

# View logs in Supabase Dashboard (remote)
# Go to: Project → Edge Functions → Logs
```

### Adding Debug Logging

```typescript
// In edge functions
console.log("Debug:", JSON.stringify({ variable, anotherVariable }));

// These appear in:
// - Terminal (local development)
// - Supabase Dashboard logs (production)
```

### Testing Functions Locally

```bash
# Serve all functions
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer $(supabase status | grep anon | awk '{print $3}')" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Common Backend Issues

#### Issue: Function returns 401 Unauthorized

**Cause:** Missing or invalid auth token.

**Debug:**
```typescript
// Log the auth state
const { data: { user }, error } = await supabase.auth.getUser();
console.log("Auth:", { user: user?.id, error });
```

**Solutions:**
- Ensure frontend passes auth header
- Check if user is logged in
- Verify JWT hasn't expired

#### Issue: Function returns 500 Internal Server Error

**Debug:**
```typescript
try {
  // Your code
} catch (error) {
  console.error("Function error:", error);
  return new Response(
    JSON.stringify({ error: error.message, stack: error.stack }),
    { status: 500 }
  );
}
```

#### Issue: CORS errors

**Symptom:** "Access-Control-Allow-Origin" error in console.

**Solution:** Ensure you return CORS headers:
```typescript
import { corsHeaders } from "../_shared/cors.ts";

// For preflight
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}

// For all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

---

## Database Debugging

### Direct Database Access

```bash
# Connect to local database
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Or use Supabase Studio
supabase studio  # Opens at http://localhost:54323
```

### Debugging RLS Policies

RLS issues are silent — you get empty results, not errors.

**Debug approach:**

1. **Test as service role (bypasses RLS):**
```sql
-- In Supabase Studio SQL editor
SELECT * FROM units;  -- Service role bypasses RLS
```

2. **Test as user:**
```sql
-- Simulate RLS as a specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM units;
```

3. **Check the policy:**
```sql
-- View policies on a table
SELECT * FROM pg_policies WHERE tablename = 'units';
```

### Common Database Issues

#### Issue: Insert/Update silently fails

**Cause:** RLS policy blocks the operation.

**Debug:**
```sql
-- Check if user has organization access
SELECT organization_id FROM profiles WHERE id = 'user-uuid';

-- Check policy conditions
SELECT organization_id FROM units WHERE id = 'unit-uuid';
```

#### Issue: Cascading settings not working

**Cause:** `get_effective_*` RPC not being used.

**Solution:** Always use the RPC for settings that cascade:
```typescript
const { data } = await supabase.rpc("get_effective_alert_rules", {
  p_unit_id: unitId,
});
```

#### Issue: Migration fails

**Debug:**
```bash
# See migration status
supabase migration list

# Reset and reapply all migrations
supabase db reset

# Check for SQL errors
supabase db push --dry-run
```

---

## TTN Integration Issues

### DevEUI Normalization

DevEUIs must be normalized (uppercase, no separators):

```typescript
// Correct
const devEUI = "70B3D57ED005A123";

// Incorrect (will fail to match)
const devEUI = "70:B3:D5:7E:D0:05:A1:23";  // Has colons
const devEUI = "70b3d57ed005a123";          // Lowercase
```

**Debug:**
```typescript
// In ttn-webhook
console.log("Raw DevEUI:", payload.end_device_ids.dev_eui);
console.log("Normalized:", normalizeDevEUI(payload.end_device_ids.dev_eui));
```

### Webhook Not Receiving Data

1. **Check TTN Console:**
   - Go to Applications → Your App → Webhooks
   - Verify webhook URL is correct
   - Check "Last sent" timestamp

2. **Check webhook secret:**
   - TTN sends an `X-Downlink-Apikey` header
   - Must match what's configured in our database

3. **Check function logs:**
```bash
supabase functions logs ttn-webhook --follow
```

### Device Not Joining

1. **Check device registration:**
   - Device registered in TTN Console?
   - AppKey correct?
   - DevEUI matches physical device?

2. **Check gateway:**
   - Gateway online in TTN Console?
   - Device in range of gateway?

### Sensor Shows "Offline"

**Possible causes:**
- Device battery dead
- Device out of range
- Gateway offline
- Webhook not processing

**Debug path:**
1. Check TTN Console for recent uplinks
2. Check `sensor_readings` table for recent data
3. Check `lora_sensors` table for `last_seen_at`
4. Check function logs for errors

---

## Alert System Issues

### Alerts Not Triggering

The SSOT for alerts is `process-unit-states`. Debug there:

```bash
# Check function logs
supabase functions logs process-unit-states --follow

# Manually trigger for a unit
curl -X POST http://localhost:54321/functions/v1/process-unit-states \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"unit_id": "your-unit-uuid"}'
```

**Common causes:**
- Confirm time not elapsed (needs X minutes of excursion)
- Alert rule not applied (check `get_effective_alert_rules`)
- Unit status already in alarm state

### Alerts Not Resolving

**Check:**
1. Temperature returned to safe range?
2. Clear condition met (in `alertConfig.ts`)?
3. `process-unit-states` running on schedule?

### Escalations Not Sending

The SSOT for notifications is `process-escalations`.

**Check:**
1. Notification policy configured?
2. User has valid contact (email/phone)?
3. Escalation delay elapsed?

```bash
supabase functions logs process-escalations --follow
```

---

## Common Error Patterns

### "TypeError: Cannot read properties of null"

**Pattern:**
```
TypeError: Cannot read properties of null (reading 'map')
```

**Cause:** Trying to iterate over null/undefined data.

**Fix:**
```typescript
// Before
{data.map(item => ...)}

// After
{data?.map(item => ...) ?? <EmptyState />}
```

### "Uncaught (in promise) Error"

**Pattern:** Async operation fails without being caught.

**Fix:**
```typescript
// Add error handling
try {
  await someAsyncOperation();
} catch (error) {
  console.error("Operation failed:", error);
  toast({ title: "Error", description: error.message, variant: "destructive" });
}
```

### "PostgrestError: permission denied for table"

**Cause:** RLS policy blocking access.

**Fix:** Check user's organization membership and policy conditions.

### "FunctionsFetchError: Failed to fetch"

**Cause:** Edge function not running or network issue.

**Check:**
1. Function is deployed/serving
2. URL is correct
3. No CORS issues

---

## Performance Issues

### Slow Initial Load

**Diagnose:**
1. Check Network tab for slow requests
2. Look for large bundle sizes
3. Check for unnecessary data fetching

**Solutions:**
- Use React.lazy for code splitting
- Limit initial data fetch (pagination)
- Check for N+1 query patterns

### Slow Database Queries

**Diagnose:**
```sql
-- Find slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

**Solutions:**
- Add indexes for frequently filtered columns
- Use `.select()` to limit returned columns
- Add pagination

### Memory Leaks

**Symptoms:** App slows down over time.

**Common causes:**
- Subscriptions not cleaned up
- Timers not cleared
- Event listeners not removed

**Fix:**
```typescript
useEffect(() => {
  const subscription = supabase.channel('...').subscribe();

  return () => {
    subscription.unsubscribe();  // Cleanup!
  };
}, []);
```

---

## Known Sharp Edges

### 1. DevEUI Case Sensitivity

DevEUIs from different sources may have different cases. Always normalize:

```typescript
import { normalizeDevEUI } from "@/lib/ttnConfig";
const normalized = normalizeDevEUI(rawDevEUI);
```

### 2. Timezone Handling

All timestamps are stored in UTC. Display conversion happens on frontend:

```typescript
// Database stores UTC
created_at: "2026-01-12T10:00:00Z"

// Display in user's timezone
new Date(created_at).toLocaleString()
```

### 3. RLS Doesn't Error, It Filters

If a user can't access data, they get empty results — not an error. This is intentional for security but can confuse debugging.

### 4. Cascading Settings Evaluation

Settings cascade: Org → Site → Unit. The most specific setting wins. Use `get_effective_*` RPCs.

### 5. Alert Confirm Time

Alerts don't trigger immediately. They wait for `confirm_time_minutes` to avoid false alarms from brief fluctuations.

### 6. Supabase Types Regeneration

After database changes, regenerate types:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Forgetting this causes TypeScript errors about missing columns.

### 7. Edge Function Cold Starts

First request after deployment may be slow (cold start). This is normal.

### 8. Query Key Inconsistency

If query keys don't match between fetch and invalidation, cache updates won't work:

```typescript
// These must match!
useQuery({ queryKey: ["units", orgId] })  // Fetch
queryClient.invalidateQueries({ queryKey: ["units", orgId] })  // Invalidate
```

---

## Debugging Toolkit

### Browser DevTools

- **Console (F12):** JavaScript errors and logs
- **Network:** API requests and responses
- **Application → Storage:** Local storage, cookies
- **React DevTools:** Component inspection
- **TanStack Query DevTools:** Query cache state

### Terminal Commands

```bash
# Frontend
npm run dev             # Start with hot reload
npm run lint            # Check for errors
npm run build           # Build (catches type errors)

# Backend
supabase start          # Start local Supabase
supabase functions serve # Run functions locally
supabase functions logs <name> # View function logs
supabase db reset       # Reset database

# Database
psql <connection-string> # Direct database access
supabase studio         # Visual database browser
```

### Useful Queries

```sql
-- Recent sensor readings
SELECT * FROM sensor_readings ORDER BY created_at DESC LIMIT 10;

-- Active alerts
SELECT * FROM alerts WHERE status = 'triggered';

-- User's organization
SELECT p.*, o.name as org_name
FROM profiles p
JOIN organizations o ON p.organization_id = o.id
WHERE p.id = 'user-uuid';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

---

## Getting Help

1. **Check this guide** for common issues
2. **Search the codebase** for similar patterns
3. **Check Supabase docs** for database/auth issues
4. **Check React Query docs** for caching issues
5. **Ask the team** with context:
   - What you're trying to do
   - What you expected
   - What actually happened
   - Error messages
   - Steps to reproduce

---

## Related Documents

- [LOCAL_DEV.md](#local_dev) — Development environment setup
- [COMMON_TASKS.md](#common_tasks) — How to do common tasks
- [REPO_TOUR.md](#repo_tour) — Codebase structure
- [GETTING_STARTED.md](#getting_started) — System mental model


---

\newpage

<a id="qa-test_strategy"></a>

# Test Strategy

> FreshTrack Pro Quality Assurance Philosophy and Approach

---

## Executive Summary

FreshTrack Pro is a **safety-critical refrigeration monitoring platform**. A missed alert can result in $10,000+ of spoiled inventory and potential health code violations. This test strategy prioritizes **reliability over speed** and **coverage of critical paths over cosmetic features**.

---

## Testing Philosophy

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Safety First** | Test alert paths, escalations, and data integrity above all else |
| **Follow the Data** | Trace data from sensor → webhook → database → UI → notification |
| **SSOT Validation** | Verify single-source-of-truth components (process-unit-states, process-escalations) |
| **Regression Prevention** | Every bug fix should include a test that would have caught it |
| **Test at Boundaries** | Most bugs occur at integration points—focus testing there |

### Risk-Based Prioritization

| Risk Level | Feature Category | Testing Approach |
|------------|------------------|------------------|
| **Critical** | Alerts, notifications, data ingestion | Automated + Manual + E2E |
| **High** | Device provisioning, TTN integration, auth | Automated + Manual |
| **Medium** | Dashboard, reports, settings | Automated unit + Manual |
| **Low** | UI polish, branding, theming | Manual only |

---

## Testing Layers

### The Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Few, slow, high confidence
                    │   (Manual/Auto) │
                    └────────┬────────┘
                   ┌─────────┴─────────┐
                   │  Integration Tests │  ← Medium coverage
                   │  (API, Database)   │
                   └─────────┬─────────┘
              ┌──────────────┴──────────────┐
              │        Unit Tests           │  ← Many, fast, focused
              │  (Functions, Components)    │
              └─────────────────────────────┘
```

### Layer Definitions

#### 1. Unit Tests (Automated)

**Scope:** Individual functions, hooks, and components in isolation.

**Current Framework:**
- Frontend: Vitest + React Testing Library
- Edge Functions: Deno standard library testing

**What to Test:**
- Pure functions (eligibility checks, data transformations)
- Validation logic
- State computations (e.g., unit status)
- Utility functions

**What NOT to Test:**
- UI styling
- Third-party library internals
- Generated types

**Example:**
```typescript
describe("canProvisionGateway", () => {
  it("returns ALLOWED when all conditions are met", () => {
    const result = canProvisionGateway(validGateway, validTtnConfig);
    expect(result.allowed).toBe(true);
  });
});
```

#### 2. Integration Tests (Automated + Manual)

**Scope:** Multiple components/services working together.

**What to Test:**
- API calls → Database → Response chain
- Hook + Supabase client interactions
- Edge function + Database operations
- RLS policy enforcement

**Approaches:**
- Mock Supabase client for deterministic testing
- Use local Supabase for realistic integration tests
- Test RLS policies with different user roles

#### 3. End-to-End Tests (Primarily Manual)

**Scope:** Complete user journeys through the application.

**What to Test:**
- Onboarding flow (signup → org setup → device provisioning)
- Alert lifecycle (trigger → acknowledge → resolve)
- Escalation chain (primary → secondary → manager notification)
- Report generation

**Execution:**
- Manual testing with documented checklists
- Consider Playwright for critical paths in future

---

## Testing Responsibilities

### What is Automated

| Category | What's Tested | Framework |
|----------|--------------|-----------|
| **Eligibility Logic** | Gateway/sensor provisioning rules | Vitest |
| **TTN Permissions** | API key permission validation | Deno |
| **Data Transformations** | DevEUI normalization, temperature conversion | Vitest |
| **Validation Schemas** | Input validation (Zod schemas) | Vitest |

### What is Manual

| Category | Why Manual | Documentation |
|----------|-----------|---------------|
| **Device Provisioning** | Requires TTN account, real hardware | [MANUAL_TESTING.md](#manual_testing) |
| **Alert Flow** | Complex timing, escalation chains | [E2E_SCENARIOS.md](#e2e_scenarios) |
| **Onboarding Wizard** | Multi-step UI with external dependencies | [MANUAL_TESTING.md](#manual_testing) |
| **Mobile Responsiveness** | Visual verification required | [MANUAL_TESTING.md](#manual_testing) |
| **Stripe Integration** | Payment flows, webhooks | [MANUAL_TESTING.md](#manual_testing) |

---

## Test Environments

### Local Development

```bash
# Start local Supabase
supabase start

# Run frontend tests
npm run test

# Run edge function tests
cd supabase/functions/_shared
deno test
```

### Staging Environment

- Shared Supabase project for integration testing
- Test TTN application (separate from production)
- Stripe test mode

### Production

- No testing in production
- Canary deployments for new features
- Feature flags for gradual rollout

---

## Test Data Management

### Principles

1. **Isolation:** Each test creates its own data
2. **Cleanup:** Tests clean up after themselves
3. **Determinism:** Same test, same result (no random data in assertions)
4. **Factories:** Use factory functions for test data

### Test Data Factories (Recommended Pattern)

```typescript
// src/test/factories.ts
export function createTestTTNConfig(overrides = {}): TTNConfigState {
  return {
    isEnabled: true,
    hasApiKey: true,
    applicationId: "test-app-id",
    ...overrides,
  };
}

export function createTestGateway(overrides = {}): GatewayForEligibility {
  return {
    gateway_eui: "AABBCCDDEEFF0011",
    ttn_gateway_id: null,
    status: "pending",
    ...overrides,
  };
}
```

---

## Critical Path Coverage

These paths MUST have both automated and manual testing:

### 1. Data Ingestion Pipeline

```
Sensor → TTN → ttn-webhook → sensor_readings table → process-unit-states
```

| Step | Test Type | Coverage |
|------|-----------|----------|
| TTN webhook receives data | Integration | Manual |
| DevEUI normalization | Unit | Automated |
| Reading stored in database | Integration | Manual |
| Unit status computed | Unit | Automated (planned) |

### 2. Alert Lifecycle

```
Excursion detected → Alert created → Notification sent → Acknowledged → Resolved
```

| Step | Test Type | Coverage |
|------|-----------|----------|
| Temperature threshold breach | Unit | Automated (planned) |
| Confirm time elapsed | Integration | Manual |
| Alert record created | Integration | Manual |
| Escalation triggered | E2E | Manual |

### 3. Device Provisioning

```
User enters DevEUI → Validate → Register with TTN → Save to database → Status: Active
```

| Step | Test Type | Coverage |
|------|-----------|----------|
| DevEUI validation | Unit | Automated |
| Permission check | Unit | Automated |
| TTN API call | Integration | Manual |
| Database update | Integration | Manual |

---

## Quality Gates

### Before Merging (PR Checklist)

- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed for UI changes
- [ ] No TypeScript errors (`npm run lint`)
- [ ] No console errors in browser

### Before Release

- [ ] All automated tests pass
- [ ] Manual E2E scenarios completed
- [ ] Staging environment tested
- [ ] Performance acceptable (page load < 3s)
- [ ] Critical path manual testing signed off

---

## Metrics and Goals

### Current State (Baseline)

| Metric | Value |
|--------|-------|
| Test files | 3 |
| Lines of test code | 476 |
| Components with tests | 0/112 (0%) |
| Hooks with tests | 0/26 (0%) |
| Edge functions with tests | 1/32 (3%) |
| Pages with tests | 0/23 (0%) |

### Target State (6-Month Goal)

| Metric | Target |
|--------|--------|
| Test files | 50+ |
| Lines of test code | 5,000+ |
| Critical path unit coverage | 80% |
| Edge function coverage | 50% |
| Manual test documentation | Complete |

---

## Running Tests

### Frontend Tests (Vitest)

```bash
# Run all tests
npm run test

# Run in watch mode
npm run test -- --watch

# Run with UI
npm run test -- --ui

# Run specific file
npm run test -- gatewayEligibility

# Run with coverage (when configured)
npm run test -- --coverage
```

### Edge Function Tests (Deno)

```bash
# Navigate to function
cd supabase/functions/_shared

# Run tests
deno test

# Run specific test file
deno test ttnPermissions.test.ts

# Run with permissions
deno test --allow-net --allow-env
```

---

## Adding Tests (For Developers)

### New Feature Checklist

1. **Identify the critical logic** — What could break?
2. **Write unit tests first** — Test edge cases
3. **Add integration test if external service involved**
4. **Update manual test documentation** if UI-heavy
5. **Update COVERAGE_MAP.md** with new coverage

### Test File Naming

```
# Unit tests - co-located with source
src/lib/actions/gatewayEligibility.ts
src/lib/actions/gatewayEligibility.test.ts

# Edge function tests
supabase/functions/_shared/ttnPermissions.ts
supabase/functions/_shared/ttnPermissions.test.ts
```

---

## Related Documents

- [COVERAGE_MAP.md](#coverage_map) — Feature-to-test mapping
- [MANUAL_TESTING.md](#manual_testing) — Step-by-step manual QA checklists
- [E2E_SCENARIOS.md](#e2e_scenarios) — Critical user flow testing
- [KNOWN_GAPS.md](#known_gaps) — Missing coverage and risks


---

\newpage

<a id="qa-coverage_map"></a>

# Coverage Map

> Feature-to-test mapping for FreshTrack Pro

---

## Overview

This document maps every major feature and component to its test coverage status. Use this to quickly identify what's tested and what requires manual verification.

### Legend

| Symbol | Meaning |
|--------|---------|
| :white_check_mark: | Automated tests exist |
| :large_orange_diamond: | Partial coverage |
| :red_circle: | No automated tests |
| **M** | Manual testing required |
| **U** | Unit test |
| **I** | Integration test |
| **E** | E2E test |

---

## Pages

| Page | Route | Test Status | Test Type | Notes |
|------|-------|-------------|-----------|-------|
| Landing | `/` | :red_circle: | M | Visual verification only |
| Auth | `/auth` | :red_circle: | M | Supabase Auth dependency |
| Onboarding | `/onboarding` | :red_circle: | M | Multi-step wizard |
| Dashboard | `/dashboard` | :red_circle: | M | Complex state management |
| Settings | `/settings` | :red_circle: | M | Tabs, forms, permissions |
| Unit Detail | `/units/:unitId` | :red_circle: | M | Real-time data, sensors |
| Site Detail | `/sites/:siteId` | :red_circle: | M | Hierarchy display |
| Area Detail | `/sites/:siteId/areas/:areaId` | :red_circle: | M | Unit listing |
| Alerts | `/alerts` | :red_circle: | M | Alert CRUD, acknowledgment |
| Reports | `/reports` | :red_circle: | M | Report generation |
| Manual Log | `/manual-log` | :red_circle: | M | Offline capability |
| Admin Health | `/admin/health` | :red_circle: | M | System diagnostics |
| Inspector | `/inspector` | :red_circle: | M | Debug tools |

**Coverage: 0/23 pages have automated tests**

---

## Components by Feature Area

### Settings Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| TTN Connection Settings | `TTNConnectionSettings.tsx` | :red_circle: | Critical |
| Sensor Manager | `SensorManager.tsx` | :red_circle: | Critical |
| Gateway Manager | `GatewayManager.tsx` | :red_circle: | Critical |
| Alert Rules Editor | `AlertRulesEditor.tsx` | :red_circle: | High |
| Notification Policy Editor | `NotificationPolicyEditor.tsx` | :red_circle: | High |
| Organization Settings | `OrganizationSettings.tsx` | :red_circle: | Medium |
| Escalation Contacts | `EscalationContactsManager.tsx` | :red_circle: | High |
| Branding Settings | `BrandingSettings.tsx` | :red_circle: | Low |

### Dashboard Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| Low Battery Widget | `LowBatteryWidget.tsx` | :red_circle: | Medium |
| Dashboard Layout | `DashboardLayout.tsx` | :red_circle: | Medium |
| Site Overview | `SiteOverview.tsx` | :red_circle: | Medium |
| Unit Status Card | `UnitStatusCard.tsx` | :red_circle: | High |

### Unit Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| Unit Alerts Banner | `UnitAlertsBanner.tsx` | :red_circle: | High |
| Unit Sensors Card | `UnitSensorsCard.tsx` | :red_circle: | High |
| Battery Health Card | `BatteryHealthCard.tsx` | :red_circle: | Medium |
| Temperature Graph | `TemperatureGraph.tsx` | :red_circle: | Medium |
| Unit Settings Section | `UnitSettingsSection.tsx` | :red_circle: | Medium |

### Alert Components

| Component | File | Test Status | Priority |
|-----------|------|-------------|----------|
| Alert Row | `AlertRow.tsx` | :red_circle: | High |
| Alert Detail Modal | `AlertDetailModal.tsx` | :red_circle: | High |
| Notification Dropdown | `NotificationDropdown.tsx` | :red_circle: | Medium |

### UI Components (shadcn/ui)

| Component | Test Status | Notes |
|-----------|-------------|-------|
| All 43 shadcn components | :large_orange_diamond: | Third-party, tested upstream |

---

## Hooks

| Hook | File | Test Status | Priority | Notes |
|------|------|-------------|----------|-------|
| useUnitStatus | `useUnitStatus.ts` | :red_circle: | Critical | Mirrors backend logic |
| useAlertRules | `useAlertRules.ts` | :red_circle: | Critical | CRUD operations |
| useLoraSensors | `useLoraSensors.ts` | :red_circle: | Critical | Sensor management |
| useGateways | `useGateways.ts` | :red_circle: | Critical | Gateway management |
| useNotificationPolicies | `useNotificationPolicies.ts` | :red_circle: | High | Notification config |
| useAuthAndOnboarding | `useAuthAndOnboarding.ts` | :red_circle: | High | Auth state |
| useUserRole | `useUserRole.ts` | :red_circle: | High | RBAC |
| useTTNSetupWizard | `useTTNSetupWizard.ts` | :red_circle: | High | Multi-step flow |
| useGatewayProvisioningPreflight | `useGatewayProvisioningPreflight.ts` | :red_circle: | High | TTN validation |
| useHealthCheck | `useHealthCheck.ts` | :red_circle: | Medium | System health |
| useOfflineSync | `useOfflineSync.ts` | :red_circle: | High | Offline capability |
| useBatteryForecast | `useBatteryForecast.ts` | :red_circle: | Medium | Predictions |
| useSoftDelete | `useSoftDelete.ts` | :red_circle: | Medium | Soft delete logic |
| useTTNDeprovision | `useTTNDeprovision.ts` | :red_circle: | Medium | Cleanup operations |

**Coverage: 0/26 hooks have automated tests**

---

## Library Functions (src/lib/)

### Eligibility Logic (TESTED)

| Function | File | Test Status | Tests |
|----------|------|-------------|-------|
| canProvisionGateway | `gatewayEligibility.ts` | :white_check_mark: | 9 cases |
| canEditGateway | `gatewayEligibility.ts` | :white_check_mark: | 3 cases |
| canDeleteGateway | `gatewayEligibility.ts` | :white_check_mark: | 3 cases |
| canProvisionSensor | `sensorEligibility.ts` | :white_check_mark: | 9 cases |
| canEditSensor | `sensorEligibility.ts` | :white_check_mark: | 3 cases |
| canDeleteSensor | `sensorEligibility.ts` | :white_check_mark: | 3 cases |

### Configuration (NOT TESTED)

| File | Test Status | Priority |
|------|-------------|----------|
| alertConfig.ts | :red_circle: | Medium |
| statusConfig.ts | :red_circle: | Medium |
| entityStatusConfig.ts | :red_circle: | Medium |
| validation.ts | :red_circle: | High |
| utils.ts | :red_circle: | Low |
| stripe.ts | :red_circle: | Medium |

---

## Edge Functions (supabase/functions/)

### Critical Functions

| Function | Test Status | Priority | Risk |
|----------|-------------|----------|------|
| `process-unit-states` | :red_circle: | **Critical** | Alert SSOT - untested |
| `process-escalations` | :red_circle: | **Critical** | Notification SSOT - untested |
| `ttn-webhook` | :red_circle: | **Critical** | Data ingestion - untested |
| `ingest-readings` | :red_circle: | **Critical** | Data pipeline - untested |

### TTN Management

| Function | Test Status | Priority |
|----------|-------------|----------|
| `ttn-bootstrap` | :red_circle: | High |
| `ttn-provision-device` | :red_circle: | High |
| `ttn-provision-gateway` | :red_circle: | High |
| `ttn-gateway-preflight` | :red_circle: | High |
| `ttn-list-devices` | :red_circle: | Medium |
| `ttn-deprovision-worker` | :red_circle: | Medium |

### Shared Utilities

| File | Test Status | Tests |
|------|-------------|-------|
| `ttnPermissions.ts` | :white_check_mark: | 5 cases |
| `ttnConfig.ts` | :red_circle: | - |
| `validation.ts` | :red_circle: | - |
| `response.ts` | :red_circle: | - |
| `cors.ts` | :red_circle: | - |

### Billing Functions

| Function | Test Status | Priority |
|----------|-------------|----------|
| `stripe-checkout` | :red_circle: | High |
| `stripe-portal` | :red_circle: | High |
| `stripe-webhook` | :red_circle: | High |

### Other Functions

| Function | Test Status | Priority |
|----------|-------------|----------|
| `health-check` | :red_circle: | Medium |
| `sensor-simulator` | :red_circle: | Low |
| `create-organization` | :red_circle: | Medium |
| `soft-delete-cleanup` | :red_circle: | Low |

**Coverage: 1/32 edge functions have tests (3%)**

---

## Database (Migrations & RLS)

### Tables with RLS Policies

| Table | RLS Tested | Notes |
|-------|------------|-------|
| organizations | :red_circle: | Multi-tenant isolation |
| profiles | :red_circle: | User access |
| units | :red_circle: | Org-scoped access |
| alerts | :red_circle: | Status filtering |
| sensor_readings | :red_circle: | Time-series data |
| lora_sensors | :red_circle: | Device management |
| gateways | :red_circle: | Gateway management |
| alert_rules | :red_circle: | Cascading settings |
| notification_policies | :red_circle: | Notification config |
| escalation_contacts | :red_circle: | Contact management |

**No automated RLS policy tests exist**

---

## External Integrations

| Integration | Test Status | Testing Approach |
|-------------|-------------|------------------|
| Supabase Auth | :red_circle: | Manual testing |
| Supabase Database | :red_circle: | Local instance for integration |
| The Things Network (TTN) | :red_circle: | Test TTN application |
| Stripe | :red_circle: | Test mode + webhooks |
| Twilio (SMS) | :red_circle: | Manual testing |
| Resend (Email) | :red_circle: | Manual testing |

---

## Feature Coverage Summary

| Feature Area | Files | Tested | Coverage |
|--------------|-------|--------|----------|
| **Pages** | 23 | 0 | 0% |
| **Components** | 112 | 0 | 0% |
| **Hooks** | 26 | 0 | 0% |
| **Edge Functions** | 32 | 1 | 3% |
| **Lib/Actions** | 6 functions | 6 | 100% |
| **Lib/Config** | 6 files | 0 | 0% |

### Overall Automated Test Coverage

| Metric | Count |
|--------|-------|
| Total test files | 3 |
| Total test cases | ~35 |
| Lines of test code | 476 |
| **Estimated code coverage** | **< 5%** |

---

## Test File Inventory

### Existing Test Files

```
src/lib/actions/gatewayEligibility.test.ts   (178 lines, 15 tests)
src/lib/actions/sensorEligibility.test.ts    (193 lines, 15 tests)
supabase/functions/_shared/ttnPermissions.test.ts (105 lines, 5 tests)
```

### Testing Infrastructure

```
src/test/setup.ts                 # Jest-DOM matchers
vite.config.ts                    # Vitest configuration
package.json                      # Dependencies (vitest, testing-library)
```

---

## Priority Matrix

### Immediate Priority (Week 1-2)

| What | Why | Type |
|------|-----|------|
| `process-unit-states` | Alert SSOT, safety-critical | Unit + Integration |
| `ttn-webhook` | Data ingestion entry point | Integration |
| `useUnitStatus` | Frontend status computation | Unit |

### High Priority (Week 3-4)

| What | Why | Type |
|------|-----|------|
| `process-escalations` | Notification SSOT | Unit + Integration |
| `useAlertRules` | Alert configuration | Unit |
| `useLoraSensors` | Device management | Unit |
| Onboarding flow | Critical user journey | E2E Manual |

### Medium Priority (Month 2)

| What | Why | Type |
|------|-----|------|
| RLS policy tests | Security validation | Integration |
| Dashboard components | User-facing | Component |
| Settings components | Configuration | Component |

---

## How to Read This Map

1. **Identify the feature** you're working on
2. **Check the test status** in this document
3. **If :red_circle:**, either:
   - Write automated tests before making changes
   - Follow manual testing procedures in [MANUAL_TESTING.md](#manual_testing)
4. **If :white_check_mark:**, ensure existing tests still pass
5. **Update this document** when adding new tests

---

## Related Documents

- [TEST_STRATEGY.md](#test_strategy) — Overall testing philosophy
- [MANUAL_TESTING.md](#manual_testing) — Step-by-step manual QA checklists
- [E2E_SCENARIOS.md](#e2e_scenarios) — Critical user flow testing
- [KNOWN_GAPS.md](#known_gaps) — Missing coverage and risks


---

\newpage

<a id="qa-manual_testing"></a>

# Manual Testing Guide

> Step-by-step QA checklists for FreshTrack Pro

---

## How to Use This Guide

1. **Before testing:** Ensure you have access to a test environment
2. **During testing:** Follow each step exactly, check the boxes
3. **After testing:** Document any failures with screenshots
4. **Report issues:** Create tickets with reproduction steps

### Test Environment Requirements

| Requirement | Details |
|-------------|---------|
| Browser | Chrome (latest), Firefox, Safari, Edge |
| Mobile | iOS Safari, Android Chrome |
| Test account | QA account with admin permissions |
| TTN access | Test TTN application (not production) |
| Stripe | Test mode API keys |

---

## Section 1: Authentication & Onboarding

### 1.1 New User Registration

**Preconditions:** Logged out, fresh browser session

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/auth` | Sign in form displays | [ ] |
| 2 | Click "Sign Up" tab | Sign up form displays | [ ] |
| 3 | Enter valid email | Email field accepts input | [ ] |
| 4 | Enter password (< 6 chars) | Error: "Password must be at least 6 characters" | [ ] |
| 5 | Enter valid password (6+ chars) | Password field accepts input | [ ] |
| 6 | Click "Sign Up" | Loading indicator appears | [ ] |
| 7 | Wait for completion | Redirects to onboarding page | [ ] |
| 8 | Check email | Confirmation email received | [ ] |

### 1.2 User Login

**Preconditions:** Registered account exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/auth` | Sign in form displays | [ ] |
| 2 | Enter registered email | Email field accepts input | [ ] |
| 3 | Enter wrong password | Error: "Invalid login credentials" | [ ] |
| 4 | Enter correct password | Password field accepts input | [ ] |
| 5 | Click "Sign In" | Loading indicator appears | [ ] |
| 6 | Wait for completion | Redirects to dashboard | [ ] |

### 1.3 Onboarding Wizard

**Preconditions:** New user, first login

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | After first login | Onboarding wizard appears | [ ] |
| 2 | Enter organization name | Field accepts input | [ ] |
| 3 | Click "Next" | Moves to site creation step | [ ] |
| 4 | Enter site name | Field accepts input | [ ] |
| 5 | Enter site address (optional) | Address field works | [ ] |
| 6 | Click "Next" | Moves to area creation step | [ ] |
| 7 | Enter area name | Field accepts input | [ ] |
| 8 | Click "Next" | Moves to unit creation step | [ ] |
| 9 | Enter unit name | Field accepts input | [ ] |
| 10 | Select unit type | Dropdown works | [ ] |
| 11 | Set temperature range | Min/Max sliders work | [ ] |
| 12 | Click "Complete Setup" | Wizard completes | [ ] |
| 13 | Verify redirect | Dashboard displays with new unit | [ ] |

### 1.4 Password Reset

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/auth` | Sign in form displays | [ ] |
| 2 | Click "Forgot Password" | Reset form appears | [ ] |
| 3 | Enter registered email | Email field accepts input | [ ] |
| 4 | Click "Send Reset Link" | Success message appears | [ ] |
| 5 | Check email | Reset link received | [ ] |
| 6 | Click reset link | Password reset form appears | [ ] |
| 7 | Enter new password | Password accepted | [ ] |
| 8 | Submit | Success message, redirect to login | [ ] |
| 9 | Login with new password | Login successful | [ ] |

---

## Section 2: TTN Configuration

### 2.1 TTN Setup Wizard

**Preconditions:** Logged in as admin, TTN not configured

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → TTN | TTN settings page displays | [ ] |
| 2 | Click "Connect to TTN" | Setup wizard opens | [ ] |
| 3 | Enter TTN Application ID | Field accepts input | [ ] |
| 4 | Enter TTN API Key | Field accepts input (masked) | [ ] |
| 5 | Click "Validate" | Validation starts | [ ] |
| 6 | Wait for validation | Permission report displays | [ ] |
| 7 | If permissions valid | "Configuration Valid" message | [ ] |
| 8 | If permissions invalid | Missing permissions listed | [ ] |
| 9 | Click "Save Configuration" | Configuration saved | [ ] |
| 10 | Verify webhook created | TTN console shows webhook | [ ] |

### 2.2 TTN Permission Validation

**Preconditions:** Have TTN API key with known permissions

| Permission | Required | Test Action | Pass/Fail |
|------------|----------|-------------|-----------|
| `RIGHT_APPLICATION_INFO` | Yes | Validate basic info read | [ ] |
| `RIGHT_APPLICATION_TRAFFIC_READ` | Yes | Required for webhook data | [ ] |
| `RIGHT_APPLICATION_SETTINGS_BASIC` | Yes | Webhook configuration | [ ] |
| `RIGHT_APPLICATION_DEVICES_READ` | Yes | Device listing | [ ] |
| `RIGHT_APPLICATION_DEVICES_WRITE` | Yes | Device provisioning | [ ] |
| `RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE` | No | Downlink (optional) | [ ] |

---

## Section 3: Device Management

### 3.1 Gateway Registration

**Preconditions:** TTN configured, admin access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Gateways | Gateway list displays | [ ] |
| 2 | Click "Add Gateway" | Add gateway form opens | [ ] |
| 3 | Enter Gateway EUI (invalid format) | Error: "Invalid EUI format" | [ ] |
| 4 | Enter Gateway EUI (16 hex chars) | Field accepts input | [ ] |
| 5 | Enter Gateway name | Field accepts input | [ ] |
| 6 | Select location | Location selector works | [ ] |
| 7 | Click "Save" | Gateway saved (pending status) | [ ] |
| 8 | Click "Provision" on gateway | Provisioning starts | [ ] |
| 9 | Wait for completion | Status changes to "active" | [ ] |
| 10 | Verify in TTN Console | Gateway appears in TTN | [ ] |

### 3.2 Sensor Registration

**Preconditions:** TTN configured, admin access, unit exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Sensors | Sensor list displays | [ ] |
| 2 | Click "Add Sensor" | Add sensor form opens | [ ] |
| 3 | Enter DevEUI (invalid format) | Error: "Invalid DevEUI format" | [ ] |
| 4 | Enter DevEUI (16 hex chars) | Field accepts input | [ ] |
| 5 | Enter AppKey (32 hex chars) | Field accepts input | [ ] |
| 6 | Select unit to assign | Unit dropdown works | [ ] |
| 7 | Click "Save" | Sensor saved (pending status) | [ ] |
| 8 | Click "Provision" on sensor | Provisioning starts | [ ] |
| 9 | Wait for completion | Status changes to "joining" | [ ] |
| 10 | Verify in TTN Console | Device appears in TTN | [ ] |
| 11 | Power on physical sensor | Wait for join | [ ] |
| 12 | Verify sensor joins | Status changes to "active" | [ ] |

### 3.3 Sensor Assignment to Unit

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to unit detail page | Unit page displays | [ ] |
| 2 | Click "Assign Sensor" | Sensor selector opens | [ ] |
| 3 | Select available sensor | Sensor selected | [ ] |
| 4 | Click "Assign" | Sensor assigned to unit | [ ] |
| 5 | Verify sensor shows on unit | Sensor card displays | [ ] |
| 6 | Verify readings flow | Temperature data appears | [ ] |

### 3.4 Device Deprovisioning

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Select provisioned device | Device selected | [ ] |
| 2 | Click "Deprovision" | Confirmation dialog appears | [ ] |
| 3 | Confirm deprovisioning | Deprovisioning starts | [ ] |
| 4 | Wait for completion | Status changes to "pending" | [ ] |
| 5 | Verify removed from TTN | Device gone from TTN console | [ ] |

---

## Section 4: Alert Configuration

### 4.1 Alert Rules Setup

**Preconditions:** Unit exists, admin access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Alert Rules | Alert rules list displays | [ ] |
| 2 | Select a unit | Unit-specific rules show | [ ] |
| 3 | Click "Add Rule" | Rule form opens | [ ] |
| 4 | Set high temperature threshold | Slider/input works | [ ] |
| 5 | Set low temperature threshold | Slider/input works | [ ] |
| 6 | Set confirm time (minutes) | Input accepts number | [ ] |
| 7 | Click "Save" | Rule saved | [ ] |
| 8 | Verify rule appears in list | Rule displays correctly | [ ] |

### 4.2 Notification Policy Setup

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Notifications | Notification settings display | [ ] |
| 2 | Click "Add Policy" | Policy form opens | [ ] |
| 3 | Enter policy name | Field accepts input | [ ] |
| 4 | Select alert types | Multi-select works | [ ] |
| 5 | Select notification channels | Email/SMS/Push checkboxes | [ ] |
| 6 | Set escalation delay | Time input works | [ ] |
| 7 | Add escalation contacts | Contact selector works | [ ] |
| 8 | Click "Save" | Policy saved | [ ] |

### 4.3 Escalation Contact Management

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Contacts | Contact list displays | [ ] |
| 2 | Click "Add Contact" | Contact form opens | [ ] |
| 3 | Enter contact name | Field accepts input | [ ] |
| 4 | Enter email address | Email validation works | [ ] |
| 5 | Enter phone number | Phone validation works | [ ] |
| 6 | Set escalation level | Level selector works | [ ] |
| 7 | Click "Save" | Contact saved | [ ] |
| 8 | Verify in contact list | Contact appears | [ ] |

---

## Section 5: Dashboard & Monitoring

### 5.1 Dashboard Overview

**Preconditions:** Logged in, units configured

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/dashboard` | Dashboard loads | [ ] |
| 2 | Verify unit cards display | All units show status | [ ] |
| 3 | Verify color coding | Green/Yellow/Red correct | [ ] |
| 4 | Click on a unit card | Navigates to unit detail | [ ] |
| 5 | Verify battery indicators | Battery levels show | [ ] |
| 6 | Verify last reading time | Timestamps accurate | [ ] |

### 5.2 Unit Detail Page

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to unit detail | Unit page loads | [ ] |
| 2 | Verify temperature graph | Graph displays readings | [ ] |
| 3 | Change time range | Graph updates | [ ] |
| 4 | Verify current temperature | Current reading displays | [ ] |
| 5 | Verify status badge | Status correct | [ ] |
| 6 | Verify sensor list | Assigned sensors show | [ ] |
| 7 | Verify alert banner | Active alerts show (if any) | [ ] |

### 5.3 Real-Time Updates

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open unit detail page | Page displays | [ ] |
| 2 | Wait for new sensor reading | (5-minute interval) | [ ] |
| 3 | Verify auto-update | New reading appears | [ ] |
| 4 | Verify no page refresh needed | Data updates in place | [ ] |

---

## Section 6: Alert Handling

### 6.1 Alert Acknowledgment

**Preconditions:** Active alert exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/alerts` | Alert list displays | [ ] |
| 2 | Find active alert | Alert row visible | [ ] |
| 3 | Click "Acknowledge" | Confirmation dialog appears | [ ] |
| 4 | Enter acknowledgment note | Text field accepts input | [ ] |
| 5 | Click "Confirm" | Alert status changes | [ ] |
| 6 | Verify status update | Shows "acknowledged" | [ ] |
| 7 | Verify timestamp | Acknowledgment time recorded | [ ] |

### 6.2 Alert Resolution

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Temperature returns to normal | Condition resolves | [ ] |
| 2 | Wait for processing | System processes state | [ ] |
| 3 | Verify alert auto-resolves | Status changes to "resolved" | [ ] |
| 4 | Check resolution time | Timestamp recorded | [ ] |
| 5 | Alert moves to history | Not in active list | [ ] |

### 6.3 Alert Notification Delivery

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Trigger temperature excursion | (Simulator or real) | [ ] |
| 2 | Wait for confirm time | Alert triggers | [ ] |
| 3 | Check email | Email notification received | [ ] |
| 4 | Check SMS (if configured) | SMS received | [ ] |
| 5 | Check push notification | Push received | [ ] |
| 6 | Verify notification content | Contains unit, temp, time | [ ] |

---

## Section 7: Manual Temperature Logging

### 7.1 Online Manual Log

**Preconditions:** Logged in, unit exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/manual-log` | Manual log page displays | [ ] |
| 2 | Select unit | Unit dropdown works | [ ] |
| 3 | Enter temperature value | Number input works | [ ] |
| 4 | Add optional note | Text field works | [ ] |
| 5 | Click "Log Temperature" | Submission starts | [ ] |
| 6 | Verify success message | "Temperature logged" shows | [ ] |
| 7 | Check unit detail | Manual log appears in history | [ ] |

### 7.2 Offline Manual Log

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Enable airplane mode | Device offline | [ ] |
| 2 | Navigate to `/manual-log` | Page loads from cache | [ ] |
| 3 | Enter temperature | Input works offline | [ ] |
| 4 | Click "Log Temperature" | Stored locally | [ ] |
| 5 | Verify pending indicator | Shows "pending sync" | [ ] |
| 6 | Disable airplane mode | Device online | [ ] |
| 7 | Wait for sync | Data syncs to server | [ ] |
| 8 | Verify synced | Pending indicator clears | [ ] |
| 9 | Check unit detail | Entry appears in history | [ ] |

---

## Section 8: Reports

### 8.1 Temperature Log Report

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/reports` | Reports page displays | [ ] |
| 2 | Select "Temperature Log" | Report type selected | [ ] |
| 3 | Select date range | Date picker works | [ ] |
| 4 | Select units/sites | Multi-select works | [ ] |
| 5 | Click "Generate" | Report generates | [ ] |
| 6 | Verify data content | Readings display correctly | [ ] |
| 7 | Click "Export PDF" | PDF downloads | [ ] |
| 8 | Open PDF | Content matches on-screen | [ ] |

### 8.2 Compliance Report

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Select "Compliance Report" | Report type selected | [ ] |
| 2 | Select time period | 30/60/90 days options | [ ] |
| 3 | Click "Generate" | Report generates | [ ] |
| 4 | Verify summary stats | Counts accurate | [ ] |
| 5 | Verify alert history | Alerts listed | [ ] |
| 6 | Verify corrective actions | Actions documented | [ ] |

---

## Section 9: Mobile Responsiveness

### 9.1 Mobile Layout Check

**Test on:** iPhone SE (375px), iPhone 14 (390px), Android (360px)

| Page | Test | Pass/Fail |
|------|------|-----------|
| Dashboard | Units readable, cards stack vertically | [ ] |
| Unit Detail | Graph scrollable, data visible | [ ] |
| Settings | Navigation accessible, forms usable | [ ] |
| Manual Log | Form fields full width, easy to tap | [ ] |
| Alerts | Alert rows readable, actions accessible | [ ] |

### 9.2 Touch Interactions

| Interaction | Test | Pass/Fail |
|-------------|------|-----------|
| Buttons | Minimum 44px tap target | [ ] |
| Dropdowns | Easy to select on mobile | [ ] |
| Modals | Close button accessible | [ ] |
| Scroll | Smooth, no jank | [ ] |
| Pull to refresh | Works where expected | [ ] |

---

## Section 10: Role-Based Access

### 10.1 Staff Role Permissions

**Preconditions:** Logged in as staff user

| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| View dashboard | Allowed | [ ] |
| View unit details | Allowed | [ ] |
| Log temperature manually | Allowed | [ ] |
| Acknowledge alerts | Allowed | [ ] |
| Add new sensor | **Denied** | [ ] |
| Delete unit | **Denied** | [ ] |
| Access billing | **Denied** | [ ] |

### 10.2 Manager Role Permissions

**Preconditions:** Logged in as manager

| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| All staff permissions | Allowed | [ ] |
| Create units | Allowed | [ ] |
| Edit alert rules | Allowed | [ ] |
| View reports | Allowed | [ ] |
| Manage users | **Denied** | [ ] |
| Access billing | **Denied** | [ ] |

### 10.3 Admin/Owner Permissions

| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| All manager permissions | Allowed | [ ] |
| Manage users | Allowed | [ ] |
| Configure TTN | Allowed | [ ] |
| Access billing | Allowed | [ ] |
| Delete organization | Allowed (owner only) | [ ] |

---

## Section 11: Browser Compatibility

Test all major pages on:

| Browser | Version | Dashboard | Settings | Alerts | Manual Log |
|---------|---------|-----------|----------|--------|------------|
| Chrome | Latest | [ ] | [ ] | [ ] | [ ] |
| Firefox | Latest | [ ] | [ ] | [ ] | [ ] |
| Safari | Latest | [ ] | [ ] | [ ] | [ ] |
| Edge | Latest | [ ] | [ ] | [ ] | [ ] |
| Safari iOS | Latest | [ ] | [ ] | [ ] | [ ] |
| Chrome Android | Latest | [ ] | [ ] | [ ] | [ ] |

---

## Section 12: Performance Checks

### 12.1 Page Load Times

| Page | Target | Actual | Pass/Fail |
|------|--------|--------|-----------|
| Dashboard | < 3s | ___s | [ ] |
| Unit Detail | < 2s | ___s | [ ] |
| Settings | < 2s | ___s | [ ] |
| Reports | < 3s | ___s | [ ] |

### 12.2 Data Operations

| Operation | Target | Actual | Pass/Fail |
|-----------|--------|--------|-----------|
| Save alert rule | < 1s | ___s | [ ] |
| Acknowledge alert | < 1s | ___s | [ ] |
| Log temperature | < 1s | ___s | [ ] |
| Generate report | < 5s | ___s | [ ] |

---

## Test Session Template

```markdown
## Test Session Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Staging/Local/Production]
**Browser:** [Browser/Version]
**Device:** [Desktop/Mobile/Tablet]

### Sections Tested
- [ ] Section 1: Authentication
- [ ] Section 2: TTN Configuration
- [ ] Section 3: Device Management
- [ ] Section 4: Alert Configuration
- [ ] Section 5: Dashboard
- [ ] Section 6: Alert Handling
- [ ] Section 7: Manual Logging
- [ ] Section 8: Reports
- [ ] Section 9: Mobile
- [ ] Section 10: Permissions
- [ ] Section 11: Browser Compatibility
- [ ] Section 12: Performance

### Issues Found
| ID | Section | Description | Severity | Screenshot |
|----|---------|-------------|----------|------------|
| 1  |         |             |          |            |

### Notes
[Additional observations]
```

---

## Related Documents

- [TEST_STRATEGY.md](#test_strategy) — Overall testing philosophy
- [COVERAGE_MAP.md](#coverage_map) — Feature-to-test mapping
- [E2E_SCENARIOS.md](#e2e_scenarios) — Critical user flow testing
- [KNOWN_GAPS.md](#known_gaps) — Missing coverage and risks


---

\newpage

<a id="qa-e2e_scenarios"></a>

# End-to-End Test Scenarios

> Critical user flows with full preconditions, steps, and expected results

---

## Overview

These scenarios represent the most critical user journeys through FreshTrack Pro. Each scenario should be executed completely to validate system behavior under real-world conditions.

### Scenario Priority Levels

| Level | Description | Testing Frequency |
|-------|-------------|-------------------|
| **P0** | Business-critical, safety-impacting | Every release |
| **P1** | Core functionality | Every release |
| **P2** | Important features | Major releases |
| **P3** | Nice-to-have | Quarterly |

---

## Scenario 1: New Customer Onboarding (P0)

### Description
A new customer signs up, configures their organization, connects TTN, provisions their first device, and receives their first temperature reading.

### Preconditions
- Fresh test account (not previously registered)
- Valid TTN application with API key
- Physical gateway and sensor (or simulator)
- Email access for verification

### Test Data Required
```
Email: test-{timestamp}@example.com
TTN Application ID: test-freshtrack-app
TTN API Key: NNSXS.xxx... (with full permissions)
Gateway EUI: AABBCCDDEEFF0011
Sensor DevEUI: 0011223344556677
Sensor AppKey: 00112233445566778899AABBCCDDEEFF
```

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Navigate to `/auth` | Sign-up form displays | |
| 2 | Create account with test email | Account created, redirect to onboarding | |
| 3 | Complete onboarding wizard (org, site, area, unit) | Organization structure created | |
| 4 | Navigate to Settings → TTN | TTN settings page shows "Not Connected" | |
| 5 | Enter TTN Application ID | Field accepts input | |
| 6 | Enter TTN API Key | Field accepts input (masked) | |
| 7 | Click "Validate Connection" | Permission validation runs | |
| 8 | Verify all permissions valid | Green checkmarks for all permissions | |
| 9 | Click "Save Configuration" | Configuration saved, webhook created | |
| 10 | Navigate to Settings → Gateways | Gateway list shows (empty) | |
| 11 | Add gateway with test EUI | Gateway created in "pending" status | |
| 12 | Click "Provision to TTN" | Provisioning starts | |
| 13 | Wait for provisioning | Status changes to "active" | |
| 14 | Navigate to Settings → Sensors | Sensor list shows (empty) | |
| 15 | Add sensor with test DevEUI/AppKey | Sensor created in "pending" status | |
| 16 | Assign sensor to unit | Sensor assigned | |
| 17 | Click "Provision to TTN" | Provisioning starts | |
| 18 | Wait for device to join | Status changes to "joining" then "active" | |
| 19 | Navigate to Dashboard | Dashboard shows unit | |
| 20 | Wait for first reading (~5 min) | Temperature value appears on unit card | |
| 21 | Click on unit card | Unit detail page shows temperature graph | |

### Success Criteria
- [ ] Account created successfully
- [ ] Organization structure visible
- [ ] TTN webhook verified in TTN Console
- [ ] Gateway visible in TTN Console
- [ ] Sensor visible in TTN Console
- [ ] First temperature reading received within 10 minutes
- [ ] Temperature displays correctly on dashboard

### Failure Handling

| Failure Point | Recovery Action |
|---------------|-----------------|
| TTN validation fails | Verify API key permissions in TTN Console |
| Gateway provisioning fails | Check Gateway EUI format, verify not already registered |
| Sensor won't join | Verify AppKey matches, check gateway is online |
| No readings received | Check TTN Live Data tab, verify webhook URL |

---

## Scenario 2: Temperature Excursion Alert Lifecycle (P0)

### Description
A refrigerator temperature rises above threshold, triggering an alert that is acknowledged and then resolves when temperature returns to normal.

### Preconditions
- Unit with active sensor
- Alert rule configured (e.g., max 40°F)
- Notification policy with email enabled
- Escalation contacts configured

### Test Data Required
```
Unit: Test Cooler
Max Temperature Threshold: 40°F (4.4°C)
Confirm Time: 5 minutes
Escalation Delay: 15 minutes
Primary Contact: primary@test.com
Secondary Contact: secondary@test.com
```

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Verify unit shows "OK" status | Dashboard shows green status | |
| 2 | Cause temperature to rise above 40°F | (Use simulator or physical test) | |
| 3 | Wait 1 minute | Unit status may show "excursion" | |
| 4 | Wait for confirm time (5 min) | Alert status changes to "triggered" | |
| 5 | Check primary contact email | Alert notification received | |
| 6 | Verify notification content | Contains unit name, temperature, timestamp | |
| 7 | Navigate to `/alerts` | Alert appears in active list | |
| 8 | Click on alert row | Alert detail displays | |
| 9 | Verify alert details | Type, severity, timestamps correct | |
| 10 | Click "Acknowledge" | Acknowledgment dialog appears | |
| 11 | Enter note: "Investigating issue" | Note field accepts input | |
| 12 | Confirm acknowledgment | Alert status changes to "acknowledged" | |
| 13 | Verify escalation stopped | Secondary contact NOT notified yet | |
| 14 | Return temperature to normal | (Use simulator or physical test) | |
| 15 | Wait for next processing cycle | Alert auto-resolves | |
| 16 | Verify alert resolved | Status shows "resolved" in history | |
| 17 | Verify unit status | Dashboard shows "OK" again | |

### Success Criteria
- [ ] Alert triggered after confirm time
- [ ] Email notification delivered within 2 minutes of trigger
- [ ] Notification contains accurate information
- [ ] Acknowledgment stops escalation
- [ ] Alert resolves when condition clears
- [ ] Full audit trail preserved

### Failure Handling

| Failure Point | Recovery Action |
|---------------|-----------------|
| Alert not triggered | Check `process-unit-states` logs, verify alert rules |
| Email not received | Check spam, verify notification policy, check Resend logs |
| Alert won't resolve | Verify temperature actually below threshold, check processing |

---

## Scenario 3: Alert Escalation Chain (P0)

### Description
An alert is triggered but not acknowledged, causing automatic escalation through the contact chain.

### Preconditions
- Alert rule configured
- Notification policy with escalation enabled
- Multiple escalation levels configured:
  - Level 1: primary@test.com (0 min delay)
  - Level 2: manager@test.com (15 min delay)
  - Level 3: director@test.com (30 min delay)

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Trigger temperature excursion | Alert created | |
| 2 | Wait for confirm time | Alert status: "triggered" | |
| 3 | Check Level 1 email | Notification received | |
| 4 | **Do NOT acknowledge** | Alert remains triggered | |
| 5 | Wait 15 minutes | Escalation timer runs | |
| 6 | Check Level 2 email | Escalation notification received | |
| 7 | Verify escalation flag | Alert shows "escalated" | |
| 8 | **Do NOT acknowledge** | Alert remains triggered | |
| 9 | Wait 15 more minutes (30 total) | Second escalation | |
| 10 | Check Level 3 email | Second escalation notification received | |
| 11 | Acknowledge as Level 3 | Alert acknowledged | |
| 12 | Verify acknowledgment record | Shows who acknowledged, timestamp | |

### Success Criteria
- [ ] Each escalation level notified at correct time
- [ ] Escalation notifications include escalation context
- [ ] Acknowledgment at any level stops further escalation
- [ ] Full escalation history preserved

### Timing Diagram

```
0 min     5 min     15 min    30 min
  |         |         |         |
  |--Confirm--|--Wait---|--Wait---|
  |           |         |         |
              |         |         |
            Alert     Level 2   Level 3
           Triggers   Notified  Notified
           Level 1
           Notified
```

---

## Scenario 4: Offline Manual Logging with Sync (P1)

### Description
Staff logs temperature manually while offline, data syncs when connectivity returns.

### Preconditions
- Unit exists with manual logging enabled
- Staff user account
- Mobile device with app access

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Log in on mobile device | Dashboard loads | |
| 2 | Navigate to Manual Log | Manual log page displays | |
| 3 | Enable airplane mode | Device offline | |
| 4 | Verify offline indicator | "Offline" badge appears | |
| 5 | Select unit from dropdown | Unit selected (cached) | |
| 6 | Enter temperature: 38°F | Input accepted | |
| 7 | Add note: "Visual check" | Note accepted | |
| 8 | Tap "Log Temperature" | Success with "pending sync" | |
| 9 | Repeat for 2 more entries | All stored locally | |
| 10 | Disable airplane mode | Device online | |
| 11 | Wait for sync | Sync indicator appears | |
| 12 | Verify sync complete | "Pending" badges clear | |
| 13 | Check unit detail page | All 3 entries appear in history | |
| 14 | Verify timestamps | Original entry times preserved | |

### Success Criteria
- [ ] Offline logging works without errors
- [ ] All entries synced without data loss
- [ ] Original timestamps preserved
- [ ] Entries appear in correct chronological order

### Failure Handling

| Failure Point | Recovery Action |
|---------------|-----------------|
| Offline mode not working | Check service worker registration, clear cache |
| Sync fails | Check network, retry sync, examine IndexedDB |
| Entries missing | Check local storage, check for sync conflicts |

---

## Scenario 5: Multi-Location Monitoring (P1)

### Description
Regional manager monitors multiple locations, receives alerts from different sites, and generates consolidated reports.

### Preconditions
- Organization with 3+ sites configured
- Units at each site with sensors
- Regional manager account with access to all sites
- Alert rules configured for each site

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Log in as regional manager | Dashboard loads | |
| 2 | Verify all sites visible | 3+ sites displayed | |
| 3 | Verify aggregate status | Overall org status shows | |
| 4 | Click on Site A | Site detail page shows | |
| 5 | Verify Site A units | Units list displays | |
| 6 | Navigate back to dashboard | Dashboard displays | |
| 7 | Click on Site B | Site B detail page shows | |
| 8 | Trigger alert at Site A | (Background action) | |
| 9 | Refresh dashboard | Alert indicator appears for Site A | |
| 10 | Click alert notification | Navigate to alert | |
| 11 | Acknowledge alert | Alert acknowledged | |
| 12 | Navigate to Reports | Reports page displays | |
| 13 | Select "All Sites" | Multi-site scope selected | |
| 14 | Select last 7 days | Date range set | |
| 15 | Generate compliance report | Report generates | |
| 16 | Verify all sites in report | Data from all 3 sites included | |
| 17 | Export PDF | PDF downloads | |
| 18 | Verify PDF content | All site data in document | |

### Success Criteria
- [ ] All sites accessible from single dashboard
- [ ] Aggregate status accurate
- [ ] Alerts visible regardless of source site
- [ ] Cross-site reports generate correctly

---

## Scenario 6: Device Failure and Recovery (P1)

### Description
A sensor goes offline, triggers monitoring interrupt alert, and then recovers when replaced.

### Preconditions
- Unit with active sensor
- Monitoring interrupt rule enabled (e.g., offline > 30 min)
- Replacement sensor available

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Verify sensor is "active" | Dashboard shows normal status | |
| 2 | Simulate sensor failure | (Power off or remove battery) | |
| 3 | Wait 30 minutes | Sensor goes offline | |
| 4 | Verify sensor status | Status changes to "offline" | |
| 5 | Verify unit status | Shows "monitoring_interrupted" | |
| 6 | Check for alert | "Monitoring Interrupted" alert created | |
| 7 | Check notification | Alert notification received | |
| 8 | Navigate to Settings → Sensors | Sensor shows offline | |
| 9 | Deprovision failed sensor | Sensor removed from TTN | |
| 10 | Add replacement sensor | New sensor added | |
| 11 | Provision replacement | Sensor provisioned to TTN | |
| 12 | Assign to unit | Sensor assigned | |
| 13 | Power on replacement sensor | Device joins network | |
| 14 | Wait for first reading | Reading received | |
| 15 | Verify unit status | Returns to "OK" | |
| 16 | Verify original alert | Should auto-resolve | |

### Success Criteria
- [ ] Offline detection works within expected timeframe
- [ ] Monitoring interrupt alert triggers
- [ ] Sensor replacement process works
- [ ] Unit status recovers automatically

---

## Scenario 7: Health Inspection Report (P1)

### Description
Generate compliance documentation for a health inspector requesting 90 days of temperature records.

### Preconditions
- 90+ days of temperature data
- Some alerts during period (for realistic testing)
- Admin or manager account

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Navigate to Reports | Reports page displays | |
| 2 | Select "Compliance Report" | Report type selected | |
| 3 | Set date range: last 90 days | Date range set | |
| 4 | Select specific site | Site scope set | |
| 5 | Click "Generate Report" | Report loading starts | |
| 6 | Wait for completion | Report displays | |
| 7 | Verify summary section | Total readings, alert count | |
| 8 | Verify reading counts | Expected number present | |
| 9 | Verify alert history | Alerts listed with resolution | |
| 10 | Verify corrective actions | Actions documented | |
| 11 | Click "Export PDF" | PDF generates | |
| 12 | Download PDF | File downloads | |
| 13 | Open PDF | Content renders correctly | |
| 14 | Verify all sections present | Summary, data, alerts, actions | |
| 15 | Verify timestamps | All in correct timezone | |

### Success Criteria
- [ ] Report generates within 30 seconds
- [ ] All 90 days of data included
- [ ] Alert history complete
- [ ] PDF professional and print-ready
- [ ] Data matches on-screen display

---

## Scenario 8: Billing and Plan Upgrade (P2)

### Description
Customer upgrades from Starter to Pro plan to add more sensors.

### Preconditions
- Account on Starter plan
- Stripe test mode enabled
- Test card numbers available

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Navigate to Settings → Billing | Billing page displays | |
| 2 | Verify current plan | Shows "Starter" | |
| 3 | Click "Upgrade Plan" | Plan selection appears | |
| 4 | Select "Pro" plan | Pro features highlighted | |
| 5 | Click "Continue" | Stripe checkout opens | |
| 6 | Enter test card: 4242... | Card accepted | |
| 7 | Complete checkout | Payment processes | |
| 8 | Return to app | Success message | |
| 9 | Verify plan updated | Shows "Pro" | |
| 10 | Verify sensor limit increased | Limit shows 25 | |
| 11 | Add sensor beyond old limit | Sensor added successfully | |
| 12 | Check Stripe dashboard | Subscription active | |

### Success Criteria
- [ ] Checkout flow completes
- [ ] Plan updates immediately
- [ ] New limits take effect
- [ ] Stripe webhook processed correctly

---

## Scenario 9: User Role and Permission Changes (P2)

### Description
Admin invites new user, assigns role, and verifies permission enforcement.

### Preconditions
- Admin account
- New user email for invitation

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Log in as admin | Dashboard displays | |
| 2 | Navigate to Settings → Users | User list displays | |
| 3 | Click "Invite User" | Invitation form opens | |
| 4 | Enter new user email | Email accepted | |
| 5 | Select role: "Staff" | Role selected | |
| 6 | Send invitation | Invitation sent | |
| 7 | Check new user email | Invitation received | |
| 8 | Accept invitation (new session) | Account created | |
| 9 | Log in as new staff user | Dashboard displays | |
| 10 | Verify dashboard access | Units visible | |
| 11 | Try to access Settings → TTN | Access denied | |
| 12 | Try to delete a unit | Action blocked | |
| 13 | Log temperature manually | Action succeeds | |
| 14 | Acknowledge an alert | Action succeeds | |
| 15 | Log back in as admin | Admin dashboard | |
| 16 | Change user role to Manager | Role updated | |
| 17 | Log back in as user | Role change reflected | |
| 18 | Verify expanded permissions | Settings access granted | |

### Success Criteria
- [ ] Invitation flow works
- [ ] Role restrictions enforced immediately
- [ ] Role changes take effect without re-login
- [ ] No permission leakage

---

## Scenario 10: Data Integrity Under Load (P2)

### Description
Verify system handles high-frequency sensor readings without data loss.

### Preconditions
- Sensor simulator available
- Ability to send rapid readings

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Configure simulator for 10 sensors | Simulator ready | |
| 2 | Set reading frequency: 1 per minute | Fast mode enabled | |
| 3 | Start simulator | Readings begin flowing | |
| 4 | Run for 30 minutes | 300+ readings generated | |
| 5 | Stop simulator | Readings stop | |
| 6 | Query database: count readings | Should match sent count | |
| 7 | Verify no duplicates | No duplicate timestamps | |
| 8 | Verify no gaps | Sequential readings present | |
| 9 | Check dashboard performance | Still responsive | |
| 10 | Generate report for period | Report includes all data | |

### Success Criteria
- [ ] 100% of sent readings stored
- [ ] No duplicate entries
- [ ] Dashboard remains responsive
- [ ] No webhook failures (check TTN logs)

---

## Test Session Log Template

```markdown
## E2E Test Session

**Date:** YYYY-MM-DD HH:MM
**Tester:** [Name]
**Environment:** [Staging/Local]
**Scenario:** [Scenario Name]

### Execution Log

| Step | Start Time | Status | Notes |
|------|------------|--------|-------|
| 1    | HH:MM      | Pass   |       |
| 2    | HH:MM      | Pass   |       |
| 3    | HH:MM      | FAIL   | [Details] |

### Failure Details
[Detailed description of any failures]

### Screenshots
[Attach relevant screenshots]

### Environment Notes
- Browser:
- Device:
- Network conditions:

### Sign-off
- [ ] All steps completed
- [ ] All success criteria verified
- [ ] Issues documented and reported
```

---

## Related Documents

- [TEST_STRATEGY.md](#test_strategy) — Overall testing philosophy
- [COVERAGE_MAP.md](#coverage_map) — Feature-to-test mapping
- [MANUAL_TESTING.md](#manual_testing) — Step-by-step manual QA checklists
- [KNOWN_GAPS.md](#known_gaps) — Missing coverage and risks


---

\newpage

<a id="qa-known_gaps"></a>

# Known Test Coverage Gaps

> Risk assessment and recommended future tests

---

## Executive Summary

FreshTrack Pro has **minimal automated test coverage** (~5% estimated). The existing tests cover only eligibility logic and TTN permission validation. Critical paths including alert processing, data ingestion, and the entire frontend remain untested.

### Current Coverage Statistics

| Area | Files | Tested | Coverage |
|------|-------|--------|----------|
| Pages | 23 | 0 | 0% |
| Components | 112 | 0 | 0% |
| Hooks | 26 | 0 | 0% |
| Edge Functions | 32 | 1 | 3% |
| Lib/Actions | 6 | 6 | 100% |
| **Total** | **199+** | **7** | **~3%** |

---

## Critical Gaps (P0 - Immediate Risk)

### Gap 1: Alert Processing Engine

| Attribute | Value |
|-----------|-------|
| **File** | `supabase/functions/process-unit-states/index.ts` |
| **Risk Level** | **CRITICAL** |
| **Business Impact** | Missed alerts → spoiled inventory ($10K+), health violations |
| **Current Testing** | None |

**What Could Go Wrong:**
- Temperature threshold comparisons fail
- Confirm time logic broken
- Alert state transitions incorrect
- Database writes silently fail

**Recommended Tests:**
```typescript
// Unit tests for alert logic
describe("process-unit-states", () => {
  it("creates alert when temp exceeds threshold for confirm_time");
  it("does not create alert for brief excursions");
  it("resolves alert when temp returns to normal");
  it("handles multiple simultaneous excursions");
  it("respects unit-specific override rules");
});
```

**Priority:** Implement within 1 week

---

### Gap 2: Notification Dispatch

| Attribute | Value |
|-----------|-------|
| **File** | `supabase/functions/process-escalations/index.ts` |
| **Risk Level** | **CRITICAL** |
| **Business Impact** | Alerts triggered but no one notified |
| **Current Testing** | None |

**What Could Go Wrong:**
- Escalation timing incorrect
- Wrong contacts notified
- Email/SMS delivery fails silently
- Duplicate notifications sent

**Recommended Tests:**
```typescript
describe("process-escalations", () => {
  it("sends notification to level 1 contacts immediately");
  it("escalates to level 2 after delay if unacknowledged");
  it("stops escalation when alert acknowledged");
  it("handles contact with no email gracefully");
  it("respects notification policy channel settings");
});
```

**Priority:** Implement within 1 week

---

### Gap 3: TTN Webhook Data Ingestion

| Attribute | Value |
|-----------|-------|
| **File** | `supabase/functions/ttn-webhook/index.ts` |
| **Risk Level** | **CRITICAL** |
| **Business Impact** | Temperature data not recorded → compliance gaps |
| **Current Testing** | None |

**What Could Go Wrong:**
- DevEUI normalization fails
- Webhook secret validation bypassed
- Payload parsing errors
- Database insert fails
- Duplicate readings accepted

**Recommended Tests:**
```typescript
describe("ttn-webhook", () => {
  it("accepts valid uplink with correct webhook secret");
  it("rejects requests with invalid webhook secret");
  it("normalizes DevEUI to uppercase no-separator format");
  it("parses temperature from various payload formats");
  it("stores reading with correct sensor association");
  it("handles unknown DevEUI gracefully");
});
```

**Priority:** Implement within 1 week

---

### Gap 4: Frontend Unit Status Computation

| Attribute | Value |
|-----------|-------|
| **File** | `src/hooks/useUnitStatus.ts` |
| **Risk Level** | **HIGH** |
| **Business Impact** | Dashboard shows wrong status → delayed response |
| **Current Testing** | None |

**What Could Go Wrong:**
- Status priority ordering wrong
- Excursion vs alarm distinction broken
- Offline detection timing wrong
- Status doesn't update when data changes

**Recommended Tests:**
```typescript
describe("useUnitStatus", () => {
  it("returns 'ok' when temperature in range");
  it("returns 'excursion' during unconfirmed excursion");
  it("returns 'alarm_active' after confirm time");
  it("returns 'offline' when sensor stops reporting");
  it("priority: alarm_active > excursion > offline > ok");
});
```

**Priority:** Implement within 2 weeks

---

## High-Priority Gaps (P1 - Significant Risk)

### Gap 5: Row-Level Security Policies

| Attribute | Value |
|-----------|-------|
| **Files** | All migrations with RLS policies |
| **Risk Level** | **HIGH** |
| **Business Impact** | Data leakage between organizations |
| **Current Testing** | None |

**Risk Scenarios:**
- User A can see User B's organization data
- Deleted user retains access
- Role changes not enforced
- Cross-tenant data in reports

**Recommended Tests:**
```sql
-- Test RLS for units table
SET request.jwt.claim.sub = 'user-org-a';
SELECT * FROM units WHERE organization_id = 'org-b'; -- Should return 0
```

**Priority:** Implement within 2 weeks

---

### Gap 6: Device Provisioning Flow

| Attribute | Value |
|-----------|-------|
| **Files** | `ttn-provision-device`, `ttn-provision-gateway` |
| **Risk Level** | **HIGH** |
| **Business Impact** | Devices not registered → no data collection |
| **Current Testing** | Eligibility only (logic before API call) |

**What Could Go Wrong:**
- TTN API call format wrong
- Error handling insufficient
- Rollback on partial failure missing
- Status not updated after provisioning

**Priority:** Implement within 3 weeks

---

### Gap 7: Offline Sync Mechanism

| Attribute | Value |
|-----------|-------|
| **File** | `src/hooks/useOfflineSync.ts` |
| **Risk Level** | **HIGH** |
| **Business Impact** | Manual logs lost during field work |
| **Current Testing** | None |

**What Could Go Wrong:**
- IndexedDB writes fail
- Sync conflicts not resolved
- Data loss during sync
- Timestamps corrupted

**Priority:** Implement within 3 weeks

---

### Gap 8: Alert Rules Cascading

| Attribute | Value |
|-----------|-------|
| **Files** | `get_effective_alert_rules` RPC, `useAlertRules.ts` |
| **Risk Level** | **MEDIUM-HIGH** |
| **Business Impact** | Wrong thresholds applied → false positives/negatives |
| **Current Testing** | None |

**What Could Go Wrong:**
- Unit override not applied
- Site settings ignored
- Inheritance chain broken
- Default rules missing

**Priority:** Implement within 4 weeks

---

## Medium-Priority Gaps (P2)

### Gap 9: Component Testing

| Files | Count | Risk |
|-------|-------|------|
| Settings components | 20+ | Forms may break silently |
| Dashboard widgets | 10+ | Data display errors |
| Alert components | 5+ | Status not reflected |

**Recommended Approach:**
- Use React Testing Library
- Start with forms that save data
- Test error states

**Priority:** Implement over 2 months

---

### Gap 10: Page-Level Integration

| Pages | Risk |
|-------|------|
| Dashboard | Data loading, filtering, refresh |
| Settings | Form submission, validation |
| Unit Detail | Real-time updates, graph rendering |
| Reports | Report generation, export |

**Recommended Approach:**
- Mock Supabase client
- Test component composition
- Verify data flow

**Priority:** Implement over 2 months

---

### Gap 11: Stripe Integration

| Functions | Risk |
|-----------|------|
| `stripe-checkout` | Payment failures |
| `stripe-portal` | Customer access issues |
| `stripe-webhook` | Subscription state sync |

**Recommended Approach:**
- Use Stripe test mode
- Mock webhook events
- Test state transitions

**Priority:** Implement over 2 months

---

## Low-Priority Gaps (P3)

### Gap 12: UI/Visual Testing

| Area | Current State |
|------|---------------|
| Responsive design | Manual only |
| Browser compatibility | Manual only |
| Theme/branding | Manual only |
| Accessibility | Not tested |

**Recommended Approach:**
- Consider Playwright for visual regression
- Use axe-core for accessibility

**Priority:** Quarterly review

---

### Gap 13: Performance Testing

| Metric | Current State |
|--------|---------------|
| Page load times | Not measured |
| API response times | Not measured |
| Database query performance | Not measured |
| Concurrent user load | Not tested |

**Recommended Approach:**
- Lighthouse CI for page performance
- k6 for API load testing
- pg_stat_statements for query analysis

**Priority:** Before scaling

---

## Risk Matrix

| Gap | Likelihood | Impact | Risk Score | Priority |
|-----|------------|--------|------------|----------|
| Alert Processing | Medium | Critical | **P0** | Week 1 |
| Notification Dispatch | Medium | Critical | **P0** | Week 1 |
| TTN Webhook | Low | Critical | **P0** | Week 1 |
| Unit Status | Medium | High | **P1** | Week 2 |
| RLS Policies | Low | Critical | **P1** | Week 2 |
| Device Provisioning | Medium | High | **P1** | Week 3 |
| Offline Sync | Medium | High | **P1** | Week 3 |
| Alert Cascading | Low | High | **P1** | Week 4 |
| Components | High | Medium | **P2** | Month 2 |
| Page Integration | High | Medium | **P2** | Month 2 |
| Stripe | Low | Medium | **P2** | Month 2 |
| UI/Visual | High | Low | **P3** | Quarterly |
| Performance | Low | Medium | **P3** | Pre-scale |

---

## Immediate Action Items

### Week 1

1. **Add npm test script to package.json**
   ```json
   "test": "vitest",
   "test:watch": "vitest --watch",
   "test:coverage": "vitest --coverage"
   ```

2. **Create test utilities file**
   ```typescript
   // src/test/utils.ts
   export function createMockSupabaseClient() { ... }
   export function createTestAlertRule() { ... }
   export function createTestUnit() { ... }
   ```

3. **Write first critical path tests**
   - `process-unit-states` alert logic
   - `ttn-webhook` payload parsing
   - `useUnitStatus` status computation

### Week 2-4

1. Add integration tests for database operations
2. Create RLS policy test suite
3. Document manual test procedures for gaps

---

## Testing Debt Tracking

### Definition of Done for Test Debt

A gap is "closed" when:
- [ ] Automated tests exist for happy path
- [ ] Automated tests exist for error cases
- [ ] Tests run in CI
- [ ] Coverage documented in COVERAGE_MAP.md

### Quarterly Review Checklist

- [ ] Review this document
- [ ] Update gap priorities based on incidents
- [ ] Track coverage metrics
- [ ] Plan next quarter's test debt reduction

---

## Appendix: Test Infrastructure Improvements

### Immediate Needs

1. **npm test script** — Currently missing from package.json
2. **CI integration** — Tests should run on every PR
3. **Coverage reporting** — Track progress over time

### Future Considerations

1. **Playwright for E2E** — Automate critical user journeys
2. **Visual regression** — Catch UI breakage
3. **Load testing** — Validate scaling before growth

---

## Related Documents

- [TEST_STRATEGY.md](#test_strategy) — Overall testing philosophy
- [COVERAGE_MAP.md](#coverage_map) — Feature-to-test mapping
- [MANUAL_TESTING.md](#manual_testing) — Step-by-step manual QA checklists
- [E2E_SCENARIOS.md](#e2e_scenarios) — Critical user flow testing


---

\newpage

<a id="security-security_overview"></a>

# Security Overview

> FreshTrack Pro Security Architecture and Principles

---

## Executive Summary

FreshTrack Pro is a multi-tenant SaaS platform for refrigeration monitoring. Security is architected around **tenant isolation**, **defense in depth**, and **least privilege access**. The platform handles sensitive operational data and integrates with external IoT infrastructure (The Things Network) and payment processing (Stripe).

### Security Classification

| Data Type | Classification | Handling |
|-----------|----------------|----------|
| Temperature readings | Business Sensitive | Encrypted in transit, RLS protected |
| TTN API keys | Secret | Encrypted at rest, never logged |
| User credentials | Secret | Managed by Supabase Auth |
| Organization data | Business Sensitive | Tenant-isolated via RLS |
| Payment information | PCI Sensitive | Handled by Stripe (not stored) |

---

## Security Principles

### 1. Defense in Depth

Multiple security layers protect each transaction:

```
┌─────────────────────────────────────────────────────────────┐
│                     PERIMETER LAYER                          │
│  TLS 1.3 • CDN WAF • Rate Limiting                          │
├─────────────────────────────────────────────────────────────┤
│                   APPLICATION LAYER                          │
│  JWT Validation • CORS • Input Validation • CSRF Protection │
├─────────────────────────────────────────────────────────────┤
│                   AUTHORIZATION LAYER                        │
│  RBAC • RLS Policies • Org Scope Verification               │
├─────────────────────────────────────────────────────────────┤
│                      DATA LAYER                              │
│  Encryption at Rest • Column Encryption • Audit Logging     │
└─────────────────────────────────────────────────────────────┘
```

### 2. Tenant Isolation (Zero Trust Between Tenants)

Every database query is scoped to the authenticated user's organization:

- **Row Level Security (RLS)**: PostgreSQL policies enforce org boundaries
- **Foreign Key Constraints**: Data relationships maintain org scope
- **Unique Constraints**: Scoped to organization (e.g., DevEUI per org)
- **Function-Level Checks**: Edge functions verify org membership

### 3. Least Privilege Access

| Principal | Access Level | Justification |
|-----------|-------------|---------------|
| Anonymous users | Public pages only | No data access |
| Authenticated users | Own organization only | RLS enforced |
| Staff role | Read + limited write | Operational needs |
| Admin role | Full org access | Management needs |
| Service role | Cross-org (internal only) | Scheduled jobs |

### 4. Secure by Default

- All database tables have RLS **enabled by default**
- All edge functions require JWT verification unless explicitly disabled
- All external webhooks require signature/secret verification
- Sensitive fields are encrypted before storage

---

## Trust Boundaries

```mermaid
graph TB
    subgraph "UNTRUSTED ZONE"
        U[Users/Browsers]
        TTN[TTN Network]
        STRIPE[Stripe]
    end

    subgraph "DMZ"
        CDN[Supabase CDN/Edge]
    end

    subgraph "TRUSTED ZONE"
        subgraph "Application Layer"
            FUNC[Edge Functions]
            AUTH[Supabase Auth]
        end
        subgraph "Data Layer"
            DB[(PostgreSQL)]
            SECRETS[Vault/Secrets]
        end
    end

    U -->|TLS| CDN
    TTN -->|Webhook Secret| CDN
    STRIPE -->|Signature| CDN
    CDN -->|JWT| FUNC
    CDN -->|JWT| AUTH
    FUNC -->|Service Role| DB
    AUTH -->|Internal| DB
    FUNC -->|Read| SECRETS
```

### Boundary Definitions

| Boundary | From | To | Validation |
|----------|------|-----|------------|
| **B1** | Browser | CDN | TLS, CORS |
| **B2** | CDN | Edge Functions | JWT signature |
| **B3** | TTN | Webhook | Per-org secret (constant-time compare) |
| **B4** | Stripe | Webhook | HMAC signature |
| **B5** | Edge Functions | Database | RLS policies + service role |
| **B6** | Edge Functions | Secrets | Environment variables |

---

## High-Level Security Controls

### Authentication Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| Password authentication | Supabase Auth | Active |
| Session management | JWT with refresh tokens | Active |
| Password strength | 8+ chars, complexity rules | Active |
| Account lockout | Supabase rate limiting | Active |
| Email verification | Supabase email confirmation | Active |
| MFA/2FA | **TBD** - Not currently implemented | Planned |

### Authorization Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| Role-Based Access Control | 6 roles (owner → inspector) | Active |
| Row-Level Security | PostgreSQL RLS policies | Active |
| Organization isolation | `organization_id` on all tables | Active |
| Permission functions | `has_role()`, `user_belongs_to_org()` | Active |
| API endpoint protection | JWT verification per function | Active |

### Data Protection Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| Transport encryption | TLS 1.3 (Supabase managed) | Active |
| Database encryption | Supabase managed encryption at rest | Active |
| Sensitive field encryption | XOR-based obfuscation (v2 format) | Active |
| Secret storage | Environment variables / Vault | Active |
| Audit logging | `event_logs` table with hash chain | Active |

### Network Controls

| Control | Implementation | Status |
|---------|----------------|--------|
| CORS | Configured per function | Active |
| Rate limiting | Supabase platform level | Active |
| DDoS protection | Supabase/Cloudflare | Active |
| Webhook validation | Per-integration verification | Active |

---

## Security Architecture by Layer

### Frontend (Browser)

- Single-page React application
- JWT stored in localStorage (with refresh mechanism)
- No sensitive data stored client-side (except session token)
- CSP headers managed by hosting platform
- Input validation with Zod schemas

### API Layer (Edge Functions)

- Deno runtime with V8 isolates
- Per-request JWT verification
- Service role for internal operations
- Constant-time secret comparison for webhooks
- Request validation before processing

### Database Layer (PostgreSQL)

- Row Level Security on all tables
- `SECURITY DEFINER` functions for privileged operations
- Encrypted columns for API keys
- Audit tables for compliance
- Cascading deletes preserve referential integrity

### External Integrations

| Integration | Auth Method | Data Flow |
|-------------|-------------|-----------|
| The Things Network | Per-org webhook secret | Inbound only |
| Stripe | HMAC signature | Bidirectional |
| Resend (Email) | API key | Outbound only |
| Twilio (SMS) | API key | Outbound only |

---

## Compliance Considerations

### Data Residency

- Primary database: Supabase cloud (region configurable)
- CDN: Global edge locations
- TTN data: EU1 cluster enforced for European deployments

### Regulatory Alignment

| Requirement | Status | Notes |
|-------------|--------|-------|
| GDPR | Partial | Data deletion, audit logs implemented |
| HACCP | Active | Temperature logging, tamper-evident records |
| FDA 21 CFR Part 11 | Partial | Audit trail, electronic signatures TBD |
| SOC 2 | TBD | Supabase platform certified |
| PCI DSS | N/A | No card data stored (Stripe handles) |

### Audit Capabilities

- **Event logs**: All significant actions logged with actor, timestamp, IP
- **Hash chaining**: Events include `previous_hash` for tamper detection
- **Immutable design**: Append-only logging tables
- **Retention**: Configurable per compliance requirements

---

## Security Responsibilities

### Platform (Supabase)

- Infrastructure security
- Database encryption at rest
- Network security and DDoS protection
- Auth service security
- Patching and updates

### Application (FreshTrack Pro)

- RLS policy correctness
- Input validation
- Secret management
- Secure coding practices
- Vulnerability remediation

### Customer

- Strong passwords
- User access management
- Device physical security
- Timely security updates
- Incident reporting

---

## Known Security Considerations

### Acknowledged Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| CORS wildcard (*) | Protected by JWT/API key auth | Documented |
| localStorage JWT | Refresh token rotation | Active |
| API key in logs (last4) | Log access controls required | TBD |
| Debug encryption mode | Temporary, requires reversion | In Progress |

### Security Debt

1. **MFA not implemented** - Planned for future release
2. **API key rotation UI** - Manual process currently
3. **Rate limiting visibility** - Platform-level, not application-configurable
4. **Webhook secret rotation** - No automated rotation

---

## Security Contacts

| Role | Responsibility |
|------|----------------|
| Security Lead | Architecture, policy, incident response |
| Platform Team | Infrastructure, Supabase configuration |
| Development Team | Secure coding, vulnerability fixes |
| Operations | Monitoring, log analysis |

---

## Related Documents

- [AUTH_MODEL.md](#auth_model) — Authentication and authorization details
- [DATA_PROTECTION.md](#data_protection) — Encryption and secrets management
- [THREAT_MODEL.md](#threat_model) — Threats, attack surfaces, mitigations
- [INCIDENT_RESPONSE.md](#incident_response) — Security incident procedures


---

\newpage

<a id="security-auth_model"></a>

# Authentication & Authorization Model

> How users authenticate and what they can access

---

## Authentication Architecture

### Authentication Provider

FreshTrack Pro uses **Supabase Auth** for all user authentication:

| Component | Technology |
|-----------|------------|
| Identity Provider | Supabase Auth (GoTrue) |
| Token Format | JWT (RS256 signed) |
| Session Storage | Browser localStorage |
| Token Refresh | Automatic refresh before expiry |
| Password Hashing | bcrypt (Supabase managed) |

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant A as Auth Page
    participant SA as Supabase Auth
    participant DB as Database
    participant D as Dashboard

    U->>A: Navigate to /auth
    A->>U: Display login form
    U->>A: Submit email/password
    A->>SA: signInWithPassword()
    SA->>SA: Validate credentials
    SA->>DB: Create session record
    SA->>A: Return JWT + refresh token
    A->>U: Store tokens in localStorage
    A->>D: Redirect to /dashboard
    D->>SA: Verify JWT on each request
    SA->>D: Return user context
```

### Token Structure

```typescript
// JWT Payload (decoded)
{
  "aud": "authenticated",
  "exp": 1704931200,           // Expiration timestamp
  "sub": "user-uuid-here",     // User ID
  "email": "user@example.com",
  "role": "authenticated",     // Supabase role (not app role)
  "session_id": "session-uuid"
}
```

### Session Management

| Aspect | Configuration |
|--------|---------------|
| Access token lifetime | 1 hour (Supabase default) |
| Refresh token lifetime | 7 days |
| Concurrent sessions | Unlimited |
| Session invalidation | On password change, manual logout |

### Authentication Endpoints

| Endpoint | Purpose | Rate Limited |
|----------|---------|--------------|
| `/auth/v1/signup` | User registration | Yes |
| `/auth/v1/token` | Login, refresh | Yes |
| `/auth/v1/logout` | Session termination | No |
| `/auth/v1/recover` | Password reset | Yes |

---

## Password Security

### Password Requirements

Enforced in `/src/pages/Auth.tsx`:

```typescript
// Password validation
password.length >= 8           // Minimum length
/[A-Z]/.test(password)        // Uppercase required
/[a-z]/.test(password)        // Lowercase required
/[0-9]/.test(password)        // Number required
/[^A-Za-z0-9]/.test(password) // Special character required
```

### Password Storage

- **Hashing**: bcrypt with cost factor (Supabase managed)
- **Salt**: Unique per password (bcrypt built-in)
- **Storage**: `auth.users` table (never in application tables)

### Password Reset Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as Auth Page
    participant SA as Supabase Auth
    participant E as Email Service

    U->>A: Click "Forgot Password"
    A->>SA: resetPasswordForEmail()
    SA->>E: Send reset link email
    E->>U: Email with magic link
    U->>A: Click reset link
    A->>SA: Verify token from URL
    SA->>A: Token valid
    A->>U: Show new password form
    U->>A: Submit new password
    A->>SA: updateUser({ password })
    SA->>SA: Invalidate other sessions
    SA->>A: Success
```

---

## Authorization Model

### Role Hierarchy

FreshTrack Pro implements a **role-based access control (RBAC)** model:

```
┌─────────────────────────────────────────────────┐
│                    OWNER                         │
│  Full control, billing, user management          │
├─────────────────────────────────────────────────┤
│                    ADMIN                         │
│  All operations except billing                   │
├─────────────────────────────────────────────────┤
│                   MANAGER                        │
│  Operational control, settings, reports          │
├─────────────────────────────────────────────────┤
│                    STAFF                         │
│  Daily operations, temperature logging           │
├─────────────────────────────────────────────────┤
│                   VIEWER                         │
│  Read-only access to alerts                      │
├─────────────────────────────────────────────────┤
│                  INSPECTOR                       │
│  Alerts + export reports for audits              │
└─────────────────────────────────────────────────┘
```

### Role Permissions Matrix

| Permission | Owner | Admin | Manager | Staff | Viewer | Inspector |
|------------|:-----:|:-----:|:-------:|:-----:|:------:|:---------:|
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View alerts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Acknowledge alerts | ✓ | ✓ | ✓ | - | - | - |
| Log temperatures | ✓ | ✓ | ✓ | ✓ | - | - |
| Edit temperature limits | ✓ | ✓ | ✓ | - | - | - |
| Manage sites/areas/units | ✓ | ✓ | ✓ | - | - | - |
| Configure TTN | ✓ | ✓ | - | - | - | - |
| Manage sensors/gateways | ✓ | ✓ | - | - | - | - |
| Manage users | ✓ | ✓ | - | - | - | - |
| Export reports | ✓ | ✓ | ✓ | - | - | ✓ |
| Access billing | ✓ | - | - | - | - | - |
| Delete organization | ✓ | - | - | - | - | - |

### Role Assignment

Roles are stored in the `user_roles` table:

```sql
CREATE TABLE user_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    role TEXT NOT NULL CHECK (role IN (
        'owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'
    )),
    created_at TIMESTAMPTZ,
    UNIQUE (user_id, organization_id)  -- One role per user per org
);
```

### Permission Checking (Frontend)

```typescript
// src/hooks/useUserRole.ts
const { role, permissions } = useUserRole();

// Check specific permission
if (permissions.canManageSites) {
    // Show site management UI
}

// Check role directly
if (role === 'owner' || role === 'admin') {
    // Show admin features
}
```

### Permission Checking (Backend)

```typescript
// Edge function pattern
const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

if (!['owner', 'admin'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403
    });
}
```

---

## Organization/User Separation

### Multi-Tenancy Model

```mermaid
graph TD
    subgraph "Organization A"
        UA1[User A1 - Owner]
        UA2[User A2 - Staff]
        SA[Site A]
        DA[(Data A)]
    end

    subgraph "Organization B"
        UB1[User B1 - Owner]
        SB[Site B]
        DB[(Data B)]
    end

    UA1 --> SA
    UA2 --> SA
    SA --> DA

    UB1 --> SB
    SB --> DB

    DA -.-x|RLS Blocks| UB1
    DB -.-x|RLS Blocks| UA1
```

### Organization Isolation Enforcement

#### Database Level (RLS)

```sql
-- Example RLS policy on units table
CREATE POLICY "Users can view their org's units"
    ON units
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM profiles
            WHERE id = auth.uid()
        )
    );
```

#### Helper Functions

```sql
-- Check if user belongs to organization
CREATE FUNCTION user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = _user_id AND organization_id = _org_id
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has specific role
CREATE FUNCTION has_role(_user_id UUID, _org_id UUID, _role TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = _user_id
        AND organization_id = _org_id
        AND role = _role
    );
$$ LANGUAGE sql SECURITY DEFINER;
```

#### Application Level

```typescript
// Every data query includes organization scope
const { data } = await supabase
    .from('units')
    .select('*')
    .eq('organization_id', organizationId);  // Explicit scope
```

### Cross-Organization Protection

| Scenario | Protection Mechanism |
|----------|---------------------|
| User A queries Org B data | RLS returns empty result |
| User A's token used with Org B ID | RLS blocks + function validation |
| DevEUI registered in both orgs | `UNIQUE (organization_id, dev_eui)` constraint |
| Webhook for wrong org | Webhook secret lookup isolates |

---

## Session and Token Security

### Token Storage

| Token Type | Storage Location | Security Consideration |
|------------|-----------------|----------------------|
| Access token | localStorage | XSS vulnerable, short-lived |
| Refresh token | localStorage | Longer-lived, rotated on use |

### Token Refresh Flow

```typescript
// Automatic refresh (Supabase client)
const { data, error } = await supabase.auth.refreshSession();

// Triggered when:
// - Access token expires
// - Manual refresh called
// - Page load with valid refresh token
```

### Session Invalidation

| Event | Action |
|-------|--------|
| User logout | Clear localStorage, server-side session invalidation |
| Password change | All sessions invalidated |
| Account deletion | All sessions and data deleted |
| Admin revocation | Session invalidated on next request |

---

## JWT Verification in Edge Functions

### Automatic Verification (config.toml)

```toml
[functions.stripe-checkout]
verify_jwt = true  # Supabase verifies before function executes
```

### Manual Verification

```typescript
// For functions with verify_jwt = false
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const { data: { user }, error } = await supabase.auth.getUser(token);

if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
}
```

### Verification Matrix

| Function | JWT Verification | Auth Method |
|----------|-----------------|-------------|
| `stripe-checkout` | Automatic | Supabase JWT |
| `stripe-portal` | Automatic | Supabase JWT |
| `sensor-simulator` | Automatic | Supabase JWT |
| `ttn-webhook` | None | Webhook secret |
| `stripe-webhook` | None | HMAC signature |
| `manage-ttn-settings` | Manual | Bearer token |
| `process-unit-states` | None | Internal API key |
| `export-temperature-logs` | Manual | JWT or API key |

---

## API Authentication Methods

### Method 1: JWT Bearer Token

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Used by: Browser clients, authenticated API calls

### Method 2: API Key Header

```http
X-Internal-Key: sk_internal_xxxxx
```

Used by: Scheduled jobs, service-to-service

### Method 3: Webhook Secret

```http
X-Webhook-Secret: whsec_xxxxxxx
```

Used by: TTN webhooks (per-organization)

### Method 4: Signature Verification

```http
stripe-signature: t=xxx,v1=xxx
```

Used by: Stripe webhooks

---

## Security Events Logged

| Event | Logged Data | Table |
|-------|-------------|-------|
| Login success | user_id, IP, user_agent, timestamp | Supabase audit |
| Login failure | email, IP, timestamp | Supabase audit |
| Password change | user_id, timestamp | Supabase audit |
| Role change | actor, target_user, old_role, new_role | event_logs |
| Permission denied | user_id, resource, action, timestamp | Function logs |

---

## Security Recommendations

### Current Implementation

- [x] Password complexity requirements
- [x] JWT-based session management
- [x] Role-based access control
- [x] Row-level security policies
- [x] Webhook signature verification
- [x] Service role isolation

### Recommended Enhancements

| Enhancement | Priority | Status |
|-------------|----------|--------|
| Multi-factor authentication (MFA) | High | TBD |
| Session timeout configuration | Medium | TBD |
| Login anomaly detection | Medium | TBD |
| API key rotation workflow | Medium | TBD |
| OAuth/SSO integration | Low | TBD |

---

## Related Documents

- [SECURITY_OVERVIEW.md](#security_overview) — High-level security architecture
- [DATA_PROTECTION.md](#data_protection) — Encryption and secrets management
- [THREAT_MODEL.md](#threat_model) — Threats and mitigations
- [INCIDENT_RESPONSE.md](#incident_response) — Security incident procedures


---

\newpage

<a id="security-data_protection"></a>

# Data Protection

> Encryption, secrets management, and data handling practices

---

## Data Classification

### Classification Scheme

| Level | Description | Examples | Controls |
|-------|-------------|----------|----------|
| **Secret** | Credentials, keys | API keys, passwords | Encrypted, never logged |
| **Confidential** | Sensitive business data | Customer data, configs | Encrypted, access controlled |
| **Internal** | Operational data | Temperature readings | RLS protected |
| **Public** | Non-sensitive | Marketing content | Standard controls |

### Data Inventory

| Data Type | Classification | Storage | Encryption |
|-----------|---------------|---------|------------|
| User passwords | Secret | Supabase Auth | bcrypt hashed |
| TTN API keys | Secret | `ttn_connections` | Application-level |
| Webhook secrets | Secret | `ttn_connections` | Application-level |
| Stripe keys | Secret | Environment only | Not stored in DB |
| Temperature readings | Internal | `sensor_readings` | At rest (platform) |
| Organization info | Confidential | `organizations` | At rest (platform) |
| User profiles | Confidential | `profiles` | At rest (platform) |

---

## Encryption at Rest

### Platform-Level Encryption

Supabase provides transparent encryption for all database storage:

| Component | Encryption | Key Management |
|-----------|------------|----------------|
| PostgreSQL data files | AES-256 | Supabase managed |
| PostgreSQL WAL | AES-256 | Supabase managed |
| Backups | AES-256 | Supabase managed |
| Blob storage | AES-256 | Supabase managed |

### Application-Level Encryption

Sensitive fields receive additional application-level encryption:

#### Encrypted Fields

| Table | Field | Encryption Method |
|-------|-------|-------------------|
| `ttn_connections` | `ttn_api_key_encrypted` | XOR v2 |
| `ttn_connections` | `ttn_webhook_secret_encrypted` | XOR v2 |
| `ttn_connections` | `ttn_gateway_api_key_encrypted` | XOR v2 |
| `ttn_connections` | `ttn_org_api_key_encrypted` | XOR v2 |

#### Encryption Algorithm (v2 Format)

```typescript
// Location: supabase/functions/_shared/ttnConfig.ts

function obfuscateKey(key: string, salt: string): string {
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key);
    const saltBytes = encoder.encode(salt);

    const obfuscated = new Uint8Array(keyBytes.length);
    for (let i = 0; i < keyBytes.length; i++) {
        obfuscated[i] = keyBytes[i] ^ saltBytes[i % saltBytes.length];
    }

    return "v2:" + btoa(String.fromCharCode(...obfuscated));
}
```

**Key Derivation:**
- Salt source: `TTN_ENCRYPTION_SALT` environment variable
- Fallback: First 32 characters of `SUPABASE_SERVICE_ROLE_KEY`
- Format prefix: `v2:` for version identification

#### Decryption

```typescript
function deobfuscateKey(encoded: string, salt: string): string {
    // Handle v2 format
    if (encoded.startsWith("v2:")) {
        const decoded = atob(encoded.slice(3));
        // XOR with salt to recover original
        // ...
    }
    // Legacy format fallback
    // ...
}
```

### Display Safety

For user interface display, only the last 4 characters are shown:

| Stored Field | Display Field | Example |
|--------------|--------------|---------|
| `ttn_api_key_encrypted` | `ttn_api_key_last4` | `•••••A1B2` |
| `ttn_webhook_secret_encrypted` | (computed) | `•••••X9Y8` |

---

## Encryption in Transit

### TLS Configuration

All communications use TLS 1.3:

| Connection | TLS Version | Certificate |
|------------|-------------|-------------|
| Browser → CDN | TLS 1.3 | Supabase managed |
| CDN → Edge Functions | TLS 1.3 | Internal |
| Edge Functions → Database | TLS 1.3 | Internal |
| Application → TTN | TLS 1.3 | TTN certificate |
| Application → Stripe | TLS 1.3 | Stripe certificate |

### API Security Headers

```typescript
// Applied to all responses
{
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
}
```

---

## Secrets Management

### Secret Categories

| Category | Examples | Storage Location |
|----------|----------|------------------|
| **Platform secrets** | Database password, JWT secret | Supabase Vault |
| **Integration secrets** | TTN admin key, Stripe secret | Environment variables |
| **Per-org secrets** | TTN app keys, webhook secrets | Database (encrypted) |
| **User secrets** | Passwords | Supabase Auth |

### Environment Variables

#### Frontend (Exposed to Browser)

```env
# .env - VITE_ prefix exposes to browser
VITE_SUPABASE_PROJECT_ID=xxxxx
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJS...  # Public anon key (safe)
```

**Security Note:** `VITE_` prefixed variables are bundled into client-side code. Never put secrets here.

#### Backend (Server-Side Only)

```env
# Edge function secrets (never exposed to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJS...  # Privileged access
TTN_ADMIN_API_KEY=NNSXS.xxxxx             # TTN admin operations
TTN_ENCRYPTION_SALT=xxxxxxxx              # Encryption salt
STRIPE_SECRET_KEY=sk_live_xxxxx           # Stripe API
STRIPE_WEBHOOK_SECRET=whsec_xxxxx         # Stripe webhook
INTERNAL_API_KEY=xxxxx                     # Internal service calls
DEVICE_INGEST_API_KEY=xxxxx               # Device data ingestion
```

### Secret Rotation

| Secret Type | Rotation Method | Frequency |
|-------------|-----------------|-----------|
| Database password | Supabase dashboard | On compromise |
| JWT secret | Supabase dashboard | On compromise |
| TTN API keys | Manual re-provisioning | On compromise |
| Stripe keys | Stripe dashboard | On compromise |
| Webhook secrets | Regenerate + update DB | On compromise |

### Secret Access Patterns

```typescript
// Correct: Server-side secret access
const apiKey = Deno.env.get("TTN_ADMIN_API_KEY");

// Incorrect: Never log secrets
console.log("API Key:", apiKey);  // NEVER DO THIS

// Acceptable: Log last 4 for debugging
console.log("Using key ending in:", apiKey.slice(-4));
```

---

## CI/CD Security

### Build-Time Security

| Check | Tool | Stage |
|-------|------|-------|
| Secret scanning | **TBD** | Pre-commit |
| Dependency audit | `npm audit` | Build |
| Type checking | TypeScript | Build |
| Linting | ESLint | Build |

### Deployment Security

| Environment | Secret Injection | Method |
|-------------|-----------------|--------|
| Development | `.env` file | Local only, gitignored |
| Staging | Supabase Secrets | Dashboard/CLI |
| Production | Supabase Secrets | Dashboard/CLI |

### Gitignore Rules

```gitignore
# Secrets - NEVER commit
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json

# Supabase local
supabase/.branches
supabase/.temp
```

### Secret Exposure Prevention

| Control | Implementation |
|---------|----------------|
| Pre-commit hooks | **TBD** - Recommend git-secrets |
| Branch protection | **TBD** - Configure in repository |
| Secret scanning | **TBD** - GitHub secret scanning |
| Audit logging | Supabase audit logs |

---

## Sensitive Data Handling

### PII (Personally Identifiable Information)

| Data Type | Collected | Storage | Retention |
|-----------|-----------|---------|-----------|
| Email | Yes | `auth.users` | Account lifetime |
| Name | Optional | `profiles` | Account lifetime |
| Phone | Optional | `escalation_contacts` | Account lifetime |
| IP Address | Logged | `event_logs` | Configurable |

### Data Minimization

- Only collect data necessary for functionality
- Phone numbers only for SMS alerts
- IP addresses only for audit trails

### Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Temperature readings | Permanent | N/A (compliance) |
| Alert history | Permanent | N/A (compliance) |
| Audit logs | Permanent | N/A (compliance) |
| Session data | 7 days | Automatic |
| Deleted user data | Immediate cascade | Referential delete |

### Right to Deletion

```sql
-- User deletion cascades through:
-- 1. profiles (FK to auth.users)
-- 2. user_roles (FK to profiles)
-- 3. Organization data remains (other users may exist)

-- Full org deletion required for complete data removal
DELETE FROM organizations WHERE id = ?;
-- Cascades to all related data
```

---

## Database Security

### Connection Security

| Aspect | Configuration |
|--------|---------------|
| Connection encryption | TLS required |
| Connection pooling | Supabase managed |
| Prepared statements | Yes (SQL injection prevention) |
| Query timeouts | Configured |

### RLS as Data Protection

Row Level Security acts as a data protection mechanism:

```sql
-- Users can only see their organization's data
CREATE POLICY "org_isolation" ON sensor_readings
    FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id FROM profiles
            WHERE id = auth.uid()
        )
    );
```

### Privileged Access

| Role | Access Level | Use Case |
|------|-------------|----------|
| `anon` | RLS enforced, limited | Public/unauthenticated |
| `authenticated` | RLS enforced, user context | Normal users |
| `service_role` | Bypasses RLS | Backend services |

**Service Role Protection:**
- Never expose service role key to frontend
- Use only in edge functions for internal operations
- Audit all service role usage

---

## Backup and Recovery

### Backup Configuration

| Aspect | Configuration |
|--------|---------------|
| Frequency | Daily (Supabase managed) |
| Retention | 7 days (configurable) |
| Encryption | AES-256 |
| Location | Same region as database |

### Recovery Procedures

| Scenario | Recovery Method | RTO |
|----------|-----------------|-----|
| Accidental deletion | Point-in-time recovery | Hours |
| Database corruption | Restore from backup | Hours |
| Region failure | Cross-region restore | Hours |

---

## Audit and Compliance

### Audit Trail

```sql
-- Event logs table structure
CREATE TABLE event_logs (
    id UUID PRIMARY KEY,
    organization_id UUID,
    event_type TEXT NOT NULL,
    actor_id UUID,
    actor_type TEXT,  -- 'user' | 'system'
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    previous_hash TEXT,  -- Chain hash for tamper detection
    event_hash TEXT,
    created_at TIMESTAMPTZ
);
```

### Logged Events

| Event Type | Logged Details |
|------------|----------------|
| `user.login` | IP, user agent, success/failure |
| `user.logout` | Session ID |
| `role.change` | Old role, new role, actor |
| `data.export` | Export type, date range |
| `settings.change` | Field changed, old/new values |
| `alert.acknowledge` | Alert ID, actor, note |

### Tamper Detection

Events are hash-chained to detect tampering:

```typescript
// Each event includes hash of previous event
const eventHash = hash(event.id + event.data + previousHash);
```

---

## Security Monitoring

### Log Analysis

| Log Source | Contains | Access |
|------------|----------|--------|
| Supabase logs | Database queries, auth events | Supabase dashboard |
| Edge function logs | Application events | Supabase dashboard |
| Event logs table | Business events | Application |

### Alerting (TBD)

| Condition | Alert | Priority |
|-----------|-------|----------|
| Failed login spike | **TBD** | High |
| Service role access anomaly | **TBD** | High |
| RLS policy bypass attempt | **TBD** | Critical |
| Secret access from new IP | **TBD** | Medium |

---

## Security Hardening Checklist

### Implemented

- [x] TLS for all connections
- [x] Encrypted secrets storage
- [x] RLS on all tables
- [x] Input validation (Zod)
- [x] Prepared statements
- [x] Audit logging
- [x] Service role isolation

### Recommended Enhancements

| Enhancement | Priority | Status |
|-------------|----------|--------|
| Secret scanning in CI | High | TBD |
| Automated key rotation | Medium | TBD |
| Enhanced audit alerting | Medium | TBD |
| Field-level encryption expansion | Low | TBD |
| Hardware security module (HSM) | Low | TBD |

---

## Related Documents

- [SECURITY_OVERVIEW.md](#security_overview) — High-level security architecture
- [AUTH_MODEL.md](#auth_model) — Authentication and authorization
- [THREAT_MODEL.md](#threat_model) — Threats and mitigations
- [INCIDENT_RESPONSE.md](#incident_response) — Security incident procedures


---

\newpage

<a id="security-threat_model"></a>

# Threat Model

> Assets, threat actors, attack surfaces, and mitigations

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Last Updated | 2026-01-12 |
| Review Frequency | Quarterly |
| Methodology | STRIDE + DREAD |
| Scope | FreshTrack Pro application and infrastructure |

---

## Assets

### Critical Assets

| Asset | Description | Confidentiality | Integrity | Availability |
|-------|-------------|-----------------|-----------|--------------|
| **Temperature Data** | Historical sensor readings | Medium | Critical | High |
| **Alert Records** | Alert history, acknowledgments | Medium | Critical | High |
| **TTN Credentials** | API keys for IoT infrastructure | Critical | Critical | High |
| **User Credentials** | Passwords, sessions | Critical | Critical | High |
| **Organization Data** | Customer configurations | High | High | High |

### High-Value Assets

| Asset | Description | CIA Rating |
|-------|-------------|------------|
| Stripe credentials | Payment processing | C: Critical, I: Critical, A: High |
| Webhook secrets | External integration auth | C: Critical, I: High, A: Medium |
| Service role key | Database bypass access | C: Critical, I: Critical, A: Critical |
| Audit logs | Compliance records | C: Medium, I: Critical, A: High |

### Supporting Assets

| Asset | Description | CIA Rating |
|-------|-------------|------------|
| Source code | Application logic | C: Medium, I: High, A: Medium |
| Infrastructure config | Deployment settings | C: Medium, I: High, A: High |
| Documentation | Technical/business docs | C: Low, I: Medium, A: Low |

---

## Threat Actors

### Actor Profiles

| Actor | Motivation | Capability | Likelihood |
|-------|------------|------------|------------|
| **Competitor** | Data theft, sabotage | Medium | Low |
| **Cybercriminal** | Financial gain, ransomware | Medium-High | Medium |
| **Disgruntled Employee** | Revenge, data theft | High (insider) | Low |
| **Script Kiddie** | Curiosity, reputation | Low | Medium |
| **Nation State** | Espionage, disruption | Very High | Very Low |
| **Malicious Customer** | Cross-tenant access | Medium | Medium |

### Most Likely Threat Actors

1. **Malicious Customer** — Attempts to access other organizations' data
2. **Cybercriminal** — Credential stuffing, API abuse
3. **Script Kiddie** — Automated scanning, known vulnerabilities

---

## Attack Surfaces

### Threat Diagram

```mermaid
graph TB
    subgraph "External Actors"
        ATK[Attacker]
        MAL[Malicious Customer]
    end

    subgraph "Attack Surface"
        WEB[Web Application<br/>React SPA]
        API[API Endpoints<br/>Edge Functions]
        WH_TTN[TTN Webhook]
        WH_STRIPE[Stripe Webhook]
        AUTH[Auth Endpoints]
    end

    subgraph "Internal Systems"
        DB[(PostgreSQL<br/>+ RLS)]
        SECRETS[Secrets Store]
        FUNC[Edge Functions]
    end

    subgraph "External Services"
        TTN[The Things Network]
        STRIPE[Stripe]
    end

    ATK -->|XSS, CSRF| WEB
    ATK -->|Injection, Auth Bypass| API
    ATK -->|Forged Webhooks| WH_TTN
    ATK -->|Forged Webhooks| WH_STRIPE
    ATK -->|Credential Stuffing| AUTH
    MAL -->|Tenant Escape| API

    WEB --> API
    API --> DB
    API --> SECRETS
    WH_TTN --> FUNC
    WH_STRIPE --> FUNC
    FUNC --> DB

    TTN -.->|Legitimate| WH_TTN
    STRIPE -.->|Legitimate| WH_STRIPE

    style ATK fill:#ff6b6b
    style MAL fill:#ff9f43
    style DB fill:#2ed573
    style SECRETS fill:#2ed573
```

### Attack Surface Inventory

| Surface | Entry Point | Authentication | Risk Level |
|---------|-------------|----------------|------------|
| Web Application | `/*` routes | JWT session | Medium |
| REST API | `/functions/*` | JWT/API key | High |
| TTN Webhook | `/functions/ttn-webhook` | Webhook secret | High |
| Stripe Webhook | `/functions/stripe-webhook` | HMAC signature | Medium |
| Auth Endpoints | `/auth/v1/*` | None (public) | High |
| Database | PostgreSQL port | Service role | Critical |

---

## Threat Analysis (STRIDE)

### Spoofing

| Threat | Target | Mitigation | Status |
|--------|--------|------------|--------|
| **S1** Session hijacking | User sessions | JWT with expiry, HTTPS only | Active |
| **S2** Credential stuffing | Auth endpoint | Rate limiting, complexity rules | Active |
| **S3** Forged webhook calls | TTN/Stripe | Secret/signature verification | Active |
| **S4** API key theft | Service endpoints | Encrypted storage, rotation | Partial |

### Tampering

| Threat | Target | Mitigation | Status |
|--------|--------|------------|--------|
| **T1** Temperature data modification | Sensor readings | RLS, audit logs, hash chain | Active |
| **T2** Alert state manipulation | Alert records | RLS, role checks | Active |
| **T3** Configuration tampering | Org settings | RLS, admin-only access | Active |
| **T4** Log tampering | Audit logs | Hash chain, append-only | Active |

### Repudiation

| Threat | Target | Mitigation | Status |
|--------|--------|------------|--------|
| **R1** Deny alert acknowledgment | Alert actions | Actor ID, timestamp, IP logged | Active |
| **R2** Deny temperature logs | Manual entries | Actor ID, timestamp logged | Active |
| **R3** Deny configuration changes | Settings | Event log with actor | Active |

### Information Disclosure

| Threat | Target | Mitigation | Status |
|--------|--------|------------|--------|
| **I1** Cross-tenant data access | All data | RLS policies, org scope | Active |
| **I2** API key exposure | TTN keys | Encryption, last4 display | Active |
| **I3** Log leakage | Audit data | Access control, RLS | Partial |
| **I4** Error message disclosure | Stack traces | Production error handling | Active |

### Denial of Service

| Threat | Target | Mitigation | Status |
|--------|--------|------------|--------|
| **D1** API flooding | Edge functions | Rate limiting (platform) | Active |
| **D2** Auth endpoint abuse | Login | Rate limiting | Active |
| **D3** Webhook flooding | TTN webhook | Secret validation first | Active |
| **D4** Database exhaustion | PostgreSQL | Connection pooling | Active |

### Elevation of Privilege

| Threat | Target | Mitigation | Status |
|--------|--------|------------|--------|
| **E1** Tenant escape | Cross-org access | RLS, org_id validation | Active |
| **E2** Role escalation | User roles | DB constraints, RLS | Active |
| **E3** Service role access | Privileged ops | Server-side only | Active |
| **E4** Webhook to admin | Internal systems | Scoped permissions | Active |

---

## Attack Scenarios

### Scenario 1: Cross-Tenant Data Access

**Actor:** Malicious Customer
**Goal:** Access competitor's temperature data
**Attack Path:**

```
1. Attacker signs up for legitimate account
2. Inspects API calls in browser DevTools
3. Modifies organization_id in request
4. Attempts to fetch data from victim org
```

**Mitigations:**
- RLS policy checks `auth.uid()` against `profiles.organization_id`
- Returns empty result, not error (prevents enumeration)
- Function-level org validation as defense in depth

**Risk Rating:** Medium (mitigated)

---

### Scenario 2: Webhook Forgery

**Actor:** External Attacker
**Goal:** Inject false sensor data
**Attack Path:**

```
1. Attacker discovers webhook URL
2. Crafts fake TTN uplink payload
3. Sends to webhook endpoint
4. Attempts to inject readings for target org
```

**Mitigations:**
- Per-org webhook secret required in header
- Constant-time secret comparison (timing attack prevention)
- Org lookup via secret isolates scope
- Unknown secrets rejected before processing

**Risk Rating:** Low (well mitigated)

---

### Scenario 3: Credential Stuffing

**Actor:** Cybercriminal
**Goal:** Account takeover
**Attack Path:**

```
1. Attacker obtains leaked credential database
2. Automates login attempts against /auth/v1/token
3. Successful logins captured
4. Access victim organizations
```

**Mitigations:**
- Supabase rate limiting on auth endpoints
- Password complexity requirements
- **TBD:** Account lockout after failures
- **TBD:** Breach detection alerting
- **TBD:** MFA would prevent this attack

**Risk Rating:** Medium (partially mitigated)

---

### Scenario 4: API Key Extraction

**Actor:** Disgruntled Employee
**Goal:** Exfiltrate TTN API keys for sabotage
**Attack Path:**

```
1. Employee with admin access views TTN settings
2. Uses browser DevTools to intercept API response
3. Extracts encrypted key from response
4. Attempts offline decryption
```

**Mitigations:**
- Keys encrypted in database
- Full key never returned to frontend (only last4)
- Decryption requires server-side salt
- **TBD:** Key access logging and alerting

**Risk Rating:** Medium (encryption helps, access control needed)

---

### Scenario 5: Privilege Escalation via Role Manipulation

**Actor:** Malicious Customer (staff role)
**Goal:** Gain admin access
**Attack Path:**

```
1. Staff user inspects API calls
2. Discovers role update endpoint
3. Attempts to modify own role to admin
4. Crafts request with elevated role
```

**Mitigations:**
- Role table protected by RLS
- Only owner/admin can modify roles
- `has_role()` function validates permissions
- Database constraint on valid role values

**Risk Rating:** Low (well mitigated)

---

## Risk Assessment (DREAD)

| Threat | Damage | Reproducibility | Exploitability | Affected Users | Discoverability | Score |
|--------|--------|-----------------|----------------|----------------|-----------------|-------|
| S1 Session hijacking | 3 | 2 | 2 | 3 | 2 | **2.4** |
| S2 Credential stuffing | 4 | 4 | 3 | 3 | 4 | **3.6** |
| S3 Webhook forgery | 4 | 3 | 2 | 4 | 2 | **3.0** |
| I1 Cross-tenant access | 5 | 2 | 2 | 5 | 3 | **3.4** |
| I2 API key exposure | 4 | 2 | 2 | 4 | 2 | **2.8** |
| E1 Tenant escape | 5 | 2 | 2 | 5 | 3 | **3.4** |
| D1 API flooding | 2 | 4 | 4 | 4 | 4 | **3.6** |

**Score interpretation:** 1-2 (Low), 2-3 (Medium), 3-4 (High), 4-5 (Critical)

### Priority Ranking

1. **S2 Credential stuffing** (3.6) — Implement MFA
2. **D1 API flooding** (3.6) — Review rate limits
3. **I1/E1 Tenant escape** (3.4) — Audit RLS policies
4. **S3 Webhook forgery** (3.0) — Regular secret rotation
5. **I2 API key exposure** (2.8) — Add access logging

---

## Mitigation Controls

### Authentication Controls

| Control | Threat Addressed | Implementation |
|---------|-----------------|----------------|
| JWT verification | S1 Spoofing | Supabase Auth |
| Password complexity | S2 Stuffing | Frontend validation |
| Rate limiting | S2, D1 | Platform level |
| Webhook secrets | S3 Forgery | Per-org secrets |
| **MFA (TBD)** | S2 Stuffing | Not implemented |

### Authorization Controls

| Control | Threat Addressed | Implementation |
|---------|-----------------|----------------|
| RLS policies | E1, I1 | PostgreSQL |
| Role validation | E2 | `has_role()` function |
| Org scope checks | E1, I1 | Function-level |
| Service role isolation | E3 | Server-side only |

### Data Protection Controls

| Control | Threat Addressed | Implementation |
|---------|-----------------|----------------|
| TLS | T1, I2 | Platform |
| Encryption at rest | I2, I4 | Platform + app |
| Audit logging | R1, R2, R3 | Event logs table |
| Hash chain | T4 | Append-only logs |

### Monitoring Controls

| Control | Threat Addressed | Status |
|---------|-----------------|--------|
| Failed login monitoring | S2 | **TBD** |
| Unusual access patterns | E1, I1 | **TBD** |
| API abuse detection | D1 | **TBD** |
| Secret access logging | I2 | **TBD** |

---

## Security Testing Recommendations

### Penetration Testing Scope

| Area | Test Type | Frequency |
|------|-----------|-----------|
| Authentication | Credential attacks, session | Annual |
| Authorization | Tenant isolation, RBAC | Annual |
| API security | Injection, rate limiting | Annual |
| Webhook security | Forgery, replay | Annual |

### Automated Testing

| Tool | Purpose | Integration |
|------|---------|-------------|
| Dependency scanner | Known vulnerabilities | CI/CD |
| SAST | Code vulnerabilities | CI/CD |
| DAST | Runtime vulnerabilities | Staging |
| Secret scanner | Credential leakage | Pre-commit |

---

## Residual Risks

### Accepted Risks

| Risk | Justification | Monitoring |
|------|---------------|------------|
| CORS wildcard | Multi-tenant SaaS, protected by auth | Auth logs |
| localStorage JWT | Browser standard, short-lived | Session audit |
| XOR encryption | Defense in depth, not sole protection | Key rotation |

### Risks Requiring Attention

| Risk | Current State | Recommendation | Priority |
|------|---------------|----------------|----------|
| No MFA | Single factor | Implement TOTP | High |
| Limited rate visibility | Platform only | Add app-level | Medium |
| No breach detection | Manual review | Automated alerting | Medium |
| Key rotation manual | On-demand | Automated rotation | Low |

---

## Threat Model Maintenance

### Review Triggers

- New feature deployment
- Security incident
- Quarterly review cycle
- Dependency updates
- Infrastructure changes

### Update Process

1. Review current threats and mitigations
2. Assess new attack vectors
3. Update risk ratings
4. Document new controls
5. Communicate changes to team

---

## Related Documents

- [SECURITY_OVERVIEW.md](#security_overview) — High-level security architecture
- [AUTH_MODEL.md](#auth_model) — Authentication and authorization
- [DATA_PROTECTION.md](#data_protection) — Encryption and secrets
- [INCIDENT_RESPONSE.md](#incident_response) — Security incident procedures


---

\newpage

<a id="security-incident_response"></a>

# Incident Response

> Detection, containment, recovery, and postmortem procedures

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document Owner | Security Lead |
| Last Updated | 2026-01-12 |
| Review Frequency | Semi-annual |
| Test Frequency | Annual tabletop exercise |

---

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Active breach, data exfiltration | Immediate (< 15 min) | Credential theft, RLS bypass |
| **P2 - High** | Potential breach, service impact | < 1 hour | Suspicious access, DoS attack |
| **P3 - Medium** | Security weakness, limited impact | < 4 hours | Vulnerability discovered, failed attacks |
| **P4 - Low** | Minor issue, informational | < 24 hours | Policy violation, audit finding |

### Incident Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Unauthorized Access** | Access beyond permissions | Tenant escape, privilege escalation |
| **Data Breach** | Data exposure or theft | Customer data leak, API key exposure |
| **Service Disruption** | Availability impact | DoS, infrastructure failure |
| **Malware/Compromise** | System infection | Compromised credentials, malicious code |
| **Policy Violation** | Non-compliance | Improper access, audit failure |

---

## Response Team

### Roles and Responsibilities

| Role | Primary Responsibility | Backup |
|------|----------------------|--------|
| **Incident Commander** | Overall coordination, decisions | Engineering Lead |
| **Security Lead** | Technical investigation, containment | Senior Developer |
| **Communications Lead** | Customer/stakeholder updates | Product Manager |
| **Engineering Lead** | Technical remediation | On-call Engineer |
| **Legal Counsel** | Regulatory compliance | External Counsel |

### Escalation Path

```
P4 → On-call Engineer (monitor)
P3 → Security Lead (investigate)
P2 → Incident Commander + Security Lead (respond)
P1 → Full Response Team (all hands)
```

### Contact Information

| Role | Contact Method | Availability |
|------|---------------|--------------|
| Security Lead | **[TBD - Add contact]** | 24/7 for P1/P2 |
| On-call Engineer | **[TBD - PagerDuty/Opsgenie]** | 24/7 |
| Incident Commander | **[TBD - Add contact]** | Business hours + P1 |

---

## Phase 1: Detection

### Detection Sources

| Source | What It Detects | Alert Mechanism |
|--------|-----------------|-----------------|
| Supabase Logs | Auth failures, errors | Dashboard monitoring |
| Edge Function Logs | Application errors | Log aggregation |
| Event Logs Table | Business anomalies | Periodic review |
| Customer Reports | Visible issues | Support channel |
| External Scanners | Vulnerabilities | Scheduled scans |
| Platform Alerts | Infrastructure issues | Supabase status |

### Detection Indicators

#### High Confidence Indicators

| Indicator | Likely Incident | Action |
|-----------|-----------------|--------|
| Multiple failed logins from one IP | Brute force attack | Block IP, investigate |
| Cross-org data in logs | RLS bypass | Escalate immediately |
| Unexpected service role usage | Credential theft | Rotate keys, investigate |
| Webhook failures spike | Attack or misconfiguration | Validate secrets |

#### Medium Confidence Indicators

| Indicator | Possible Incident | Action |
|-----------|-------------------|--------|
| Unusual login times/locations | Account compromise | Verify with user |
| High API request volume | DoS or scraping | Review rate limits |
| New admin user created | Privilege escalation | Audit user creation |
| Configuration changes | Unauthorized change | Verify with admins |

### Initial Triage Checklist

```markdown
## Triage Checklist

- [ ] What was detected and when?
- [ ] What systems are affected?
- [ ] Is the attack ongoing?
- [ ] What data may be exposed?
- [ ] Are customers impacted?
- [ ] What is the preliminary severity (P1-P4)?
- [ ] Who needs to be notified?
```

---

## Phase 2: Containment

### Immediate Actions by Incident Type

#### Credential Compromise

```
1. Identify compromised credentials
2. Revoke/rotate affected credentials:
   - User password: Force password reset
   - API key: Regenerate in Supabase
   - Webhook secret: Regenerate + update integrations
   - Service role key: Contact Supabase support
3. Invalidate active sessions
4. Block suspicious IPs (if identifiable)
5. Preserve logs for investigation
```

#### Data Breach

```
1. Identify scope of exposure
2. If ongoing: Disable affected endpoints
3. Preserve evidence (logs, database state)
4. Document what data was accessed
5. Identify affected customers
6. Assess regulatory notification requirements
```

#### DoS Attack

```
1. Identify attack vector
2. Enable enhanced rate limiting
3. Block attacking IPs/ranges
4. Scale infrastructure if possible
5. Monitor for attack pattern changes
6. Consider CDN-level mitigation
```

#### RLS Bypass / Tenant Escape

```
1. CRITICAL: Disable affected functionality immediately
2. Identify all potentially affected queries
3. Audit logs for unauthorized access
4. Notify affected tenants
5. Preserve full database state for analysis
6. Review and fix RLS policies
```

### Containment Commands

#### Rotate Supabase Secrets

```bash
# API keys - via Supabase Dashboard
# Settings → API → Regenerate Keys

# JWT secret rotation - Contact Supabase Support
# This invalidates ALL sessions
```

#### Block User Access

```sql
-- Disable specific user (preserves data)
UPDATE auth.users
SET banned_until = 'infinity'
WHERE id = 'user-uuid-here';

-- Or delete session
DELETE FROM auth.sessions
WHERE user_id = 'user-uuid-here';
```

#### Emergency RLS Policy

```sql
-- If RLS bypass suspected, add emergency deny-all
CREATE POLICY "emergency_lockdown"
ON affected_table
AS RESTRICTIVE
FOR ALL
USING (false);

-- Remember to drop after investigation
-- DROP POLICY "emergency_lockdown" ON affected_table;
```

### Evidence Preservation

| Evidence | Collection Method | Retention |
|----------|------------------|-----------|
| Database logs | Supabase export | 90 days minimum |
| Edge function logs | Supabase export | 90 days minimum |
| Event logs table | Database backup | Permanent |
| Network logs | Supabase/CDN logs | As available |
| Timeline of actions | Incident document | Permanent |

---

## Phase 3: Eradication

### Root Cause Analysis

```markdown
## Root Cause Template

1. **What happened?**
   - Factual description of the incident

2. **How did it happen?**
   - Attack vector or failure mode
   - Vulnerabilities exploited

3. **Why wasn't it prevented?**
   - Control gaps
   - Detection failures

4. **What data/systems were affected?**
   - Scope of impact
   - Customer impact

5. **Timeline of events**
   - Detection time
   - Response time
   - Resolution time
```

### Remediation Checklist

```markdown
## Remediation Checklist

- [ ] Vulnerability identified and understood
- [ ] Fix developed and tested
- [ ] Fix deployed to production
- [ ] Verification that fix works
- [ ] Similar vulnerabilities identified and fixed
- [ ] Detection improved for future incidents
- [ ] Credentials rotated (if applicable)
- [ ] Affected users notified (if applicable)
```

### Common Remediation Actions

| Issue | Remediation |
|-------|-------------|
| Weak RLS policy | Rewrite policy, audit similar |
| Missing input validation | Add validation, review endpoints |
| Exposed credentials | Rotate all affected, add scanning |
| Missing rate limiting | Implement application-level limits |
| Insufficient logging | Add logging for blind spots |

---

## Phase 4: Recovery

### Recovery Procedures

#### Service Restoration

```markdown
1. Verify eradication is complete
2. Remove emergency controls (if applied)
3. Restore normal operations
4. Monitor for incident recurrence
5. Confirm functionality with smoke tests
```

#### Customer Communication

| Scenario | Communication |
|----------|---------------|
| No customer impact | Internal documentation only |
| Service disruption | Status page update |
| Data exposure (specific users) | Direct notification to affected |
| Data breach (broad) | Public notification + regulatory |

#### Regulatory Notification

| Regulation | Notification Requirement | Timeline |
|------------|-------------------------|----------|
| GDPR | Data breach to supervisory authority | 72 hours |
| State laws (varies) | Consumer notification | Varies by state |
| Industry specific | Per contractual requirements | Per contract |

### Recovery Verification

```markdown
## Recovery Checklist

- [ ] All affected systems restored
- [ ] Monitoring confirms normal operation
- [ ] No indicators of persistence
- [ ] Customer impact resolved
- [ ] Communications completed
- [ ] Documentation updated
```

---

## Phase 5: Postmortem

### Postmortem Process

```
1. Schedule postmortem meeting (within 5 business days)
2. Gather all timeline and evidence
3. Conduct blameless review
4. Document findings
5. Identify action items
6. Assign owners and deadlines
7. Share learnings (as appropriate)
```

### Postmortem Template

```markdown
# Security Incident Postmortem

## Incident Summary
- **Date/Time:**
- **Duration:**
- **Severity:**
- **Incident Commander:**

## What Happened
[Factual description]

## Timeline
| Time | Event |
|------|-------|
| | Detection |
| | Containment began |
| | Root cause identified |
| | Fix deployed |
| | Incident closed |

## Impact
- **Users Affected:**
- **Data Exposed:**
- **Service Downtime:**
- **Financial Impact:**

## Root Cause
[Technical explanation]

## What Went Well
- [List positives]

## What Went Poorly
- [List improvements needed]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | |

## Lessons Learned
[Key takeaways]
```

### Action Item Tracking

| Priority | Timeline | Example Actions |
|----------|----------|-----------------|
| Critical | 24 hours | Emergency patches, key rotation |
| High | 1 week | Security control additions |
| Medium | 1 month | Process improvements |
| Low | 1 quarter | Documentation updates |

---

## Communication Templates

### Internal Escalation

```
SECURITY INCIDENT - [P1/P2/P3/P4]

What: [Brief description]
When: [Detection time]
Impact: [Current assessment]
Status: [Detection/Containment/Eradication/Recovery]

Next Steps:
- [Immediate actions]

Requested:
- [Any assistance needed]
```

### Customer Notification (Data Breach)

```
Subject: Important Security Notice from FreshTrack Pro

Dear [Customer],

We are writing to inform you of a security incident that may
have affected your data.

**What Happened:**
[Clear, factual description]

**What Information Was Involved:**
[Specific data types]

**What We Are Doing:**
[Remediation steps]

**What You Can Do:**
[Recommended actions]

**For More Information:**
[Contact details]

We apologize for this incident and are committed to protecting
your data. If you have questions, please contact [support].

Sincerely,
[Name]
FreshTrack Pro Security Team
```

### Status Page Update

```
[TIMESTAMP] - Investigating increased error rates
[TIMESTAMP] - Identified issue, implementing fix
[TIMESTAMP] - Fix deployed, monitoring
[TIMESTAMP] - Incident resolved, all systems normal
```

---

## Tabletop Exercises

### Exercise Schedule

| Exercise Type | Frequency | Participants |
|---------------|-----------|--------------|
| Tabletop scenario | Quarterly | Response team |
| Technical drill | Semi-annual | Engineering |
| Full simulation | Annual | All stakeholders |

### Sample Scenarios

1. **Credential Stuffing Attack**
   - Large volume of failed logins detected
   - Some accounts may be compromised
   - Practice: Detection, containment, communication

2. **RLS Policy Bypass**
   - Customer reports seeing another org's data
   - Practice: Immediate containment, investigation

3. **Webhook Secret Exposure**
   - TTN webhook secret found in public log
   - Practice: Rotation, impact assessment

4. **Ransomware Scenario**
   - Supabase account access compromised
   - Practice: Escalation, recovery from backup

---

## Metrics and Improvement

### Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mean Time to Detect (MTTD) | < 1 hour (P1) | Detection time - incident start |
| Mean Time to Contain (MTTC) | < 4 hours (P1) | Containment time - detection |
| Mean Time to Recover (MTTR) | < 24 hours (P1) | Recovery time - detection |
| Postmortem completion | 100% (P1-P2) | Days to complete |
| Action item closure | 90% on time | Per due date |

### Continuous Improvement

After each incident:
1. Update runbooks with lessons learned
2. Improve detection for similar incidents
3. Enhance automated response where possible
4. Train team on new procedures
5. Update this document as needed

---

## Related Documents

- [SECURITY_OVERVIEW.md](#security_overview) — High-level security architecture
- [AUTH_MODEL.md](#auth_model) — Authentication and authorization
- [DATA_PROTECTION.md](#data_protection) — Encryption and secrets
- [THREAT_MODEL.md](#threat_model) — Threats and mitigations


---

\newpage

<a id="operations-metrics_overview"></a>

# Metrics Overview

> Key system metrics and health indicators for FreshTrack Pro

---

## Metric Categories

### Overview

| Category | What It Measures | Priority |
|----------|------------------|----------|
| **System Health** | Database, edge functions, infrastructure | Critical |
| **Application Health** | User operations, data processing | High |
| **Integration Health** | TTN, Stripe, notification delivery | High |
| **Business Metrics** | Sensors, alerts, readings | Medium |

---

## System Health Metrics

### Database Metrics

| Metric | Description | Healthy | Degraded | Unhealthy |
|--------|-------------|---------|----------|-----------|
| **Query Latency** | Time for standard queries | < 300ms | 300-500ms | > 500ms |
| **RPC Latency** | Time for function calls | < 500ms | 500-1000ms | > 1000ms |
| **Connection Status** | Database reachability | Connected | - | Unreachable |
| **Table Availability** | Critical tables accessible | All OK | Some degraded | Tables missing |

#### Critical Tables

These tables are checked during health checks:

```
organizations    - Tenant configuration
sites            - Location data
units            - Refrigeration units
alerts           - Active alerts
lora_sensors     - IoT sensors
gateways         - LoRa gateways
sensor_readings  - Temperature data
ttn_connections  - TTN configuration
```

#### How to Check

```bash
# Via health check endpoint
curl https://your-project.supabase.co/functions/v1/health-check

# Response structure
{
  "status": "ok|degraded|error",
  "timestamp": "2026-01-12T12:00:00Z",
  "checks": {
    "database": { "status": "ok", "latency_ms": 45 },
    "tables": { "status": "ok", "checked": 8, "available": 8 }
  }
}
```

---

### Edge Function Metrics

| Metric | Description | Source |
|--------|-------------|--------|
| **Invocation Count** | Number of function calls | Supabase Dashboard |
| **Success Rate** | Percentage of 2xx responses | Supabase Dashboard |
| **Average Latency** | Mean execution time | Supabase Dashboard |
| **Error Rate** | Percentage of 4xx/5xx | Supabase Dashboard |
| **Cold Start Rate** | First invocations after idle | Supabase Dashboard |

#### Critical Functions to Monitor

| Function | Criticality | Expected Latency | Notes |
|----------|-------------|------------------|-------|
| `ttn-webhook` | Critical | < 500ms | Data ingestion path |
| `process-unit-states` | Critical | < 2000ms | Alert processing |
| `process-escalations` | Critical | < 3000ms | Notification dispatch |
| `ingest-readings` | High | < 500ms | Sensor data processing |
| `health-check` | High | < 200ms | Monitoring endpoint |
| `stripe-webhook` | High | < 1000ms | Payment processing |

#### Function Health Check Status

The application checks 34 edge functions with these methods:

| Check Type | Description |
|------------|-------------|
| `GET` | Simple availability check |
| `POST` | Functions requiring request body |
| `skip` | Functions with side effects (webhooks, SMS) |

---

### Infrastructure Metrics

| Metric | Description | Where to Find |
|--------|-------------|---------------|
| **CDN Cache Hit Rate** | Edge cache efficiency | Supabase/CDN dashboard |
| **Bandwidth Usage** | Data transfer volume | Supabase dashboard |
| **Storage Usage** | Database size | Supabase dashboard |
| **Connection Pool** | Active DB connections | Supabase dashboard |

---

## Application Health Indicators

### Data Processing Metrics

| Metric | Description | Healthy State |
|--------|-------------|---------------|
| **Readings/Hour** | Sensor data ingestion rate | Consistent with sensor count |
| **Processing Lag** | Time from reading to storage | < 30 seconds |
| **Alert Creation Rate** | New alerts per hour | Within normal variance |
| **Alert Resolution Rate** | Resolved alerts per hour | Matches creation rate |

#### Sensor Reading Flow

```
Sensor → TTN → ttn-webhook → sensor_readings table
                    ↓
              process-unit-states → alerts table
                    ↓
              process-escalations → notifications
```

### Unit Status Distribution

Track the distribution of unit statuses:

| Status | Meaning | Normal Distribution |
|--------|---------|---------------------|
| `ok` | Normal operation | 85-95% |
| `excursion` | Unconfirmed temp issue | 0-5% |
| `alarm_active` | Confirmed alarm | 0-2% |
| `monitoring_interrupted` | No data received | 0-3% |
| `offline` | Extended no data | 0-5% |
| `manual_required` | Needs manual log | 0-10% |
| `restoring` | Recovering | 0-2% |

### Alert Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Active Alerts** | Currently unresolved | Minimize |
| **MTTR** | Mean time to resolution | < 30 min |
| **Acknowledgment Rate** | % acknowledged before escalation | > 80% |
| **Escalation Rate** | % requiring escalation | < 20% |

---

## Integration Health Metrics

### TTN Integration

| Metric | Description | Healthy State |
|--------|-------------|---------------|
| **Webhook Success Rate** | Valid payloads processed | > 99% |
| **Device Match Rate** | DevEUI matched to sensor | > 99% |
| **Unknown Device Rate** | Unmatched DevEUIs | < 1% |
| **Provisioning Success** | Devices registered to TTN | > 95% |

#### TTN Connection Status

Checked via `ttn_connections` table:

```sql
SELECT
  organization_id,
  is_enabled,
  provisioning_status,
  ttn_region,
  ttn_application_id IS NOT NULL as has_app_id,
  updated_at
FROM ttn_connections
WHERE is_enabled = true;
```

| Status | Description |
|--------|-------------|
| `healthy` | Enabled + complete + has app ID |
| `degraded` | Enabled but incomplete config |
| `unhealthy` | Disabled or missing critical fields |

### Stripe Integration

| Metric | Description | Healthy State |
|--------|-------------|---------------|
| **Webhook Delivery** | Stripe events received | 100% |
| **Signature Validation** | Valid signatures | 100% |
| **Event Processing** | Events handled successfully | > 99% |
| **Subscription Sync** | DB matches Stripe state | 100% |

#### Webhook Events Monitored

```
checkout.session.completed     - New subscription
customer.subscription.updated  - Plan changes
invoice.payment_succeeded      - Successful payment
invoice.payment_failed         - Failed payment
```

### Notification Delivery

| Metric | Description | Target |
|--------|-------------|--------|
| **Email Delivery Rate** | Emails successfully sent | > 99% |
| **SMS Delivery Rate** | SMS messages delivered | > 98% |
| **Push Notification Rate** | Push notifications sent | > 99% |
| **Notification Latency** | Time from trigger to delivery | < 60s |

---

## Sensor and Gateway Metrics

### Sensor Health

| Metric | Description | Warning Threshold |
|--------|-------------|-------------------|
| **Active Sensors** | Status = 'active' | Compare to expected |
| **Offline Sensors** | No reading > check-in interval | > 5% of total |
| **Low Battery** | Battery < 20% | Any sensors |
| **Weak Signal** | Signal < -100 dBm | > 10% of sensors |

#### Sensor Status Query

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM lora_sensors
GROUP BY status;
```

| Status | Meaning |
|--------|---------|
| `pending` | Created, not provisioned |
| `joining` | Registered, awaiting join |
| `active` | Operating normally |
| `offline` | No recent data |
| `fault` | Hardware issue detected |

### Gateway Health

| Metric | Description | Warning Threshold |
|--------|-------------|-------------------|
| **Online Gateways** | Status = 'online' | All expected online |
| **Offline Gateways** | No recent activity | Any offline |
| **Coverage Gaps** | Areas without gateway | Site-specific |

---

## Business Metrics

### Operational KPIs

| KPI | Description | How to Calculate |
|-----|-------------|------------------|
| **Monitoring Uptime** | % time sensors reporting | `(readings_received / expected_readings) * 100` |
| **Alert Response Time** | Time to acknowledge | `AVG(acknowledged_at - created_at)` |
| **Compliance Rate** | % readings in range | `(in_range_readings / total_readings) * 100` |
| **Coverage** | Units with active sensors | `(units_with_sensor / total_units) * 100` |

### Usage Metrics

| Metric | Description |
|--------|-------------|
| **Active Organizations** | Orgs with recent activity |
| **Active Users** | Users logged in last 30 days |
| **Total Sensors** | Deployed sensor count |
| **Daily Readings** | Readings per day |
| **Report Exports** | Reports generated |

---

## Metric Collection Points

### Current Implementation

| Collection Point | Method | Data Captured |
|------------------|--------|---------------|
| Health Check Endpoint | `/functions/v1/health-check` | System status, latencies |
| Debug Logger | Client-side ring buffer | Operations, errors, timing |
| Event Logs Table | Database insert | Business events |
| Supabase Dashboard | Platform metrics | Function stats, errors |

### Recommended Additions

| Metric | Recommended Tool | Purpose |
|--------|------------------|---------|
| APM traces | Sentry/DataDog | End-to-end timing |
| Custom metrics | Prometheus/Grafana | Business KPIs |
| Log aggregation | LogTail/Papertrail | Centralized logging |
| Uptime monitoring | BetterStack/Pingdom | External availability |

---

## Thresholds Summary

### System Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| DB Query Latency | > 300ms | > 500ms |
| RPC Latency | > 500ms | > 1000ms |
| Edge Function Error Rate | > 1% | > 5% |
| Cold Start Rate | > 10% | > 25% |

### Integration Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Webhook Success Rate | < 99% | < 95% |
| Device Match Rate | < 99% | < 95% |
| Notification Delivery | < 99% | < 95% |
| TTN Provisioning | < 95% | < 90% |

### Operational Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Units in Alarm | > 5% | > 10% |
| Sensors Offline | > 5% | > 15% |
| Alert Acknowledgment | > 30 min | > 60 min |
| Processing Lag | > 30s | > 60s |

---

## Related Documents

- [DASHBOARDS.md](#dashboards) — Dashboard configuration and visualization
- [ALERTING.md](#alerting) — Alert conditions and escalation
- [LOGGING.md](#logging) — Log sources and debugging
- [RUNBOOKS.md](#runbooks) — Operational procedures


---

\newpage

<a id="operations-dashboards"></a>

# Dashboards

> Monitoring dashboards and visualization for FreshTrack Pro

---

## Dashboard Architecture

### Metrics Flow Diagram

```mermaid
graph TB
    subgraph "Data Sources"
        S[Sensors/Gateways]
        TTN[TTN Network]
        STRIPE[Stripe]
        USERS[User Actions]
    end

    subgraph "Ingestion Layer"
        WH_TTN[ttn-webhook]
        WH_STRIPE[stripe-webhook]
        EF[Edge Functions]
    end

    subgraph "Storage Layer"
        DB[(PostgreSQL)]
        LOGS[Event Logs]
        METRICS[Debug Logs]
    end

    subgraph "Monitoring Layer"
        HC[Health Check]
        DT[Debug Terminal]
        SUPA[Supabase Dashboard]
    end

    subgraph "Dashboards"
        HD[Health Dashboard]
        INSP[Inspector]
        EVHIST[Event History]
        MAINT[Data Maintenance]
    end

    S --> TTN
    TTN --> WH_TTN
    STRIPE --> WH_STRIPE
    USERS --> EF

    WH_TTN --> DB
    WH_STRIPE --> DB
    EF --> DB
    EF --> LOGS
    EF --> METRICS

    DB --> HC
    DB --> HD
    LOGS --> EVHIST
    LOGS --> INSP
    METRICS --> DT

    HC --> HD
    HC --> SUPA
```

---

## Existing Dashboards

### 1. Health Dashboard

**Location:** `/admin/health`
**Access:** Admin users only
**Component:** `src/pages/HealthDashboard.tsx`

#### What It Shows

| Section | Information | Update Frequency |
|---------|-------------|------------------|
| Overall Status | System health summary | 1 minute (auto-refresh) |
| Category Breakdown | Database, Edge Functions, TTN, Overall | 1 minute |
| Check List | Individual check results | 1 minute |
| Latency Display | Response times per check | Per check |

#### Visual Elements

- **Status Badges:** healthy (green), degraded (yellow), unhealthy (red), unknown (gray)
- **Expandable Cards:** Click to see check details
- **Search/Filter:** Find specific checks
- **Sort Options:** By status, name, or latency

#### Health Check Categories

```
Database Checks
├── Query Latency
├── RPC Latency
└── Table Availability

Edge Function Checks
├── Critical Functions (flagged)
└── Non-Critical Functions

TTN Integration
├── Configuration Status
├── Provisioning Status
└── Application ID Check
```

#### Refresh Controls

| Control | Behavior |
|---------|----------|
| Auto-refresh | 1-minute interval (toggle) |
| Quick check | 5-minute interval for header badge |
| Manual refresh | Click to run all checks |

---

### 2. Debug Terminal

**Location:** Bottom dock (when enabled)
**Access:** Users with debug mode enabled
**Component:** `src/components/debug/DebugTerminal.tsx`

#### What It Shows

| Tab | Contents |
|-----|----------|
| **Events** | All logged events |
| **CRUD** | Database operations |
| **Network** | Edge function calls |
| **Sync** | Data synchronization |
| **TTN** | TTN-related operations |
| **Errors** | Error-level logs only |

#### Log Entry Details

```
[timestamp] [level] [category] Message
├── Duration: Xms (for operations)
├── Entity: type/id
├── Correlation ID: (for tracing)
└── Payload: (expandable JSON)
```

#### Controls

| Control | Function |
|---------|----------|
| Pause/Resume | Stop/start log collection |
| Clear | Empty the log buffer |
| Auto-scroll | Follow new entries |
| Export JSON | Download full log |
| Support Snapshot | Redacted export for support |
| Filter | By level, category, search |

---

### 3. Inspector (Audit Trail)

**Location:** `/inspector`
**Access:** Admin, Inspector roles
**Component:** `src/pages/Inspector.tsx`

#### What It Shows

| Section | Information |
|---------|-------------|
| Temperature Logs | Manual and sensor readings |
| Exception Logs | Alerts, violations, issues |
| Corrective Actions | Responses to exceptions |
| Monitoring Gaps | Periods without data |

#### Filters Available

- Date range
- Site selection
- Unit selection
- Log type

#### Export Options

- CSV export
- PDF report generation

---

### 4. Event History

**Location:** `/event-history` (or via admin menu)
**Access:** Admin users
**Component:** `src/pages/EventHistory.tsx`

#### What It Shows

All business events from `event_logs` table:

| Event Category | Examples |
|----------------|----------|
| Device | sensor_paired, reading_received, device_offline |
| Alert | created, activated, acknowledged, resolved |
| Compliance | manual_temp_logged, excursion_started |
| Settings | unit_settings_updated, alert_rules_updated |
| Notification | sent, failed, delivered |
| TTN | settings.updated, .enabled, .tested |
| System | user_login, report_exported |

#### Display Features

- Expandable event details
- Actor identification (user/system)
- Entity links (site, unit, sensor)
- Severity badges
- Pagination (50 per page)

---

### 5. Data Maintenance

**Location:** `/admin/maintenance`
**Access:** Owner/Admin only
**Component:** `src/pages/DataMaintenance.tsx`

#### What It Shows

| Section | Information |
|---------|-------------|
| Orphan Organizations | Orgs with no active users |
| Cleanup Jobs | Background job status |
| Data Integrity | Referential integrity checks |

#### Actions Available

- Soft delete orphan orgs
- View job history
- Manual cleanup triggers

---

## Supabase Dashboard

### Location

Access via: https://supabase.com/dashboard/project/{project-id}

### Key Sections

#### Database

| View | Information |
|------|-------------|
| Table Editor | Browse/edit data |
| SQL Editor | Run queries |
| Database Health | Connection stats |

#### Edge Functions

| View | Information |
|------|-------------|
| Function List | All deployed functions |
| Logs | Real-time function logs |
| Metrics | Invocations, latency, errors |

#### Authentication

| View | Information |
|------|-------------|
| Users | Registered users |
| Sessions | Active sessions |
| Logs | Auth events |

#### Storage

| View | Information |
|------|-------------|
| Buckets | File storage |
| Usage | Storage metrics |

---

## Recommended Dashboards

### Operations Dashboard (To Build)

**Purpose:** Single pane for ops team

```
┌─────────────────────────────────────────────────────────────┐
│                    OPERATIONS DASHBOARD                      │
├─────────────────┬───────────────────┬───────────────────────┤
│ System Health   │ Alert Summary     │ Integration Status    │
│ ● Database: OK  │ Active: 5         │ ● TTN: Healthy        │
│ ● Functions: OK │ Unack: 2          │ ● Stripe: Healthy     │
│ ● TTN: OK       │ Critical: 1       │ ● Email: Healthy      │
├─────────────────┴───────────────────┴───────────────────────┤
│                    Key Metrics (24h)                         │
│ Readings: 145,234 | Alerts: 23 | MTTR: 18min | Uptime: 99.9%│
├─────────────────────────────────────────────────────────────┤
│                    Recent Events                             │
│ 12:34 - Alert resolved: Unit 42 temperature normal          │
│ 12:28 - Alert created: Unit 15 high temperature             │
│ 12:15 - Sensor offline: DEV-A1B2C3                          │
└─────────────────────────────────────────────────────────────┘
```

#### Recommended Implementation

| Component | Tool | Data Source |
|-----------|------|-------------|
| System Health | Health check API | `/functions/v1/health-check` |
| Alert Summary | Database query | `alerts` table |
| Integration Status | Health checks | TTN, Stripe checks |
| Key Metrics | Database queries | Aggregated data |
| Recent Events | Event logs | `event_logs` table |

---

### Customer Success Dashboard (To Build)

**Purpose:** Customer health and usage

```
┌─────────────────────────────────────────────────────────────┐
│                 CUSTOMER SUCCESS DASHBOARD                   │
├─────────────────────────────────────────────────────────────┤
│ Active Organizations: 127  │  Active Users: 892             │
│ New This Month: 12         │  Churn Risk: 3                 │
├─────────────────────────────────────────────────────────────┤
│ Engagement Metrics                                           │
│ Daily Active Users: 234                                      │
│ Reports Generated: 89 (last 7 days)                          │
│ Alerts Acknowledged: 95%                                     │
├─────────────────────────────────────────────────────────────┤
│ Health Distribution                                          │
│ ███████████████████░░░ 89% Healthy                           │
│ ████░░░░░░░░░░░░░░░░░░ 8% At Risk                            │
│ ██░░░░░░░░░░░░░░░░░░░░ 3% Needs Attention                    │
└─────────────────────────────────────────────────────────────┘
```

---

### Integration Monitor (To Build)

**Purpose:** Track external service health

```
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRATION MONITOR                        │
├──────────────────────────────────────────────────────────────┤
│ TTN (The Things Network)                                     │
│ ├── Status: ● Online                                         │
│ ├── Webhooks/hour: 1,234                                     │
│ ├── Success rate: 99.8%                                      │
│ └── Last received: 2 seconds ago                             │
├──────────────────────────────────────────────────────────────┤
│ Stripe                                                       │
│ ├── Status: ● Online                                         │
│ ├── Events/day: 45                                           │
│ ├── Failed payments: 2                                       │
│ └── Last webhook: 3 hours ago                                │
├──────────────────────────────────────────────────────────────┤
│ Notifications                                                │
│ ├── Email (Resend): ● Online | Sent today: 89                │
│ ├── SMS (Twilio): ● Online | Sent today: 12                  │
│ └── Push: ● Online | Sent today: 234                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Dashboard Access Matrix

| Dashboard | Owner | Admin | Manager | Staff | Viewer |
|-----------|:-----:|:-----:|:-------:|:-----:|:------:|
| Health Dashboard | ✓ | ✓ | - | - | - |
| Debug Terminal | ✓ | ✓ | ✓ | - | - |
| Inspector | ✓ | ✓ | - | - | ✓ |
| Event History | ✓ | ✓ | - | - | - |
| Data Maintenance | ✓ | ✓ | - | - | - |
| Supabase Dashboard | Infra team only | - | - | - | - |

---

## Dashboard URLs

### Application Dashboards

| Dashboard | URL Path |
|-----------|----------|
| Health Dashboard | `/admin/health` |
| Inspector | `/inspector` |
| Event History | `/event-history` |
| Data Maintenance | `/admin/maintenance` |

### External Dashboards

| Dashboard | URL |
|-----------|-----|
| Supabase | `https://supabase.com/dashboard/project/{id}` |
| TTN Console | `https://eu1.cloud.thethings.network/console` |
| Stripe | `https://dashboard.stripe.com` |
| Resend | `https://resend.com/emails` |

---

## Monitoring Best Practices

### Daily Checks

1. Review Health Dashboard status
2. Check active alert count
3. Verify sensor online rate
4. Review any failed notifications

### Weekly Checks

1. Review Event History for patterns
2. Check integration success rates
3. Review customer usage metrics
4. Check storage and database growth

### Monthly Checks

1. Review overall system performance
2. Analyze alert trends
3. Review error rates and patterns
4. Capacity planning review

---

## Related Documents

- [METRICS_OVERVIEW.md](#metrics_overview) — Metric definitions and thresholds
- [ALERTING.md](#alerting) — Alert conditions and escalation
- [LOGGING.md](#logging) — Log sources and debugging
- [RUNBOOKS.md](#runbooks) — Operational procedures


---

\newpage

<a id="operations-alerting"></a>

# Alerting

> Alert conditions, severity levels, and escalation paths

---

## Alert Types Overview

### Application Alerts (Customer-Facing)

These are alerts visible to customers in the FreshTrack Pro application:

| Alert Type | Description | Severity |
|------------|-------------|----------|
| `temp_excursion` | Temperature outside safe range | Warning → Critical |
| `temp_high` | Temperature above max threshold | Warning → Critical |
| `temp_low` | Temperature below min threshold | Warning → Critical |
| `monitoring_interrupted` | No readings received | Warning → Critical |
| `door_open` | Door open too long | Warning |
| `low_battery` | Sensor battery low | Warning |
| `sensor_offline` | Sensor not reporting | Warning |
| `gateway_offline` | Gateway not reporting | Warning |

### System Alerts (Operations)

These require operational attention:

| Alert Type | Description | Severity |
|------------|-------------|----------|
| Health check failure | System component unhealthy | Critical |
| High error rate | Edge function errors > threshold | High |
| Integration failure | TTN/Stripe/notification failure | High |
| Database latency | Query time > threshold | Medium |
| Capacity warning | Storage/connections nearing limit | Medium |

---

## Alert Lifecycle

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> Triggered: Condition detected
    Triggered --> Activated: Confirm time elapsed
    Activated --> Escalated: No acknowledgment
    Activated --> Acknowledged: User acknowledges
    Escalated --> Acknowledged: User acknowledges
    Acknowledged --> Resolved: Condition clears
    Activated --> Resolved: Condition clears (auto)
    Resolved --> [*]
```

### State Definitions

| State | Description | Actions Available |
|-------|-------------|-------------------|
| **Triggered** | Condition detected, waiting confirm time | Auto-resolve if clears |
| **Activated** | Confirmed, notifications sent | Acknowledge, auto-resolve |
| **Escalated** | Escalation level increased | Acknowledge |
| **Acknowledged** | User has responded | Wait for resolution |
| **Resolved** | Condition cleared | View history |

---

## Severity Levels

### Application Severity

| Level | Color | Description | Example |
|-------|-------|-------------|---------|
| **Critical** | Red | Immediate action required | Temp > 45°F for >15min |
| **Warning** | Orange | Attention needed | Temp slightly out of range |
| **Info** | Blue | Informational | System status update |

### Operational Severity

| Level | Response Time | Description |
|-------|---------------|-------------|
| **P1 - Critical** | < 15 minutes | Service down, data at risk |
| **P2 - High** | < 1 hour | Significant degradation |
| **P3 - Medium** | < 4 hours | Minor impact |
| **P4 - Low** | < 24 hours | Informational |

---

## Alert Conditions

### Temperature Alerts

#### High Temperature

```
Condition:
  current_temp > max_threshold
  AND duration > confirm_time_minutes

Transitions:
  excursion → alarm_active (after confirm time)
  alarm_active → ok (when temp returns to range)
```

#### Low Temperature

```
Condition:
  current_temp < min_threshold
  AND duration > confirm_time_minutes

Transitions:
  Same as high temperature
```

#### Confirm Time

- Prevents false alarms from brief fluctuations
- Default: 5 minutes (configurable per unit)
- Range: 1-60 minutes

### Monitoring Alerts

#### No Data Received

```
Condition:
  last_reading_at < (now - check_in_interval - buffer)
  Buffer: 30 seconds

Unit Status:
  monitoring_interrupted (if critical)
  offline (if warning level)
```

#### Sensor Offline

```
Condition:
  sensor.last_seen_at < (now - 2 * expected_interval)

Threshold:
  Expected interval: 5-15 minutes (sensor-dependent)
```

### Device Alerts

#### Low Battery

```
Condition:
  battery_level < 20%

Notification:
  Warning at 20%
  Critical at 10%
```

#### Door Open

```
Condition:
  door_state = 'open'
  AND duration > door_grace_period

Grace Period:
  Default: 5 minutes (configurable)
```

---

## Escalation Paths

### Customer Alert Escalation

```
Level 1 (Immediate)
├── Primary notification contacts
├── Channels: Email, SMS, Push
└── Wait: escalation_delay minutes

Level 2 (After delay)
├── Secondary/manager contacts
├── Channels: Same as configured
└── Wait: escalation_delay minutes

Level 3 (After 2x delay)
├── Emergency/owner contacts
├── Channels: All available
└── Final level
```

### Escalation Configuration

Stored in `notification_policies` table:

| Field | Description |
|-------|-------------|
| `escalation_delay_minutes` | Time before escalation |
| `escalation_contacts` | Contact IDs per level |
| `quiet_hours_start/end` | Suppress non-critical during hours |
| `channels` | email, sms, push |

### Operational Escalation

| Level | Time | Contacts | Actions |
|-------|------|----------|---------|
| L1 | 0 min | On-call engineer | Investigate |
| L2 | 15 min | Engineering lead | Join investigation |
| L3 | 30 min | Engineering manager | Incident command |
| L4 | 60 min | CTO/Leadership | Executive awareness |

---

## Notification Channels

### Email Notifications

- **Provider:** Resend API
- **Trigger:** All alert levels
- **Content:** Alert details, unit info, action links
- **Retry:** 3 attempts with backoff

### SMS Notifications

- **Provider:** Twilio
- **Trigger:** Critical alerts, escalations
- **Content:** Brief alert summary, call to action
- **Retry:** 3 attempts

### Push Notifications

- **Platform:** Web push (PWA)
- **Trigger:** All alerts (if enabled)
- **Content:** Title and brief message
- **Delivery:** Best-effort

### Notification Status

| Status | Description |
|--------|-------------|
| `queued` | Waiting to send |
| `sent` | Successfully dispatched |
| `delivered` | Confirmed delivery |
| `failed` | Delivery failed |
| `suppressed` | Quiet hours or disabled |

---

## Alert Processing

### Process Flow

```mermaid
sequenceDiagram
    participant S as Sensor Reading
    participant P as process-unit-states
    participant DB as Database
    participant E as process-escalations
    participant N as Notification Service

    S->>P: New reading received
    P->>DB: Check alert rules
    P->>DB: Compare to thresholds

    alt Threshold exceeded
        P->>DB: Create/update alert
        P->>DB: Update unit status
        P->>E: Trigger escalation check
        E->>DB: Check notification policy
        E->>N: Send notifications
        N-->>E: Delivery status
        E->>DB: Log notification
    else Within range
        P->>DB: Resolve any active alert
        P->>DB: Update unit status to OK
    end
```

### Processing Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `process-unit-states` | Evaluate alerts, update status | After reading ingestion |
| `process-escalations` | Send notifications, escalate | Alert state changes |

---

## Operational Alerts (Recommended)

### Current State

FreshTrack Pro does not currently have automated operational alerting. Monitoring is through:
- Health Dashboard (manual check)
- Supabase Dashboard (platform metrics)
- Debug Terminal (application logs)

### Recommended Alerting Setup

#### Integration with External Service

| Service | Use Case | Integration Method |
|---------|----------|-------------------|
| PagerDuty | On-call management | Webhook from health check |
| Opsgenie | Incident management | API integration |
| Slack | Team notifications | Webhook |
| Email | Backup notifications | SMTP |

#### Recommended Alert Rules

| Condition | Threshold | Severity |
|-----------|-----------|----------|
| Health check returns error | Any check failed | P2 |
| Health check returns degraded | >3 checks degraded | P3 |
| Edge function error rate | >5% in 5 minutes | P2 |
| Database latency | >500ms avg | P3 |
| TTN webhook failures | >10% in 1 hour | P2 |
| No readings received | 0 in 15 minutes | P1 |

#### Implementation Approach

```javascript
// Recommended: Add to health-check function
if (overallStatus === 'error') {
  await fetch(process.env.PAGERDUTY_WEBHOOK, {
    method: 'POST',
    body: JSON.stringify({
      routing_key: process.env.PAGERDUTY_KEY,
      event_action: 'trigger',
      payload: {
        summary: 'FreshTrack Pro health check failed',
        severity: 'critical',
        source: 'health-check',
        custom_details: checkResults
      }
    })
  });
}
```

---

## Alert Configuration

### Per-Organization Settings

| Setting | Location | Description |
|---------|----------|-------------|
| Alert rules | `alert_rules` table | Thresholds per unit/site |
| Notification policy | `notification_policies` | Channels, contacts |
| Escalation contacts | `escalation_contacts` | Contact hierarchy |
| Quiet hours | `notification_policies` | Suppress timing |

### Default Thresholds

| Unit Type | Min Temp | Max Temp | Confirm Time |
|-----------|----------|----------|--------------|
| Cooler | 33°F | 40°F | 5 min |
| Freezer | -10°F | 0°F | 5 min |
| Walk-in Cooler | 35°F | 41°F | 10 min |
| Prep Station | 35°F | 40°F | 5 min |

### Alert Rule Cascade

```
Organization Default
    ↓ (override)
Site Settings
    ↓ (override)
Unit Settings
```

Resolved via `get_effective_alert_rules` RPC.

---

## Silencing and Suppression

### Quiet Hours

- Configurable per notification policy
- Suppresses non-critical alerts
- Critical alerts always sent
- Logged as "suppressed" for audit

### Manual Suppression

| Action | Effect | Duration |
|--------|--------|----------|
| Acknowledge alert | Stops escalation | Until resolved |
| Disable unit monitoring | No alerts | Until re-enabled |
| Contact opt-out | Skip contact | Permanent |

### Maintenance Windows

Currently: Manual acknowledgment during maintenance
Recommended: Scheduled suppression windows (to implement)

---

## Alert Auditing

### What's Logged

| Event | Logged Data |
|-------|-------------|
| Alert created | Type, severity, unit, timestamp |
| Alert acknowledged | User, timestamp, note |
| Alert resolved | Timestamp, auto/manual |
| Notification sent | Channel, recipient, status |
| Escalation triggered | Level, contacts notified |

### Audit Queries

```sql
-- Recent alerts by organization
SELECT * FROM alerts
WHERE organization_id = ?
ORDER BY created_at DESC
LIMIT 50;

-- Alert response times
SELECT
  id,
  type,
  created_at,
  acknowledged_at,
  EXTRACT(EPOCH FROM (acknowledged_at - created_at))/60 as minutes_to_ack
FROM alerts
WHERE acknowledged_at IS NOT NULL
ORDER BY created_at DESC;

-- Escalated alerts
SELECT * FROM alerts
WHERE escalation_level > 0
ORDER BY created_at DESC;
```

---

## Troubleshooting Alerts

### Alert Not Triggering

1. Check alert rules exist for unit
2. Verify confirm time hasn't elapsed yet
3. Check `process-unit-states` function logs
4. Verify sensor is sending data

### Notification Not Received

1. Check notification policy configuration
2. Verify contact has valid email/phone
3. Check `process-escalations` function logs
4. Check notification delivery status in DB
5. Verify not in quiet hours

### Alert Not Resolving

1. Verify temperature returned to range
2. Check `process-unit-states` is running
3. Check for stale readings (sensor offline)
4. Manual resolution may be needed

---

## Related Documents

- [METRICS_OVERVIEW.md](#metrics_overview) — Metric definitions and thresholds
- [DASHBOARDS.md](#dashboards) — Dashboard configuration
- [LOGGING.md](#logging) — Log sources and debugging
- [RUNBOOKS.md](#runbooks) — Operational procedures


---

\newpage

<a id="operations-logging"></a>

# Logging

> Log sources, formats, and debugging procedures

---

## Log Sources Overview

### Log Architecture

```mermaid
graph TB
    subgraph "Client Side"
        DL[Debug Logger<br/>Ring Buffer]
        EL[Event Logger<br/>UI Events]
    end

    subgraph "Server Side"
        EF[Edge Function Logs<br/>console.log]
        AU[Supabase Auth Logs]
    end

    subgraph "Database"
        EVT[(event_logs table)]
        SR[(sensor_readings)]
        AL[(alerts)]
    end

    subgraph "Viewing"
        DT[Debug Terminal]
        EH[Event History]
        INSP[Inspector]
        SUPA[Supabase Dashboard]
    end

    DL --> DT
    EL --> EVT
    EF --> SUPA
    AU --> SUPA
    EVT --> EH
    EVT --> INSP
    SR --> INSP
    AL --> INSP
```

---

## Client-Side Logging

### Debug Logger

**Location:** `src/lib/debugLogger.ts`
**Storage:** In-memory ring buffer (5000 entries)

#### Log Levels

| Level | Color | Use Case |
|-------|-------|----------|
| `debug` | Gray | Verbose debugging |
| `info` | Blue | Normal operations |
| `warn` | Orange | Potential issues |
| `error` | Red | Errors and failures |

#### Log Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `ui` | User interface events | Button clicks, navigation |
| `routing` | Route changes | Page transitions |
| `db` | Database operations | Queries, mutations |
| `sync` | Data synchronization | Offline sync, refresh |
| `ttn` | TTN operations | Provisioning, webhooks |
| `provisioning` | Device provisioning | Sensor/gateway setup |
| `edge` | Edge function calls | API requests |
| `network` | Network activity | Fetch, WebSocket |
| `auth` | Authentication | Login, logout, token |
| `crud` | CRUD operations | Create, update, delete |
| `realtime` | Real-time updates | Subscriptions |
| `mutation` | Data mutations | Form submissions |
| `query` | Data queries | Data fetching |

#### Using the Debug Logger

```typescript
import { debugLog, startOperation, endOperation } from '@/lib/debugLogger';

// Simple log
debugLog.info('crud', 'Created new unit', { unitId, name });

// Operation tracking
const opId = startOperation('provisioning', 'Provisioning sensor');
try {
  await provisionSensor(sensor);
  endOperation(opId, 'success', { sensorId: sensor.id });
} catch (error) {
  endOperation(opId, 'error', { error: error.message });
}

// With correlation ID (for tracing related operations)
debugLog.info('ttn', 'Starting TTN sync', {
  correlationId: 'abc-123'
});
```

#### Automatic Redaction

The debug logger automatically redacts sensitive data:

| Field Pattern | Redaction |
|---------------|-----------|
| `api_key`, `apiKey` | `[REDACTED]` |
| `secret`, `password` | `[REDACTED]` |
| `token`, `authorization` | `[REDACTED]` |
| `private_key`, `credential` | `[REDACTED]` |
| `ttn_api_key_last4` | Shows last 4 only |
| `dev_eui`, `gateway_eui` | Shows last 4 only |

#### Exporting Logs

```typescript
import { exportLogs, generateSnapshot } from '@/lib/debugLogger';

// Full JSON export
const jsonLogs = exportLogs();

// Support snapshot (safe for sharing)
const snapshot = generateSnapshot({
  focusTimestamp: errorTime,
  includeNetwork: true,
  maxLogs: 500
});
```

---

### Event Logger

**Location:** `src/lib/eventLogger.ts`
**Storage:** `event_logs` database table

#### Log Functions

```typescript
// General event logging
logEvent({
  event_type: 'unit.settings_updated',
  category: 'settings',
  severity: 'info',
  title: 'Unit settings changed',
  site_id: unit.site_id,
  unit_id: unit.id,
  event_data: { changes: diff }
});

// Alert-specific logging
logAlertEvent(alert, 'acknowledged', userId, { note: 'Checking now' });

// Manual temperature logging
logManualTempEvent(unit, temperature, userId, { note: 'Visual check' });

// Settings change logging
logSettingsEvent('alert_rules', 'updated', userId, {
  before: oldRules,
  after: newRules
});
```

#### Event Types

| Type Pattern | Description |
|--------------|-------------|
| `sensor.*` | Sensor events (paired, reading, offline) |
| `alert.*` | Alert lifecycle (created, acknowledged, resolved) |
| `compliance.*` | Compliance events (excursion, gap) |
| `settings.*` | Configuration changes |
| `notification.*` | Notification delivery |
| `ttn.*` | TTN integration events |
| `system.*` | System events (login, export) |

---

## Server-Side Logging

### Edge Function Logging

All edge functions use `console.log` with prefixes:

```typescript
// Standard pattern
console.log('[ttn-webhook] Received uplink', {
  dev_eui: payload.end_device_ids.dev_eui
});

// Error logging
console.error('[ttn-webhook] Device not found', {
  dev_eui: normalizedEui
});

// Timing
const startTime = Date.now();
// ... operation ...
console.log('[process-unit-states] Completed', {
  duration_ms: Date.now() - startTime,
  units_processed: count
});
```

### Function Log Prefixes

| Function | Prefix |
|----------|--------|
| `ttn-webhook` | `[ttn-webhook]` |
| `stripe-webhook` | `[stripe-webhook]` |
| `process-unit-states` | `[process-unit-states]` |
| `process-escalations` | `[process-escalations]` |
| `ingest-readings` | `[ingest-readings]` |
| `health-check` | `[health-check]` |

### Viewing Server Logs

#### Supabase Dashboard

1. Navigate to Edge Functions
2. Select function
3. View "Logs" tab
4. Filter by time range

#### CLI Access

```bash
# Stream logs (requires Supabase CLI)
supabase functions logs ttn-webhook --follow

# View recent logs
supabase functions logs ttn-webhook --limit 100
```

---

## Database Logging

### Event Logs Table

**Table:** `event_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Tenant scope |
| `event_type` | TEXT | Event identifier |
| `category` | TEXT | Event category |
| `severity` | TEXT | info/warning/critical |
| `title` | TEXT | Human-readable title |
| `actor_id` | UUID | User who triggered |
| `actor_type` | TEXT | user/system |
| `site_id` | UUID | Related site |
| `area_id` | UUID | Related area |
| `unit_id` | UUID | Related unit |
| `event_data` | JSONB | Additional data |
| `ip_address` | INET | Client IP |
| `user_agent` | TEXT | Browser info |
| `previous_hash` | TEXT | Hash chain |
| `event_hash` | TEXT | Event hash |
| `created_at` | TIMESTAMPTZ | Timestamp |

### Query Examples

```sql
-- Recent events for an organization
SELECT * FROM event_logs
WHERE organization_id = 'org-uuid'
ORDER BY created_at DESC
LIMIT 50;

-- Events by type
SELECT * FROM event_logs
WHERE event_type LIKE 'alert.%'
ORDER BY created_at DESC;

-- Events by actor
SELECT * FROM event_logs
WHERE actor_id = 'user-uuid'
ORDER BY created_at DESC;

-- Events with search
SELECT * FROM event_logs
WHERE title ILIKE '%temperature%'
OR event_data::text ILIKE '%temperature%'
ORDER BY created_at DESC;
```

---

## Log Retention

### Current Retention

| Log Type | Retention | Location |
|----------|-----------|----------|
| Debug logs | Session only | Browser memory |
| Event logs | Permanent | Database |
| Edge function logs | 7 days | Supabase |
| Auth logs | 7 days | Supabase |

### Recommendations

| Log Type | Recommended Retention | Reason |
|----------|----------------------|--------|
| Event logs | 2+ years | Compliance (HACCP) |
| Edge function logs | 30 days | Debugging |
| Auth logs | 90 days | Security |

---

## Debugging Procedures

### Using the Debug Terminal

1. **Enable Debug Mode**
   - Press `Ctrl+Shift+D` or toggle in settings
   - Debug terminal appears at bottom

2. **Filter Logs**
   - Use tabs: Events, CRUD, Network, Sync, TTN, Errors
   - Search by keyword
   - Filter by category or entity

3. **Trace Operations**
   - Click correlation ID link to filter related
   - Expand entries to see full payload
   - Note duration for performance issues

4. **Export for Support**
   - Click "Support Snapshot" button
   - Automatically redacts sensitive data
   - Share JSON with support team

### Debugging Common Issues

#### No Sensor Readings

```
1. Check TTN tab in Debug Terminal
2. Look for webhook entries
3. If no entries:
   - Check TTN Console for uplinks
   - Verify webhook URL in TTN
   - Check webhook secret matches
4. If entries exist:
   - Look for error messages
   - Check device matching logs
   - Verify DevEUI format
```

#### Alert Not Triggering

```
1. Check DB tab for alert rule queries
2. Verify rules returned for unit
3. Check Edge tab for process-unit-states calls
4. Look for evaluation logs
5. Check confirm time hasn't elapsed
```

#### Notification Not Delivered

```
1. Check event_logs for notification events
2. Look for process-escalations logs
3. Verify contact configuration
4. Check for quiet hours suppression
5. Review notification delivery status
```

### Edge Function Debugging

#### View Logs in Supabase

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select the function
4. Click "Logs" tab
5. Set time range
6. Search for relevant entries

#### Log Search Patterns

```
# Find webhook errors
[ttn-webhook] Error

# Find device matching
Device not found

# Find processing times
duration_ms

# Find specific device
DEV-EUI-HERE
```

---

## Support Snapshot

### What's Included

```json
{
  "meta": {
    "version": "1.0.0",
    "environment": "production",
    "timestamp": "2026-01-12T12:00:00Z",
    "currentRoute": "/dashboard"
  },
  "user": {
    "emailDomain": "example.com",
    "organizationId": "org-uuid",
    "debugEnabled": true
  },
  "logs": {
    "entries": [...],  // Last 500 entries
    "totalCount": 1234
  },
  "network": {
    "recentCalls": [...]  // Last 50 edge calls
  },
  "domain": {
    "ttnConfig": {
      "cluster": "eu1",
      "hasAppId": true
    },
    "sensors": { "count": 25, "active": 23 },
    "gateways": { "count": 2, "online": 2 }
  }
}
```

### What's Redacted

- Full API keys (shows last4 only)
- Full email addresses (shows domain only)
- Password fields
- Auth tokens
- Session data

### Generating Snapshot

```typescript
// Via UI
// Click "Support Snapshot" in Debug Terminal

// Via code
import { generateSnapshot } from '@/lib/snapshotBuilder';

const snapshot = generateSnapshot({
  focusTimestamp: errorTimestamp,
  includeNetwork: true,
  maxLogs: 500,
  surroundingSeconds: 30
});
```

---

## Log Analysis

### Performance Analysis

```typescript
// Find slow operations
const slowOps = logs.filter(log =>
  log.duration && log.duration > 1000
);

// Find error patterns
const errors = logs.filter(log =>
  log.level === 'error'
);

// Group by category
const byCategory = logs.reduce((acc, log) => {
  acc[log.category] = (acc[log.category] || 0) + 1;
  return acc;
}, {});
```

### Common Patterns to Watch

| Pattern | Indicates |
|---------|-----------|
| Repeated `401` errors | Auth issues |
| High `duration_ms` values | Performance problems |
| `Device not found` | DevEUI mismatch |
| `RLS policy violation` | Permission issue |
| `Connection timeout` | Network problems |

---

## Best Practices

### Logging Guidelines

1. **Always use structured logging**
   ```typescript
   // Good
   console.log('[function] Event', { key: value });

   // Bad
   console.log('Something happened with ' + value);
   ```

2. **Include context**
   ```typescript
   // Good
   console.log('[process] Completed', {
     duration_ms: Date.now() - start,
     items_processed: count,
     errors: errorCount
   });
   ```

3. **Use appropriate levels**
   - `debug`: Verbose, development only
   - `info`: Normal operations
   - `warn`: Potential issues
   - `error`: Failures

4. **Never log secrets**
   ```typescript
   // Good
   console.log('Using key ending in', key.slice(-4));

   // Bad
   console.log('API key:', apiKey);
   ```

5. **Use correlation IDs for tracing**
   ```typescript
   const correlationId = crypto.randomUUID();
   debugLog.info('Starting operation', { correlationId });
   // ... pass correlationId through the operation
   ```

---

## Related Documents

- [METRICS_OVERVIEW.md](#metrics_overview) — Metric definitions and thresholds
- [DASHBOARDS.md](#dashboards) — Dashboard configuration
- [ALERTING.md](#alerting) — Alert conditions and escalation
- [RUNBOOKS.md](#runbooks) — Operational procedures


---

\newpage

<a id="operations-runbooks"></a>

# Runbooks

> Step-by-step operational procedures for common incidents

---

## Runbook Index

| ID | Runbook | Severity | Trigger |
|----|---------|----------|---------|
| RB-001 | [Health Check Failure](#rb-001-health-check-failure) | P2 | Health dashboard red |
| RB-002 | [TTN Webhook Not Receiving](#rb-002-ttn-webhook-not-receiving) | P1 | No sensor readings |
| RB-003 | [Sensor Offline](#rb-003-sensor-offline) | P3 | Sensor status offline |
| RB-004 | [Gateway Offline](#rb-004-gateway-offline) | P2 | Gateway not reporting |
| RB-005 | [Alert Processing Failure](#rb-005-alert-processing-failure) | P1 | Alerts not triggering |
| RB-006 | [Notification Delivery Failure](#rb-006-notification-delivery-failure) | P2 | Notifications not sent |
| RB-007 | [Database Latency High](#rb-007-database-latency-high) | P3 | Slow queries |
| RB-008 | [Stripe Webhook Failure](#rb-008-stripe-webhook-failure) | P2 | Payment issues |
| RB-009 | [Simulator Not Running](#rb-009-simulator-not-running) | P4 | Test data not generating |
| RB-010 | [User Cannot Login](#rb-010-user-cannot-login) | P3 | Auth failures |
| RB-011 | [TTN Provisioning Failure](#rb-011-ttn-provisioning-failure) | P3 | Device registration fails |
| RB-012 | [Data Ingestion Backlog](#rb-012-data-ingestion-backlog) | P2 | Processing delays |

---

## RB-001: Health Check Failure

### Symptoms
- Health Dashboard shows red status
- `/functions/v1/health-check` returns error status
- One or more checks failing

### Severity
P2 - High

### Initial Assessment

```bash
# 1. Check health endpoint directly
curl https://your-project.supabase.co/functions/v1/health-check

# 2. Note which checks are failing
# Response format:
{
  "status": "error",
  "checks": {
    "database": { "status": "error", "error": "..." },
    "tables": { "status": "ok" },
    ...
  }
}
```

### Resolution Steps

#### If Database Check Failing

1. Check Supabase status page: https://status.supabase.com
2. Verify database is accessible via Supabase Dashboard
3. Check for connection pool exhaustion
4. If persistent, contact Supabase support

#### If Edge Function Check Failing

1. Check Supabase Edge Functions dashboard
2. Look for deployment errors
3. Check function logs for errors
4. Verify environment variables are set
5. Try redeploying the function:
   ```bash
   supabase functions deploy <function-name>
   ```

#### If TTN Check Failing

1. Verify TTN connection is enabled
2. Check `ttn_connections` table for config
3. Validate TTN API key is still valid
4. See [RB-002](#rb-002-ttn-webhook-not-receiving)

### Escalation
- If unresolved after 15 minutes: Escalate to Engineering Lead
- If affecting customer data: Escalate immediately

---

## RB-002: TTN Webhook Not Receiving

### Symptoms
- No new sensor readings appearing
- `sensor_readings` table not updating
- TTN Console shows uplinks but no delivery

### Severity
P1 - Critical (data not being collected)

### Diagnosis

```bash
# 1. Check TTN webhook logs
supabase functions logs ttn-webhook --limit 50

# 2. Look for patterns:
# - "Webhook received" = Reaching our endpoint
# - "Unknown device" = DevEUI not matched
# - "Invalid secret" = Auth failure
# - No logs = Webhook not reaching us
```

### Resolution Steps

#### Step 1: Verify TTN Configuration

1. Go to TTN Console → Applications → Integrations → Webhooks
2. Verify webhook URL: `https://your-project.supabase.co/functions/v1/ttn-webhook`
3. Check "Enabled" is true
4. Verify "Uplink message" is checked

#### Step 2: Verify Webhook Secret

```sql
-- Get webhook secret (last 4 chars)
SELECT
  organization_id,
  ttn_application_id,
  ttn_webhook_secret_encrypted IS NOT NULL as has_secret,
  SUBSTRING(ttn_webhook_secret_encrypted FROM -4) as secret_last4
FROM ttn_connections
WHERE is_enabled = true;
```

1. Compare secret in TTN Console header configuration
2. Header name should be: `X-Webhook-Secret`
3. If mismatch, update in TTN Console

#### Step 3: Test Webhook Manually

```bash
# Send test payload (replace values)
curl -X POST \
  https://your-project.supabase.co/functions/v1/ttn-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret-here" \
  -d '{
    "end_device_ids": {
      "device_id": "test-device",
      "dev_eui": "AABBCCDDEEFF0011"
    },
    "uplink_message": {
      "decoded_payload": {
        "temperature": 38.5
      }
    }
  }'
```

#### Step 4: Check Device Matching

```sql
-- Find sensor by DevEUI
SELECT id, dev_eui, status, unit_id
FROM lora_sensors
WHERE UPPER(REPLACE(dev_eui, ':', '')) = 'AABBCCDDEEFF0011';
```

If not found:
- DevEUI may be formatted differently
- Sensor may not be registered
- Check both `lora_sensors` and legacy `devices` table

### Escalation
- Immediate if no data for >15 minutes across all orgs
- Engineering Lead + on-call

---

## RB-003: Sensor Offline

### Symptoms
- Sensor status shows "offline"
- No recent readings from sensor
- Customer reports unit not updating

### Severity
P3 - Medium

### Diagnosis

```sql
-- Check sensor status
SELECT
  id,
  dev_eui,
  status,
  last_seen_at,
  battery_level,
  signal_strength,
  NOW() - last_seen_at as time_since_seen
FROM lora_sensors
WHERE id = 'sensor-uuid';
```

### Resolution Steps

#### Step 1: Verify Physical Device

1. Contact customer to verify:
   - Sensor is powered on
   - Sensor LED indicates normal operation
   - Sensor is in range of gateway

#### Step 2: Check Gateway Status

```sql
-- Find gateway for this org
SELECT id, name, status, last_seen_at
FROM gateways
WHERE organization_id = 'org-uuid';
```

If gateway offline, see [RB-004](#rb-004-gateway-offline)

#### Step 3: Check TTN Device Status

1. Go to TTN Console → Applications → Devices
2. Find device by DevEUI
3. Check "Last seen" timestamp
4. Check for join issues

#### Step 4: Force Rejoin (If Needed)

1. In TTN Console, delete device session keys
2. Power cycle physical sensor
3. Monitor for new join request

### Customer Communication

```
Subject: Sensor Status Update

We've identified that sensor [DEV_EUI_LAST4] appears to be
offline. This could be due to:

1. Low battery - Please check the sensor battery
2. Signal issues - Ensure the sensor is within range of the gateway
3. Physical issue - Try power cycling the sensor

If the issue persists after checking these items, please
contact support with the sensor location details.
```

---

## RB-004: Gateway Offline

### Symptoms
- Gateway status shows "offline"
- Multiple sensors behind gateway not reporting
- TTN Console shows gateway disconnected

### Severity
P2 - High (affects multiple sensors)

### Diagnosis

```sql
-- Check gateway and related sensors
SELECT
  g.id,
  g.name,
  g.status,
  g.last_seen_at,
  COUNT(s.id) as sensor_count
FROM gateways g
LEFT JOIN lora_sensors s ON s.gateway_id = g.id
WHERE g.id = 'gateway-uuid'
GROUP BY g.id;
```

### Resolution Steps

#### Step 1: Verify Physical Gateway

Contact customer to verify:
- Gateway is powered on
- Network cable connected (if ethernet)
- LED status indicates online

#### Step 2: Check TTN Console

1. Go to TTN Console → Gateways
2. Find gateway by EUI
3. Check connection status
4. Review "Last seen" timestamp

#### Step 3: Network Troubleshooting

1. Verify internet connectivity at location
2. Check firewall rules (ports 1700 UDP, 8883 TCP)
3. Try power cycling gateway

#### Step 4: Re-register if Needed

If gateway won't reconnect:
1. Delete from TTN Console
2. Re-provision via FreshTrack Pro
3. Factory reset physical gateway

---

## RB-005: Alert Processing Failure

### Symptoms
- Temperature out of range but no alert
- `process-unit-states` not updating unit status
- Alerts not being created

### Severity
P1 - Critical (safety-critical functionality)

### Diagnosis

```bash
# Check function logs
supabase functions logs process-unit-states --limit 50

# Look for errors or processing messages
```

### Resolution Steps

#### Step 1: Verify Function is Running

```bash
# Invoke manually (if scheduled via cron)
curl -X POST \
  https://your-project.supabase.co/functions/v1/process-unit-states \
  -H "Authorization: Bearer SERVICE_ROLE_KEY"
```

#### Step 2: Check Alert Rules

```sql
-- Verify alert rules exist
SELECT *
FROM alert_rules
WHERE unit_id = 'unit-uuid'
OR site_id = (SELECT site_id FROM units WHERE id = 'unit-uuid')
OR organization_id = (SELECT organization_id FROM units WHERE id = 'unit-uuid');
```

#### Step 3: Check Unit Status

```sql
-- Current unit state
SELECT
  id,
  name,
  status,
  last_temp_reading,
  last_reading_at,
  temp_min,
  temp_max
FROM units
WHERE id = 'unit-uuid';
```

#### Step 4: Force Processing

```sql
-- Mark unit for reprocessing (triggers next cycle)
UPDATE units
SET status = 'pending_evaluation'
WHERE id = 'unit-uuid';
```

### Escalation
- Immediate to Engineering Lead
- This is safety-critical functionality

---

## RB-006: Notification Delivery Failure

### Symptoms
- Alerts triggered but no notifications sent
- Customer reports not receiving emails/SMS
- Notification status shows "failed"

### Severity
P2 - High

### Diagnosis

```bash
# Check escalation function logs
supabase functions logs process-escalations --limit 50
```

```sql
-- Check notification records
SELECT *
FROM notification_logs
WHERE alert_id = 'alert-uuid'
ORDER BY created_at DESC;
```

### Resolution Steps

#### Step 1: Verify Notification Policy

```sql
-- Check policy exists and is configured
SELECT *
FROM notification_policies
WHERE organization_id = 'org-uuid';
```

#### Step 2: Verify Contact Information

```sql
-- Check escalation contacts
SELECT *
FROM escalation_contacts
WHERE organization_id = 'org-uuid'
AND escalation_level = 1;
```

#### Step 3: Check Email Service (Resend)

1. Login to Resend dashboard
2. Check for failed deliveries
3. Verify API key is valid
4. Check for sending limits

#### Step 4: Check SMS Service (Twilio)

1. Login to Twilio console
2. Check message logs
3. Verify account balance
4. Check for carrier blocks

### Manual Notification (If Urgent)

```bash
# Send manual email via Resend API
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "alerts@freshtrackpro.com",
    "to": "customer@example.com",
    "subject": "Urgent: Temperature Alert",
    "text": "Unit X has exceeded temperature threshold..."
  }'
```

---

## RB-007: Database Latency High

### Symptoms
- Health check shows degraded database
- Slow page loads
- Query timeouts

### Severity
P3 - Medium

### Diagnosis

```sql
-- Check active queries
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';
```

### Resolution Steps

#### Step 1: Identify Slow Queries

1. Go to Supabase Dashboard → Database → Query Performance
2. Sort by execution time
3. Identify patterns (missing indexes, full table scans)

#### Step 2: Check Connection Pool

1. Go to Database Settings → Connection Pool
2. Check active connections vs limit
3. Consider increasing pool size temporarily

#### Step 3: Kill Long-Running Queries (If Needed)

```sql
-- Kill specific query (use with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = <pid-from-above>;
```

#### Step 4: Optimize

- Add missing indexes
- Optimize problematic queries
- Consider query caching

---

## RB-008: Stripe Webhook Failure

### Symptoms
- Payments not reflected in app
- Subscription changes not syncing
- Stripe Dashboard shows webhook failures

### Severity
P2 - High

### Diagnosis

```bash
# Check webhook logs
supabase functions logs stripe-webhook --limit 50
```

### Resolution Steps

#### Step 1: Check Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Verify endpoint URL
3. Check for failed events
4. Verify webhook signing secret

#### Step 2: Replay Failed Events

1. In Stripe Dashboard, find failed webhook
2. Click "Resend" to replay event
3. Monitor logs for processing

#### Step 3: Verify Webhook Secret

```bash
# Test with correct secret
curl -X POST \
  https://your-project.supabase.co/functions/v1/stripe-webhook \
  -H "stripe-signature: test" \
  -d '{...}'
```

#### Step 4: Manual Sync

```sql
-- Update subscription manually if needed
UPDATE organizations
SET
  plan_tier = 'pro',
  sensor_limit = 25,
  subscription_status = 'active'
WHERE stripe_customer_id = 'cus_xxx';
```

---

## RB-009: Simulator Not Running

### Symptoms
- Test sensors not generating data
- Simulator status shows inactive
- No synthetic readings

### Severity
P4 - Low (development/testing only)

### Resolution Steps

#### Step 1: Check Simulator Status

```sql
-- Find active simulations
SELECT *
FROM sensor_simulations
WHERE status = 'streaming'
AND organization_id = 'org-uuid';
```

#### Step 2: Verify Scheduler

Check if `run-simulator-heartbeats` is scheduled:
1. Check pg_cron configuration
2. Or verify external scheduler (if used)

#### Step 3: Manual Trigger

```bash
# Trigger heartbeat manually
curl -X POST \
  https://your-project.supabase.co/functions/v1/run-simulator-heartbeats \
  -H "Authorization: Bearer INTERNAL_API_KEY"
```

#### Step 4: Restart Simulation

```sql
-- Reset and restart simulation
UPDATE sensor_simulations
SET
  status = 'streaming',
  next_reading_at = NOW()
WHERE id = 'simulation-uuid';
```

---

## RB-010: User Cannot Login

### Symptoms
- User reports login failure
- "Invalid credentials" error
- Account locked

### Severity
P3 - Medium

### Resolution Steps

#### Step 1: Verify User Exists

```sql
-- Check auth.users table
SELECT
  id,
  email,
  email_confirmed_at,
  banned_until,
  last_sign_in_at
FROM auth.users
WHERE email = 'user@example.com';
```

#### Step 2: Check for Ban

If `banned_until` is set:
```sql
-- Remove ban
UPDATE auth.users
SET banned_until = NULL
WHERE email = 'user@example.com';
```

#### Step 3: Reset Password

1. User should use "Forgot Password"
2. Or admin can trigger reset via Supabase Dashboard
3. Or via API:
   ```bash
   curl -X POST \
     https://your-project.supabase.co/auth/v1/recover \
     -H "apikey: ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com"}'
   ```

#### Step 4: Check Profile

```sql
-- Verify profile exists
SELECT * FROM profiles
WHERE id = 'user-uuid';

-- Verify organization assignment
SELECT * FROM user_roles
WHERE user_id = 'user-uuid';
```

---

## RB-011: TTN Provisioning Failure

### Symptoms
- Device/gateway provisioning fails
- Error in provisioning UI
- Device not appearing in TTN Console

### Severity
P3 - Medium

### Diagnosis

```bash
# Check provisioning logs
supabase functions logs ttn-provision-device --limit 30
supabase functions logs ttn-provision-gateway --limit 30
```

### Resolution Steps

#### Step 1: Verify TTN Configuration

```sql
-- Check org TTN config
SELECT
  organization_id,
  is_enabled,
  ttn_region,
  ttn_application_id,
  provisioning_status
FROM ttn_connections
WHERE organization_id = 'org-uuid';
```

#### Step 2: Validate API Key

Run preflight check:
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/ttn-gateway-preflight \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "org-uuid"}'
```

#### Step 3: Check TTN Quotas

1. Go to TTN Console
2. Check application device limits
3. Check gateway limits

#### Step 4: Manual Registration

If automated fails:
1. Register device manually in TTN Console
2. Update local database to match
3. Investigate automation failure

---

## RB-012: Data Ingestion Backlog

### Symptoms
- Readings delayed
- Processing queue growing
- Dashboard showing stale data

### Severity
P2 - High

### Diagnosis

```sql
-- Check recent reading counts
SELECT
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as reading_count
FROM sensor_readings
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1
ORDER BY 1 DESC;
```

### Resolution Steps

#### Step 1: Check Function Performance

```bash
# Look for slow processing
supabase functions logs ingest-readings --limit 50

# Check for timeouts
supabase functions logs process-unit-states --limit 50
```

#### Step 2: Scale if Possible

Contact Supabase support for:
- Increased function concurrency
- Database performance tier

#### Step 3: Prioritize Critical Processing

```sql
-- Focus on units with active alerts
UPDATE units
SET processing_priority = 'high'
WHERE status = 'alarm_active';
```

#### Step 4: Clear Backlog

May need to:
- Temporarily skip non-critical processing
- Increase batch sizes
- Add processing capacity

---

## Emergency Contacts

| Role | Contact | When to Use |
|------|---------|-------------|
| On-Call Engineer | See PagerDuty/Opsgenie | P1-P2 incidents |
| Engineering Lead | See team directory | Escalation |
| Supabase Support | support@supabase.io | Platform issues |
| TTN Support | support@thethings.network | TTN issues |
| Stripe Support | Stripe Dashboard | Payment issues |

---

## Related Documents

- [METRICS_OVERVIEW.md](#metrics_overview) — Metric definitions and thresholds
- [DASHBOARDS.md](#dashboards) — Dashboard configuration
- [ALERTING.md](#alerting) — Alert conditions and escalation
- [LOGGING.md](#logging) — Log sources and debugging


---

\newpage

<a id="diagrams-system_context"></a>

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
        TWILIO[Twilio<br/>SMS Delivery]
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

    FT -->|"SMS alerts"| TWILIO
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
| Twilio | SMS alert delivery | Outbound API |
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
    F -->|SMS Alerts| TW[Twilio]
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

- [CONTAINER_DIAGRAM.md](#container_diagram) - Internal container architecture
- [ARCHITECTURE.md](#architecture-architecture) - Detailed architecture documentation


---

\newpage

<a id="diagrams-container_diagram"></a>

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
        TWILIO[Twilio]
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
    SMS --> TWILIO

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
| Edge → Twilio | HTTPS | API Credentials |
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

- [SYSTEM_CONTEXT.md](#system_context) - External context
- [FLOWCHARTS.md](#charts-flowcharts) - Process flows
- [ARCHITECTURE.md](#architecture-architecture) - Full documentation


---

\newpage

<a id="diagrams-page_diagrams"></a>

# Page Diagrams

> Component and data flow diagrams for each application page

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [Unit Detail](#unit-detail)
3. [Alerts](#alerts)
4. [Settings](#settings)
5. [Manual Log](#manual-log)
6. [Reports](#reports)
7. [Auth Page](#auth-page)
8. [Site Detail](#site-detail)
9. [Area Detail](#area-detail)
10. [Health Dashboard](#health-dashboard)
11. [Onboarding](#onboarding)

---

## Dashboard

**Route**: `/dashboard`
**File**: `src/pages/Dashboard.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Dashboard Page"
        DL[DashboardLayout]

        subgraph "Header"
            NB[NavBar]
            ND[NotificationDropdown]
            TT[ThemeToggle]
        end

        subgraph "Sidebar"
            NL[NavLinks]
            BC[BrandedLogo]
        end

        subgraph "Main Content"
            BW[LowBatteryWidget]
            SL[Site List]

            subgraph "Site Section"
                SC[Site Card]
                AL[Area List]

                subgraph "Area Section"
                    AC[Area Card]
                    UG[Unit Grid]
                    UC[Unit Card]
                end
            end
        end
    end

    DL --> NB
    DL --> ND
    DL --> TT
    DL --> NL
    DL --> BC
    DL --> BW
    DL --> SL
    SL --> SC
    SC --> AL
    AL --> AC
    AC --> UG
    UG --> UC
```

### Data Flow

```mermaid
flowchart TB
    subgraph "Data Sources"
        ORG[organizations]
        SITES[sites]
        AREAS[areas]
        UNITS[units]
        ALERTS[alerts]
        SENSORS[lora_sensors]
    end

    subgraph "Hooks"
        UO[useOrganization]
        US[useSites]
        UA[useAreas]
        UU[useUnits]
        UAL[useAlerts]
        UUS[useUnitStatus]
    end

    subgraph "Components"
        DASH[Dashboard]
        UCARD[UnitCard]
    end

    ORG --> UO --> DASH
    SITES --> US --> DASH
    AREAS --> UA --> DASH
    UNITS --> UU --> DASH
    ALERTS --> UAL --> UCARD
    SENSORS --> UUS --> UCARD
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Ready: Data loaded
    Loading --> NoOrg: No organization
    Loading --> Error: Load failed

    NoOrg --> [*]: Redirect to /onboarding

    Ready --> Ready: Poll refresh
    Ready --> Navigating: Click unit

    Navigating --> [*]: Go to unit detail

    Error --> Loading: Retry
```

---

## Unit Detail

**Route**: `/units/:unitId`
**File**: `src/pages/UnitDetail.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Unit Detail Page"
        UD[UnitDetail]

        subgraph "Header Section"
            HB[HierarchyBreadcrumb]
            SB[StatusBadge]
            LTB[LogTempButton]
        end

        subgraph "Alert Section"
            UAB[UnitAlertsBanner]
        end

        subgraph "Status Cards"
            LKG[LastKnownGoodCard]
            BH[BatteryHealthCard]
            DR[DeviceReadinessCard]
        end

        subgraph "Sensors Section"
            USC[UnitSensorsCard]
            SDP[SensorDetailsPopover]
            ASD[AssignSensorToUnitDialog]
        end

        subgraph "Settings Section"
            UATS[UnitAlertThresholdsSection]
            USS[UnitSettingsSection]
        end

        subgraph "Charts"
            TC[TemperatureChart]
        end
    end

    UD --> HB
    UD --> SB
    UD --> LTB
    UD --> UAB
    UD --> LKG
    UD --> BH
    UD --> DR
    UD --> USC
    USC --> SDP
    USC --> ASD
    UD --> UATS
    UD --> USS
    UD --> TC
```

### Data Flow

```mermaid
flowchart TB
    subgraph "API Calls"
        U[units/:id]
        S[lora_sensors]
        R[sensor_readings]
        A[alerts]
        AR[get_effective_alert_rules]
    end

    subgraph "State"
        UNIT[Unit Data]
        SENS[Sensors]
        READ[Readings]
        ALR[Alerts]
        RULES[Alert Rules]
    end

    subgraph "Computed"
        STATUS[Unit Status]
        CHART[Chart Data]
    end

    U --> UNIT
    S --> SENS
    R --> READ
    A --> ALR
    AR --> RULES

    UNIT --> STATUS
    READ --> STATUS
    ALR --> STATUS
    RULES --> STATUS

    READ --> CHART
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Ready: Unit loaded
    Loading --> NotFound: 404

    Ready --> AlertVisible: Has active alerts
    AlertVisible --> Ready: All resolved

    Ready --> Editing: Open settings
    Editing --> Saving: Submit
    Saving --> Ready: Success
    Saving --> Editing: Error

    Ready --> LoggingTemp: Open modal
    LoggingTemp --> Ready: Submit/Cancel
```

---

## Alerts

**Route**: `/alerts`
**File**: `src/pages/Alerts.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Alerts Page"
        AP[Alerts]

        subgraph "Filters"
            SF[StatusFilter]
            SEV[SeverityFilter]
            TF[TypeFilter]
            DR[DateRange]
        end

        subgraph "Alert List"
            AT[AlertTable]
            AR[AlertRow]
        end

        subgraph "Actions"
            ACK[AcknowledgeButton]
            RES[ResolveButton]
            VU[ViewUnitLink]
        end
    end

    AP --> SF
    AP --> SEV
    AP --> TF
    AP --> DR
    AP --> AT
    AT --> AR
    AR --> ACK
    AR --> RES
    AR --> VU
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Empty: No alerts
    Loading --> Ready: Alerts loaded

    Ready --> Filtering: Apply filter
    Filtering --> Ready: Results

    Ready --> Acknowledging: Click acknowledge
    Acknowledging --> Ready: Success

    Ready --> Resolving: Click resolve
    Resolving --> Ready: Success
```

---

## Settings

**Route**: `/settings`
**File**: `src/pages/Settings.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Settings Page"
        SP[Settings]

        subgraph "Tabs"
            GT[General Tab]
            ART[Alert Rules Tab]
            NPT[Notification Policies Tab]
            ST[Sensors Tab]
            GWT[Gateways Tab]
            TTNT[TTN Tab]
            BT[Billing Tab]
            AT[Account Tab]
        end

        subgraph "Alert Rules Components"
            ARE[AlertRulesEditor]
            ARSE[AlertRulesScopedEditor]
            ARH[AlertRulesHistoryModal]
        end

        subgraph "Sensor Components"
            SM[SensorManager]
            ASD[AddSensorDialog]
            ESD[EditSensorDialog]
        end

        subgraph "Gateway Components"
            GM[GatewayManager]
            AGD[AddGatewayDialog]
            EGD[EditGatewayDialog]
        end

        subgraph "TTN Components"
            TTNCS[TTNConnectionSettings]
            TTNCP[TTNCredentialsPanel]
            TTNPL[TTNProvisioningLogs]
        end

        subgraph "Billing Components"
            BTB[BillingTab]
            PC[PlanCard]
            IH[InvoiceHistory]
        end
    end

    SP --> GT
    SP --> ART --> ARE
    ART --> ARSE
    ART --> ARH
    SP --> NPT
    SP --> ST --> SM
    SM --> ASD
    SM --> ESD
    SP --> GWT --> GM
    GM --> AGD
    GM --> EGD
    SP --> TTNT --> TTNCS
    TTNCS --> TTNCP
    TTNCS --> TTNPL
    SP --> BT --> BTB
    BTB --> PC
    BTB --> IH
    SP --> AT
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Ready: Settings loaded

    Ready --> Editing: Modify setting
    Editing --> Saving: Submit
    Saving --> Ready: Success
    Saving --> Editing: Error

    Ready --> TabSwitch: Change tab
    TabSwitch --> Ready: Tab loaded
```

---

## Manual Log

**Route**: `/manual-log`
**File**: `src/pages/ManualLog.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Manual Log Page"
        ML[ManualLog]

        subgraph "Unit Selector"
            SS[SiteSelect]
            AS[AreaSelect]
            US[UnitSelect]
        end

        subgraph "Log Form"
            TI[TemperatureInput]
            NI[NotesInput]
            SB[SubmitButton]
        end

        subgraph "Status"
            OI[OfflineIndicator]
            QC[QueueCount]
        end
    end

    ML --> SS
    SS --> AS
    AS --> US
    ML --> TI
    ML --> NI
    ML --> SB
    ML --> OI
    ML --> QC
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> SelectUnit
    SelectUnit --> EnterTemp: Unit selected

    EnterTemp --> Validating: Submit
    Validating --> Submitting: Valid
    Validating --> EnterTemp: Invalid

    Submitting --> Success: Online + Success
    Submitting --> Queued: Offline
    Submitting --> EnterTemp: Error

    Success --> SelectUnit: Clear form
    Queued --> SelectUnit: Clear form

    state Offline {
        Queued --> Syncing: Online
        Syncing --> Synced: Success
    }
```

---

## Reports

**Route**: `/reports`
**File**: `src/pages/Reports.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Reports Page"
        RP[Reports]

        subgraph "Report Selection"
            RT[ReportType]
            DR[DateRange]
            UF[UnitFilter]
        end

        subgraph "Report Display"
            CRC[ComplianceReportCard]
            RP2[ReportPreview]
        end

        subgraph "Export"
            EP[ExportPDF]
            EC[ExportCSV]
        end
    end

    RP --> RT
    RP --> DR
    RP --> UF
    RP --> CRC
    RP --> RP2
    RP --> EP
    RP --> EC
```

---

## Auth Page

**Route**: `/auth`
**File**: `src/pages/Auth.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Auth Page"
        AP[Auth]

        subgraph "Tabs"
            SI[SignIn Form]
            SU[SignUp Form]
        end

        subgraph "Form Fields"
            EI[EmailInput]
            PI[PasswordInput]
            PR[PasswordRequirements]
        end

        subgraph "Actions"
            SB[SubmitButton]
            FR[ForgotPassword]
        end
    end

    AP --> SI
    AP --> SU
    SI --> EI
    SI --> PI
    SU --> EI
    SU --> PI
    SU --> PR
    SI --> SB
    SU --> SB
    SI --> FR
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle

    Idle --> Submitting: Submit
    Submitting --> Success: Valid credentials
    Submitting --> Error: Invalid

    Success --> [*]: Redirect
    Error --> Idle: Clear error
```

---

## Site Detail

**Route**: `/sites/:siteId`
**File**: `src/pages/SiteDetail.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Site Detail Page"
        SD[SiteDetail]

        subgraph "Header"
            HB[HierarchyBreadcrumb]
            SN[SiteName]
            SA[SiteAddress]
        end

        subgraph "Content"
            AL[AreaList]
            AC[AreaCard]
            UL[UnitList]
        end

        subgraph "Settings"
            SCS[SiteComplianceSettings]
            SGC[SiteGatewaysCard]
        end
    end

    SD --> HB
    SD --> SN
    SD --> SA
    SD --> AL
    AL --> AC
    AC --> UL
    SD --> SCS
    SD --> SGC
```

---

## Area Detail

**Route**: `/sites/:siteId/areas/:areaId`
**File**: `src/pages/AreaDetail.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Area Detail Page"
        AD[AreaDetail]

        subgraph "Header"
            HB[HierarchyBreadcrumb]
            AN[AreaName]
        end

        subgraph "Units"
            UG[UnitGrid]
            UC[UnitCard]
            AU[AddUnitButton]
        end
    end

    AD --> HB
    AD --> AN
    AD --> UG
    UG --> UC
    AD --> AU
```

---

## Health Dashboard

**Route**: `/admin/health`
**File**: `src/pages/HealthDashboard.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Health Dashboard"
        HD[HealthDashboard]

        subgraph "Summary"
            OHS[OverallHealthSummary]
        end

        subgraph "Checks"
            HCL[HealthCheckList]
            HSC[HealthStatusCard]
            HSB[HealthStatusBadge]
        end
    end

    HD --> OHS
    HD --> HCL
    HCL --> HSC
    HSC --> HSB
```

---

## Onboarding

**Route**: `/onboarding`
**File**: `src/pages/Onboarding.tsx`

### Component Diagram

```mermaid
graph TB
    subgraph "Onboarding Page"
        OB[Onboarding]

        subgraph "Steps"
            S1[Step 1: Organization]
            S2[Step 2: Site]
            S3[Step 3: Area]
            S4[Step 4: Unit]
            S5[Step 5: Sensor]
        end

        subgraph "Progress"
            PI[ProgressIndicator]
        end
    end

    OB --> PI
    OB --> S1
    S1 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> S5
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Step1_Org
    Step1_Org --> Step2_Site: Submit
    Step2_Site --> Step3_Area: Submit
    Step3_Area --> Step4_Unit: Submit
    Step4_Unit --> Step5_Sensor: Submit
    Step5_Sensor --> Complete: Skip/Submit
    Complete --> [*]: Redirect to dashboard
```

---

## Related Documentation

- [PAGES.md](#product-pages) - Full page documentation
- [USER_FLOWS.md](#product-user_flows) - User flow documentation
- [STATE_MACHINES.md](#state_machines) - State machine details


---

\newpage

<a id="diagrams-sequences"></a>

# Sequence Diagrams

> Sequence diagrams for major user flows and system processes

---

## Table of Contents

1. [User Registration](#user-registration)
2. [User Sign In](#user-sign-in)
3. [Temperature Reading Flow](#temperature-reading-flow)
4. [Manual Logging Flow](#manual-logging-flow)
5. [Alert Acknowledgment](#alert-acknowledgment)
6. [Excursion Detection](#excursion-detection)
7. [Alert Escalation](#alert-escalation)
8. [TTN Setup Flow](#ttn-setup-flow)
9. [Sensor Provisioning](#sensor-provisioning)
10. [Dashboard Monitoring](#dashboard-monitoring)

---

## User Registration

```mermaid
sequenceDiagram
    participant U as User
    participant A as Auth Page
    participant PB as check-password-breach
    participant SA as Supabase Auth
    participant DB as Database
    participant OB as Onboarding

    U->>A: Enter email, password
    A->>A: Validate format (Zod)
    A->>PB: Check password breach
    PB-->>A: Not breached

    A->>SA: signUp(email, password)
    SA->>SA: Create auth.users record
    SA->>DB: Trigger: create profile
    DB-->>SA: Profile created
    SA-->>A: User + session

    A->>OB: Redirect to /onboarding
    U->>OB: Enter org details
    OB->>DB: create_organization_with_owner()
    DB-->>OB: Org created

    U->>OB: Create site, area, unit
    OB->>DB: create_site_for_org()
    OB->>DB: create_area_for_site()
    OB->>DB: create_unit_for_area()

    OB-->>U: Redirect to /dashboard
```

---

## User Sign In

```mermaid
sequenceDiagram
    participant U as User
    participant A as Auth Page
    participant SA as Supabase Auth
    participant DB as Database
    participant D as Dashboard

    U->>A: Enter email, password
    A->>A: Validate format

    A->>SA: signInWithPassword(email, password)
    SA->>SA: Validate credentials
    SA-->>A: JWT + refresh token

    A->>DB: Fetch user profile
    DB-->>A: Profile data

    A->>DB: Fetch user_roles
    DB-->>A: Organization membership

    A->>D: Redirect to /dashboard
    D->>DB: Load dashboard data
    DB-->>D: Units, alerts, etc.
    D-->>U: Display dashboard
```

---

## Temperature Reading Flow

```mermaid
sequenceDiagram
    participant S as Sensor
    participant G as Gateway
    participant T as TTN
    participant W as ttn-webhook
    participant DB as Database
    participant P as process-unit-states
    participant E as process-escalations

    S->>G: LoRa transmission (temp: 38.5°F)
    G->>T: Forward uplink
    T->>T: Decode payload

    T->>W: POST webhook (X-Webhook-Secret)
    W->>W: Validate secret
    W->>DB: Lookup org by secret
    DB-->>W: Organization ID

    W->>DB: Lookup sensor by DevEUI
    DB-->>W: Sensor record

    W->>DB: INSERT sensor_readings
    W->>DB: UPDATE units (last_temp_reading)
    W->>DB: UPDATE lora_sensors (last_seen_at)

    W->>P: POST /process-unit-states
    P->>DB: SELECT units with readings
    P->>DB: SELECT get_effective_alert_rules()

    P->>P: Evaluate thresholds

    alt Temperature in range
        P->>DB: UPDATE units.status = 'ok'
    else Temperature out of range
        P->>DB: UPDATE units.status = 'excursion'
        P->>DB: INSERT alerts
        P->>E: POST /process-escalations
        E->>DB: SELECT notification_policies
        E->>DB: INSERT notification_events
    end

    P-->>W: Processing complete
    W-->>T: 200 OK
```

---

## Manual Logging Flow

```mermaid
sequenceDiagram
    participant U as User
    participant ML as ManualLog Page
    participant IDB as IndexedDB
    participant DB as Database

    U->>ML: Select unit
    U->>ML: Enter temperature
    U->>ML: Click "Log"

    ML->>ML: Validate temperature range

    alt Online
        ML->>DB: INSERT manual_temperature_logs
        DB-->>ML: Success
        ML->>DB: UPDATE units.last_manual_log_at
        ML-->>U: Success toast
    else Offline
        ML->>IDB: Store in offline queue
        IDB-->>ML: Queued
        ML-->>U: "Saved offline" toast
    end

    Note over ML,IDB: When connection restored

    ML->>IDB: Get queued logs
    IDB-->>ML: Pending logs

    loop For each queued log
        ML->>DB: INSERT manual_temperature_logs
        DB-->>ML: Success
        ML->>IDB: Remove from queue
    end

    ML-->>U: "Synced" toast
```

---

## Alert Acknowledgment

```mermaid
sequenceDiagram
    participant U as User
    participant A as Alerts Page
    participant DB as Database
    participant EL as event_logs

    U->>A: View alert list
    A->>DB: SELECT alerts WHERE status = 'triggered'
    DB-->>A: Active alerts

    U->>A: Click "Acknowledge"
    A->>A: Open notes dialog
    U->>A: Enter notes
    U->>A: Confirm

    A->>DB: UPDATE alerts SET acknowledged_at, acknowledged_by
    DB-->>A: Updated

    A->>EL: INSERT event_log (alert_acknowledged)
    EL-->>A: Logged

    A-->>U: Success toast
    A->>A: Refresh alert list
```

---

## Excursion Detection

```mermaid
sequenceDiagram
    participant S as Sensor
    participant P as process-unit-states
    participant DB as Database
    participant E as process-escalations
    participant N as Notifications

    Note over S,P: Temperature exceeds threshold

    S->>P: Reading: 48°F (limit: 40°F)
    P->>DB: Get unit current status
    DB-->>P: status = 'ok'

    P->>P: Temp > high_limit?
    P->>P: Yes, check door state

    alt Door open within grace
        P->>P: Skip excursion (grace period)
    else Door closed or grace exceeded
        P->>DB: UPDATE units.status = 'excursion'
        P->>DB: UPDATE units.last_status_change = NOW()
        P->>DB: INSERT alerts (temp_excursion, severity: critical)
        P->>DB: INSERT event_logs

        P->>E: Trigger escalations
        E->>DB: Get notification policy
        E->>N: Send email/SMS/push
        N-->>E: Delivery status
        E->>DB: INSERT notification_events
    end

    Note over P,DB: Confirm time passes (10-20 min)

    P->>DB: Check excursion duration
    DB-->>P: 15 minutes in excursion

    P->>DB: UPDATE units.status = 'alarm_active'
    P->>DB: UPDATE alerts.severity = 'critical'
    P->>E: Trigger critical notifications
```

---

## Alert Escalation

```mermaid
sequenceDiagram
    participant T as Timer
    participant E as process-escalations
    participant DB as Database
    participant EC as escalation_contacts
    participant N as Notification Service

    Note over T,E: Alert created at T=0

    T->>E: Escalation check (T=15min)
    E->>DB: SELECT alerts WHERE not acknowledged
    DB-->>E: Alert still active

    E->>DB: Get notification_policy
    DB-->>E: Escalation intervals: [15, 30, 60]

    E->>DB: UPDATE alerts.escalation_level = 2
    E->>EC: SELECT contacts WHERE level = 2
    EC-->>E: Level 2 contacts

    loop For each contact
        E->>N: Send notification
        N-->>E: Delivery status
        E->>DB: INSERT notification_events
    end

    E->>DB: UPDATE alerts.next_escalation_at

    Note over T,E: Still not acknowledged at T=30min

    T->>E: Escalation check (T=30min)
    E->>DB: UPDATE alerts.escalation_level = 3
    E->>EC: SELECT contacts WHERE level = 3
    E->>N: Send to level 3 contacts
```

---

## TTN Setup Flow

```mermaid
sequenceDiagram
    participant U as User
    participant S as Settings Page
    participant V as ttn-gateway-preflight
    participant B as ttn-bootstrap
    participant DB as Database
    participant TTN as The Things Network

    U->>S: Navigate to TTN tab
    U->>S: Enter Application ID
    U->>S: Enter API Key

    S->>V: Validate API key
    V->>TTN: GET /applications (test permissions)

    alt Valid permissions
        TTN-->>V: 200 OK
        V-->>S: Valid, show permissions
    else Invalid
        TTN-->>V: 401/403
        V-->>S: Invalid key
        S-->>U: Show error
    end

    U->>S: Click "Connect"

    S->>DB: INSERT ttn_connections
    Note over S,DB: API key encrypted, secret hashed

    S->>B: Configure webhook
    B->>TTN: POST /webhooks
    TTN-->>B: Webhook created
    B->>DB: UPDATE ttn_connections.is_configured = true

    S-->>U: "Connected" status
```

---

## Sensor Provisioning

```mermaid
sequenceDiagram
    participant U as User
    participant S as SensorManager
    participant DB as Database
    participant Q as ttn_provisioning_queue
    participant W as ttn-provision-worker
    participant TTN as The Things Network

    U->>S: Click "Add Sensor"
    U->>S: Enter DevEUI, name, type
    S->>S: Normalize DevEUI

    S->>DB: INSERT lora_sensors (status: pending)
    DB-->>S: Sensor created

    S->>Q: INSERT provisioning job
    Q-->>S: Job queued

    Note over W,TTN: Background worker runs

    W->>Q: SELECT pending jobs
    Q-->>W: Sensor provisioning job

    W->>DB: Get ttn_connections for org
    DB-->>W: TTN credentials

    W->>TTN: POST /devices (register device)

    alt Success
        TTN-->>W: Device registered
        W->>DB: UPDATE lora_sensors.status = 'joining'
        W->>DB: UPDATE lora_sensors.ttn_device_id
        W->>Q: UPDATE job status = 'complete'
    else Failure
        TTN-->>W: Error
        W->>Q: UPDATE job (status: failed, error)
        W->>DB: INSERT ttn_provisioning_logs
    end

    Note over S,TTN: Sensor joins network

    TTN->>DB: First uplink via ttn-webhook
    DB->>DB: UPDATE lora_sensors.status = 'active'
```

---

## Dashboard Monitoring

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant Q as TanStack Query
    participant DB as Database

    U->>D: Navigate to /dashboard

    D->>Q: useOrganization()
    Q->>DB: SELECT organizations
    DB-->>Q: Org data
    Q-->>D: Cached org

    D->>Q: useSites(), useAreas(), useUnits()
    Q->>DB: SELECT sites, areas, units
    DB-->>Q: Hierarchy data
    Q-->>D: Cached data

    D->>D: Render unit cards
    D->>D: Apply status styling

    loop Every 30 seconds
        Q->>DB: Refetch stale queries
        DB-->>Q: Updated data
        Q-->>D: Re-render if changed
    end

    U->>D: Click unit card
    D->>D: Navigate to /units/:id
```

---

## Related Documentation

- [USER_FLOWS.md](#product-user_flows) - Detailed flow descriptions
- [PAGE_DIAGRAMS.md](#page_diagrams) - Page component diagrams
- [STATE_MACHINES.md](#state_machines) - State machine diagrams


---

\newpage

<a id="diagrams-state_machines"></a>

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

- [PAGE_DIAGRAMS.md](#page_diagrams) - Page component diagrams
- [SEQUENCES.md](#sequences) - Sequence diagrams
- [PAGES.md](#product-pages) - Page documentation
- [API.md](#engineering-api) - Alert processing details


---

\newpage

<a id="charts-er_diagram"></a>

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

- [DATA_MODEL.md](#engineering-data_model) - Complete schema documentation
- [ARCHITECTURE.md](#architecture-architecture) - Database architecture


---

\newpage

<a id="charts-flowcharts"></a>

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
    C -->|Yes| E[Call Twilio API]

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

- [API.md](#engineering-api) - Edge function details
- [SEQUENCES.md](#diagrams-sequences) - Sequence diagrams
- [STATE_MACHINES.md](#diagrams-state_machines) - State machines


---

\newpage

<a id="glossary"></a>

# FreshTrack Pro Glossary

> Terminology and definitions used throughout the documentation

**Last Updated:** 2026-01-12 02:24:44 UTC
**Total Terms:** 198

---

## Quick Navigation

- [Architecture](#architecture)
- [Product](#product)
- [IoT/Hardware](#iot-hardware)
- [Alert System](#alert-system)
- [Monitoring](#monitoring)
- [Security](#security)
- [Data](#data)
- [Integration](#integration)
- [Development](#development)
- [General](#general)

---

## Architecture

| Term | Definition |
|------|------------|
| **Anon Key** | Public API key with restricted access, safe for client-side use |
| **Edge Function** | Serverless function deployed on Supabase's edge network for low-latency API endpoints |
| **JWT** | JSON Web Token - compact, URL-safe token format used for authentication and authorization |
| **Multi-tenant** | Architecture where a single application instance serves multiple isolated organizations |
| **RLS** | Row Level Security - PostgreSQL feature that restricts data access at the row level based on user context |
| **Service Role Key** | Privileged API key that bypasses RLS policies, used only in server-side contexts |

## Product

| Term | Definition |
|------|------------|
| **Alert Rule** | Configuration defining temperature thresholds and timing for generating alerts |
| **Check-in Interval** | The configured frequency at which a sensor should report temperature readings |
| **Confirm Time** | Delay before a temperature excursion triggers an active alarm (prevents false positives) |
| **Excursion** | A temperature reading outside the configured safe range for a unit |
| **Site** | A physical location containing one or more units under an organization |
| **Unit** | A refrigeration unit (cooler, freezer, walk-in) being monitored for temperature compliance |

## IoT/Hardware

| Term | Definition |
|------|------------|
| **DevEUI** | Device Extended Unique Identifier - globally unique 64-bit identifier for LoRa devices |
| **Downlink** | Data transmission from network to sensor (configuration, commands) |
| **Gateway** | LoRaWAN gateway that receives sensor transmissions and forwards to TTN |
| **Join Request** | LoRaWAN procedure where a device authenticates and joins the network |
| **LoRa** | Long Range - low-power wireless protocol for IoT sensor communication |
| **TTN** | The Things Network - community and enterprise LoRaWAN network infrastructure |
| **Uplink** | Data transmission from sensor to network (readings, status) |

## Alert System

| Term | Definition |
|------|------------|
| **Escalation** | Process of notifying additional contacts when an alert is not acknowledged |
| **MTTR** | Mean Time To Resolution - average time from alert creation to resolution |
| **Notification Policy** | Configuration for how and when to send alert notifications |
| **Quiet Hours** | Time periods when non-critical notifications are suppressed |

## Monitoring

| Term | Definition |
|------|------------|
| **Debug Terminal** | Developer tool displaying real-time application logs and events |
| **Degraded** | System state where functionality is impaired but not completely failed |
| **Event Log** | Timestamped record of system and business events for auditing |
| **Health Check** | Automated system status verification across all components |

## Security

| Term | Definition |
|------|------------|
| **MFA** | Multi-Factor Authentication - requiring multiple verification methods for login |
| **Organization Context** | The tenant boundary that determines data access scope |
| **RBAC** | Role-Based Access Control - permission system based on user roles within organizations |
| **Session Token** | Time-limited authentication credential stored after user login |

## Data

| Term | Definition |
|------|------------|
| **Cascade** | Automatic propagation of database operations to related records |
| **Reading Buffer** | Temporary storage for sensor readings before database persistence |
| **Sensor Reading** | Individual temperature measurement with timestamp and metadata |
| **Soft Delete** | Marking records as deleted without physical removal (preserves audit trail) |

## Integration

| Term | Definition |
|------|------------|
| **API Endpoint** | URL path that accepts requests and returns responses |
| **Idempotency** | Property where repeated operations produce the same result |
| **Rate Limiting** | Restricting the number of requests within a time window |
| **Webhook** | HTTP callback triggered by external events (TTN data, Stripe payments) |

## Development

| Term | Definition |
|------|------------|
| **React Query** | Data fetching and caching library for React applications |
| **Supabase** | Backend-as-a-service platform providing PostgreSQL, Auth, and Edge Functions |
| **Vite** | Modern frontend build tool for development and production bundling |
| **Zustand** | Lightweight state management library for React |

## General

| Term | Definition |
|------|------------|
| **Actions** | \| Action \| Description \| Side Effects \| |
| **Actors** | - Primary: New User (Food Safety Manager) |
| **Add Sensors** | Register your LoRaWAN sensors in the TTN Console |
| **Alert Creation** | Only `process-unit-states` creates alerts in the database |
| **Alert Resolution** | Only `process-unit-states` resolves alerts automatically |
| **Alert Types Created** | - `temp_excursion` - Temperature out of range |
| **API Calls** | - `supabase |
| **API key rotation UI** | Manual process currently |
| **APIs and Data Touched** | - `supabase |
| **Application ID** | `freshtracker-{org-slug}` |
| **Application Name** | `FreshTracker - {Org Name}` |
| **Architecture** | - Per-organization TTN Application |
| **Audit Trail** | `event_logs` for significant changes |
| **Auth** | Verify login/logout works |
| **Authentication** | Unique webhook secret per organization |
| **Backend** | Zod validation in edge functions |
| **Cause** | API key is invalid or expired |
| **Causes** | - Secrets may take a few seconds to propagate |
| **Check** | API key is valid |
| **Compliance Documentation** | Immutable audit trails for health inspections |
| **Component** | `AlertRulesEditor |
| **Component Composition** | Use shadcn components as building blocks |
| **Components** | - `HealthCheckList |
| **Config Objects** | Centralized status/alert configuration in `lib/` |
| **Configuration** | Stored in `ttn_connections` table per organization |
| **Configure Devices** | Add device EUIs and keys |
| **Continuous Monitoring** | Automated temperature readings every 5 minutes (configurable) |
| **Copy the generated API key** | you won't be able to see it again! |
| **Credential Stuffing Attack** | Large volume of failed logins detected |
| **Data Dependencies** | - None (creates new session) |
| **Database** | Organization-specific settings (TTN credentials) |
| **Dedicated API Key** | Application-scoped with minimal required permissions |
| **Dedicated Webhook** | Points to FreshTrack with unique secret for authentication |
| **Diagram Reference** | [Landing Page Diagram]( |
| **Enable** | Settings → Debug toggle (or `localStorage |
| **Enable Debug Mode** | Press `Ctrl+Shift+D` or toggle in settings |
| **Enabled Messages** | - Uplink message |
| **Encrypted Storage** | All API keys and secrets are encrypted in the database |
| **Endpoint** | `https://<project> |
| **Engine** | PostgreSQL 14 |
| **Equipment Health** | Battery forecasting, calibration tracking, and connectivity monitoring |
| **Error States** | - Invalid credentials |
| **Event Logging** | All significant state changes logged via `logEvent()` or edge function logging |
| **Event logs** | All significant actions logged with actor, timestamp, IP |
| **Events** | Uplink messages, join accepts |
| **Events Handled** | - `checkout |
| **Excursion Detection** | Immediate alerts when temperatures exceed safe thresholds |
| **Export for Support** | Click "Support Snapshot" button |
| **Failure Modes** | \| Failure \| Cause \| Recovery \| |
| **Features** | - Route logging |
| **File** | `supabase/functions/user-sync/index |
| **Files** | `src/components/health/* |
| **Files Involved** | - `src/pages/Auth |
| **Filter Logs** | Use tabs: Events, CRUD, Network, Sync, TTN, Errors |
| **Filters** | - Event type (alert, temperature, configuration, user) |
| **Fix** | Ensure user is synced and `ttn |
| **Foreign Key Constraints** | Data relationships maintain org scope |
| **FreshTrack Pro subscription** | A few hundred dollars per month |
| **Frontend** | Zod schemas in `lib/validation |
| **Function** | `health-check` |
| **Goal** | New user creates account and sets up their organization |
| **HACCP Compliance** | Audit trails, corrective action tracking, and compliance reporting |
| **Hash chaining** | Events include `previous_hash` for tamper detection |
| **Hashing** | bcrypt with cost factor (Supabase managed) |
| **Headers** | \| Header \| Value \| |
| **Hierarchical Configuration** | Settings cascade: Organization → Site → Area → Unit |
| **Immutable design** | Append-only logging tables |
| **Implication** | Always consider failure modes |
| **Important** | `ready` must be `true`! |
| **Indexes** | - `organizations_slug_key` (unique) |
| **Key Features** | - RLS policies for multi-tenancy |
| **Layout** | - Hero section with value proposition |
| **Location configuration** | 15-30 minutes per site |
| **Manual Logging** | UI → Supabase direct → `manual_temperature_logs` table |
| **Manual Temperature Logging** | Offline-capable manual entry with automatic sync |
| **Masking pattern** | ```typescript |
| **MFA not implemented** | Planned for future release |
| **Migrations** | 100+ files in `supabase/migrations/` |
| **Minimal Permissions** | Application API keys only have rights needed for sensor management |
| **Monitor** | Check FreshTrack's sensor data to see incoming readings |
| **Name** | `FreshTrack Admin Key` |
| **Never log** | - Full phone numbers (mask: `+1555***4567`) |
| **Notes** | - Returns 202 for unknown devices to prevent TTN retries |
| **Notifications** | `process-unit-states` → `process-escalations` → email/SMS/push |
| **Offline Behavior** | - Logs stored in IndexedDB |
| **Outcome** | In less than an hour, FreshTrack Pro is monitoring all refrigeration units and the whole team has access |
| **Plans** | \| Plan \| Price \| Sensors \| Features \| |
| **Preconditions** | User is not authenticated |
| **Predictive Maintenance** | Battery forecasts and calibration reminders |
| **Provisioning** | Registered in both our DB and TTN |
| **Purpose** | LoRa sensor network connectivity |
| **Query Keys** | Structured for cache invalidation |
| **Query Parameters** | - `organization_id` (required) |
| **Quick Setup** | If your credentials are already configured, see [TTN_PRODUCTION_SETUP |
| **Ransomware Scenario** | Supabase account access compromised |
| **Rate limiting visibility** | Platform-level, not application-configurable |
| **Recovery** | - Retry button for failed queries |
| **Relationships** | - `organization_id` → `organizations |
| **Report Types** | \| Report \| Description \| |
| **Request Body** | None (processes all active units) |
| **Resolution** | - If webhook issue: Regenerate secret, update TTN |
| **Response** | CSV or JSON data |
| **Responsibilities** | - User interface rendering |
| **Result** | Faster inspections |
| **Retention** | Configurable per compliance requirements |
| **Returns** | Merged alert rules with cascade priority (Unit > Site > Org) |
| **Rights** | Select the following: |
| **RLS Policy Bypass** | Customer reports seeing another org's data |
| **ROI Example** | One prevented incident = 12–24 months of subscription cost avoided |
| **Route** | `/dashboard` |
| **Salt** | Unique per password (bcrypt built-in) |
| **Savings** | 5–10 hours per week in staff time across a typical multi-unit operation |
| **Secrets** | Managed via Supabase dashboard |
| **Sensor Data Ingestion** | TTN → `ttn-webhook` → `sensor_readings` table |
| **Sensor installation** | 5-10 minutes per unit (just stick to wall) |
| **Sequence Diagram** | [See SEQUENCES |
| **Severity** | `warning` or `critical` |
| **Shift Handoff** | Staff can acknowledge and hand off alerts with notes |
| **Solution** | Install the Supabase CLI: |
| **Source** | `src/lib/statusConfig |
| **Staff training** | 15-30 minutes |
| **State Processing** | `ingest-readings` → `process-unit-states` → creates/resolves alerts |
| **Status** | `triggered` → `acknowledged` → `resolved` |
| **Status Codes** | \| Code \| Meaning \| |
| **Status Computation** | Frontend uses `computeUnitStatus()` for consistency with backend logic |
| **Steps** | \| Step \| Actor \| Action \| System Response \| |
| **Stripe** | Check Settings → Billing tab loads plans |
| **Supabase Dashboard** | Go to Project Settings → API |
| **Symptoms** | All sensors in an organization show offline status |
| **System automatically** | - Validates API key permissions (`ttn-gateway-preflight`) |
| **Table** | `event_logs` |
| **TBD** | Configure Supabase cron jobs for: |
| **Tenant Isolation** | Each org's TTN traffic is isolated via unique webhook secrets |
| **Test Data Flow** | Send test uplinks to verify webhook delivery |
| **Timeline of events** | Detection time |
| **Timestamps** | `created_at`, `updated_at` on most tables |
| **Trace Operations** | Click correlation ID link to filter related |
| **Trigger** | Scheduled (cron) or manual |
| **TTN User ID** | `frostguard` |
| **Twilio** | Check SMS delivery in Settings → Notification History |
| **Types** | `temp_excursion`, `monitoring_interrupted`, `door_open`, `low_battery`, etc |
| **Unique** | `(user_id, organization_id)` |
| **Unique Constraints** | Scoped to organization (e |
| **URL** | `https://YOUR_PROJECT |
| **URL Parameters** | `siteId` (UUID) |
| **Usage** | Called by `process-escalations` for critical alerts |
| **Use appropriate levels** | `debug`: Verbose, development only |
| **UUID Primary Keys** | All tables use UUID `id` columns |
| **Value** | (paste your TTN admin API key from Step 1) |
| **Verify webhook** | - TTN Application → Webhooks → Should show `freshtrack-webhook` |
| **Webhook Secret Exposure** | TTN webhook secret found in public log |
| **Webhook secret rotation** | No automated rotation |
| **What happened** | Freezer door was propped open for cleaning |
| **Who responded** | Kitchen manager acknowledged within 8 minutes |
| **Write first critical path tests** | `process-unit-states` alert logic |

---

## Adding Terms

To add new terms to this glossary:

1. Edit `/docs/_meta/glossary-seed.yml`
2. Run `npm run docs:build`
3. Terms are automatically extracted from bold definitions in documentation

## Related Documents

- [INDEX.md](#index) — Complete documentation index
- [GETTING_STARTED.md](#onboarding-getting_started) — Onboarding guide


---

\newpage

<a id="ci_checklist"></a>

# Documentation CI Checklist

> Validation rules enforced by the documentation pipeline

---

## Overview

This document describes the automated checks run by `npm run docs:lint` and the CI workflow. All checks must pass before documentation changes can be merged.

---

## Automated Checks

### ✅ Structure Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **H1 Title Required** | Error | Every document must have exactly one H1 (`#`) title |
| **Heading Hierarchy** | Warning | Heading levels should not skip (e.g., H2 → H4) |
| **Description Block** | Warning | Documents should have a description blockquote after title |
| **Related Documents** | Warning | Documents should link to related content |

### ✅ Link Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **Broken Internal Links** | Error | All `[text](#path)` links must resolve to existing files |
| **Orphaned Documents** | Warning | All docs should be linked from INDEX.md |
| **Anchor Links** | Info | Links to specific sections are validated |

### ✅ Content Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **Placeholder Text** | Error | No `[TBD]`, `[TODO]`, or `[PLACEHOLDER]` in content |
| **TODO Markers** | Warning | `TODO`, `FIXME`, `XXX` should be resolved |
| **Empty Code Blocks** | Warning | Code blocks should contain content |
| **Minimum Length** | Warning | Documents should have meaningful content (>100 chars) |
| **Table Formatting** | Warning | Table rows should have consistent column counts |

### ✅ Diagram Validation

| Check | Severity | Description |
|-------|----------|-------------|
| **Mermaid Syntax** | Error | Mermaid diagrams must have valid syntax |
| **Diagram Type** | Error | Must start with valid diagram type (graph, flowchart, etc.) |

### ✅ Required Files

| File | Required | Purpose |
|------|----------|---------|
| `README.md` | Yes | Project overview |
| `INDEX.md` | Yes | Documentation navigation |
| `GLOSSARY.md` | Yes | Term definitions |
| `architecture/ARCHITECTURE.md` | Yes | System architecture |
| `engineering/API.md` | Yes | API documentation |
| `engineering/DATA_MODEL.md` | Yes | Data model documentation |

---

## CI Workflow

### Trigger Conditions

The documentation CI runs on:
- Push to `main` or `develop` branches (docs/** changes)
- Pull requests touching `docs/**` files
- Manual workflow dispatch

### Pipeline Steps

```yaml
1. Checkout repository
2. Setup Node.js
3. Install dependencies
4. Run docs:lint
5. Run docs:generate
6. Verify no uncommitted changes
7. Upload artifacts (if build step)
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | One or more errors found |

---

## Local Validation

### Before Committing

Run the full documentation pipeline locally:

```bash
# Full pipeline (generate + lint + build)
npm run docs:all

# Just validate
npm run docs:lint

# Just regenerate index/glossary
npm run docs:generate
```

### Pre-commit Hook (Recommended)

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check if docs changed
if git diff --cached --name-only | grep -q "^docs/"; then
  npm run docs:lint || exit 1
fi
```

---

## Fixing Common Issues

### Broken Link

```markdown
# Error: Broken link: ./missing.md

# Fix: Update the link to correct path
[Text](#correct-path)
```

### Missing Title

```markdown
# Error: Document missing H1 title

# Fix: Add title at top of document
# My Document Title

Content here...
```

### Heading Skip

```markdown
# Warning: Heading level jumps from H2 to H4

# Bad:
## Section
#### Subsection

# Good:
## Section
### Subsection
```

### Placeholder Text

```markdown
# Error: Contains placeholder text: [TBD]

# Fix: Replace with actual content
[TBD] → The actual implementation details...
```

### Invalid Mermaid

```markdown
# Error: Mermaid diagram: Missing diagram type

# Bad:
\`\`\`mermaid
A --> B
\`\`\`

# Good:
\`\`\`mermaid
graph LR
    A --> B
\`\`\`
```

---

## Severity Levels

| Level | CI Impact | Action Required |
|-------|-----------|-----------------|
| **Error** | Fails CI | Must fix before merge |
| **Warning** | Passes CI | Should fix, not blocking |
| **Info** | Passes CI | Optional improvement |

---

## Adding New Checks

To add new validation rules:

1. Edit `scripts/docs/lint-docs.js`
2. Add validation function
3. Call from `lintDocs()` function
4. Update this checklist

Example:

```javascript
async function validateNewRule(filePath, content) {
  const relativePath = path.relative(DOCS_ROOT, filePath);

  if (/* condition */) {
    errors.push({
      file: relativePath,
      type: 'new-rule',
      message: 'Description of the issue'
    });
  }
}
```

---

## Bypassing Checks

### Emergency Merge

If you must merge with failing checks (not recommended):

1. Add `[skip docs-ci]` to commit message
2. Create follow-up issue to fix documentation
3. Fix within 24 hours

### Suppressing Warnings

Some warnings can be suppressed per-file:

```markdown
<!-- docs-lint-disable missing-related -->
# Document Without Related Section

This document intentionally has no related documents section.
```

---

## Metrics

Track documentation health over time:

| Metric | Target | Current |
|--------|--------|---------|
| Broken links | 0 | - |
| Orphaned docs | 0 | - |
| TODO markers | 0 | - |
| Coverage | 100% | - |

Run `npm run docs:lint` to see current counts.

---

## Related Documents

- [INDEX.md](#index) — Documentation navigation
- [GLOSSARY.md](#glossary) — Term definitions
- [README.md](#readme) — Project overview


---

\newpage

