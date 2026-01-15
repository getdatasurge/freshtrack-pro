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
| SMS delivery failed | `notification_events.status = 'failed'` | Check Telnyx portal |
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
5. Verify Telnyx/email credentials

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

- [API.md](./API.md) - Edge function details
- [DATA_MODEL.md](./DATA_MODEL.md) - Event log schema
- [INTEGRATIONS.md](./INTEGRATIONS.md) - Third-party service status
