-- ============================================================
-- SENSOR CATALOG - Master Reference Library
-- ============================================================

CREATE TABLE IF NOT EXISTS sensor_catalog (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer        text NOT NULL,
  model               text NOT NULL,
  model_variant       text,
  display_name        text NOT NULL,
  sensor_kind         text NOT NULL DEFAULT 'temp'
                      CONSTRAINT sensor_catalog_kind_check CHECK (
                        sensor_kind IN (
                          'temp', 'temp_humidity', 'door', 'combo', 'co2', 'leak', 'gps',
                          'pulse', 'soil', 'air_quality', 'vibration',
                          'meter', 'tilt'
                        )
                      ),
  description         text,
  frequency_bands     text[] DEFAULT '{US915}',
  lorawan_version     text DEFAULT '1.0.3',
  regional_params     text DEFAULT 'RP001-1.0.3-RevA',
  supports_otaa       boolean DEFAULT true,
  supports_abp        boolean DEFAULT false,
  supports_class      text DEFAULT 'A',
  f_ports             jsonb DEFAULT '[]'::jsonb,
  decoded_fields      jsonb DEFAULT '[]'::jsonb,
  sample_payloads     jsonb DEFAULT '[]'::jsonb,
  decoder_js          text,
  decoder_python      text,
  decoder_source_url  text,
  decoder_provenance  jsonb DEFAULT '{}'::jsonb,
  sample_payload_provenance jsonb DEFAULT '{}'::jsonb,
  decoder_test_vectors jsonb DEFAULT '[]'::jsonb,
  uplink_info         jsonb DEFAULT '{}'::jsonb,
  battery_info        jsonb DEFAULT '{}'::jsonb,
  downlink_info       jsonb DEFAULT '{}'::jsonb,
  image_url           text,
  datasheet_url       text,
  product_url         text,
  ttn_device_repo_id  text,
  is_supported        boolean DEFAULT true,
  is_visible          boolean DEFAULT true,
  sort_order          integer DEFAULT 0,
  tags                text[] DEFAULT '{}',
  notes               text,
  revision            integer NOT NULL DEFAULT 1,
  deprecated_at       timestamptz,
  deprecated_reason   text,
  decode_mode         text DEFAULT 'ttn' CHECK (decode_mode IN ('ttn', 'trust', 'app', 'off')),
  temperature_unit    text DEFAULT 'C' CHECK (temperature_unit IN ('C', 'F')),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  created_by          uuid
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_manufacturer ON sensor_catalog(manufacturer);
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_kind ON sensor_catalog(sensor_kind);
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_supported ON sensor_catalog(is_supported) WHERE is_supported = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensor_catalog_mfr_model ON sensor_catalog(manufacturer, model, COALESCE(model_variant, ''));

CREATE INDEX IF NOT EXISTS idx_sensor_catalog_search ON sensor_catalog
  USING gin(to_tsvector('english',
    coalesce(manufacturer,'') || ' ' ||
    coalesce(model,'') || ' ' ||
    coalesce(display_name,'') || ' ' ||
    coalesce(description,'')
  ));

-- Trigger for updated_at + revision
CREATE OR REPLACE FUNCTION update_sensor_catalog_on_change()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = OLD.revision + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sensor_catalog_on_change ON sensor_catalog;
CREATE TRIGGER trg_sensor_catalog_on_change
  BEFORE UPDATE ON sensor_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_sensor_catalog_on_change();

-- RLS
ALTER TABLE sensor_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can read all" ON sensor_catalog;
CREATE POLICY "Super admins can read all" ON sensor_catalog
  FOR SELECT USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can insert" ON sensor_catalog;
CREATE POLICY "Super admins can insert" ON sensor_catalog
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update" ON sensor_catalog;
CREATE POLICY "Super admins can update" ON sensor_catalog
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can delete" ON sensor_catalog;
CREATE POLICY "Super admins can delete" ON sensor_catalog
  FOR DELETE USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read visible" ON sensor_catalog;
CREATE POLICY "Authenticated users can read visible" ON sensor_catalog
  FOR SELECT USING (auth.role() = 'authenticated' AND is_visible = true AND deprecated_at IS NULL);

-- Seed data with proper UUIDs
INSERT INTO sensor_catalog (
  manufacturer, model, display_name, sensor_kind, description,
  frequency_bands, lorawan_version, supports_otaa, supports_class,
  f_ports, decoded_fields, uplink_info, battery_info, tags, sort_order, notes
) VALUES
('Dragino', 'LHT65', 'Dragino LHT65 Temperature & Humidity Sensor', 'temp',
 'Indoor LoRaWAN temperature and humidity sensor with external probe option.',
 '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
 '[{"port": 2, "direction": "up", "description": "Periodic telemetry uplink", "is_default": true}]'::jsonb,
 '[{"field": "temperature_c", "type": "number", "unit": "°C", "range": [-40, 125], "description": "Internal temperature"}]'::jsonb,
 '{"default_interval_s": 600}'::jsonb,
 '{"type": "2x AAA", "chemistry": "lithium", "expected_life_years": 2}'::jsonb,
 '{"refrigeration","temperature","humidity"}', 10, 'Primary sensor for cooler/freezer monitoring.'),
('Dragino', 'LDS02', 'Dragino LDS02 Door/Window Sensor', 'door',
 'LoRaWAN magnetic contact sensor for door open/close detection.',
 '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
 '[{"port": 2, "direction": "up", "description": "Door event uplink", "is_default": true}]'::jsonb,
 '[{"field": "door_open", "type": "boolean", "unit": null, "range": null, "description": "Door state"}]'::jsonb,
 '{"default_interval_s": 7200, "event_driven": true}'::jsonb,
 '{"type": "2x AAA", "chemistry": "lithium", "expected_life_years": 3}'::jsonb,
 '{"door","contact","magnetic"}', 20, 'Primary door sensor for walk-in monitoring.'),
('Elsys', 'ERS CO2', 'Elsys ERS CO2 Multi-Sensor', 'co2',
 'Premium indoor environmental sensor measuring CO2, temperature, humidity.',
 '{US915,EU868}', '1.0.3', true, 'A',
 '[{"port": 5, "direction": "up", "description": "Telemetry uplink", "is_default": true}]'::jsonb,
 '[{"field": "co2_ppm", "type": "number", "unit": "ppm", "range": [0, 10000], "description": "CO2 concentration"}]'::jsonb,
 '{"default_interval_s": 600}'::jsonb,
 '{"type": "2x AA", "chemistry": "lithium", "expected_life_years": 5}'::jsonb,
 '{"co2","air-quality","ventilation"}', 30, 'For kitchen air quality compliance monitoring.'),
('Dragino', 'LWL02', 'Dragino LWL02 Water Leak Detector', 'leak',
 'LoRaWAN water leak sensor with probe contacts.',
 '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
 '[{"port": 2, "direction": "up", "description": "Leak status uplink", "is_default": true}]'::jsonb,
 '[{"field": "leak_detected", "type": "boolean", "unit": null, "range": null, "description": "Water detected"}]'::jsonb,
 '{"default_interval_s": 7200, "event_driven": true}'::jsonb,
 '{"type": "2x AAA", "chemistry": "lithium", "expected_life_years": 3}'::jsonb,
 '{"leak","water","flood"}', 50, 'Detect water leaks near refrigeration equipment.')
ON CONFLICT (manufacturer, model, COALESCE(model_variant, '')) DO NOTHING;

-- Public view
CREATE OR REPLACE VIEW sensor_catalog_public AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, f_ports, decoded_fields, uplink_info,
  battery_info, is_supported, tags, decode_mode, temperature_unit
FROM sensor_catalog
WHERE is_visible = true AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;

-- Search function
CREATE OR REPLACE FUNCTION search_sensor_catalog(search_term text)
RETURNS SETOF sensor_catalog AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM sensor_catalog
  WHERE
    to_tsvector('english', coalesce(manufacturer,'') || ' ' || coalesce(model,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(description,''))
    @@ plainto_tsquery('english', search_term)
    OR manufacturer ILIKE '%' || search_term || '%'
    OR model ILIKE '%' || search_term || '%'
    OR search_term = ANY(tags)
  ORDER BY sort_order, manufacturer, model;
END;
$$ LANGUAGE plpgsql STABLE;