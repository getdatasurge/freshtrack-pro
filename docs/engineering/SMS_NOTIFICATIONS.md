# SMS Notifications — Telnyx

> Canonical reference for SMS alert delivery in FreshTrack Pro

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration](#configuration)
4. [Message Lifecycle](#message-lifecycle)
5. [Webhook Integration](#webhook-integration)
6. [Testing](#testing)
7. [Compliance](#compliance)
8. [Troubleshooting](#troubleshooting)

---

## Overview

FreshTrack Pro uses **Telnyx** as the sole SMS provider for critical alert delivery. SMS notifications are sent for temperature excursions, equipment failures, and other safety-critical events that require immediate attention.

### Key Configuration

| Property | Value |
|----------|-------|
| **Provider** | Telnyx |
| **Messaging Profile** | `frost guard` |
| **Profile ID** | `40019baa-aa62-463c-b254-463c66f4b2d3` |
| **Phone Number** | `+18889890560` (Toll-Free) |
| **Verification ID** | `99ac127c-6dae-57ee-afc4-32949ac9124e` |

### When SMS is Sent

SMS alerts are triggered by the `process-escalations` edge function when:
- An alert reaches `critical` severity
- The notification policy includes SMS as a channel
- The escalation contact has a valid phone number
- Rate limiting allows the notification (max 1 per alert per contact per 15 minutes)

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ALERT PROCESSING                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ process-escalations │────▶│  send-sms-alert  │────▶│   Telnyx API    │
│                     │     │                  │     │                 │
│ - Checks policy     │     │ - Formats message│     │ POST /messages  │
│ - Determines channel│     │ - Adds profile ID│     │                 │
│ - Rate limits       │     │ - Logs to DB     │     │                 │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                                              │
                                                         Webhook
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DELIVERY STATUS                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            ┌─────────────────┐
                            │  telnyx-webhook │
                            │                 │
                            │ - Verifies sig  │
                            │ - Updates status│
                            │ - Logs event    │
                            └─────────────────┘
                                    │
                                    ▼
                            ┌─────────────────┐
                            │  sms_alert_log  │
                            │                 │
                            │ - Tracks status │
                            │ - Error details │
                            │ - Timestamps    │
                            └─────────────────┘
```

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `process-escalations` | Orchestrates all notifications | `supabase/functions/process-escalations/` |
| `send-sms-alert` | Sends SMS via Telnyx API | `supabase/functions/send-sms-alert/` |
| `telnyx-webhook` | Receives delivery status | `supabase/functions/telnyx-webhook/` |
| `telnyx-verification-status` | Checks toll-free verification | `supabase/functions/telnyx-verification-status/` |
| `telnyx-configure-webhook` | Automates webhook setup | `supabase/functions/telnyx-configure-webhook/` |
| `SmsAlertHistory.tsx` | UI for viewing SMS history | `src/components/settings/` |
| `TelnyxWebhookUrlsCard.tsx` | Displays webhook URLs | `src/components/settings/` |
| `TollFreeVerificationCard.tsx` | Shows verification status | `src/components/settings/` |

---

## Configuration

### Required Secrets

Set these in Supabase secrets:

| Secret | Description | Example |
|--------|-------------|---------|
| `TELNYX_API_KEY` | API key from Telnyx portal | `KEY01234567890ABCDEF...` |
| `TELNYX_PHONE_NUMBER` | Toll-free sender number | `+18889890560` |
| `TELNYX_MESSAGING_PROFILE_ID` | Profile ID for routing | `40019baa-aa62-463c-b254-463c66f4b2d3` |
| `TELNYX_PUBLIC_KEY` | Ed25519 public key for webhook verification | `MFkwEwYHKoZIzj0C...` |

```bash
# Set via Supabase CLI
supabase secrets set TELNYX_API_KEY=KEY01234567890ABCDEF
supabase secrets set TELNYX_PHONE_NUMBER=+18889890560
supabase secrets set TELNYX_MESSAGING_PROFILE_ID=40019baa-aa62-463c-b254-463c66f4b2d3
supabase secrets set TELNYX_PUBLIC_KEY=your-ed25519-public-key
```

### Webhook Configuration

Configure in Telnyx Portal → Messaging → Messaging Profiles → "frost guard":

| Setting | Value |
|---------|-------|
| **Webhook URL** | `https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/telnyx-webhook` |
| **Failover URL** | `https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/telnyx-webhook` |
| **API Version** | `2` |

**Required Event Types:**
- ✅ `message.sent`
- ✅ `message.delivered`
- ✅ `message.failed`
- ✅ `message.received`

---

## Message Lifecycle

### 1. Alert Triggers Escalation

```typescript
// process-escalations determines SMS is needed
const channels = policy.initial_channels; // ['sms', 'email']
if (channels.includes('sms')) {
  await sendSmsAlert(contact.phone, alertMessage);
}
```

### 2. SMS Sent via Telnyx

```typescript
// send-sms-alert formats and sends
const payload = {
  from: process.env.TELNYX_PHONE_NUMBER,
  to: recipientPhone,
  text: messageBody,
  messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
  webhook_url: `${SUPABASE_URL}/functions/v1/telnyx-webhook`,
  webhook_failover_url: `${SUPABASE_URL}/functions/v1/telnyx-webhook`,
};

const response = await fetch('https://api.telnyx.com/v2/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

### 3. Logged to Database

```sql
INSERT INTO sms_alert_log (
  alert_id,
  recipient_phone,
  message_body,
  provider_message_id,
  status,
  sent_at
) VALUES (...);
```

### 4. Delivery Status Received

Telnyx sends webhook events as the message progresses:

| Event | Meaning | Action |
|-------|---------|--------|
| `message.sent` | Accepted by carrier | Update status to `sent` |
| `message.delivered` | Delivered to device | Update status to `delivered` |
| `message.failed` | Delivery failed | Update status to `failed`, log error |

### 5. Status Updated

```typescript
// telnyx-webhook updates sms_alert_log
UPDATE sms_alert_log
SET status = 'delivered',
    delivered_at = NOW()
WHERE provider_message_id = $1;
```

---

## Webhook Integration

### Signature Verification

Telnyx uses Ed25519 signatures. The webhook validates:

```typescript
const signature = req.headers['telnyx-signature-ed25519'];
const timestamp = req.headers['telnyx-timestamp'];
const payload = await req.text();

const isValid = verifyEd25519Signature(
  TELNYX_PUBLIC_KEY,
  signature,
  timestamp + '|' + payload
);

if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

### Event Handling

```typescript
switch (event.event_type) {
  case 'message.sent':
    await updateStatus(messageId, 'sent');
    break;
  case 'message.delivered':
    await updateStatus(messageId, 'delivered');
    break;
  case 'message.failed':
    await updateStatus(messageId, 'failed', event.payload.errors);
    break;
  case 'message.received':
    await handleInbound(event.payload);
    break;
}
```

### Inbound Message Handling

When users reply STOP or HELP:
- Telnyx automatically handles opt-out
- `message.received` webhook logs the response
- User preference is tracked for future sends

---

## Testing

### Send Test SMS from UI

1. Go to Settings → Notifications
2. Click "Send Test SMS"
3. Enter a phone number
4. Verify delivery in SMS Alert History

### Verify Webhook Reception

```bash
# Check function logs
supabase functions logs telnyx-webhook --limit 20
```

### Test Webhook Manually

```bash
curl -X POST \
  https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/telnyx-webhook \
  -H "Content-Type: application/json" \
  -H "telnyx-signature-ed25519: test-signature" \
  -H "telnyx-timestamp: 1234567890" \
  -d '{
    "data": {
      "event_type": "message.delivered",
      "payload": {
        "id": "test-message-id"
      }
    }
  }'
```

### Check SMS Alert Log

```sql
SELECT
  id,
  recipient_phone,
  status,
  sent_at,
  delivered_at,
  error_message
FROM sms_alert_log
ORDER BY sent_at DESC
LIMIT 10;
```

---

## Compliance

### Toll-Free Verification

Toll-free numbers require verification before sending SMS at scale:

1. **Submit Verification** - Complete in Telnyx Portal
2. **Provide Use Case** - "Food safety temperature alerts"
3. **Sample Messages** - Provide example alert text
4. **Opt-In Proof** - Submit opt-in asset

**Current Status:**
- Verification ID: `99ac127c-6dae-57ee-afc4-32949ac9124e`
- Check status in Settings → Notifications

### Opt-In Requirements

FreshTrack collects consent when adding escalation contacts:
- Checkbox confirming SMS consent
- Opt-in asset: `src/assets/telnyx-opt-in-verification.png`
- Records timestamp of consent

### STOP/HELP Handling

- **STOP**: Telnyx automatically opts out the number
- **HELP**: Telnyx sends standard help message
- Both events logged via `message.received` webhook

### Rate Limiting

- Max 1 SMS per alert per contact per 15 minutes
- Prevents alert fatigue
- Configurable in notification policies

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| SMS not delivered | Invalid phone format | Ensure E.164 format (`+15551234567`) |
| Delivery failed | Number opted out | User replies START to opt back in |
| Auth error | Invalid API key | Regenerate key in Telnyx portal |
| Rate limited | Too many SMS | Check escalation policy timing |
| Webhook not receiving | Wrong URL or signature | Verify webhook config in Telnyx portal |
| Toll-free rejected | Unverified number | Complete toll-free verification |
| Signature invalid | Wrong public key | Update `TELNYX_PUBLIC_KEY` secret |

### Debugging Checklist

1. ✅ Check `TELNYX_API_KEY` is set and valid
2. ✅ Check `TELNYX_PHONE_NUMBER` is verified
3. ✅ Check `TELNYX_MESSAGING_PROFILE_ID` matches "frost guard"
4. ✅ Check webhook URL is correct in Telnyx portal
5. ✅ Check `telnyx-webhook` function logs for errors
6. ✅ Check `sms_alert_log` table for status
7. ✅ Verify recipient hasn't opted out

### Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| 10009 | Authentication failed | Check API key |
| 40001 | Landline destination | Use mobile number |
| 40300 | Number opted out | Recipient replies START |
| 40310 | Invalid number | Check E.164 format |
| 40311 | Not SMS-capable | Use different number |
| 40002/40003 | Message blocked | Check content for spam triggers |
| 40008 | Toll-free unverified | Complete verification |

### Useful Queries

```sql
-- Recent SMS failures
SELECT * FROM sms_alert_log
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 20;

-- SMS delivery rate (last 7 days)
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM sms_alert_log
WHERE sent_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Opted-out numbers
SELECT DISTINCT recipient_phone
FROM sms_alert_log
WHERE error_message LIKE '%opted out%'
   OR error_code = '40300';
```

---

## Related Documentation

- [INTEGRATIONS.md](./INTEGRATIONS.md#telnyx) — Integration overview
- [ARCHITECTURE.md](./ARCHITECTURE.md#telnyx) — System architecture
- [RUNBOOKS.md](../operations/RUNBOOKS.md#rb-006-notification-delivery-failure) — Incident response

---

*Last Updated: January 2025*
