-- =============================================================================
-- Fix Sensor Settings — Multiple Critical Issues
--
-- 1. Add confirmed_uplink_interval_s to sensor_configurations
--    (Issue 5: interval display must show confirmed value, not pending)
-- 2. Mark set_confirmed_uplinks as hidden in LDS02/LHT65 catalog entries
--    (Issue 4: confirmed uplinks always on, not user-configurable)
-- 3. Add set_confirmed_uplinks to LHT65 catalog (for auto-provisioning)
-- =============================================================================

-- 1. Add confirmed_uplink_interval_s column
--    This stores the last value the sensor actually acknowledged.
--    uplink_interval_s may be updated when a downlink is queued (pending),
--    but confirmed_uplink_interval_s only changes on confirmation.
ALTER TABLE sensor_configurations
  ADD COLUMN IF NOT EXISTS confirmed_uplink_interval_s INTEGER;

-- Backfill: copy current uplink_interval_s as the confirmed value
UPDATE sensor_configurations
SET confirmed_uplink_interval_s = uplink_interval_s
WHERE uplink_interval_s IS NOT NULL
  AND confirmed_uplink_interval_s IS NULL;

-- 2. Update LHT65 catalog: add set_confirmed_uplinks (hidden) + request_status
UPDATE sensor_catalog
SET downlink_info = '{
  "supports_remote_config": true,
  "config_port": 3,
  "native_temp_unit": "celsius",
  "native_temp_resolution": 0.01,
  "commands": [
    {
      "key": "set_tdc",
      "name": "How often this sensor reports",
      "description": "The sensor sends a reading at this interval.",
      "hex_template": "01{seconds_4byte_hex}",
      "category": "interval",
      "fields": [
        {
          "name": "minutes",
          "label": "Minutes",
          "type": "integer",
          "unit": "min",
          "min": 1,
          "max": 1440,
          "default": 10,
          "step": 1,
          "control": "number",
          "encoding": "u32be",
          "inputTransform": "minutes_to_seconds"
        }
      ]
    },
    {
      "key": "set_temp_alarm_high",
      "name": "High temperature alert",
      "description": "Alert if temperature goes above this threshold.",
      "hex_template": "02{temp_2byte_hex}",
      "category": "alarm",
      "fields": [
        {
          "name": "temperature",
          "label": "High threshold",
          "type": "integer",
          "unit": "\u00b0",
          "min": -40,
          "max": 125,
          "default": 41,
          "step": 1,
          "control": "number",
          "encoding": "temp_celsius_x100",
          "helperText": "Uses your display unit \u2014 converted automatically for the sensor."
        }
      ]
    },
    {
      "key": "set_temp_alarm_low",
      "name": "Low temperature alert",
      "description": "Alert if temperature drops below this threshold.",
      "hex_template": "03{temp_2byte_hex}",
      "category": "alarm",
      "fields": [
        {
          "name": "temperature",
          "label": "Low threshold",
          "type": "integer",
          "unit": "\u00b0",
          "min": -40,
          "max": 125,
          "default": 32,
          "step": 1,
          "control": "number",
          "encoding": "temp_celsius_x100",
          "helperText": "Uses your display unit \u2014 converted automatically for the sensor."
        }
      ]
    },
    {
      "key": "set_confirmed_uplinks",
      "name": "Require delivery confirmation",
      "description": "Confirmed uplinks guarantee delivery but use more battery.",
      "hex_template": "3401",
      "category": "mode",
      "hidden": true,
      "fields": [
        {
          "name": "confirmed",
          "label": "Uplink confirmation",
          "type": "boolean",
          "default": true,
          "control": "toggle",
          "trueLabel": "Confirmed",
          "falseLabel": "Unconfirmed",
          "encoding": "bool01"
        }
      ]
    },
    {
      "key": "request_status",
      "name": "Request device status",
      "description": "Device will respond with its current status on the next uplink.",
      "hex_template": "04FF",
      "category": "action",
      "fields": []
    }
  ]
}'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LHT65';

-- 3. Update LDS02 catalog: mark set_confirmed_uplinks as hidden
UPDATE sensor_catalog
SET downlink_info = '{
  "supports_remote_config": true,
  "config_port": 3,
  "commands": [
    {
      "key": "set_tdc",
      "name": "How often this sensor reports",
      "description": "The sensor sends a heartbeat at this interval even if nothing changes.",
      "hex_template": "01{seconds_4byte_hex}",
      "category": "interval",
      "fields": [
        {
          "name": "minutes",
          "label": "Minutes",
          "type": "integer",
          "unit": "min",
          "min": 1,
          "max": 1440,
          "default": 10,
          "step": 1,
          "control": "number",
          "encoding": "u32be",
          "inputTransform": "minutes_to_seconds"
        }
      ]
    },
    {
      "key": "set_open_alarm",
      "name": "Alert if door stays open longer than",
      "description": "You will get an alert if a door is left open beyond this time.",
      "hex_template": "02{minutes_2byte_hex}",
      "category": "alarm",
      "fields": [
        {
          "name": "minutes",
          "label": "Minutes",
          "type": "integer",
          "unit": "min",
          "min": 1,
          "max": 1440,
          "default": 5,
          "step": 1,
          "control": "number",
          "encoding": "u16be"
        }
      ]
    },
    {
      "key": "set_event_uplinks",
      "name": "Send alerts on open/close",
      "description": "When enabled, sensor immediately reports when door opens or closes.",
      "hex_template": "A7{disalarm_byte}",
      "category": "mode",
      "fields": [
        {
          "name": "enabled",
          "label": "Event alerts",
          "type": "boolean",
          "default": true,
          "control": "toggle",
          "trueLabel": "Enabled",
          "falseLabel": "Disabled",
          "encoding": "invertBool01"
        }
      ]
    },
    {
      "key": "set_confirmed_uplinks",
      "name": "Require delivery confirmation",
      "description": "Confirmed uplinks guarantee delivery but use more battery.",
      "hex_template": "05{confirmed_byte}",
      "category": "mode",
      "hidden": true,
      "fields": [
        {
          "name": "confirmed",
          "label": "Uplink confirmation",
          "type": "boolean",
          "default": true,
          "control": "toggle",
          "trueLabel": "Confirmed",
          "falseLabel": "Unconfirmed",
          "encoding": "bool01"
        }
      ]
    },
    {
      "key": "reset_open_count",
      "name": "Reset door open count",
      "description": "Resets the cumulative door-open counter stored on the device.",
      "hex_template": "A601",
      "category": "action",
      "fields": [],
      "confirmation": "Reset the door open counter to zero? This cannot be undone."
    },
    {
      "key": "request_status",
      "name": "Request device status",
      "description": "Device will respond with its current status on the next uplink.",
      "hex_template": "04FF",
      "category": "action",
      "fields": []
    }
  ]
}'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LDS02';

-- 4. Backfill sensor_catalog_id for any sensors still missing it
--    Handles cases where manufacturer/model may differ in casing or whitespace
UPDATE public.lora_sensors ls
SET sensor_catalog_id = sc.id
FROM public.sensor_catalog sc
WHERE LOWER(TRIM(ls.manufacturer)) = LOWER(TRIM(sc.manufacturer))
  AND LOWER(TRIM(ls.model)) = LOWER(TRIM(sc.model))
  AND ls.sensor_catalog_id IS NULL
  AND ls.deleted_at IS NULL
  AND sc.deprecated_at IS NULL;

-- Also try to match sensors that have model set but no manufacturer
-- (e.g., sensors synced from emulator might only have model)
UPDATE public.lora_sensors ls
SET sensor_catalog_id = sc.id
FROM public.sensor_catalog sc
WHERE ls.sensor_catalog_id IS NULL
  AND ls.deleted_at IS NULL
  AND sc.deprecated_at IS NULL
  AND ls.model IS NOT NULL
  AND LOWER(TRIM(ls.model)) = LOWER(TRIM(sc.model));
