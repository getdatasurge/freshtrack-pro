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
