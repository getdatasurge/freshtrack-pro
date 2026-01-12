# FreshTrack Pro API Documentation

> Complete documentation for all Edge Functions and RPC endpoints

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Data Ingestion Functions](#data-ingestion-functions)
4. [Alert Processing Functions](#alert-processing-functions)
5. [TTN Management Functions](#ttn-management-functions)
6. [User & Data Management Functions](#user-data-management-functions)
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

**Purpose**: Send SMS via Telnyx

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

- [INTEGRATIONS.md](./INTEGRATIONS.md) - Third-party service configuration
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema
- [FLOWCHARTS.md](../charts/FLOWCHARTS.md) - Visual process flows
