-- =============================================================================
-- Fix Downlink Command Definitions
--
-- Critical bugs that cause downlinks to show "delivered" but not change sensor:
--
-- 1. LDS02 config_port was 3 — LDS02 uses fPort 10 for downlinks
-- 2. set_tdc encoding was u32be (4 bytes) — Dragino uses u24be (3 bytes)
-- 3. LDS02 set_open_alarm used command 0x02 (EDC) — correct is 0xA9 (TTRIG)
-- 4. request_status used 0x04FF — that is RESET on all Dragino sensors
-- 5. LHT65 set_confirmed_uplinks hex_template "3401" (no braces) caused
--    encoder to emit "340101" instead of "3401"
--
-- Sources:
--   LHT65N: https://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20LoRaWAN%20End%20Nodes/LHT65N-PIR/
--   LDS02:  https://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20LoRaWAN%20End%20Nodes/LDS02/
--   TTN:    https://www.thethingsnetwork.org/forum/t/downlink-command-lht65n-not-working/61603
-- =============================================================================

-- ── LHT65 ─────────────────────────────────────────────────────────────────────
-- Fixes:
--   • set_tdc: encoding u32be → u24be (Dragino TDC = 0x01 + 3 bytes)
--   • set_confirmed_uplinks: hex_template "3401" → "34{confirmed_byte}"
--   • request_status: 04FF (RESET!) → 2601 (actual status request on LHT65)
--   • config_port stays 3 (confirmed correct for LHT65N)
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
      "hex_template": "01{seconds_3byte_hex}",
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
      "hex_template": "34{confirmed_byte}",
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
      "description": "Device will respond with its current configuration on the next uplink (fPort 5).",
      "hex_template": "2601",
      "category": "action",
      "fields": []
    }
  ]
}'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LHT65';

-- ── LDS02 ─────────────────────────────────────────────────────────────────────
-- Fixes:
--   • config_port: 3 → 10 (LDS02 downlinks use fPort 10)
--   • set_tdc: encoding u32be → u24be
--   • set_open_alarm: 0x02 (EDC!) → 0xA9 (TTRIG)
--     TTRIG format: A9 + enable(1 byte) + seconds(2 bytes big-endian)
--     Example: A9 01 00 1E = enable alarm, 30 seconds
--   • request_status 04FF removed (that is RESET!)
--   • Added properly labeled reset_device with dangerous flag
UPDATE sensor_catalog
SET downlink_info = '{
  "supports_remote_config": true,
  "config_port": 10,
  "commands": [
    {
      "key": "set_tdc",
      "name": "How often this sensor reports",
      "description": "The sensor sends a heartbeat at this interval even if nothing changes.",
      "hex_template": "01{seconds_3byte_hex}",
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
          "inputTransform": "minutes_to_seconds"
        }
      ]
    },
    {
      "key": "set_open_alarm",
      "name": "Alert if door stays open longer than",
      "description": "You will get an alert if a door is left open beyond this time. Uses AT+TTRIG.",
      "hex_template": "A9{enable_byte}{seconds_2byte_hex}",
      "category": "alarm",
      "fields": [
        {
          "name": "enabled",
          "label": "Door open alarm",
          "type": "boolean",
          "default": true,
          "control": "toggle",
          "trueLabel": "Enabled",
          "falseLabel": "Disabled",
          "encoding": "bool01"
        },
        {
          "name": "minutes",
          "label": "Minutes",
          "type": "integer",
          "unit": "min",
          "min": 1,
          "max": 1080,
          "default": 5,
          "step": 1,
          "control": "number",
          "encoding": "u16be",
          "inputTransform": "minutes_to_seconds"
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
      "key": "reset_device",
      "name": "Reset device",
      "description": "Factory-resets the LDS02. The device will rejoin the network.",
      "hex_template": "04FF",
      "category": "action",
      "fields": [],
      "confirmation": "This will factory-reset the sensor. It will rejoin the network and all settings will be lost. Continue?",
      "dangerous": true
    }
  ]
}'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LDS02';
