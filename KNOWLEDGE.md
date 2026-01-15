# FrostGuard Custom Knowledge Base

> This document provides project-specific guidelines, conventions, and context for Lovable AI to apply across all edits. It serves as the shared memory for the FrostGuard refrigeration monitoring platform.

---

## Project Overview

**Product Name:** FrostGuard
**Tagline:** Refrigeration Monitoring & Food Safety Compliance
**Core Purpose:** Real-time temperature monitoring for refrigeration units with automated alerts, HACCP compliance tracking, and multi-level escalation notifications.

**What This App Does:**
- Monitors refrigeration units via IoT sensors (LoRa/TTN-based)
- Detects temperature excursions, door events, and sensor faults
- Sends automated alerts via email, SMS, and push notifications
- Supports manual temperature logging with offline sync
- Provides compliance reporting and audit trails for food safety
- Manages multi-tenant organizations with hierarchical structure (Org → Site → Area → Unit)

**What This App Is NOT:**
- Not a consumer/home refrigerator app
- Not a general IoT platform
- Not a food inventory/ordering system

---

## Project Guidelines

### Core Principles

1. **Reliability Over Features**
   - This is safety-critical software. Temperature monitoring must be accurate and alerts must be reliable.
   - Prefer simple, tested solutions over clever optimizations.
   - Always handle error states gracefully—users depend on this system.

2. **Single Source of Truth (SSOT)**
   - `process-unit-states` edge function is the ONLY service that creates/resolves alerts.
   - `get_effective_alert_rules` RPC resolves alert rules with proper cascade logic.
   - `computeUnitStatus()` hook mirrors backend logic—keep them in sync.
   - Never duplicate alert creation logic in the frontend.

3. **Hierarchical Cascade Pattern**
   - Settings cascade: Organization → Site → Area → Unit
   - Alert rules at lower levels override higher levels (Unit overrides Site overrides Org)
   - Respect this hierarchy in all configuration features.

4. **Event-Driven Architecture**
   - Sensor data ingestion triggers state processing
   - State changes trigger escalations
   - All significant actions log to `event_logs` table for audit trail

5. **Offline-First for Manual Logging**
   - Users may be in cold storage with poor connectivity
   - Manual temperature logs must work offline and sync when connected
   - Use IndexedDB via `offlineStorage` module

### What to Prioritize

- **User safety and compliance** - Temperature violations can cause foodborne illness
- **Alert reliability** - False negatives are worse than false positives
- **Audit trails** - All changes must be logged for compliance
- **Mobile responsiveness** - Users check temperatures on mobile devices
- **Clear status indicators** - Users must understand unit status at a glance

### What to Avoid

- **Inline magic values** - Use config objects from `lib/alertConfig.ts`, `lib/statusConfig.ts`
- **Duplicate business logic** - Keep frontend computation in sync with backend
- **Breaking changes to alert processing** - Test thoroughly before modifying `process-unit-states`
- **Unvalidated user input** - Always use Zod schemas from `lib/validation.ts`
- **Disabling existing safety features** - Never skip validation or remove alert thresholds

### Decision Framework

When making implementation decisions:
1. Will this affect alert reliability? → Add tests, get review
2. Does this touch alert rules cascade? → Verify with `get_effective_alert_rules`
3. Is this user-facing text? → Use consistent terminology (see Terminology section)
4. Does this modify sensor data flow? → Update system-map.md documentation

---

## User Personas

### Primary: Food Safety Manager (Alex)

**Role:** Food Safety Coordinator at a restaurant chain or food processing facility
**Goals:**
- Ensure all refrigeration units maintain safe temperatures
- Respond quickly to temperature excursions
- Generate compliance reports for health inspections
- Manage multiple sites from a single dashboard

**Pain Points:**
- Manually checking temperatures is time-consuming and error-prone
- Late discovery of temperature violations leads to spoiled food
- Paper-based logging is tedious and hard to audit
- Different sites have different equipment and requirements

**Behaviors:**
- Checks dashboard first thing in morning and before leaving
- Wants push notifications for critical alerts immediately
- Needs to delegate acknowledgment to shift managers
- Reviews weekly/monthly reports for trends

**Technical Proficiency:** Moderate - comfortable with web apps, not technical

### Secondary: Operations Manager (Jordan)

**Role:** Manages facilities, equipment, and staff schedules
**Goals:**
- Minimize equipment downtime
- Predict maintenance needs before failures
- Optimize staff response to alerts
- Control costs while maintaining compliance

**Pain Points:**
- Unexpected equipment failures are expensive
- Hard to know which alerts need immediate vs. scheduled attention
- Managing escalation contacts across shifts is complex

**Behaviors:**
- Focuses on trends and patterns over individual readings
- Wants battery forecasts and calibration reminders
- Configures escalation policies by shift and severity
- Uses reports for budgeting and equipment planning

**Technical Proficiency:** Low to moderate

### Tertiary: Kitchen Staff (Sam)

**Role:** Line cook, prep worker, or shift lead
**Goals:**
- Log manual temperatures quickly between tasks
- Acknowledge alerts when on shift
- Understand which units need attention

**Pain Points:**
- Hands are often wet/dirty; needs quick mobile interactions
- Doesn't want to log in repeatedly
- Confused by complex interfaces

**Behaviors:**
- Uses mobile exclusively, often in a hurry
- Scans quickly for red/warning indicators
- Prefers large touch targets and simple flows

**Technical Proficiency:** Low

### Admin: IT/Technical Administrator (Morgan)

**Role:** Sets up sensors, manages integrations, troubleshoots
**Goals:**
- Provision and configure LoRa sensors
- Monitor sensor connectivity and battery health
- Debug issues when alerts aren't working
- Manage user access and permissions

**Behaviors:**
- Uses Inspector/debug tools
- Configures TTN connections and webhooks
- Reviews event logs and sensor diagnostics

**Technical Proficiency:** High

---

## Design Assets

### Color Palette

**Brand Colors:**
```css
--primary: #1e3a5f        /* Deep navy blue - trust, professionalism */
--primary-foreground: #ffffff
--accent: #34d399         /* Cyan/teal - ice, cold, freshness */
```

**Status Colors (Critical - use consistently):**
```css
--safe: hsl(152, 69%, 40%)        /* Green - normal operation */
--warning: hsl(38, 92%, 50%)      /* Orange - needs attention */
--alarm: hsl(0, 84%, 60%)         /* Red - immediate action required */
--excursion: hsl(25, 95%, 53%)    /* Orange-red - temperature out of range */
--offline: hsl(215, 16%, 47%)     /* Gray - no communication */
```

**Severity Mapping:**
| Severity | Color | Use Case |
|----------|-------|----------|
| Info | Blue/Gray | Informational, calibration reminders |
| Warning | Orange | Attention needed, not critical |
| Critical | Red | Immediate action required, food safety risk |

**Status Priority Order (highest to lowest):**
1. `alarm_active` (Critical)
2. `temp_excursion` (Critical)
3. `monitoring_interrupted` (Warning)
4. `manual_required` (Warning)
5. `ok` (Safe)
6. `offline` (Gray)

### Typography

```css
--font-sans: 'Inter', system-ui, sans-serif
--font-mono: 'JetBrains Mono', monospace
```

**Hierarchy:**
- Page titles: `text-2xl font-bold` or `text-3xl font-bold`
- Section headers: `text-lg font-semibold` or `text-xl font-semibold`
- Card titles: `text-base font-medium`
- Body text: `text-sm` or `text-base`
- Labels/captions: `text-xs text-muted-foreground`

**Temperature Readings:**
- Current temperature: Large, bold, color indicates status
- Limits: Smaller, muted, show thresholds
- Always include unit (°F or °C based on org settings)

### Layout Patterns

**Dashboard Layout:**
- Sidebar navigation (collapsible on mobile)
- Main content area with breadcrumb hierarchy
- Card-based unit displays
- Status badges prominent

**Card Structure:**
```jsx
<Card>
  <CardHeader>
    <CardTitle>{unit.name}</CardTitle>
    <CardDescription>Status and last reading</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Temperature display, alerts, actions */}
  </CardContent>
</Card>
```

**Modal Patterns:**
- Use `Dialog` from shadcn/ui for all modals
- Confirmation dialogs for destructive actions
- Form modals for data entry (LogTempModal pattern)

**Table Patterns:**
- Use `Table` components for lists
- Sortable columns for key fields
- Status badges in first or second column
- Actions in last column

### Iconography

**Use Lucide React icons exclusively.** Common icons:
- `Thermometer` - temperature readings
- `AlertTriangle` - warnings
- `AlertCircle` - critical alerts
- `CheckCircle` - success/ok states
- `XCircle` - errors/failures
- `Clock` - time-based alerts
- `Battery`, `BatteryLow` - battery status
- `Wifi`, `WifiOff` - connectivity
- `DoorOpen`, `DoorClosed` - door sensors
- `Settings` - configuration
- `Bell` - notifications

### Animation

**Use sparingly for meaningful feedback:**
- `pulse-glow` - Active critical alerts (draws attention)
- `fade-in` - Page/component entry
- `slide-in-from-right` - Drawer/panel animations
- Framer Motion for complex transitions

**Avoid:**
- Gratuitous animations that distract
- Animations on critical status indicators (may obscure reading)

---

## Coding Conventions

### File Organization

```
src/
├── pages/          # Route-level components only
├── components/     # Reusable components
│   ├── ui/         # shadcn/ui base components (don't modify)
│   ├── dashboard/  # Dashboard-specific components
│   ├── alerts/     # Alert display components
│   ├── unit/       # Unit monitoring components
│   ├── settings/   # Settings panels
│   └── [feature]/  # Feature-grouped components
├── hooks/          # Custom React hooks
├── lib/            # Utilities and configuration
├── types/          # TypeScript type definitions
└── integrations/   # External service integrations
```

### Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `UnitCard.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useUnitStatus.ts`)
- Utilities: `camelCase.ts` (e.g., `alertConfig.ts`)
- Types: `camelCase.ts` (e.g., `ttn.ts`)

**Components:**
- PascalCase for component names
- Props interfaces: `ComponentNameProps`
- Destructure props in function signature

**Variables:**
- camelCase for variables and functions
- SCREAMING_SNAKE_CASE for constants/configs
- Prefix boolean variables with `is`, `has`, `can`, `should`

### TypeScript Patterns

**Always type function parameters and returns:**
```typescript
function computeUnitStatus(
  info: UnitStatusInfo,
  rules: AlertRules
): ComputedUnitStatus {
  // ...
}
```

**Use database types from Supabase:**
```typescript
import type { Database } from '@/integrations/supabase/types';
type Unit = Database['public']['Tables']['units']['Row'];
```

**Extend for frontend needs:**
```typescript
interface UnitWithAlerts extends Unit {
  activeAlerts: Alert[];
  computedStatus: ComputedUnitStatus;
}
```

### React Query Patterns

**Query key structure:**
```typescript
// Entity queries
['units', unitId]
['alerts', { organizationId, status: 'active' }]
['alert-rules', { unitId }]

// List queries
['sites', { organizationId }]
['areas', { siteId }]
```

**Standard hook pattern:**
```typescript
export function useUnit(unitId: string) {
  return useQuery({
    queryKey: ['units', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!unitId,
  });
}
```

**Mutation pattern:**
```typescript
export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['units', data.id] });
      toast.success('Unit updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update unit');
    },
  });
}
```

### Component Patterns

**Use shadcn/ui components as base:**
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
```

**Compose over customize:**
```typescript
// Good - compose shadcn components
function StatusBadge({ status }: { status: UnitStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Avoid - modifying shadcn source
```

**Use config objects for display logic:**
```typescript
import { ALERT_TYPE_CONFIG } from '@/lib/alertConfig';

function AlertIcon({ type }: { type: AlertType }) {
  const config = ALERT_TYPE_CONFIG[type];
  const Icon = config.icon;
  return <Icon className={config.colorClass} />;
}
```

### Form Patterns

**Use React Hook Form + Zod:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { temperatureLogSchema } from '@/lib/validation';

function LogTempForm() {
  const form = useForm({
    resolver: zodResolver(temperatureLogSchema),
    defaultValues: { temperature: '', notes: '' },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="temperature"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Temperature</FormLabel>
            <FormControl>
              <Input {...field} type="number" step="0.1" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}
```

### Error Handling

**Toast notifications for user feedback:**
```typescript
import { toast } from 'sonner';

// Success
toast.success('Temperature logged successfully');

// Error
toast.error('Failed to save. Please try again.');

// Warning
toast.warning('Offline - will sync when connected');
```

**Log errors for debugging:**
```typescript
try {
  await someOperation();
} catch (error) {
  console.error('[ComponentName] Operation failed:', error);
  toast.error('Operation failed');
}
```

---

## External References

### Documentation

- **Supabase Docs:** https://supabase.com/docs
- **shadcn/ui:** https://ui.shadcn.com/docs
- **TanStack Query:** https://tanstack.com/query/latest
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev/icons
- **The Things Network:** https://www.thethingsindustries.com/docs/

### Internal Documentation

- **System Architecture:** `/docs/system-map.md`
- **Deprecations & Migrations:** `/docs/deprecations.md`

### API References

- **Supabase Project:** Access via environment variables
- **TTN Console:** https://console.thethingsnetwork.org/
- **Telnyx (SMS):** https://developers.telnyx.com/docs/messaging/sms
  - Messaging Profile: `frost guard` (ID: `40019baa-aa62-463c-b254-463c66f4b2d3`)
  - Toll-Free Number: `+18889890560`

---

## Security Practices

### Authentication

- **Supabase Auth** handles all authentication
- Password requirements: 8+ chars, uppercase, lowercase, number, special char
- Session management via Supabase client
- Auto-redirect to `/auth` when session expires

### Authorization

- **Row-Level Security (RLS)** enforced at database level
- Users can only access their organization's data
- Roles: `admin`, `manager`, `viewer`
- Check permissions with `usePermissions()` hook

### Input Validation

**Always validate user input:**
```typescript
import { temperatureLogSchema, emailSchema, phoneSchema } from '@/lib/validation';

// Temperature: -100°F to 200°F
// Email: standard email regex
// Phone: E.164 format for SMS
```

**Sanitize strings:**
```typescript
import { sanitizeString } from '@/lib/validation';
const cleanInput = sanitizeString(userInput);
```

### Sensitive Data

- **Never log** full phone numbers (mask in logs)
- **Never expose** API keys in frontend code
- **Use environment variables** for all secrets
- **Supabase anon key** is safe for client-side (limited by RLS)

### Edge Function Security

- Validate internal API keys with `validateInternalApiKey()`
- Use `_shared/` modules for validation logic
- Log with masked sensitive parameters

---

## Compliance Requirements

### HACCP Compliance

- Temperature logs must include timestamp and operator ID
- Excursions must be documented with corrective actions
- Audit trail must be immutable (soft deletes, no hard deletes)
- Reports must be exportable for health inspections

### Data Retention

- Temperature readings retained per organization policy
- Event logs retained for audit purposes
- Soft delete (`deleted_at`) instead of hard delete for critical data

### Audit Trail Requirements

**All significant events logged to `event_logs`:**
- Alert created, acknowledged, resolved
- Temperature logged (manual and automatic)
- Settings changed
- User actions (login, permission changes)

**Event log structure:**
```typescript
{
  event_type: 'alert_created' | 'temperature_logged' | 'setting_changed' | ...,
  category: 'alert' | 'temperature' | 'configuration' | 'user',
  severity: 'info' | 'warning' | 'error',
  title: 'Human-readable title',
  organization_id: string,
  unit_id?: string,
  actor_id: string,
  actor_type: 'user' | 'system',
  event_data: { /* JSON details */ }
}
```

---

## Terminology

Use these terms consistently throughout the application:

| Correct Term | Avoid | Context |
|--------------|-------|---------|
| Unit | Fridge, Refrigerator, Equipment | A monitored refrigeration unit |
| Excursion | Violation, Out of range | Temperature outside limits |
| Alarm | Alert (when referring to active) | Active critical condition |
| Alert | Notification, Warning | Any condition notification |
| Reading | Data point, Sample | Single temperature measurement |
| Manual log | Hand log, Check | User-entered temperature |
| Sensor | Device, Probe | Physical IoT device |
| Gateway | Hub, Base station | LoRa gateway device |
| Area | Zone, Section | Logical grouping within site |
| Site | Location, Facility | Physical building/address |
| Escalation | Notification chain | Alert severity progression |
| Acknowledge | Dismiss, Accept | User confirms alert receipt |
| Resolve | Close, Clear | Alert condition ended |

---

## Quick Reference

### Status Codes

| Status | Meaning | Color | Priority |
|--------|---------|-------|----------|
| `alarm_active` | Critical temperature alarm | Red | 1 (highest) |
| `temp_excursion` | Temperature out of range | Orange-red | 2 |
| `monitoring_interrupted` | No sensor data | Gray | 3 |
| `manual_required` | Manual log overdue | Orange | 4 |
| `ok` | Normal operation | Green | 5 |
| `offline` | Sensor offline | Gray | 6 |

### Alert Types

| Type | Description | Default Severity |
|------|-------------|------------------|
| `alarm_active` | Confirmed temperature alarm | Critical |
| `temp_excursion` | Temperature excursion detected | Critical |
| `monitoring_interrupted` | Sensor not reporting | Warning |
| `missed_manual_entry` | Manual log overdue | Warning |
| `door_open` | Door open too long | Warning |
| `low_battery` | Sensor battery low | Info |
| `sensor_fault` | Sensor malfunction | Warning |
| `calibration_due` | Calibration reminder | Info |
| `suspected_cooling_failure` | Possible equipment failure | Critical |

### Key Edge Functions

| Function | Purpose |
|----------|---------|
| `process-unit-states` | Creates/resolves alerts (SSOT) |
| `process-escalations` | Sends notifications |
| `ingest-readings` | Receives sensor data |
| `send-sms-alert` | Sends SMS via Telnyx |
| `ttn-webhook` | Receives TTN uplinks |
| `ttn-provision-device` | Provisions LoRa devices |
| `telnyx-webhook` | Receives SMS delivery status webhooks |
| `telnyx-verification-status` | Checks toll-free verification status |
| `telnyx-configure-webhook` | Automates Telnyx webhook setup |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-31 | Initial knowledge base created | Lovable AI |

---

*Keep this document current as the project evolves. Update it when adding major features, changing conventions, or modifying the data model.*
