# FreshTrack Pro Glossary

> Terminology and definitions used throughout the documentation

**Last Updated:** (auto-generated)
**Total Terms:** 213

---

## Quick Navigation

- [Architecture](#architecture)
- [Product](#product)
- [IoT Hardware](#iot-hardware)
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

## IoT Hardware

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
| **Ed25519 Signature** | Cryptographic signature algorithm used by Telnyx to verify webhook authenticity |
| **Idempotency** | Property where repeated operations produce the same result |
| **Messaging Profile** | Telnyx configuration grouping phone numbers, webhooks, and message settings under a named profile |
| **Opt-In Asset** | Image or document proving customer consent for SMS communications |
| **Rate Limiting** | Restricting the number of requests within a time window |
| **Toll-Free Verification** | Regulatory process requiring business verification before sending SMS from toll-free numbers |
| **Webhook** | HTTP callback triggered by external events (TTN data, Stripe payments, Telnyx delivery status) |

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
| **Accept Uncertainty** | It's OK to note unknowns |
| **Accountability** | Document who made decisions and when |
| **Actions** | \| Action \| Description \| Side Effects \| |
| **Actors** | - Primary: New User (Food Safety Manager) |
| **Add Sensors** | Register your LoRaWAN sensors in the TTN Console |
| **Alert Creation** | Only `process-unit-states` creates alerts in the database |
| **Alert Resolution** | Only `process-unit-states` resolves alerts automatically |
| **Alert Types Created** | - `temp_excursion` - Temperature out of range |
| **Alternatives** | Options that were considered |
| **API Calls** | - `supabase |
| **API key rotation UI** | Manual process currently |
| **APIs and Data Touched** | - `supabase |
| **Application ID** | `freshtracker-{org-slug}` |
| **Application Name** | `FreshTracker - {Org Name}` |
| **Architecture** | - Per-organization TTN Application |
| **Audit Trail** | `event_logs` for significant changes |
| **Auth** | Verify login/logout works |
| **Authentication** | Per-organization webhook secret (`X-Webhook-Secret`) |
| **Backend** | Zod validation in edge functions |
| **Be Concise** | ADRs should be 1-2 pages maximum |
| **Cause** | API key is invalid or expired |
| **Causes** | - Secrets may take a few seconds to propagate |
| **Check** | API key is valid |
| **Communication** | Share architectural knowledge across the team |
| **Compliance Documentation** | Immutable audit trails for health inspections |
| **Component** | `AlertRulesEditor |
| **Component Composition** | Use shadcn components as building blocks |
| **Components** | - `HealthCheckList |
| **Config Objects** | Centralized status/alert configuration in `lib/` |
| **Configuration** | Stored in `ttn_connections` table per organization |
| **Configure Devices** | Add device EUIs and keys |
| **Consequences** | Positive and negative impacts |
| **Context** | Problem or situation driving the decision |
| **Continuous Monitoring** | Automated temperature readings every 5 minutes (configurable) |
| **Copy the generated API key** | you won't be able to see it again! |
| **Credential Stuffing Attack** | Large volume of failed logins detected |
| **Data Dependencies** | - None (creates new session) |
| **Database** | Organization-specific settings (TTN credentials) |
| **Decision** | What was decided |
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
| **File** | `src/pages/Index |
| **Files** | `src/components/health/* |
| **Files Involved** | - `src/pages/Auth |
| **Filter Logs** | Use tabs: Events, CRUD, Network, Sync, TTN, Errors |
| **Filters** | - Event type (alert, temperature, configuration, user) |
| **Fix** | Ensure user is synced and `ttn |
| **Focus on Why** | The rationale is more important than the what |
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
| **Historical Context** | Understand why past decisions were made |
| **Immutable design** | Append-only logging tables |
| **Implication** | Always consider failure modes |
| **Important** | `ready` must be `true`! |
| **Include Alternatives** | Show what else was considered |
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
| **Name** | User Sign Up and Onboarding |
| **Never log** | - Full phone numbers (mask: `+1555***4567`) |
| **Notes** | - Returns 202 for unknown devices to prevent TTN retries |
| **Notifications** | `process-unit-states` → `process-escalations` → email/SMS/push |
| **Offline Behavior** | - Logs stored in IndexedDB |
| **Onboarding** | Help new team members understand the codebase quickly |
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
| **Related** | Links to related ADRs, issues, or docs |
| **Relationships** | - `organization_id` → `organizations |
| **Report Types** | \| Report \| Description \| |
| **Request Body** | None (processes all active units) |
| **Resolution** | - If webhook issue: Regenerate secret, update TTN |
| **Response** | CSV or JSON data |
| **Responsibilities** | - User interface rendering |
| **Result** | Faster inspections |
| **Retention** | Configurable per compliance requirements |
| **Returns** | Merged alert rules with cascade priority (Unit > Site > Org) |
| **Reversibility** | Know when and why to revisit decisions |
| **Rights** | Select the following: |
| **RLS Policy Bypass** | Customer reports seeing another org's data |
| **ROI Example** | One prevented incident = 12–24 months of subscription cost avoided |
| **Route** | `/organization` |
| **Salt** | Unique per password (bcrypt built-in) |
| **Savings** | 5–10 hours per week in staff time across a typical multi-unit operation |
| **Secrets** | Managed via Supabase dashboard |
| **Sensor Data Ingestion** | TTN → `ttn-webhook` → `sensor_readings` table |
| **Sensor installation** | 5-10 minutes per unit (just stick to wall) |
| **Sequence Diagram** | [See SEQUENCES |
| **Severity** | `warning` or `critical` |
| **Shift Handoff** | Staff can acknowledge and hand off alerts with notes |
| **Solution** | Check `VITE_SUPABASE_URL` matches your running backend: |
| **Source** | `src/lib/statusConfig |
| **Staff training** | 15-30 minutes |
| **State Processing** | `ingest-readings` → `process-unit-states` → creates/resolves alerts |
| **Status** | Current lifecycle state |
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
| **Title** | Clear, descriptive name |
| **Trace Operations** | Click correlation ID link to filter related |
| **Trigger** | Scheduled (cron) or manual |
| **TTN User ID** | `frostguard` |
| **Telnyx** | Check SMS delivery in Settings → Notification History |
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

- [INDEX.md](./INDEX.md) — Complete documentation index
- [GETTING_STARTED.md](./onboarding/GETTING_STARTED.md) — Onboarding guide
