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

# Check SMS sending logs
supabase functions logs send-sms-alert --limit 50

# Check webhook logs for delivery status
supabase functions logs telnyx-webhook --limit 50
```

```sql
-- Check notification records
SELECT *
FROM notification_events
WHERE alert_id = 'alert-uuid'
ORDER BY created_at DESC;

-- Check SMS alert log
SELECT *
FROM sms_alert_log
WHERE alert_id = 'alert-uuid'
ORDER BY sent_at DESC;
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
AND is_active = true;
```

#### Step 3: Check Email Service (Resend)

1. Login to Resend dashboard
2. Check for failed deliveries
3. Verify API key is valid
4. Check for sending limits

#### Step 4: Check SMS Service (Telnyx)

**Telnyx Configuration:**
- Messaging Profile: `frost guard`
- Profile ID: `40019baa-aa62-463c-b254-463c66f4b2d3`
- Toll-Free Number: `+18889890560`

**Portal Steps:**
1. Login to Telnyx Mission Control portal (telnyx.com)
2. Navigate to Messaging → Messaging Profiles → "frost guard"
3. Check message logs for delivery status
4. Verify toll-free number is verified and active
5. Check account balance if applicable

**Verify Secrets:**
```sql
-- Secrets should be set (check via Supabase dashboard)
-- TELNYX_API_KEY
-- TELNYX_PHONE_NUMBER (+18889890560)
-- TELNYX_MESSAGING_PROFILE_ID (40019baa-aa62-463c-b254-463c66f4b2d3)
-- TELNYX_PUBLIC_KEY (for webhook verification)
```

**Check Webhook Configuration:**
- Webhook URL: `https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/telnyx-webhook`
- Event types: `message.sent`, `message.delivered`, `message.failed`, `message.received`

#### Step 5: Check for Opt-Out

```sql
-- Check if recipient has opted out
SELECT * FROM sms_alert_log
WHERE recipient_phone = '+15551234567'
  AND (error_message LIKE '%opted out%' OR error_code = '40300');
```

If opted out, user must reply START to re-enable.

#### Step 6: Verify Toll-Free Verification

Check Settings → Notifications in FreshTrack UI for toll-free verification status.
Unverified toll-free numbers have sending restrictions.

### Manual Notification (If Urgent)

```bash
# Send manual SMS via Telnyx API
curl -X POST https://api.telnyx.com/v2/messages \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+18889890560",
    "to": "+15551234567",
    "text": "URGENT FreshTrack Alert: Unit X has exceeded temperature threshold",
    "messaging_profile_id": "40019baa-aa62-463c-b254-463c66f4b2d3"
  }'

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

### Common Telnyx Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| 10009 | Auth failed | Check `TELNYX_API_KEY` |
| 40001 | Landline | Use mobile number |
| 40300 | Opted out | User replies START |
| 40310 | Invalid number | Check E.164 format |
| 40008 | Toll-free unverified | Complete verification |

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

- [METRICS_OVERVIEW.md](./METRICS_OVERVIEW.md) — Metric definitions and thresholds
- [DASHBOARDS.md](./DASHBOARDS.md) — Dashboard configuration
- [ALERTING.md](./ALERTING.md) — Alert conditions and escalation
- [LOGGING.md](./LOGGING.md) — Log sources and debugging
