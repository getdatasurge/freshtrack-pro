# FreshTrack Pro Glossary

> Alphabetical reference for domain terms, acronyms, and internal concepts

---

## A

### Acknowledge (Alert)
The action of confirming receipt of an alert without resolving it. Acknowledged alerts remain active but indicate a user has seen them.

**References**: `src/integrations/supabase/types.ts` (alert_status enum), `src/components/alerts/AlertRow.tsx`

### Alarm Active
Unit status indicating a confirmed temperature excursion that has persisted beyond the confirmation threshold. This is the most severe temperature-related status.

**References**: `src/lib/statusConfig.ts`, `supabase/functions/process-unit-states/index.ts:301`

### Alert
A notification generated when a monitored condition exceeds defined thresholds. Alerts have types, severities, and statuses.

**References**: `src/integrations/supabase/types.ts` (alerts table), `src/lib/alertConfig.ts`

### Alert Rule
Configurable thresholds that define when alerts are triggered. Rules cascade from Organization → Site → Unit, with lower levels overriding higher levels.

**References**: `src/integrations/supabase/types.ts` (alert_rules table), `src/hooks/useAlertRules.ts`

### Alert Severity
The urgency level of an alert. Values: `warning` (attention needed) or `critical` (immediate action required).

**References**: `src/integrations/supabase/types.ts` (alert_severity enum)

### Alert Status
The lifecycle state of an alert. Values: `triggered` (active), `acknowledged` (seen), `resolved` (cleared).

**References**: `src/integrations/supabase/types.ts` (alert_status enum)

### Alert Type
The category of condition being monitored. Values include:
- `temp_excursion` - Temperature out of range
- `monitoring_interrupted` - Sensor offline
- `door_open` - Door open too long
- `low_battery` - Sensor battery low
- `sensor_fault` - Sensor malfunction
- `suspected_cooling_failure` - Possible equipment failure
- `calibration_due` - Calibration reminder
- `missed_manual_entry` - Manual log overdue

**References**: `src/integrations/supabase/types.ts` (alert_type enum), `src/lib/alertConfig.ts`

### API Key (TTN)
Authentication credential for The Things Network. Types:
- **Personal API Key**: User-level access
- **Application API Key**: Application-scoped access
- **Organization API Key**: Organization-wide access

**References**: `supabase/functions/_shared/ttnPermissions.ts`

### Area
A logical grouping within a Site, such as a kitchen, walk-in cooler, or storage room. Contains Units.

**References**: `src/integrations/supabase/types.ts` (areas table), `src/pages/AreaDetail.tsx`

---

## B

### Battery Forecast
Prediction of when a sensor's battery will need replacement based on voltage trends.

**References**: `src/hooks/useBatteryForecast.ts`

---

## C

### Calibration
The process of verifying and adjusting sensor accuracy against a reference thermometer. Tracked in `calibration_records` table.

**References**: `src/integrations/supabase/types.ts` (calibration_records table)

### Cascade (Alert Rules)
The inheritance pattern where settings flow from Organization → Site → Area → Unit. Lower-level settings override higher-level defaults.

**References**: `supabase/functions/_shared/` (RPC: `get_effective_alert_rules`)

### Check-in
A sensor reporting data to the system. Used to detect offline conditions.

**References**: `supabase/functions/process-unit-states/index.ts:71-78`

### Compliance Mode
The regulatory framework an organization follows. Values: `HACCP`, `FDA`, `GENERAL`.

**References**: `src/integrations/supabase/types.ts` (compliance_mode enum), `src/pages/Reports.tsx`

### Confirm Time
The duration a temperature must remain out of range before escalating from excursion to alarm. Door state affects confirm time:
- Door closed: default 600 seconds (10 minutes)
- Door open: default 1200 seconds (20 minutes)

**References**: `supabase/functions/process-unit-states/index.ts:201-203`

### Corrective Action
Documentation of steps taken to address a temperature excursion or other compliance issue. Required for HACCP compliance.

**References**: `src/integrations/supabase/types.ts` (corrective_actions table)

---

## D

### DevEUI
Device Extended Unique Identifier. A 16-character hexadecimal identifier for LoRa devices. Can be formatted with or without colons/dashes.

**References**: `supabase/functions/_shared/ttnConfig.ts`

### Door Event
A record of door state change (open/close) with timestamp. Used for door-open duration tracking.

**References**: `src/integrations/supabase/types.ts` (door_events table)

### Door Grace Period
Time allowed for a door to be open before triggering a door-open alert. Default: 20 minutes.

**References**: `supabase/functions/process-unit-states/index.ts:193-198`

---

## E

### Edge Function
Serverless function running on Supabase's Deno runtime. Used for data processing, webhooks, and integrations.

**References**: `supabase/functions/*/index.ts`

### Emulator
A testing tool that simulates sensor data and TTN integration for development purposes.

**References**: `src/components/settings/EmulatorSyncHistory.tsx`, `supabase/functions/emulator-sync/`

### Escalation
The process of notifying additional contacts when an alert remains unacknowledged. Configured via escalation policies.

**References**: `src/integrations/supabase/types.ts` (escalation_contacts, escalation_policies tables)

### Escalation Contact
A person designated to receive alert notifications at a specific escalation level.

**References**: `src/integrations/supabase/types.ts` (escalation_contacts table)

### Escalation Level
The tier of notification escalation (1, 2, 3, etc.). Higher levels are reached when lower levels don't acknowledge alerts.

**References**: `src/integrations/supabase/types.ts` (alerts.escalation_level)

### Excursion
A temperature reading outside the defined safe range. Short for "temperature excursion."

**References**: `src/lib/alertConfig.ts`, `src/lib/statusConfig.ts`

### Event Log
Audit trail entry recording significant system events. Immutable for compliance purposes.

**References**: `src/integrations/supabase/types.ts` (event_logs table), `src/lib/eventLogger.ts`

---

## F

### FDA
Food and Drug Administration. One of the compliance mode options for organizations.

**References**: `src/integrations/supabase/types.ts` (compliance_mode enum)

### FrostGuard
Internal codename for the FreshTrack Pro application.

**References**: `KNOWLEDGE.md`, `vite.config.ts` (PWA name)

---

## G

### Gateway
LoRa network gateway that receives signals from sensors and forwards them to TTN. Required for LoRa sensor connectivity.

**References**: `src/integrations/supabase/types.ts` (gateways table), `src/components/settings/GatewayManager.tsx`

### Gateway Status
State of a LoRa gateway. Values: `pending`, `online`, `offline`, `maintenance`.

**References**: `src/integrations/supabase/types.ts` (gateway_status enum)

---

## H

### HACCP
Hazard Analysis Critical Control Point. A systematic approach to food safety that identifies and controls potential hazards.

**References**: `src/integrations/supabase/types.ts` (compliance_mode enum), `KNOWLEDGE.md`

### Hysteresis
The temperature buffer applied when transitioning back to normal status. Prevents flapping between states.

**References**: `supabase/functions/process-unit-states/index.ts:439-441`

---

## I

### Ingest (Data)
The process of receiving and storing sensor readings from external sources (TTN, simulators, manual entry).

**References**: `supabase/functions/ingest-readings/index.ts`, `supabase/functions/ttn-webhook/index.ts`

### Inspector
Debug tool for examining organization data, sensor states, and system configuration.

**References**: `src/pages/Inspector.tsx`

### Internal API Key
Secret key used for edge function authentication. Required for scheduled/internal function calls.

**References**: `supabase/functions/_shared/validation.ts`

---

## L

### Last Known Good
The most recent valid temperature reading from any source (sensor or manual).

**References**: `src/components/unit/LastKnownGoodCard.tsx`

### LoRa
Long Range radio technology used for low-power, long-distance IoT communication.

**References**: `src/integrations/supabase/types.ts` (lora_sensors table)

### LoRa Sensor
A temperature/humidity/door sensor using LoRa radio technology connected via TTN.

**References**: `src/integrations/supabase/types.ts` (lora_sensors table), `src/components/settings/SensorManager.tsx`

### LoRa Sensor Status
State of a LoRa sensor. Values: `pending` (registered), `joining` (connecting to TTN), `active` (receiving data), `offline` (no recent data), `fault` (error state).

**References**: `src/integrations/supabase/types.ts` (lora_sensor_status enum)

### LoRa Sensor Type
The type of data a sensor can provide. Values: `temperature`, `temperature_humidity`, `door`, `combo`, `contact`.

**References**: `src/integrations/supabase/types.ts` (lora_sensor_type enum)

---

## M

### Manual Log
A user-entered temperature reading, typically used when automated sensors are unavailable or as a backup.

**References**: `src/integrations/supabase/types.ts` (manual_temperature_logs table), `src/pages/ManualLog.tsx`

### Manual Required
Unit status indicating sensor data is unavailable and manual temperature logging is needed.

**References**: `src/lib/statusConfig.ts`, `supabase/functions/process-unit-states/index.ts:97-120`

### Missed Check-in
A sensor failing to report data within its expected interval. Tracked for offline detection.

**References**: `supabase/functions/process-unit-states/index.ts:71-78`

### Monitoring Interrupted
Alert type indicating a sensor has stopped reporting data.

**References**: `src/lib/alertConfig.ts`, `supabase/functions/process-unit-states/index.ts`

---

## N

### Notification Event
A record of a notification attempt (email, SMS, push) including delivery status.

**References**: `src/integrations/supabase/types.ts` (notification_events table)

### Notification Policy
Configuration for how alerts of specific types should trigger notifications.

**References**: `src/integrations/supabase/types.ts` (notification_policies table), `src/hooks/useNotificationPolicies.ts`

---

## O

### Offline
Unit status indicating no sensor data has been received within the expected interval.

**References**: `src/lib/statusConfig.ts`

### Organization
Top-level tenant entity. Contains Sites, manages subscriptions, and owns sensor/gateway inventory.

**References**: `src/integrations/supabase/types.ts` (organizations table)

---

## P

### Primary Sensor
The designated sensor whose readings are used for unit status display when multiple sensors are assigned.

**References**: `src/integrations/supabase/types.ts` (lora_sensors.is_primary), `src/hooks/useSetPrimarySensor.ts`

### Process Escalations
Edge function responsible for sending notifications based on escalation policies. Single source of truth for notification dispatch.

**References**: `supabase/functions/process-escalations/index.ts`

### Process Unit States
Edge function responsible for evaluating unit states and creating/resolving alerts. Single source of truth for alert management.

**References**: `supabase/functions/process-unit-states/index.ts`

### Provisioning
The process of registering a sensor or gateway with TTN.

**References**: `supabase/functions/ttn-provision-device/`, `src/types/ttn.ts`

### Provisioning Queue
Database table tracking pending sensor/gateway provisioning jobs.

**References**: `src/integrations/supabase/types.ts` (ttn_provisioning_queue table)

---

## Q

### Quiet Hours
Time periods during which notifications are suppressed or reduced.

**References**: `supabase/functions/process-escalations/index.ts`

---

## R

### Reading
A single temperature measurement from a sensor or manual entry.

**References**: `src/integrations/supabase/types.ts` (sensor_readings table)

### Resolve (Alert)
The action of closing an alert, either automatically (condition cleared) or manually.

**References**: `src/integrations/supabase/types.ts` (alert_status enum)

### Restoring
Unit status indicating temperature is returning to normal after an excursion. Requires multiple consecutive good readings.

**References**: `src/lib/statusConfig.ts`, `supabase/functions/process-unit-states/index.ts:471-490`

### RLS
Row-Level Security. PostgreSQL feature enforcing data access control at the database level.

**References**: `supabase/migrations/*`

### RSSI
Received Signal Strength Indicator. Measure of LoRa signal quality.

**References**: `supabase/functions/ttn-webhook/index.ts:199`

---

## S

### Sensor Readings
Table storing all temperature/humidity data from sensors.

**References**: `src/integrations/supabase/types.ts` (sensor_readings table)

### Service Role Key
Supabase administrative key with full database access. Only used in edge functions.

**References**: `supabase/functions/*/index.ts`

### Site
A physical location within an organization (e.g., restaurant, warehouse). Contains Areas.

**References**: `src/integrations/supabase/types.ts` (sites table), `src/pages/Sites.tsx`

### Soft Delete
Marking a record as deleted (via `deleted_at` timestamp) rather than physically removing it. Preserves audit trail.

**References**: `src/hooks/useSoftDelete.ts`

### SSOT
Single Source of Truth. Design principle where one module is authoritative for a specific operation.

**References**: `KNOWLEDGE.md`, `docs/system-map.md`

### Suspected Cooling Failure
Alert type indicating temperature is not recovering despite door being closed, suggesting equipment malfunction.

**References**: `supabase/functions/process-unit-states/index.ts:378-435`

---

## T

### TTN
The Things Network. Open-source LoRaWAN network infrastructure used for sensor connectivity.

**References**: `supabase/functions/ttn-*/`, `src/types/ttn.ts`

### TTN Application
A container in TTN that groups devices and manages their data routing.

**References**: `supabase/functions/ttn-manage-application/index.ts`

### TTN Connection
Per-organization TTN credentials stored in the database.

**References**: `src/integrations/supabase/types.ts` (ttn_connections table)

### TTN Webhook
HTTP endpoint that receives sensor data from TTN when devices transmit.

**References**: `supabase/functions/ttn-webhook/index.ts`

### TTN Webhook Secret
Shared secret used to authenticate incoming TTN webhooks.

**References**: `supabase/functions/ttn-webhook/index.ts:145-168`

### TTS
The Things Stack. Enterprise version of The Things Network.

**References**: `supabase/functions/ttn-provision-worker/index.ts`

---

## U

### Unit
A monitored refrigeration unit (freezer, cooler, display case). The primary entity for temperature monitoring.

**References**: `src/integrations/supabase/types.ts` (units table), `src/pages/UnitDetail.tsx`

### Unit Status
The operational state of a unit. Values:
- `ok` - Normal operation
- `excursion` - Temperature out of range (unconfirmed)
- `alarm_active` - Confirmed temperature alarm
- `monitoring_interrupted` - No sensor data
- `manual_required` - Manual logging needed
- `restoring` - Recovering from excursion
- `offline` - Sensor offline

**References**: `src/lib/statusConfig.ts`, `supabase/functions/process-unit-states/index.ts:60`

### Uplink
A transmission from a LoRa device to TTN.

**References**: `supabase/functions/ttn-webhook/index.ts`

### User Role
Permission level for a user within an organization. Values: `owner`, `manager`, `operator`, `viewer`.

**References**: `src/integrations/supabase/types.ts` (app_role enum), `src/hooks/useUserRole.ts`

---

## W

### Webhook
HTTP callback endpoint that receives data from external services.

**References**: `supabase/functions/ttn-webhook/index.ts`, `supabase/functions/stripe-webhook/index.ts`

---

## Numeric / Symbols

### 202 Response
HTTP status returned for accepted-but-not-processed webhooks. Used to prevent TTN retry loops for unknown devices.

**References**: `supabase/functions/ttn-webhook/index.ts:302-311`

### E.164
International phone number format required for SMS delivery (e.g., +15551234567).

**References**: `src/lib/validation.ts`

---

## Acronym Quick Reference

| Acronym | Full Form |
|---------|-----------|
| API | Application Programming Interface |
| CORS | Cross-Origin Resource Sharing |
| DevEUI | Device Extended Unique Identifier |
| FDA | Food and Drug Administration |
| HACCP | Hazard Analysis Critical Control Point |
| IoT | Internet of Things |
| JWT | JSON Web Token |
| LoRa | Long Range (radio technology) |
| LoRaWAN | Long Range Wide Area Network |
| PWA | Progressive Web App |
| RLS | Row-Level Security |
| RPC | Remote Procedure Call |
| RSSI | Received Signal Strength Indicator |
| SNR | Signal-to-Noise Ratio |
| SSOT | Single Source of Truth |
| TTN | The Things Network |
| TTS | The Things Stack |
| UUID | Universally Unique Identifier |
