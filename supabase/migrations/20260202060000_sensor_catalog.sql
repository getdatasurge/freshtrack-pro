-- ============================================================
-- SENSOR CATALOG - Master Reference Library
-- FrostGuard Admin: Centralized sensor model reference
-- Platform-global table (no org_id). Writes restricted to
-- super admins via is_super_admin(). Org users get read-only.
-- ============================================================

-- NOTE: We intentionally use text + CHECK instead of the
-- sensor_kind enum. Enums in Postgres can't be removed/reordered
-- and cause migration pain long-term. Text with CHECK is equally
-- fast with an index and fully reversible.

-- ============================================================
-- SENSOR_CATALOG table
-- ============================================================
CREATE TABLE IF NOT EXISTS sensor_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  manufacturer        text NOT NULL,
  model               text NOT NULL,
  model_variant       text,
  display_name        text NOT NULL,
  sensor_kind         text NOT NULL DEFAULT 'temp'
                      CONSTRAINT sensor_catalog_kind_check CHECK (
                        sensor_kind IN (
                          'temp', 'door', 'combo', 'co2', 'leak', 'gps',
                          'pulse', 'soil', 'air_quality', 'vibration',
                          'meter', 'tilt'
                        )
                      ),
  description         text,

  -- LoRaWAN Configuration
  frequency_bands     text[] DEFAULT '{US915}',
  lorawan_version     text DEFAULT '1.0.3',
  regional_params     text DEFAULT 'RP001-1.0.3-RevA',
  supports_otaa       boolean DEFAULT true,
  supports_abp        boolean DEFAULT false,
  supports_class      text DEFAULT 'A',

  -- Port & Payload Info
  f_ports             jsonb DEFAULT '[]'::jsonb,

  -- Decoded Field Definitions
  decoded_fields      jsonb DEFAULT '[]'::jsonb,

  -- Sample Payloads (the library)
  sample_payloads     jsonb DEFAULT '[]'::jsonb,

  -- Decoder
  decoder_js          text,
  decoder_python      text,
  decoder_source_url  text,

  -- Provenance: where did the decoder come from?
  -- {source: "ttn_device_repo"|"vendor_github"|"internal",
  --  url: "https://...", commit_sha: "abc123", retrieved_at: "2025-12-01"}
  decoder_provenance  jsonb DEFAULT '{}'::jsonb,

  -- Provenance: where did sample payloads come from?
  -- {source: "live_uplink"|"vendor_docs"|"synthetic",
  --  device_eui: "...", captured_at: "2025-12-01"}
  sample_payload_provenance jsonb DEFAULT '{}'::jsonb,

  -- Test vectors: verify decoder correctness
  -- [{raw_hex: "CBF1...", f_port: 2, expected_decoded: {...}}]
  decoder_test_vectors jsonb DEFAULT '[]'::jsonb,

  -- Uplink Behavior
  uplink_info         jsonb DEFAULT '{}'::jsonb,

  -- Battery
  battery_info        jsonb DEFAULT '{}'::jsonb,

  -- Downlink / Configuration
  downlink_info       jsonb DEFAULT '{}'::jsonb,

  -- External References
  image_url           text,
  datasheet_url       text,
  product_url         text,
  ttn_device_repo_id  text,

  -- Admin & Versioning
  is_supported        boolean DEFAULT true,
  is_visible          boolean DEFAULT true,      -- soft-delete: set false instead of DELETE
  sort_order          integer DEFAULT 0,
  tags                text[] DEFAULT '{}',
  notes               text,
  revision            integer NOT NULL DEFAULT 1, -- bumped on each edit
  deprecated_at       timestamptz,                -- when this model was retired
  deprecated_reason   text,                       -- why it was deprecated

  -- Timestamps
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  created_by          uuid                        -- references auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_manufacturer ON sensor_catalog(manufacturer);
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_kind ON sensor_catalog(sensor_kind);
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_supported ON sensor_catalog(is_supported) WHERE is_supported = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_catalog_mfr_model ON sensor_catalog(manufacturer, model, COALESCE(model_variant, ''));

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_search ON sensor_catalog
  USING gin(to_tsvector('english',
    coalesce(manufacturer,'') || ' ' ||
    coalesce(model,'') || ' ' ||
    coalesce(display_name,'') || ' ' ||
    coalesce(description,'')
  ));

-- Updated_at + auto-bump revision trigger
CREATE OR REPLACE FUNCTION update_sensor_catalog_on_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Auto-increment revision on any content change
  NEW.revision = OLD.revision + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sensor_catalog_updated_at ON sensor_catalog;
CREATE TRIGGER trg_sensor_catalog_on_change
  BEFORE UPDATE ON sensor_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_sensor_catalog_on_change();

-- ============================================================
-- RLS: Uses existing is_super_admin() from platform_roles
--
-- Super admins (checked via is_super_admin(auth.uid())) get
-- full CRUD. All authenticated users get read-only on visible
-- entries. No service_role check needed — service_role bypasses
-- RLS entirely in Supabase by default.
-- ============================================================
ALTER TABLE sensor_catalog ENABLE ROW LEVEL SECURITY;

-- Super admins: full read access (including hidden/deprecated)
DROP POLICY IF EXISTS "Super admins can read all" ON sensor_catalog;
CREATE POLICY "Super admins can read all" ON sensor_catalog
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Super admins: insert
DROP POLICY IF EXISTS "Super admins can insert" ON sensor_catalog;
CREATE POLICY "Super admins can insert" ON sensor_catalog
  FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admins: update
DROP POLICY IF EXISTS "Super admins can update" ON sensor_catalog;
CREATE POLICY "Super admins can update" ON sensor_catalog
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admins: delete (prefer soft-delete via is_visible, but allow hard delete)
DROP POLICY IF EXISTS "Super admins can delete" ON sensor_catalog;
CREATE POLICY "Super admins can delete" ON sensor_catalog
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Authenticated org users: read-only, visible + non-deprecated only
DROP POLICY IF EXISTS "Authenticated users can read visible" ON sensor_catalog;
CREATE POLICY "Authenticated users can read visible" ON sensor_catalog
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND is_visible = true
    AND deprecated_at IS NULL
  );

-- ============================================================
-- SEED DATA: Core sensors for FrostGuard
-- ============================================================

INSERT INTO sensor_catalog (
  manufacturer, model, model_variant, display_name, sensor_kind, description,
  frequency_bands, lorawan_version, supports_otaa, supports_class,
  f_ports, decoded_fields, sample_payloads, uplink_info, battery_info, downlink_info,
  decoder_js, tags, sort_order, notes
) VALUES

-- DRAGINO LHT65
(
  'Dragino', 'LHT65', NULL,
  'Dragino LHT65 Temperature & Humidity Sensor',
  'temp',
  'Indoor LoRaWAN temperature and humidity sensor with external probe option. Ideal for walk-in coolers, freezers, and dry storage monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  '[
    {"port": 2, "direction": "up", "description": "Periodic telemetry uplink (temp, humidity, battery)", "is_default": true},
    {"port": 4, "direction": "up", "description": "Alarm uplink (threshold exceeded)"},
    {"port": 3, "direction": "down", "description": "Configuration downlink"}
  ]'::jsonb,
  '[
    {"field": "temperature_c", "type": "number", "unit": "°C", "range": [-40, 125], "description": "Internal SHT20 temperature sensor"},
    {"field": "ext_temperature_c", "type": "number", "unit": "°C", "range": [-40, 125], "description": "External probe temperature (if connected)"},
    {"field": "humidity_pct", "type": "number", "unit": "%", "range": [0, 100], "description": "Relative humidity from SHT20"},
    {"field": "battery_v", "type": "number", "unit": "V", "range": [2.1, 3.6], "description": "Battery voltage (2x AAA)"},
    {"field": "ext_sensor_type", "type": "string", "unit": null, "range": null, "description": "External sensor type: 0=none, 1=DS18B20, 4=interrupt"}
  ]'::jsonb,
  '[
    {
      "scenario": "Walk-in cooler — normal operation",
      "f_port": 2,
      "raw_hex": "CBF10B0A0175FF",
      "decoded": {"temperature_c": 3.85, "humidity_pct": 78.5, "ext_temperature_c": 4.21, "battery_v": 3.055, "ext_sensor_type": "DS18B20"},
      "notes": "Normal cooler temp range 33–40°F. Battery healthy."
    },
    {
      "scenario": "Walk-in freezer — normal operation",
      "f_port": 2,
      "raw_hex": "CB8F0964FEE8FF",
      "decoded": {"temperature_c": -18.5, "humidity_pct": 45.0, "ext_temperature_c": -20.1, "battery_v": 2.980, "ext_sensor_type": "DS18B20"},
      "notes": "Normal freezer range -10 to 0°F. Cold affects battery voltage."
    },
    {
      "scenario": "Temperature alarm — door left open",
      "f_port": 4,
      "raw_hex": "CB0F0C1E0295FF",
      "decoded": {"temperature_c": 12.8, "humidity_pct": 92.0, "ext_temperature_c": 15.5, "battery_v": 3.055, "ext_sensor_type": "DS18B20"},
      "notes": "ALARM: Cooler temp spiked — likely door left open. Humidity rising."
    },
    {
      "scenario": "Low battery warning",
      "f_port": 2,
      "raw_hex": "CA2F0A780140FF",
      "decoded": {"temperature_c": 4.2, "humidity_pct": 71.0, "ext_temperature_c": 4.5, "battery_v": 2.350, "ext_sensor_type": "DS18B20"},
      "notes": "Battery below 2.5V threshold — replace soon."
    },
    {
      "scenario": "No external probe connected",
      "f_port": 2,
      "raw_hex": "CBF10B0A007FFF",
      "decoded": {"temperature_c": 22.1, "humidity_pct": 55.0, "ext_temperature_c": null, "battery_v": 3.055, "ext_sensor_type": "none"},
      "notes": "Internal sensor only. Ext reads 0x7FFF = no probe."
    }
  ]'::jsonb,
  '{"encoding": "proprietary", "default_interval_s": 600, "min_interval_s": 60, "max_interval_s": 86400, "max_payload_bytes": 11, "confirmed_uplinks": false, "adaptive_data_rate": true}'::jsonb,
  '{"type": "2x AAA", "chemistry": "lithium", "voltage_nominal": 3.0, "voltage_range": [2.1, 3.6], "expected_life_years": 2, "low_threshold_v": 2.5, "reporting_format": "millivolts_div10"}'::jsonb,
  '{"supports_remote_config": true, "config_port": 3, "commands": [{"name": "Set Reporting Interval", "hex_template": "01{seconds_4byte_hex}", "description": "Set TDC in seconds"}, {"name": "Request Device Status", "hex_template": "04FF", "description": "Device responds with status on next uplink"}, {"name": "Set Temp Alarm High", "hex_template": "02{temp_2byte_hex}", "description": "Set high temp alarm threshold"}, {"name": "Set Temp Alarm Low", "hex_template": "03{temp_2byte_hex}", "description": "Set low temp alarm threshold"}]}'::jsonb,
  E'function decodeUplink(input) {\n  var bytes = input.bytes;\n  var port = input.fPort;\n  var data = {};\n\n  if (port === 2 || port === 4) {\n    var bat_v = ((bytes[0] << 8 | bytes[1]) >> 6) / 10;\n    data.battery_v = bat_v;\n\n    var temp_int = ((bytes[2] << 8 | bytes[3]) & 0xFFFF);\n    if (temp_int > 32767) temp_int -= 65536;\n    data.temperature_c = temp_int / 100;\n\n    data.humidity_pct = ((bytes[4] << 8 | bytes[5]) & 0xFFFF) / 10;\n\n    var ext_type = (bytes[0] << 8 | bytes[1]) & 0x3F;\n    if (ext_type === 1) {\n      var ext_temp = ((bytes[7] << 8 | bytes[8]) & 0xFFFF);\n      if (ext_temp > 32767) ext_temp -= 65536;\n      data.ext_temperature_c = ext_temp / 100;\n      data.ext_sensor_type = "DS18B20";\n    } else {\n      data.ext_sensor_type = "none";\n    }\n  }\n\n  return { data: data };\n}',
  '{"refrigeration","food-safety","cold-chain","temperature","humidity","probe"}',
  10,
  'Primary sensor for FrostGuard cooler/freezer monitoring. Most widely deployed.'
),

-- DRAGINO LDS02
(
  'Dragino', 'LDS02', NULL,
  'Dragino LDS02 Door/Window Sensor',
  'door',
  'LoRaWAN magnetic contact sensor for door open/close detection. Tracks door state, open count, and open duration. Critical for walk-in cooler/freezer door monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  '[
    {"port": 2, "direction": "up", "description": "Door event uplink (state change)", "is_default": true},
    {"port": 10, "direction": "up", "description": "Heartbeat / periodic status"},
    {"port": 3, "direction": "down", "description": "Configuration downlink"}
  ]'::jsonb,
  '[
    {"field": "door_open", "type": "boolean", "unit": null, "range": null, "description": "true = door open, false = door closed"},
    {"field": "open_count", "type": "number", "unit": "count", "range": [0, 65535], "description": "Total door open events since reset"},
    {"field": "open_duration_s", "type": "number", "unit": "seconds", "range": [0, 16777215], "description": "Last open duration in seconds"},
    {"field": "battery_v", "type": "number", "unit": "V", "range": [2.1, 3.6], "description": "Battery voltage"}
  ]'::jsonb,
  '[
    {"scenario": "Door opened — walk-in cooler", "f_port": 2, "raw_hex": "0BD301000A00001E", "decoded": {"door_open": true, "open_count": 10, "open_duration_s": 0, "battery_v": 3.027}, "notes": "Door just opened. Count shows 10th opening today."},
    {"scenario": "Door closed — short access", "f_port": 2, "raw_hex": "0BD300000A00000F", "decoded": {"door_open": false, "open_count": 10, "open_duration_s": 15, "battery_v": 3.027}, "notes": "Door closed after 15-second access. Normal kitchen activity."},
    {"scenario": "Door stuck open — alarm condition", "f_port": 2, "raw_hex": "0BD301000B000384", "decoded": {"door_open": true, "open_count": 11, "open_duration_s": 900, "battery_v": 3.027}, "notes": "ALARM: Door open for 15 minutes. Temperature likely rising."},
    {"scenario": "Heartbeat — door closed, healthy", "f_port": 10, "raw_hex": "0BD300000B00000F", "decoded": {"door_open": false, "open_count": 11, "open_duration_s": 15, "battery_v": 3.027}, "notes": "Periodic heartbeat. Everything normal."}
  ]'::jsonb,
  '{"encoding": "proprietary", "default_interval_s": 7200, "min_interval_s": 60, "max_interval_s": 86400, "max_payload_bytes": 8, "confirmed_uplinks": false, "event_driven": true, "event_types": ["door_open", "door_close", "heartbeat"]}'::jsonb,
  '{"type": "2x AAA", "chemistry": "lithium", "voltage_nominal": 3.0, "voltage_range": [2.1, 3.6], "expected_life_years": 3, "low_threshold_v": 2.5, "reporting_format": "millivolts_div10"}'::jsonb,
  '{"supports_remote_config": true, "config_port": 3, "commands": [{"name": "Set Heartbeat Interval", "hex_template": "01{seconds_4byte_hex}", "description": "Set keepalive interval"}, {"name": "Set Open Alarm Time", "hex_template": "02{minutes_2byte_hex}", "description": "Alert if door open longer than N minutes"}, {"name": "Reset Open Count", "hex_template": "04FF", "description": "Reset the cumulative open counter"}]}'::jsonb,
  E'function decodeUplink(input) {\n  var bytes = input.bytes;\n  var data = {};\n\n  data.battery_v = ((bytes[0] << 8) | bytes[1]) / 1000;\n  data.door_open = (bytes[2] & 0x01) === 1;\n  data.open_count = (bytes[3] << 8) | bytes[4];\n  data.open_duration_s = (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];\n\n  return { data: data };\n}',
  '{"refrigeration","food-safety","cold-chain","door","contact","magnetic"}',
  20,
  'Primary door sensor for FrostGuard. Paired with LHT65 per walk-in unit.'
),

-- ELSYS ERS CO2
(
  'Elsys', 'ERS CO2', NULL,
  'Elsys ERS CO2 Multi-Sensor',
  'co2',
  'Premium indoor environmental sensor measuring CO2, temperature, humidity, light, and motion. Useful for kitchen ventilation monitoring and indoor air quality compliance.',
  '{US915,EU868}', '1.0.3', true, 'A',
  '[
    {"port": 5, "direction": "up", "description": "Telemetry uplink (all sensor values)", "is_default": true},
    {"port": 6, "direction": "down", "description": "Configuration downlink"}
  ]'::jsonb,
  '[
    {"field": "temperature_c", "type": "number", "unit": "°C", "range": [-40, 85], "description": "Ambient temperature"},
    {"field": "humidity_pct", "type": "number", "unit": "%", "range": [0, 100], "description": "Relative humidity"},
    {"field": "co2_ppm", "type": "number", "unit": "ppm", "range": [0, 10000], "description": "CO2 concentration (NDIR sensor)"},
    {"field": "light_lux", "type": "number", "unit": "lux", "range": [0, 65535], "description": "Ambient light level"},
    {"field": "motion_count", "type": "number", "unit": "count", "range": [0, 255], "description": "PIR motion events since last uplink"},
    {"field": "battery_v", "type": "number", "unit": "V", "range": [2.1, 3.6], "description": "Battery voltage"}
  ]'::jsonb,
  '[
    {"scenario": "Normal kitchen — good ventilation", "f_port": 5, "decoded": {"temperature_c": 23.0, "humidity_pct": 41, "co2_ppm": 776, "light_lux": 39, "motion_count": 6, "battery_v": 3.563}, "notes": "CO2 under 1000ppm — ventilation adequate."},
    {"scenario": "Busy kitchen — high CO2", "f_port": 5, "decoded": {"temperature_c": 28.5, "humidity_pct": 68, "co2_ppm": 2150, "light_lux": 320, "motion_count": 45, "battery_v": 3.540}, "notes": "ALERT: CO2 above 2000ppm during peak service."},
    {"scenario": "Closed restaurant — overnight", "f_port": 5, "decoded": {"temperature_c": 19.2, "humidity_pct": 35, "co2_ppm": 420, "light_lux": 0, "motion_count": 0, "battery_v": 3.570}, "notes": "Baseline readings. Near outdoor CO2 levels."}
  ]'::jsonb,
  '{"encoding": "elsys_proprietary", "default_interval_s": 600, "min_interval_s": 60, "max_interval_s": 86400, "max_payload_bytes": 20, "confirmed_uplinks": false, "adaptive_data_rate": true}'::jsonb,
  '{"type": "2x AA", "chemistry": "lithium", "voltage_nominal": 3.6, "voltage_range": [2.8, 3.6], "expected_life_years": 5, "low_threshold_v": 3.0, "reporting_format": "millivolts"}'::jsonb,
  '{"supports_remote_config": true, "config_port": 6, "commands": [{"name": "Set Reporting Interval", "hex_template": "3E{seconds_2byte_hex}", "description": "Set sample period in seconds"}]}'::jsonb,
  NULL,
  '{"indoor","air-quality","co2","ventilation","kitchen","compliance"}',
  30,
  'Premium multi-sensor. Consider for kitchen air quality compliance monitoring.'
),

-- NETVOX R311A
(
  'Netvox', 'R311A', NULL,
  'Netvox R311A Wireless Door/Window Sensor',
  'door',
  'Compact LoRaWAN door/window contact sensor. Simple open/close detection with battery reporting.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  '[{"port": 1, "direction": "up", "description": "Status report / door event", "is_default": true}]'::jsonb,
  '[
    {"field": "door_open", "type": "boolean", "unit": null, "range": null, "description": "true = contact open (door open)"},
    {"field": "battery_v", "type": "number", "unit": "V", "range": [2.1, 3.6], "description": "Battery voltage"},
    {"field": "alarm", "type": "boolean", "unit": null, "range": null, "description": "Tamper or sustained open alarm"}
  ]'::jsonb,
  '[
    {"scenario": "Door opened", "f_port": 1, "decoded": {"door_open": true, "battery_v": 3.2, "alarm": false}, "notes": "Normal door open event."},
    {"scenario": "Door closed", "f_port": 1, "decoded": {"door_open": false, "battery_v": 3.2, "alarm": false}, "notes": "Normal door close event."}
  ]'::jsonb,
  '{"encoding": "netvox_proprietary", "default_interval_s": 3600, "event_driven": true}'::jsonb,
  '{"type": "CR2450", "chemistry": "lithium", "voltage_nominal": 3.0, "voltage_range": [2.1, 3.0], "expected_life_years": 3}'::jsonb,
  '{"supports_remote_config": false}'::jsonb,
  NULL,
  '{"door","contact","window","simple"}',
  40,
  'Budget-friendly door sensor alternative. No remote config support.'
),

-- DRAGINO LWL02
(
  'Dragino', 'LWL02', NULL,
  'Dragino LWL02 Water Leak Detector',
  'leak',
  'LoRaWAN water leak sensor with probe contacts. Detects water presence near walk-in coolers, ice machines, and drain lines.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  '[
    {"port": 2, "direction": "up", "description": "Leak status uplink", "is_default": true},
    {"port": 10, "direction": "up", "description": "Heartbeat"},
    {"port": 3, "direction": "down", "description": "Configuration"}
  ]'::jsonb,
  '[
    {"field": "leak_detected", "type": "boolean", "unit": null, "range": null, "description": "true = water detected on probe contacts"},
    {"field": "leak_count", "type": "number", "unit": "count", "range": [0, 65535], "description": "Total leak events since reset"},
    {"field": "battery_v", "type": "number", "unit": "V", "range": [2.1, 3.6], "description": "Battery voltage"}
  ]'::jsonb,
  '[
    {"scenario": "Water leak detected under cooler", "f_port": 2, "decoded": {"leak_detected": true, "leak_count": 1, "battery_v": 3.1}, "notes": "ALARM: Water on floor under walk-in."},
    {"scenario": "Leak cleared", "f_port": 2, "decoded": {"leak_detected": false, "leak_count": 1, "battery_v": 3.1}, "notes": "Water dried / cleaned up. Leak condition cleared."},
    {"scenario": "Heartbeat — no leak", "f_port": 10, "decoded": {"leak_detected": false, "leak_count": 0, "battery_v": 3.2}, "notes": "All clear. Periodic check-in."}
  ]'::jsonb,
  '{"encoding": "proprietary", "default_interval_s": 7200, "event_driven": true}'::jsonb,
  '{"type": "2x AAA", "chemistry": "lithium", "voltage_nominal": 3.0, "expected_life_years": 3}'::jsonb,
  '{"supports_remote_config": true, "config_port": 3}'::jsonb,
  NULL,
  '{"leak","water","flood","drain","ice-machine","condensation"}',
  50,
  'Detect water leaks near refrigeration equipment, ice machines, and drain lines.'
)

ON CONFLICT (manufacturer, model, COALESCE(model_variant, '')) DO NOTHING;

-- ============================================================
-- VIEW: Simplified sensor catalog for org-level access
-- Excludes internal fields (provenance, notes, test vectors)
-- Only shows visible, non-deprecated entries
-- ============================================================
CREATE OR REPLACE VIEW sensor_catalog_public AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, f_ports, decoded_fields, uplink_info,
  battery_info, is_supported, tags
FROM sensor_catalog
WHERE is_visible = true
  AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;

-- ============================================================
-- FUNCTION: Search sensor catalog
-- ============================================================
CREATE OR REPLACE FUNCTION search_sensor_catalog(search_term text)
RETURNS SETOF sensor_catalog AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM sensor_catalog
  WHERE
    to_tsvector('english',
      coalesce(manufacturer,'') || ' ' ||
      coalesce(model,'') || ' ' ||
      coalesce(display_name,'') || ' ' ||
      coalesce(description,'')
    ) @@ plainto_tsquery('english', search_term)
    OR manufacturer ILIKE '%' || search_term || '%'
    OR model ILIKE '%' || search_term || '%'
    OR search_term = ANY(tags)
  ORDER BY sort_order, manufacturer, model;
END;
$$ LANGUAGE plpgsql STABLE;
