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

- [DASHBOARDS.md](./DASHBOARDS.md) — Dashboard configuration and visualization
- [ALERTING.md](./ALERTING.md) — Alert conditions and escalation
- [LOGGING.md](./LOGGING.md) — Log sources and debugging
- [RUNBOOKS.md](./RUNBOOKS.md) — Operational procedures
