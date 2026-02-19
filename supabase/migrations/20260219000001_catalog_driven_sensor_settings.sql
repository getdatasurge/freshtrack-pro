-- =============================================================================
-- Catalog-driven Sensor Settings
--
-- 1. Add 'catalog' to the sensor_change_type enum
-- 2. Update downlink_info for LHT65 and LDS02 with extended command schema
-- 3. Update sensor_catalog_public view to include downlink_info
-- =============================================================================

-- 1. Add 'catalog' to the change_type enum
ALTER TYPE sensor_change_type ADD VALUE IF NOT EXISTS 'catalog';

-- 2. Update LHT65 downlink_info with extended command schema
--    All hex templates match the Dragino LHT65N AT command protocol.
--    Commands ported from src/lib/downlinkCommands.ts.
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
      "hex_template": "01{seconds_hex}",
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
          "encoding": "u24be",
          "inputTransform": "minutes_to_seconds",
          "configField": "uplink_interval_s"
        }
      ]
    },
    {
      "key": "set_alarm",
      "name": "Temperature alerts",
      "description": "Configure on-device temperature alarm with low and high thresholds. Sends one command with all alarm parameters.",
      "hex_template": "AA{wmod}{check_min}{low_c}{high_c}",
      "category": "alarm",
      "fields": [
        {
          "name": "enabled",
          "label": "Enable on-device alarm",
          "type": "boolean",
          "default": true,
          "control": "toggle",
          "trueLabel": "Enabled",
          "falseLabel": "Disabled",
          "encoding": "bool01",
          "configField": "alarm_enabled"
        },
        {
          "name": "check_minutes",
          "label": "Check interval",
          "type": "integer",
          "unit": "min",
          "min": 1,
          "max": 65535,
          "default": 1,
          "step": 1,
          "control": "number",
          "encoding": "u16be",
          "helperText": "How often the sensor checks temperature against thresholds.",
          "configField": "alarm_check_minutes"
        },
        {
          "name": "low_c",
          "label": "Alert if below",
          "type": "integer",
          "unit": "\u00b0",
          "min": -40,
          "max": 125,
          "default": 32,
          "step": 1,
          "control": "number",
          "encoding": "temp_celsius_x100",
          "helperText": "Uses your display unit \u2014 converted automatically for the sensor.",
          "configField": "alarm_low"
        },
        {
          "name": "high_c",
          "label": "Alert if above",
          "type": "integer",
          "unit": "\u00b0",
          "min": -40,
          "max": 125,
          "default": 41,
          "step": 1,
          "control": "number",
          "encoding": "temp_celsius_x100",
          "helperText": "Uses your display unit \u2014 converted automatically for the sensor.",
          "configField": "alarm_high"
        }
      ]
    },
    {
      "key": "set_ext_mode",
      "name": "External probe type",
      "description": "Configure which type of external probe is connected.",
      "hex_template": "A2{mode_byte}",
      "category": "mode",
      "fields": [
        {
          "name": "mode",
          "label": "Probe type",
          "type": "select",
          "control": "select",
          "options": [
            { "value": 1, "label": "E3 Temp Probe (ext=1)" },
            { "value": 9, "label": "E3 + Timestamp (ext=9)" }
          ],
          "default": 1,
          "encoding": "u8"
        }
      ]
    },
    {
      "key": "set_time_sync",
      "name": "Keep sensor clock accurate",
      "description": "Enable or disable automatic clock synchronization.",
      "hex_template": "28{enable_byte}",
      "category": "mode",
      "fields": [
        {
          "name": "enabled",
          "label": "Clock sync",
          "type": "boolean",
          "default": true,
          "control": "toggle",
          "trueLabel": "Enabled",
          "falseLabel": "Disabled",
          "encoding": "bool01",
          "configField": "time_sync_enabled"
        }
      ]
    },
    {
      "key": "set_time_sync_days",
      "name": "Clock sync frequency",
      "description": "How often the sensor re-synchronizes its internal clock.",
      "hex_template": "29{days_byte}",
      "category": "mode",
      "fields": [
        {
          "name": "days",
          "label": "Sync every N days",
          "type": "integer",
          "unit": "days",
          "min": 1,
          "max": 255,
          "default": 10,
          "step": 1,
          "control": "number",
          "encoding": "u8",
          "configField": "time_sync_days"
        }
      ]
    },
    {
      "key": "sync_clock_now",
      "name": "Sync clock now",
      "description": "Sets the device clock to the current time. Helps with accurate timestamps in readings.",
      "hex_template": "30{unix_ts}00",
      "category": "action",
      "fields": [
        {
          "name": "unix_ts",
          "label": "Timestamp",
          "type": "integer",
          "control": "number",
          "encoding": "unix_timestamp_now",
          "hidden": true
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

-- 3. Update LDS02 downlink_info with extended command schema
UPDATE sensor_catalog
SET downlink_info = '{
  "supports_remote_config": true,
  "config_port": 3,
  "commands": [
    {
      "key": "set_tdc",
      "name": "How often this sensor reports",
      "description": "The sensor sends a heartbeat at this interval even if nothing changes.",
      "hex_template": "01{seconds_hex}",
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
          "encoding": "u24be",
          "inputTransform": "minutes_to_seconds",
          "configField": "uplink_interval_s"
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
      "fields": [
        {
          "name": "confirmed",
          "label": "Uplink confirmation",
          "type": "boolean",
          "default": false,
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

-- 4. Update sensor_catalog_public view to include downlink_info and temperature_unit
CREATE OR REPLACE VIEW sensor_catalog_public AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, f_ports, decoded_fields, uplink_info,
  battery_info, downlink_info, is_supported, tags,
  decode_mode, temperature_unit
FROM sensor_catalog
WHERE is_visible = true
  AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;
