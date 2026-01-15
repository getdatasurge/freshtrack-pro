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
| Telnyx | SMS alert delivery |

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
   │     TTN     │       │   Stripe    │       │   Telnyx    │
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

See [INDEX.md](./INDEX.md) for a complete navigation guide to all documentation.

### Quick Links

- [Architecture Overview](./architecture/ARCHITECTURE.md)
- [API Reference](./engineering/API.md)
- [Data Model](./engineering/DATA_MODEL.md)
- [User Flows](./product/USER_FLOWS.md)
- [Page Documentation](./product/PAGES.md)
- [Integrations Guide](./engineering/INTEGRATIONS.md)
- [Glossary](./GLOSSARY.md)

---

## Contributing

1. Review the coding conventions in `KNOWLEDGE.md` at the repository root for guidelines
2. Follow the existing patterns for components, hooks, and edge functions
3. Ensure all significant state changes are logged to `event_logs`
4. Never duplicate alert creation logic - use `process-unit-states` as the single source of truth
5. Run tests before committing: `npm run test`

---

## License

Proprietary - All rights reserved.
