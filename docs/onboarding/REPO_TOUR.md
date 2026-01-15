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

- [LOCAL_DEV.md](./LOCAL_DEV.md) — Set up your development environment
- [COMMON_TASKS.md](./COMMON_TASKS.md) — How to do common development tasks
- [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) — Troubleshooting and debugging
