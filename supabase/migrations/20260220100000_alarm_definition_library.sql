-- ============================================================
-- ALARM DEFINITION LIBRARY - FrostGuard
-- Single source of truth for all alarm types
-- Purely additive — does NOT modify any existing tables
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTEND sensor_kind ENUM (backward-compatible)
-- ────────────────────────────────────────────────────────────

ALTER TYPE sensor_kind ADD VALUE IF NOT EXISTS 'co2';
ALTER TYPE sensor_kind ADD VALUE IF NOT EXISTS 'leak';
ALTER TYPE sensor_kind ADD VALUE IF NOT EXISTS 'tvoc';

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE alarm_category AS ENUM (
  'temperature',
  'door',
  'environmental',
  'sensor_health',
  'security',
  'compliance'
);

CREATE TYPE alarm_subcategory AS ENUM (
  -- Temperature subcategories
  'refrigerator',
  'freezer',
  'hot_holding',
  'walk_in_cooler',
  'walk_in_freezer',
  'prep_table',
  'general_temp',
  -- Door subcategories
  'door_state',
  'door_behavior',
  'door_conflict',
  -- Environmental subcategories
  'humidity',
  'air_quality',
  'tvoc',
  'water',
  'ambient',
  -- Sensor Health subcategories
  'battery',
  'signal',
  'connectivity',
  'data_integrity',
  'calibration',
  'gateway',
  -- Security subcategories
  'physical',
  'access',
  -- Compliance subcategories
  'haccp',
  'maintenance',
  'escalation'
);

CREATE TYPE alarm_severity AS ENUM (
  'info',
  'normal',
  'warning',
  'critical',
  'emergency'
);

CREATE TYPE detection_tier AS ENUM (
  'T1',
  'T2',
  'T3',
  'T4',
  'T5'
);

CREATE TYPE alarm_unit_type AS ENUM (
  'refrigerator',
  'freezer',
  'walk_in_cooler',
  'walk_in_freezer',
  'prep_table',
  'hot_holding',
  'any'
);

CREATE TYPE alarm_sensor_type AS ENUM (
  'temp',
  'door',
  'combo',
  'leak',
  'co2',
  'humidity',
  'motion',
  'tvoc',
  'gateway',
  'any'
);

-- ────────────────────────────────────────────────────────────
-- CORE TABLE: alarm_definitions
-- ────────────────────────────────────────────────────────────

CREATE TABLE alarm_definitions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,
  display_name          text NOT NULL,
  description           text NOT NULL,
  short_description     text,
  category              alarm_category NOT NULL,
  subcategory           alarm_subcategory NOT NULL,
  severity              alarm_severity NOT NULL DEFAULT 'warning',
  sort_order            integer NOT NULL DEFAULT 0,
  detection_tier        detection_tier NOT NULL DEFAULT 'T1',
  required_sensors      text NOT NULL,
  confidence_level      text NOT NULL DEFAULT 'Definitive',
  what_we_observe       text NOT NULL,
  what_it_might_mean    text,
  applicable_unit_types alarm_unit_type[] NOT NULL DEFAULT '{any}',
  applicable_sensor_types alarm_sensor_type[] NOT NULL DEFAULT '{any}',
  threshold_min         numeric,
  threshold_max         numeric,
  threshold_unit        text,
  duration_minutes      integer,
  cooldown_minutes      integer DEFAULT 30,
  eval_field            text,
  eval_logic            text,
  eval_params           jsonb DEFAULT '{}',
  notification_template text,
  notification_channels text[] DEFAULT '{in_app}',
  requires_corrective_action boolean DEFAULT false,
  corrective_action_text     text,
  haccp_category             text,
  regulatory_reference       text,
  escalation_minutes    integer,
  escalation_to         text,
  emulator_enabled      boolean DEFAULT true,
  emulator_payload      jsonb,
  ai_hints              text[] DEFAULT '{}',
  enabled_by_default    boolean DEFAULT true,
  is_system             boolean DEFAULT true,
  icon_name             text,
  color                 text,
  tags                  text[] DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- OVERRIDE TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE alarm_org_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id   uuid NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
  org_id                text NOT NULL,
  enabled               boolean,
  severity_override     alarm_severity,
  threshold_min         numeric,
  threshold_max         numeric,
  duration_minutes      integer,
  cooldown_minutes      integer,
  escalation_minutes    integer,
  notification_channels text[],
  custom_corrective_action text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(alarm_definition_id, org_id)
);

CREATE TABLE alarm_site_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id   uuid NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
  org_id                text NOT NULL,
  site_id               text NOT NULL,
  enabled               boolean,
  severity_override     alarm_severity,
  threshold_min         numeric,
  threshold_max         numeric,
  duration_minutes      integer,
  cooldown_minutes      integer,
  escalation_minutes    integer,
  notification_channels text[],
  custom_corrective_action text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(alarm_definition_id, org_id, site_id)
);

CREATE TABLE alarm_unit_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id   uuid NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
  org_id                text NOT NULL,
  unit_id               text NOT NULL,
  enabled               boolean,
  severity_override     alarm_severity,
  threshold_min         numeric,
  threshold_max         numeric,
  duration_minutes      integer,
  cooldown_minutes      integer,
  escalation_minutes    integer,
  notification_channels text[],
  custom_corrective_action text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  UNIQUE(alarm_definition_id, org_id, unit_id)
);

-- ────────────────────────────────────────────────────────────
-- ALARM EVENTS TABLE
-- ────────────────────────────────────────────────────────────

CREATE TABLE alarm_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id   uuid NOT NULL REFERENCES alarm_definitions(id),
  org_id                text NOT NULL,
  site_id               text,
  unit_id               text,
  dev_eui               text,
  state                 text NOT NULL DEFAULT 'active',
  severity_at_trigger   alarm_severity NOT NULL,
  trigger_value         numeric,
  trigger_field         text,
  trigger_payload       jsonb,
  acknowledged_at       timestamptz,
  acknowledged_by       text,
  resolved_at           timestamptz,
  resolved_by           text,
  resolution_notes      text,
  corrective_action_taken text,
  escalated             boolean DEFAULT false,
  escalated_at          timestamptz,
  escalation_count      integer DEFAULT 0,
  snoozed_until         timestamptz,
  triggered_at          timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_alarm_def_category ON alarm_definitions(category, subcategory);
CREATE INDEX idx_alarm_def_slug ON alarm_definitions(slug);
CREATE INDEX idx_alarm_def_severity ON alarm_definitions(severity);
CREATE INDEX idx_alarm_def_tier ON alarm_definitions(detection_tier);
CREATE INDEX idx_alarm_def_enabled ON alarm_definitions(enabled_by_default);

CREATE INDEX idx_alarm_org_override_org ON alarm_org_overrides(org_id);
CREATE INDEX idx_alarm_site_override_site ON alarm_site_overrides(org_id, site_id);
CREATE INDEX idx_alarm_unit_override_unit ON alarm_unit_overrides(org_id, unit_id);

CREATE INDEX idx_alarm_events_active ON alarm_events(org_id, state) WHERE state = 'active';
CREATE INDEX idx_alarm_events_unit ON alarm_events(unit_id, triggered_at DESC);
CREATE INDEX idx_alarm_events_def ON alarm_events(alarm_definition_id, triggered_at DESC);

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTION: get_effective_alarm_config
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_effective_alarm_config(
  p_alarm_slug text,
  p_org_id text,
  p_site_id text DEFAULT NULL,
  p_unit_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_def record;
  v_org record;
  v_site record;
  v_unit record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_def FROM alarm_definitions WHERE slug = p_alarm_slug;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_result := jsonb_build_object(
    'id', v_def.id,
    'slug', v_def.slug,
    'display_name', v_def.display_name,
    'category', v_def.category,
    'subcategory', v_def.subcategory,
    'severity', v_def.severity,
    'enabled', v_def.enabled_by_default,
    'threshold_min', v_def.threshold_min,
    'threshold_max', v_def.threshold_max,
    'threshold_unit', v_def.threshold_unit,
    'duration_minutes', v_def.duration_minutes,
    'cooldown_minutes', v_def.cooldown_minutes,
    'escalation_minutes', v_def.escalation_minutes,
    'notification_channels', to_jsonb(v_def.notification_channels),
    'corrective_action_text', v_def.corrective_action_text
  );

  -- Apply org override
  SELECT * INTO v_org FROM alarm_org_overrides
    WHERE alarm_definition_id = v_def.id AND org_id = p_org_id;
  IF FOUND THEN
    IF v_org.enabled IS NOT NULL THEN v_result := v_result || jsonb_build_object('enabled', v_org.enabled); END IF;
    IF v_org.severity_override IS NOT NULL THEN v_result := v_result || jsonb_build_object('severity', v_org.severity_override); END IF;
    IF v_org.threshold_min IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_min', v_org.threshold_min); END IF;
    IF v_org.threshold_max IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_max', v_org.threshold_max); END IF;
    IF v_org.duration_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('duration_minutes', v_org.duration_minutes); END IF;
    IF v_org.cooldown_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('cooldown_minutes', v_org.cooldown_minutes); END IF;
    IF v_org.escalation_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('escalation_minutes', v_org.escalation_minutes); END IF;
    IF v_org.notification_channels IS NOT NULL THEN v_result := v_result || jsonb_build_object('notification_channels', to_jsonb(v_org.notification_channels)); END IF;
  END IF;

  -- Apply site override
  IF p_site_id IS NOT NULL THEN
    SELECT * INTO v_site FROM alarm_site_overrides
      WHERE alarm_definition_id = v_def.id AND org_id = p_org_id AND site_id = p_site_id;
    IF FOUND THEN
      IF v_site.enabled IS NOT NULL THEN v_result := v_result || jsonb_build_object('enabled', v_site.enabled); END IF;
      IF v_site.severity_override IS NOT NULL THEN v_result := v_result || jsonb_build_object('severity', v_site.severity_override); END IF;
      IF v_site.threshold_min IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_min', v_site.threshold_min); END IF;
      IF v_site.threshold_max IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_max', v_site.threshold_max); END IF;
      IF v_site.duration_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('duration_minutes', v_site.duration_minutes); END IF;
      IF v_site.cooldown_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('cooldown_minutes', v_site.cooldown_minutes); END IF;
    END IF;
  END IF;

  -- Apply unit override (most specific wins)
  IF p_unit_id IS NOT NULL THEN
    SELECT * INTO v_unit FROM alarm_unit_overrides
      WHERE alarm_definition_id = v_def.id AND org_id = p_org_id AND unit_id = p_unit_id;
    IF FOUND THEN
      IF v_unit.enabled IS NOT NULL THEN v_result := v_result || jsonb_build_object('enabled', v_unit.enabled); END IF;
      IF v_unit.severity_override IS NOT NULL THEN v_result := v_result || jsonb_build_object('severity', v_unit.severity_override); END IF;
      IF v_unit.threshold_min IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_min', v_unit.threshold_min); END IF;
      IF v_unit.threshold_max IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_max', v_unit.threshold_max); END IF;
      IF v_unit.duration_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('duration_minutes', v_unit.duration_minutes); END IF;
      IF v_unit.cooldown_minutes IS NOT NULL THEN v_result := v_result || jsonb_build_object('cooldown_minutes', v_unit.cooldown_minutes); END IF;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_alarm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alarm_definitions_updated_at BEFORE UPDATE ON alarm_definitions FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_org_overrides_updated_at BEFORE UPDATE ON alarm_org_overrides FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_site_overrides_updated_at BEFORE UPDATE ON alarm_site_overrides FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_unit_overrides_updated_at BEFORE UPDATE ON alarm_unit_overrides FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_events_updated_at BEFORE UPDATE ON alarm_events FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();

-- ────────────────────────────────────────────────────────────
-- TIER RESOLUTION FUNCTION
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_available_tiers(
  p_unit_id text,
  p_org_id text,
  p_site_id text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_sensor_kinds text[];
  v_sensor_count integer;
  v_site_unit_count integer;
  v_has_temp boolean := false;
  v_has_door boolean := false;
  v_has_env boolean := false;
  v_tiers text[] := ARRAY['T1'];
BEGIN
  SELECT
    array_agg(DISTINCT sensor_kind),
    count(*)
  INTO v_sensor_kinds, v_sensor_count
  FROM lora_sensors
  WHERE unit_id = p_unit_id AND org_id = p_org_id AND status = 'active';

  IF v_sensor_kinds IS NULL THEN
    RETURN v_tiers;
  END IF;

  v_has_temp := 'temp' = ANY(v_sensor_kinds) OR 'combo' = ANY(v_sensor_kinds);
  v_has_door := 'door' = ANY(v_sensor_kinds) OR 'combo' = ANY(v_sensor_kinds);
  v_has_env := 'co2' = ANY(v_sensor_kinds) OR 'leak' = ANY(v_sensor_kinds)
               OR 'tvoc' = ANY(v_sensor_kinds);

  -- T2: Any sensor with time series
  IF v_sensor_count >= 1 THEN
    v_tiers := v_tiers || 'T2';
  END IF;

  -- T3: Multi-sensor same unit (temp + door paired)
  IF v_has_temp AND v_has_door THEN
    v_tiers := v_tiers || 'T3';
  END IF;
  -- T3 also if TVOC + temp
  IF v_has_temp AND 'tvoc' = ANY(v_sensor_kinds) THEN
    v_tiers := v_tiers || 'T3';
  END IF;

  -- T4: Site-wide (need 2+ units at same site with sensors)
  IF p_site_id IS NOT NULL THEN
    SELECT count(DISTINCT ls.unit_id)
    INTO v_site_unit_count
    FROM lora_sensors ls
    WHERE ls.org_id = p_org_id
      AND ls.site_id = p_site_id
      AND ls.status = 'active'
      AND ls.unit_id != p_unit_id;

    IF v_site_unit_count >= 1 THEN
      v_tiers := v_tiers || 'T4';
    END IF;
  END IF;

  -- T5: Environmental sensors
  IF v_has_env THEN
    v_tiers := v_tiers || 'T5';
  END IF;

  -- Deduplicate
  SELECT array_agg(DISTINCT t) INTO v_tiers FROM unnest(v_tiers) AS t;

  RETURN v_tiers;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- GET AVAILABLE ALARMS FOR A UNIT
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_available_alarms_for_unit(
  p_unit_id text,
  p_org_id text,
  p_site_id text DEFAULT NULL
)
RETURNS TABLE (
  alarm_id uuid,
  slug text,
  display_name text,
  category alarm_category,
  severity alarm_severity,
  detection_tier detection_tier,
  confidence_level text,
  what_we_observe text,
  enabled boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tiers text[];
  v_sensor_kinds text[];
BEGIN
  v_tiers := resolve_available_tiers(p_unit_id, p_org_id, p_site_id);

  SELECT array_agg(DISTINCT sensor_kind)
  INTO v_sensor_kinds
  FROM lora_sensors
  WHERE unit_id = p_unit_id AND org_id = p_org_id AND status = 'active';

  RETURN QUERY
  SELECT
    ad.id,
    ad.slug,
    ad.display_name,
    ad.category,
    COALESCE(
      auo.severity_override,
      aso.severity_override,
      aoo.severity_override,
      ad.severity
    ) as severity,
    ad.detection_tier,
    ad.confidence_level,
    ad.what_we_observe,
    COALESCE(
      auo.enabled,
      aso.enabled,
      aoo.enabled,
      ad.enabled_by_default
    ) as enabled
  FROM alarm_definitions ad
  LEFT JOIN alarm_unit_overrides auo
    ON auo.alarm_definition_id = ad.id AND auo.org_id = p_org_id AND auo.unit_id = p_unit_id
  LEFT JOIN alarm_site_overrides aso
    ON aso.alarm_definition_id = ad.id AND aso.org_id = p_org_id AND aso.site_id = p_site_id
  LEFT JOIN alarm_org_overrides aoo
    ON aoo.alarm_definition_id = ad.id AND aoo.org_id = p_org_id
  WHERE ad.detection_tier::text = ANY(v_tiers)
    AND (
      ad.applicable_sensor_types && ARRAY['any']::alarm_sensor_type[]
      OR ad.applicable_sensor_types && v_sensor_kinds::alarm_sensor_type[]
    )
  ORDER BY ad.category, ad.sort_order;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- SEED DATA: All 86 alarm definitions
-- ────────────────────────────────────────────────────────────

-- Helper mapping for sensor keys → alarm_sensor_type:
--   LHT65 → temp, LDS02 → door, R311A → door, ERS_CO2 → co2,
--   LWL02 → leak, R720E → tvoc

-- ── NORMAL OPERATION ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, corrective_action_text, enabled_by_default, ai_hints)
VALUES
('normal_fridge', 'Normal Refrigerator', 'Normal refrigerator operating range', 'temperature', 'refrigerator', 'normal', 1, 'T1', '1x LHT65', 'Definitive', 'Temperature steady between 35-40°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', 35, 40, '°F', '—', true, '{}'),
('normal_freezer', 'Normal Freezer', 'Normal freezer operating range', 'temperature', 'freezer', 'normal', 2, 'T1', '1x LHT65', 'Definitive', 'Temperature steady between -18°F to -10°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', -18, -10, '°F', '—', true, '{}'),
('normal_walkin_cooler', 'Normal Walk-In Cooler', 'Normal walk-in cooler operating range', 'temperature', 'walk_in_cooler', 'normal', 3, 'T1', '1x LHT65', 'Definitive', 'Temperature steady between 33-40°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', 33, 40, '°F', '—', true, '{}'),
('normal_hot_holding', 'Normal Hot Holding', 'Normal hot holding operating range', 'temperature', 'hot_holding', 'normal', 4, 'T1', '1x LHT65', 'Definitive', 'Temperature stable above 135°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', 135, 200, '°F', '—', true, '{}'),
('normal_door_closed', 'Normal Door (Closed)', 'Normal door closed state', 'door', 'door_state', 'normal', 5, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact closed', 'Door sealed', '{door}', 'door_state', NULL, NULL, NULL, '—', true, '{}'),
('normal_cooldown', 'Normal Cooldown', 'Normal temperature recovery pattern', 'temperature', 'general_temp', 'normal', 6, 'T2', '1x LHT65', 'High', 'Temp dropping at healthy rate after being elevated', 'Compressor recovering unit', '{temp}', 'last_temp_f', NULL, NULL, '°F/min', '—', true, '{rate_of_change}');

-- ── TEMPERATURE T1: FACTS ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('fridge_mild_warm', 'Fridge Slightly Warm', 'Fridge temperature 41-46°F', 'temperature', 'refrigerator', 'warning', 10, 'T1', '1x LHT65', 'Definitive', 'Temperature reading is 41-46°F', 'Could be: door left open, recent stocking, compressor struggling, thermostat drift', '{temp}', 'last_temp_f', 41, 46, '°F', 5, 30, 'Check door, check if recently stocked, verify compressor is running', true, '{correlate_with_door}', false),
('fridge_danger_zone', 'Fridge in Danger Zone', 'Fridge temperature 46-55°F', 'temperature', 'refrigerator', 'critical', 11, 'T1', '1x LHT65', 'Definitive', 'Temperature reading is 46-55°F', 'Equipment issue — multiple possible causes', '{temp}', 'last_temp_f', 46, 55, '°F', 5, 15, 'Check compressor, check door seal, move perishables if not recovering', true, '{correlate_with_door,check_site_wide}', true),
('fridge_critical_high', 'Fridge Critical High', 'Fridge temperature 55-85°F', 'temperature', 'refrigerator', 'emergency', 12, 'T1', '1x LHT65', 'Definitive', 'Temperature reading is 55-85°F', 'Major equipment failure', '{temp}', 'last_temp_f', 55, 85, '°F', 2, 10, 'Move all product to backup, call emergency HVAC/R, document loss', true, '{check_site_wide,correlate_with_door}', true),
('fridge_below_freezing', 'Fridge Below Freezing', 'Fridge temperature below 32°F', 'temperature', 'refrigerator', 'warning', 13, 'T1', '1x LHT65', 'Definitive', 'Temperature reading below 32°F', 'Thermostat too low, blocked vent, proximity to freezer wall', '{temp}', 'last_temp_f', NULL, 32, '°F', 10, 30, 'Adjust thermostat, check for blocked vents', true, '{}', false),
('freezer_warming', 'Freezer Warming', 'Freezer temperature 0-15°F', 'temperature', 'freezer', 'critical', 14, 'T1', '1x LHT65', 'Definitive', 'Temperature reading is 0-15°F', 'Could be: door, defrost, compressor, power', '{temp}', 'last_temp_f', 0, 15, '°F', 5, 15, 'Check compressor, check door seal, check evaporator fan', true, '{correlate_with_door,check_site_wide}', true),
('freezer_above_freezing', 'Freezer Above Freezing', 'Freezer temperature above 32°F', 'temperature', 'freezer', 'emergency', 15, 'T1', '1x LHT65', 'Definitive', 'Temperature reading above 32°F', 'Major failure — product loss imminent', '{temp}', 'last_temp_f', 32, 85, '°F', 5, 10, 'Move ALL product immediately, emergency service, document for insurance', true, '{check_site_wide}', true),
('freezer_too_cold', 'Freezer Too Cold', 'Freezer temperature below -30°F', 'temperature', 'freezer', 'warning', 16, 'T1', '1x LHT65', 'Definitive', 'Temperature reading below -30°F', 'Thermostat malfunction or miscalibration', '{temp}', 'last_temp_f', -50, -30, '°F', 15, 60, 'Adjust thermostat, check calibration', true, '{}', false),
('walkin_cooler_warm', 'Walk-In Cooler Too Warm', 'Walk-in cooler temperature 41-55°F', 'temperature', 'walk_in_cooler', 'critical', 17, 'T1', '1x LHT65', 'Definitive', 'Temperature reading is 41-55°F', 'Door, compressor, or stocking event', '{temp}', 'last_temp_f', 41, 55, '°F', 10, 15, 'Check door/auto-closer, check compressor, check strip curtain', true, '{correlate_with_door}', true),
('hot_holding_cooling', 'Hot Holding Cooling', 'Hot holding temperature 120-135°F', 'temperature', 'hot_holding', 'warning', 18, 'T1', '1x LHT65', 'Definitive', 'Temperature reading 120-135°F', 'Heating element, thermostat, or lid', '{temp}', 'last_temp_f', 120, 135, '°F', 5, 15, 'Stir product, check element, reheat to 165°F before re-serving', true, '{}', true),
('hot_holding_danger', 'Hot Holding in Danger Zone', 'Hot holding temperature 41-120°F', 'temperature', 'hot_holding', 'critical', 19, 'T1', '1x LHT65', 'Definitive', 'Temperature reading 41-120°F', 'Equipment failure', '{temp}', 'last_temp_f', 41, 120, '°F', 5, 10, 'Reheat to 165°F within 2hrs or discard', true, '{}', true),
('prep_table_warm', 'Prep Table Too Warm', 'Prep table temperature 41-50°F', 'temperature', 'prep_table', 'warning', 20, 'T1', '1x LHT65', 'Definitive', 'Temperature reading is 41-50°F', 'Lid open, refrigeration issue, ice melted', '{temp}', 'last_temp_f', 41, 50, '°F', 10, 15, 'Close lids, replace ice, check refrigeration', true, '{}', true);

-- ── TEMPERATURE T2: PATTERNS ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action, regulatory_reference)
VALUES
('temp_rising_fast', 'Rapid Temperature Rise', 'Rate of change >5°F/hr upward', 'temperature', 'general_temp', 'critical', 30, 'T2', '1x LHT65', 'Definitive (rate)', 'Rate of change: >5°F/hr upward', 'Major issue — door, compressor, or power. Cannot determine which without more sensors.', '{temp}', 'last_temp_f', NULL, NULL, '°F/hr', 15, 15, 'Physically inspect — check door, listen for compressor, check power', true, '{rate_of_change,correlate_with_door,check_site_wide}', false, NULL),
('temp_rising_slow', 'Gradual Temperature Drift', 'Rate of change 1-3°F/hr upward sustained', 'temperature', 'general_temp', 'warning', 31, 'T2', '1x LHT65', 'Definitive (rate)', 'Rate of change: 1-3°F/hr upward sustained', 'Dirty coils, low refrigerant, failing compressor, blocked airflow', '{temp}', 'last_temp_f', NULL, NULL, '°F/hr', 60, 60, 'Schedule HVAC/R maintenance, check condenser coils', true, '{rate_of_change,trend_analysis}', false, NULL),
('temp_oscillating', 'Temperature Oscillating', 'Oscillation ±3-8°F swings every 15-45 min', 'temperature', 'general_temp', 'warning', 32, 'T2', '1x LHT65', 'Definitive (pattern)', 'Oscillation: ±3-8°F swings every 15-45 min', 'Compressor short cycling, thermostat malfunction, defrost issues, or regular door use', '{temp}', 'last_temp_f', NULL, NULL, '°F', NULL, NULL, 'Check thermostat, listen for compressor cycling, check door activity', true, '{oscillation_detect,frequency_analysis}', false, NULL),
('temp_not_recovering', 'Temperature Not Recovering', 'Temp above threshold with no downward trend for 2+ hours', 'temperature', 'general_temp', 'critical', 33, 'T2', '1x LHT65', 'Definitive (trend)', 'Temp above threshold, no downward trend for 2+ hours', 'Equipment unable to pull temp down', '{temp}', 'last_temp_f', NULL, NULL, '°F', 120, 30, 'Unit needs service — call HVAC/R tech', true, '{trend_analysis,recovery_detection}', true, NULL),
('temp_overnight_fail', 'Overnight Recovery Failure', 'Temp still elevated at 6AM after being high at close', 'temperature', 'general_temp', 'warning', 34, 'T2', '1x LHT65', 'Definitive (trend)', 'Temp still elevated at 6AM after being high at close', 'Unit running but can''t keep up, or failed overnight', '{temp}', 'last_temp_f', NULL, NULL, '°F', 360, 60, 'Check before opening — door ajar? Compressor failed?', true, '{overnight_pattern,business_hours}', false, NULL),
('temp_sustained_danger', 'Sustained Danger Zone', '41-135°F continuously for >=120 minutes', 'temperature', 'general_temp', 'emergency', 35, 'T2', '1x LHT65', 'Definitive (time+temp)', '41-135°F continuously for ≥120 minutes', 'FDA Food Code requires discard of TCS foods', '{temp}', 'last_temp_f', 41, 135, '°F', 120, 15, 'DISCARD all TCS foods per FDA 3-501.16, document for HACCP', true, '{sustained_threshold}', true, 'FDA Food Code 3-501.16'),
('temp_defrost_no_recovery', 'Defrost Recovery Failure', 'Temp rose 10-20°F then plateaued instead of dropping', 'temperature', 'general_temp', 'warning', 36, 'T2', '1x LHT65', 'Medium (inferring defrost)', 'Temp rose 10-20°F then plateaued instead of dropping', 'Defrost heater stuck, timer broken, drain clogged', '{temp}', 'last_temp_f', NULL, NULL, '°F', 45, 60, 'Check defrost timer/heater/drain', true, '{spike_plateau_detect,defrost_pattern}', false, NULL),
('temp_freeze_thaw_cycle', 'Freeze/Thaw Cycling', 'Temperature crossing 32°F repeatedly', 'temperature', 'general_temp', 'critical', 37, 'T2', '1x LHT65', 'Definitive (pattern)', 'Temperature crossing 32°F repeatedly', 'Intermittent compressor or thermostat issue', '{temp}', 'last_temp_f', 28, 36, '°F', 30, 15, 'Product quality compromised — check compressor', true, '{threshold_crossing_count,oscillation_detect}', true, NULL),
('humidity_high', 'High Humidity', 'Humidity reading 85-95% RH', 'temperature', 'humidity', 'warning', 38, 'T1', '1x LHT65', 'Definitive', 'Humidity reading 85-95% RH', 'Poor seal, frequent door openings, defrost drain issue', '{temp}', 'last_humidity', 85, 95, '%RH', 15, 60, 'Check door seals, check defrost drain', true, '{}', false, NULL);

-- ── TEMPERATURE T3: MULTI-SENSOR CORRELATION ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('door_closed_temp_rising', 'Door Closed But Temp Rising', 'Door sensor closed but temp rising >2°F/hr', 'temperature', 'general_temp', 'critical', 40, 'T3', '1x LHT65 + 1x LDS02', 'High (door ruled out)', 'Door sensor: closed. Temp sensor: rising >2°F/hr', 'NOT a door issue. Likely: compressor, refrigerant, condenser, or power to compressor only', '{temp,door}', 'last_temp_f', NULL, NULL, '°F/hr', 15, 15, 'Compressor or refrigerant issue — call HVAC/R tech', true, '{cross_sensor_correlate,rule_out_door}', false),
('door_open_temp_rising', 'Door Open — Temp Rising (Expected)', 'Door open and temp rising — expected correlation', 'temperature', 'general_temp', 'warning', 41, 'T3', '1x LHT65 + 1x LDS02', 'Definitive (correlated)', 'Door sensor: open. Temp sensor: rising', 'Expected — temp rises when door is open', '{temp,door}', 'last_temp_f', NULL, NULL, NULL, 10, 15, 'Close door — temp will recover once sealed', true, '{cross_sensor_correlate}', false),
('post_close_no_recovery', 'Door Closed — Not Recovering', 'Door closed 30+ min ago but temp still elevated', 'temperature', 'general_temp', 'critical', 42, 'T3', '1x LHT65 + 1x LDS02', 'High (door ruled out)', 'Door closed 30+ min ago, temp still elevated', 'Equipment issue — compressor not engaging or gasket leaking', '{temp,door}', 'last_temp_f', NULL, NULL, '°F', 30, 15, 'Check compressor engagement, check gasket, call HVAC/R', true, '{cross_sensor_correlate,recovery_detection,rule_out_door}', false),
('gasket_leak_infer', 'Possible Gasket Leak', 'Door closed but slow temp drift up with rising humidity', 'temperature', 'general_temp', 'warning', 43, 'T3', '1x LHT65 + 1x LDS02', 'Medium (inference)', 'Door: closed. Temp: slow drift up. Humidity: rising', 'Gasket not sealing — warm moist air infiltrating', '{temp,door}', 'last_temp_f', NULL, NULL, '°F/hr', 60, 120, 'Inspect door gasket, check for ice on frame, replace if worn', true, '{cross_sensor_correlate,humidity_temp_correlation}', false),
('tvoc_temp_refrigerant', 'TVOC + Temp Rise — Possible Refrigerant Leak', 'TVOC spiking AND temp rising on same unit', 'temperature', 'general_temp', 'critical', 44, 'T3', '1x R720E + 1x LHT65', 'Medium (inference)', 'TVOC spiking AND temp rising on same unit', 'Refrigerant leak — VOC gases escaping as refrigerant boils off. Early warning before full compressor failure.', '{tvoc,temp}', 'tvoc_ppb', NULL, NULL, NULL, NULL, NULL, 'Call HVAC/R immediately — possible refrigerant leak. Ventilate area.', true, '{cross_sensor_correlate,tvoc_temp_correlation}', false);

-- ── TEMPERATURE T4: SITE-WIDE ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('site_wide_temp_rise', 'Site-Wide Temperature Rise', '3+ units at same site all showing temp increase', 'temperature', 'general_temp', 'emergency', 50, 'T4', '3x LHT65 at site', 'Very High', '3+ units at same site all showing temp increase', 'Almost certainly power outage or main breaker trip', '{temp}', 'last_temp_f', NULL, NULL, NULL, 10, 10, 'CHECK POWER — breaker panel, utility outage, generator. Keep doors CLOSED.', true, '{site_wide_correlation,power_outage_detect}', false),
('isolated_unit_failure', 'Isolated Unit Failure', '1 unit warming while 2+ other site units stable', 'temperature', 'general_temp', 'critical', 51, 'T4', '2x LHT65 at site', 'Very High', '1 unit warming while 2+ other site units stable', 'Confirmed unit-specific issue — not power/ambient', '{temp}', 'last_temp_f', NULL, NULL, NULL, 15, 15, 'Focus troubleshooting on this specific unit', true, '{site_wide_correlation,isolation_detect}', false),
('multi_sensor_disagree', 'Multi-Sensor Disagreement', 'Two sensors on same unit >5°F apart', 'temperature', 'general_temp', 'warning', 52, 'T4', '2x LHT65 on unit', 'Definitive', 'Two sensors on same unit >5°F apart', 'One sensor drifting or failing', '{temp}', 'last_temp_f', NULL, NULL, '°F', 15, 120, 'Compare both against reference thermometer', true, '{sensor_comparison}', false);

-- ── DOOR ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('door_open_warning', 'Door Open Warning', 'Door open for >=15 continuous minutes', 'door', 'door_state', 'warning', 60, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact open for ≥15 continuous minutes', 'Staff forgot, door propped, broken auto-closer', '{door}', 'door_state', NULL, NULL, 'minutes', 15, 15, 'Close door, check auto-closer', true, '{}', false),
('door_stuck_open', 'Door Stuck Open', 'Door open for >=60 continuous minutes', 'door', 'door_state', 'critical', 61, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact open for ≥60 continuous minutes', 'Door physically stuck, auto-closer broken, or propped', '{door}', 'door_state', NULL, NULL, 'minutes', 60, 30, 'Close immediately, check product temps, document for HACCP', true, '{}', true),
('door_open_critical', 'Door Open Critical', 'Door open for >=120 continuous minutes', 'door', 'door_state', 'emergency', 62, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact open for ≥120 continuous minutes', 'Significant food safety event', '{door}', 'door_state', NULL, NULL, 'minutes', 120, 15, 'Close door, check ALL product temps, discard if in danger zone >2hrs', true, '{}', true),
('door_rapid_cycling', 'Door Rapid Cycling', 'Door open counter incrementing rapidly (>20/hr)', 'door', 'door_behavior', 'warning', 63, 'T2', '1x LDS02', 'Definitive (count)', 'LDS02 open counter incrementing rapidly (>20/hr)', 'Busy service, propping, or delivery', '{door}', 'door_open_times', NULL, NULL, 'events/hr', NULL, 60, 'Remind staff to batch retrieval', true, '{frequency_analysis}', false),
('door_after_hours', 'After-Hours Door Open', 'Door opened during non-business hours', 'door', 'door_behavior', 'warning', 64, 'T2', '1x LDS02 or R311A', 'Definitive', 'Door opened during non-business hours', 'Unauthorized access, cleaning crew, or forgotten close', '{door}', 'door_state', NULL, NULL, NULL, 1, 15, 'Verify authorized access, check security cameras', true, '{business_hours}', false),
('door_sensor_stuck', 'Door Sensor Unchanging', 'No state change events for 72+ hours', 'door', 'door_behavior', 'warning', 65, 'T2', '1x LDS02 or R311A', 'Medium (inferring failure)', 'No state change events for 72+ hours', 'Sensor dead, magnet fallen off, or truly never opened', '{door}', 'door_state', NULL, NULL, 'hours', 4320, 1440, 'Physically verify sensor, check battery, check magnet', true, '{stale_data_detect}', false),
('door_conflict', 'Door Sensor Conflict', 'Door closed but temp rising >2°F/hr', 'door', 'door_conflict', 'critical', 66, 'T3', '1x LDS02 + 1x LHT65', 'High', 'Door: closed. Temp: rising >2°F/hr', 'Sensor misalignment or seal failure', '{door,temp}', 'door_state', NULL, NULL, NULL, 15, 15, 'Physically verify door state, check sensor alignment', true, '{cross_sensor_correlate}', false);

-- ── ENVIRONMENTAL T5 ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('co2_warning', 'High CO2 Level', 'CO2 reading 2500-5000 ppm', 'environmental', 'air_quality', 'warning', 70, 'T5', '1x ERS CO2', 'Definitive', 'CO2 reading 2500-5000 ppm', 'Dry ice, poor ventilation, or fermentation', '{co2}', 'co2_ppm', 2500, 5000, 'ppm', 5, 15, 'Ventilate before entering, check for dry ice', true, '{}', false),
('co2_critical', 'Critical CO2 — Danger to Life', 'CO2 reading above 5000 ppm', 'environmental', 'air_quality', 'emergency', 71, 'T5', '1x ERS CO2', 'Definitive', 'CO2 reading above 5000 ppm', 'Immediate asphyxiation risk', '{co2}', 'co2_ppm', 5000, NULL, 'ppm', 1, 5, 'DO NOT ENTER. Ventilate remotely. Call fire department if >10,000.', true, '{}', false),
('leak_detected', 'Water Leak Detected', 'LWL02 water_leak = true', 'environmental', 'water', 'critical', 72, 'T5', '1x LWL02', 'Definitive', 'LWL02 water_leak = true', 'Drain clog, defrost pan overflow, pipe leak', '{leak}', 'water_leak', NULL, NULL, NULL, NULL, 5, 'Locate source — check drain lines, defrost pan, pipes', true, '{}', false),
('tvoc_elevated', 'TVOC Elevated', 'TVOC reading 500-1500 ppb', 'environmental', 'tvoc', 'warning', 73, 'T5', '1x R720E', 'Definitive', 'TVOC reading 500-1500 ppb', 'Cleaning chemicals off-gassing, food spoilage gases, or new materials outgassing', '{tvoc}', 'tvoc_ppb', 500, 1500, 'ppb', 10, 30, 'Ventilate area, identify VOC source — check if recently cleaned, check product quality', true, '{tvoc_source_inference}', false),
('tvoc_high', 'TVOC High — Ventilate', 'TVOC reading 1500-5000 ppb', 'environmental', 'tvoc', 'critical', 74, 'T5', '1x R720E', 'Definitive', 'TVOC reading 1500-5000 ppb', 'Heavy chemical off-gassing, possible refrigerant leak, or significant spoilage', '{tvoc}', 'tvoc_ppb', 1500, 5000, 'ppb', 5, 15, 'Ventilate immediately, do not enter without ventilation, identify source', true, '{tvoc_source_inference}', false),
('tvoc_critical', 'TVOC Critical — Do Not Enter', 'TVOC reading above 5000 ppb', 'environmental', 'tvoc', 'emergency', 75, 'T5', '1x R720E', 'Definitive', 'TVOC reading above 5000 ppb', 'Dangerous VOC concentration — health hazard', '{tvoc}', 'tvoc_ppb', 5000, NULL, 'ppb', 1, 5, 'DO NOT ENTER. Ventilate remotely. Evacuate area if needed.', true, '{}', false),
('tvoc_cleaning_pattern', 'Post-Cleaning TVOC Spike', 'TVOC spike during typical cleaning hours', 'environmental', 'tvoc', 'info', 76, 'T2', '1x R720E', 'Medium (inferring cleaning)', 'TVOC spike during typical cleaning hours, decaying over 30-60 min', 'Normal cleaning chemical off-gassing — monitor for decay to safe levels', '{tvoc}', 'tvoc_ppb', NULL, NULL, NULL, NULL, NULL, 'Ensure adequate ventilation, wait for levels to drop before restocking', true, '{tvoc_decay_pattern,business_hours,spike_detect}', false),
('tvoc_spoilage_infer', 'Possible Food Spoilage (TVOC)', 'TVOC gradually rising but temperature is stable', 'environmental', 'tvoc', 'warning', 77, 'T3', '1x R720E + 1x LHT65', 'Medium (inference)', 'TVOC gradually rising but temperature is stable/normal', 'Not a temp issue — could be food decomposition producing VOCs (ethylene, ammonia, H2S)', '{tvoc,temp}', 'tvoc_ppb', NULL, NULL, NULL, NULL, NULL, 'Inspect stored product visually, check dates, remove spoiled items', true, '{tvoc_temp_correlation,gradual_rise_detect}', false),
('motion_after_hours', 'After-Hours Motion', 'ERS CO2 motion_count > 0 during off-hours', 'environmental', 'ambient', 'warning', 78, 'T5', '1x ERS CO2', 'Definitive', 'ERS CO2 motion_count > 0 during off-hours', 'Unauthorized access, pests, or cleaning crew', '{co2}', 'motion_count', NULL, NULL, NULL, NULL, 15, 'Check security cameras, verify authorized access', true, '{business_hours}', false),
('lights_left_on', 'Walk-In Lights Left On', 'Light elevated during off-hours', 'environmental', 'ambient', 'info', 79, 'T5', '1x ERS CO2', 'High', 'Light elevated during off-hours', 'Staff forgot to turn off lights', '{co2}', 'light_lux', NULL, NULL, NULL, NULL, 480, 'Turn off walk-in lights, consider auto-off timer', true, '{business_hours}', false),
('ambient_kitchen_hot', 'Kitchen Ambient Too Hot', 'ERS CO2 ambient temp reading 90°F+', 'environmental', 'ambient', 'warning', 80, 'T5', '1x ERS CO2', 'Definitive', 'ERS CO2 ambient temp reading 90°F+', 'HVAC failure, hood not running, extreme weather', '{co2}', 'ambient_temp_f', 90, 120, '°F', 30, 120, 'Check kitchen HVAC, verify hood, monitor equipment', true, '{}', false);

-- ── SENSOR HEALTH ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('battery_low', 'Low Battery', 'Battery 5-15%', 'sensor_health', 'battery', 'warning', 90, 'T1', 'Any sensor', 'Definitive', 'Battery 5-15%', 'Normal aging — schedule replacement', '{any}', 'battery_pct', 5, 15, '%', NULL, 1440, 'Order replacement, schedule swap', true, '{battery_drain_rate}', false),
('battery_critical', 'Battery Critical', 'Battery 1-5%', 'sensor_health', 'battery', 'critical', 91, 'T1', 'Any sensor', 'Definitive', 'Battery 1-5%', 'Days to hours remaining', '{any}', 'battery_pct', 1, 5, '%', NULL, 720, 'Replace ASAP — monitoring gap imminent', true, '{battery_drain_rate}', false),
('signal_poor', 'Poor Signal', 'RSSI -95 to -110 dBm', 'sensor_health', 'signal', 'warning', 92, 'T1', 'Any sensor', 'Definitive', 'RSSI -95 to -110 dBm', 'Distance, obstructions, interference', '{any}', 'rssi_dbm', -110, -95, 'dBm', NULL, 1440, 'Check for obstructions, consider relocating', true, '{}', false),
('signal_critical', 'Signal Critical', 'RSSI below -110 dBm', 'sensor_health', 'signal', 'critical', 93, 'T1', 'Any sensor', 'Definitive', 'RSSI below -110 dBm', 'Too far or heavy obstruction', '{any}', 'rssi_dbm', -130, -110, 'dBm', NULL, 720, 'Relocate sensor or add gateway', true, '{}', false),
('sensor_offline', 'Sensor Offline', 'No data for 2+ expected intervals', 'sensor_health', 'connectivity', 'critical', 94, 'T2', 'Any sensor', 'Definitive (gap)', 'No data for 2+ expected intervals', 'Battery dead, out of range, or failed', '{any}', 'last_uplink_at', NULL, NULL, 'minutes', NULL, 360, 'Check battery, check signal, replace', true, '{gap_detection}', false),
('sensor_offline_24h', 'Sensor Offline 24h+', 'No data for 24+ hours', 'sensor_health', 'connectivity', 'emergency', 95, 'T2', 'Any sensor', 'Definitive (gap)', 'No data for 24+ hours', 'Sensor dead or unreachable', '{any}', 'last_uplink_at', NULL, NULL, 'hours', 1440, 720, 'Replace immediately, manually log temps', true, '{gap_detection}', true),
('reading_impossible', 'Impossible Reading', 'Value outside physically possible range', 'sensor_health', 'data_integrity', 'critical', 96, 'T1', '1x LHT65 or R720E or ERS CO2', 'Definitive', 'Value outside physically possible range', 'Probe damage, water ingress, sensor failure', '{temp,tvoc,co2}', 'last_temp_f', NULL, NULL, NULL, NULL, 60, 'Ignore reading, check probe, replace sensor', true, '{range_validation}', false),
('gateway_offline', 'Gateway Offline', 'No traffic from gateway for 10+ minutes', 'sensor_health', 'gateway', 'emergency', 97, 'T1', 'Gateway', 'Definitive', 'No traffic from gateway for 10+ minutes', 'Power loss, network disconnect, hardware failure', '{gateway}', NULL, NULL, NULL, 'minutes', 10, 15, 'Check power, check network, reboot gateway', true, '{}', false);

-- ── COMPLIANCE ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('missed_reading', 'Missed Compliance Reading', 'Gap in temp log exceeding compliance requirement', 'compliance', 'haccp', 'critical', 100, 'T2', '1x LHT65', 'Definitive', 'Gap in temp log exceeding compliance requirement', 'Sensor offline, decode error, or connectivity gap', '{temp}', 'last_uplink_at', NULL, NULL, 'minutes', NULL, 60, 'Manually log temperature, document gap', true, '{gap_detection}', true),
('corrective_action_needed', 'Corrective Action Not Logged', 'Alarm resolved without corrective action field populated', 'compliance', 'haccp', 'warning', 101, 'T2', 'None', 'Definitive', 'Alarm resolved without corrective action field populated', 'Staff acknowledged but didn''t document', '{any}', NULL, NULL, NULL, NULL, 60, 120, 'Log corrective action — required for HACCP', true, '{}', true),
('repeated_alarm', 'Recurring Alarm', 'Same alarm triggered 3+ times in 24 hours', 'compliance', 'escalation', 'warning', 102, 'T2', 'None', 'Definitive', 'Same alarm triggered 3+ times in 24 hours', 'Band-aid fixes not addressing root cause', '{any}', NULL, NULL, NULL, 'count/24hr', NULL, 240, 'Investigate root cause, schedule repair', true, '{recurrence_detect}', false),
('alert_unacknowledged', 'Alert Unacknowledged', 'Critical alarm still active past SLA window', 'compliance', 'escalation', 'critical', 103, 'T2', 'None', 'Definitive', 'Critical alarm state still ''active'' past SLA window', 'Staff not monitoring or notifications not reaching them', '{any}', NULL, NULL, NULL, 'minutes', NULL, 60, 'Acknowledge alert, escalate to manager', true, '{}', false);

-- ── SECURITY ──
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('tamper_alert', 'Tamper Alert', 'R311A alarm flag = true', 'security', 'physical', 'critical', 110, 'T1', '1x R311A', 'Definitive', 'R311A alarm flag = true', 'Sensor physically tampered with', '{door}', 'alarm', NULL, NULL, NULL, NULL, 5, 'Investigate immediately, verify sensor integrity', true, '{}', false);

-- ────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run manually to confirm)
-- ────────────────────────────────────────────────────────────
-- SELECT detection_tier, count(*) FROM alarm_definitions GROUP BY detection_tier ORDER BY detection_tier;
-- SELECT category, count(*) FROM alarm_definitions GROUP BY category ORDER BY category;
-- SELECT count(*) FROM alarm_definitions; -- Should be 86
