
-- ============================================================
-- ALARM DEFINITION LIBRARY - FrostGuard
-- Single source of truth for all alarm types
-- Purely additive — does NOT modify any existing tables
-- ============================================================

-- ENUMS
CREATE TYPE alarm_category AS ENUM (
  'temperature', 'door', 'environmental', 'sensor_health', 'security', 'compliance'
);

CREATE TYPE alarm_subcategory AS ENUM (
  'refrigerator', 'freezer', 'hot_holding', 'walk_in_cooler', 'walk_in_freezer',
  'prep_table', 'general_temp',
  'door_state', 'door_behavior', 'door_conflict',
  'humidity', 'air_quality', 'tvoc', 'water', 'ambient',
  'battery', 'signal', 'connectivity', 'data_integrity', 'calibration', 'gateway',
  'physical', 'access',
  'haccp', 'maintenance', 'escalation'
);

CREATE TYPE alarm_severity AS ENUM ('info', 'normal', 'warning', 'critical', 'emergency');
CREATE TYPE detection_tier AS ENUM ('T1', 'T2', 'T3', 'T4', 'T5');
CREATE TYPE alarm_unit_type AS ENUM ('refrigerator', 'freezer', 'walk_in_cooler', 'walk_in_freezer', 'prep_table', 'hot_holding', 'any');
CREATE TYPE alarm_sensor_type AS ENUM ('temp', 'door', 'combo', 'leak', 'co2', 'humidity', 'motion', 'tvoc', 'gateway', 'any');

-- CORE TABLE
CREATE TABLE alarm_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL,
  short_description text,
  category alarm_category NOT NULL,
  subcategory alarm_subcategory NOT NULL,
  severity alarm_severity NOT NULL DEFAULT 'warning',
  sort_order integer NOT NULL DEFAULT 0,
  detection_tier detection_tier NOT NULL DEFAULT 'T1',
  required_sensors text NOT NULL,
  confidence_level text NOT NULL DEFAULT 'Definitive',
  what_we_observe text NOT NULL,
  what_it_might_mean text,
  applicable_unit_types alarm_unit_type[] NOT NULL DEFAULT '{any}',
  applicable_sensor_types alarm_sensor_type[] NOT NULL DEFAULT '{any}',
  threshold_min numeric,
  threshold_max numeric,
  threshold_unit text,
  duration_minutes integer,
  cooldown_minutes integer DEFAULT 30,
  eval_field text,
  eval_logic text,
  eval_params jsonb DEFAULT '{}',
  notification_template text,
  notification_channels text[] DEFAULT '{in_app}',
  requires_corrective_action boolean DEFAULT false,
  corrective_action_text text,
  haccp_category text,
  regulatory_reference text,
  escalation_minutes integer,
  escalation_to text,
  emulator_enabled boolean DEFAULT true,
  emulator_payload jsonb,
  ai_hints text[] DEFAULT '{}',
  enabled_by_default boolean DEFAULT true,
  is_system boolean DEFAULT true,
  icon_name text,
  color text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- OVERRIDE TABLES
CREATE TABLE alarm_org_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id uuid NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  enabled boolean,
  severity_override alarm_severity,
  threshold_min numeric,
  threshold_max numeric,
  duration_minutes integer,
  cooldown_minutes integer,
  escalation_minutes integer,
  notification_channels text[],
  custom_corrective_action text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(alarm_definition_id, org_id)
);

CREATE TABLE alarm_site_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id uuid NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  site_id text NOT NULL,
  enabled boolean,
  severity_override alarm_severity,
  threshold_min numeric,
  threshold_max numeric,
  duration_minutes integer,
  cooldown_minutes integer,
  escalation_minutes integer,
  notification_channels text[],
  custom_corrective_action text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(alarm_definition_id, org_id, site_id)
);

CREATE TABLE alarm_unit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id uuid NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  unit_id text NOT NULL,
  enabled boolean,
  severity_override alarm_severity,
  threshold_min numeric,
  threshold_max numeric,
  duration_minutes integer,
  cooldown_minutes integer,
  escalation_minutes integer,
  notification_channels text[],
  custom_corrective_action text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(alarm_definition_id, org_id, unit_id)
);

-- ALARM EVENTS TABLE
CREATE TABLE alarm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alarm_definition_id uuid NOT NULL REFERENCES alarm_definitions(id),
  org_id text NOT NULL,
  site_id text,
  unit_id text,
  dev_eui text,
  state text NOT NULL DEFAULT 'active',
  severity_at_trigger alarm_severity NOT NULL,
  trigger_value numeric,
  trigger_field text,
  trigger_payload jsonb,
  acknowledged_at timestamptz,
  acknowledged_by text,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  corrective_action_taken text,
  escalated boolean DEFAULT false,
  escalated_at timestamptz,
  escalation_count integer DEFAULT 0,
  snoozed_until timestamptz,
  triggered_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
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

-- HELPER FUNCTION: get_effective_alarm_config
CREATE OR REPLACE FUNCTION get_effective_alarm_config(
  p_alarm_slug text, p_org_id text, p_site_id text DEFAULT NULL, p_unit_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_def record; v_org record; v_site record; v_unit record; v_result jsonb;
BEGIN
  SELECT * INTO v_def FROM alarm_definitions WHERE slug = p_alarm_slug;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_result := jsonb_build_object(
    'id', v_def.id, 'slug', v_def.slug, 'display_name', v_def.display_name,
    'category', v_def.category, 'subcategory', v_def.subcategory, 'severity', v_def.severity,
    'enabled', v_def.enabled_by_default, 'threshold_min', v_def.threshold_min,
    'threshold_max', v_def.threshold_max, 'threshold_unit', v_def.threshold_unit,
    'duration_minutes', v_def.duration_minutes, 'cooldown_minutes', v_def.cooldown_minutes,
    'escalation_minutes', v_def.escalation_minutes,
    'notification_channels', to_jsonb(v_def.notification_channels),
    'corrective_action_text', v_def.corrective_action_text
  );
  SELECT * INTO v_org FROM alarm_org_overrides WHERE alarm_definition_id = v_def.id AND org_id = p_org_id;
  IF FOUND THEN
    IF v_org.enabled IS NOT NULL THEN v_result := v_result || jsonb_build_object('enabled', v_org.enabled); END IF;
    IF v_org.severity_override IS NOT NULL THEN v_result := v_result || jsonb_build_object('severity', v_org.severity_override); END IF;
    IF v_org.threshold_min IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_min', v_org.threshold_min); END IF;
    IF v_org.threshold_max IS NOT NULL THEN v_result := v_result || jsonb_build_object('threshold_max', v_org.threshold_max); END IF;
  END IF;
  IF p_site_id IS NOT NULL THEN
    SELECT * INTO v_site FROM alarm_site_overrides WHERE alarm_definition_id = v_def.id AND org_id = p_org_id AND site_id = p_site_id;
    IF FOUND THEN
      IF v_site.enabled IS NOT NULL THEN v_result := v_result || jsonb_build_object('enabled', v_site.enabled); END IF;
      IF v_site.severity_override IS NOT NULL THEN v_result := v_result || jsonb_build_object('severity', v_site.severity_override); END IF;
    END IF;
  END IF;
  IF p_unit_id IS NOT NULL THEN
    SELECT * INTO v_unit FROM alarm_unit_overrides WHERE alarm_definition_id = v_def.id AND org_id = p_org_id AND unit_id = p_unit_id;
    IF FOUND THEN
      IF v_unit.enabled IS NOT NULL THEN v_result := v_result || jsonb_build_object('enabled', v_unit.enabled); END IF;
      IF v_unit.severity_override IS NOT NULL THEN v_result := v_result || jsonb_build_object('severity', v_unit.severity_override); END IF;
    END IF;
  END IF;
  RETURN v_result;
END; $$;

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_alarm_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alarm_definitions_updated_at BEFORE UPDATE ON alarm_definitions FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_org_overrides_updated_at BEFORE UPDATE ON alarm_org_overrides FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_site_overrides_updated_at BEFORE UPDATE ON alarm_site_overrides FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_unit_overrides_updated_at BEFORE UPDATE ON alarm_unit_overrides FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();
CREATE TRIGGER trg_alarm_events_updated_at BEFORE UPDATE ON alarm_events FOR EACH ROW EXECUTE FUNCTION update_alarm_updated_at();

-- TIER RESOLUTION FUNCTION (uses organization_id and sensor_type from lora_sensors)
CREATE OR REPLACE FUNCTION resolve_available_tiers(p_unit_id text, p_org_id text, p_site_id text DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql AS $$
DECLARE
  v_sensor_kinds text[]; v_sensor_count integer; v_site_unit_count integer;
  v_has_temp boolean := false; v_has_door boolean := false; v_has_env boolean := false;
  v_tiers text[] := ARRAY['T1'];
BEGIN
  SELECT array_agg(DISTINCT sensor_type::text), count(*)
  INTO v_sensor_kinds, v_sensor_count
  FROM lora_sensors
  WHERE unit_id::text = p_unit_id AND organization_id::text = p_org_id AND status = 'active';

  IF v_sensor_kinds IS NULL THEN RETURN v_tiers; END IF;

  v_has_temp := 'temperature' = ANY(v_sensor_kinds) OR 'temperature_humidity' = ANY(v_sensor_kinds) OR 'combo' = ANY(v_sensor_kinds);
  v_has_door := 'door' = ANY(v_sensor_kinds) OR 'contact' = ANY(v_sensor_kinds) OR 'combo' = ANY(v_sensor_kinds);
  v_has_env := 'air_quality' = ANY(v_sensor_kinds) OR 'leak' = ANY(v_sensor_kinds) OR 'multi_sensor' = ANY(v_sensor_kinds);

  IF v_sensor_count >= 1 THEN v_tiers := v_tiers || 'T2'; END IF;
  IF v_has_temp AND v_has_door THEN v_tiers := v_tiers || 'T3'; END IF;

  IF p_site_id IS NOT NULL THEN
    SELECT count(DISTINCT ls.unit_id)
    INTO v_site_unit_count
    FROM lora_sensors ls
    WHERE ls.organization_id::text = p_org_id AND ls.site_id::text = p_site_id
      AND ls.status = 'active' AND ls.unit_id::text != p_unit_id;
    IF v_site_unit_count >= 1 THEN v_tiers := v_tiers || 'T4'; END IF;
  END IF;

  IF v_has_env THEN v_tiers := v_tiers || 'T5'; END IF;

  SELECT array_agg(DISTINCT t) INTO v_tiers FROM unnest(v_tiers) AS t;
  RETURN v_tiers;
END; $$;

-- GET AVAILABLE ALARMS FOR A UNIT
CREATE OR REPLACE FUNCTION get_available_alarms_for_unit(p_unit_id text, p_org_id text, p_site_id text DEFAULT NULL)
RETURNS TABLE (
  alarm_id uuid, slug text, display_name text, category alarm_category,
  severity alarm_severity, detection_tier detection_tier, confidence_level text,
  what_we_observe text, enabled boolean
) LANGUAGE plpgsql AS $$
DECLARE v_tiers text[]; v_sensor_kinds text[];
BEGIN
  v_tiers := resolve_available_tiers(p_unit_id, p_org_id, p_site_id);

  SELECT array_agg(DISTINCT ls.sensor_type::text)
  INTO v_sensor_kinds
  FROM lora_sensors ls
  WHERE ls.unit_id::text = p_unit_id AND ls.organization_id::text = p_org_id AND ls.status = 'active';

  RETURN QUERY
  SELECT ad.id, ad.slug, ad.display_name, ad.category,
    COALESCE(auo.severity_override, aso.severity_override, aoo.severity_override, ad.severity) as severity,
    ad.detection_tier, ad.confidence_level, ad.what_we_observe,
    COALESCE(auo.enabled, aso.enabled, aoo.enabled, ad.enabled_by_default) as enabled
  FROM alarm_definitions ad
  LEFT JOIN alarm_unit_overrides auo ON auo.alarm_definition_id = ad.id AND auo.org_id = p_org_id AND auo.unit_id = p_unit_id
  LEFT JOIN alarm_site_overrides aso ON aso.alarm_definition_id = ad.id AND aso.org_id = p_org_id AND aso.site_id = p_site_id
  LEFT JOIN alarm_org_overrides aoo ON aoo.alarm_definition_id = ad.id AND aoo.org_id = p_org_id
  WHERE ad.detection_tier::text = ANY(v_tiers)
    AND (ad.applicable_sensor_types && ARRAY['any']::alarm_sensor_type[]
         OR ad.applicable_sensor_types && v_sensor_kinds::alarm_sensor_type[])
  ORDER BY ad.category, ad.sort_order;
END; $$;

-- ══════════════════════════════════════════════════════════════
-- SEED DATA: All 86 alarm definitions
-- ══════════════════════════════════════════════════════════════

-- NORMAL OPERATION (6)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, corrective_action_text, enabled_by_default, ai_hints)
VALUES
('normal_fridge', 'Normal Refrigerator', 'Normal refrigerator operating range', 'temperature', 'refrigerator', 'normal', 1, 'T1', '1x LHT65', 'Definitive', 'Temperature steady between 35-40°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', 35, 40, '°F', '—', true, '{}'),
('normal_freezer', 'Normal Freezer', 'Normal freezer operating range', 'temperature', 'freezer', 'normal', 2, 'T1', '1x LHT65', 'Definitive', 'Temperature steady between -18°F to -10°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', -18, -10, '°F', '—', true, '{}'),
('normal_walkin_cooler', 'Normal Walk-In Cooler', 'Normal walk-in cooler operating range', 'temperature', 'walk_in_cooler', 'normal', 3, 'T1', '1x LHT65', 'Definitive', 'Temperature steady between 33-40°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', 33, 40, '°F', '—', true, '{}'),
('normal_hot_holding', 'Normal Hot Holding', 'Normal hot holding operating range', 'temperature', 'hot_holding', 'normal', 4, 'T1', '1x LHT65', 'Definitive', 'Temperature stable above 135°F', 'Unit functioning correctly', '{temp}', 'last_temp_f', 135, 200, '°F', '—', true, '{}'),
('normal_door_closed', 'Normal Door (Closed)', 'Normal door closed state', 'door', 'door_state', 'normal', 5, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact closed', 'Door sealed', '{door}', 'door_state', NULL, NULL, NULL, '—', true, '{}'),
('normal_cooldown', 'Normal Cooldown', 'Normal temperature recovery pattern', 'temperature', 'general_temp', 'normal', 6, 'T2', '1x LHT65', 'High', 'Temp dropping at healthy rate after being elevated', 'Compressor recovering unit', '{temp}', 'last_temp_f', NULL, NULL, '°F/min', '—', true, '{rate_of_change}');

-- TEMPERATURE T1: FACTS (11)
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

-- TEMPERATURE T2: PATTERNS (9)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action, regulatory_reference)
VALUES
('temp_rising_fast', 'Rapid Temperature Rise', 'Rate of change >5°F/hr upward', 'temperature', 'general_temp', 'critical', 30, 'T2', '1x LHT65', 'Definitive (rate)', 'Rate of change: >5°F/hr upward', 'Major issue — door, compressor, or power', '{temp}', 'last_temp_f', NULL, NULL, '°F/hr', 15, 15, 'Physically inspect — check door, listen for compressor, check power', true, '{rate_of_change,correlate_with_door,check_site_wide}', false, NULL),
('temp_rising_slow', 'Gradual Temperature Drift', 'Rate of change 1-3°F/hr upward sustained', 'temperature', 'general_temp', 'warning', 31, 'T2', '1x LHT65', 'Definitive (rate)', 'Rate of change: 1-3°F/hr upward sustained', 'Dirty coils, low refrigerant, failing compressor', '{temp}', 'last_temp_f', NULL, NULL, '°F/hr', 60, 60, 'Schedule HVAC/R maintenance, check condenser coils', true, '{rate_of_change,trend_analysis}', false, NULL),
('temp_oscillating', 'Temperature Oscillating', 'Oscillation ±3-8°F swings every 15-45 min', 'temperature', 'general_temp', 'warning', 32, 'T2', '1x LHT65', 'Definitive (pattern)', 'Oscillation: ±3-8°F swings every 15-45 min', 'Compressor short cycling, thermostat malfunction', '{temp}', 'last_temp_f', NULL, NULL, '°F', NULL, NULL, 'Check thermostat, listen for compressor cycling', true, '{oscillation_detect,frequency_analysis}', false, NULL),
('temp_not_recovering', 'Temperature Not Recovering', 'Temp above threshold with no downward trend for 2+ hours', 'temperature', 'general_temp', 'critical', 33, 'T2', '1x LHT65', 'Definitive (trend)', 'Temp above threshold, no downward trend for 2+ hours', 'Equipment unable to pull temp down', '{temp}', 'last_temp_f', NULL, NULL, '°F', 120, 30, 'Unit needs service — call HVAC/R tech', true, '{trend_analysis,recovery_detection}', true, NULL),
('temp_overnight_fail', 'Overnight Recovery Failure', 'Temp still elevated at 6AM after being high at close', 'temperature', 'general_temp', 'warning', 34, 'T2', '1x LHT65', 'Definitive (trend)', 'Temp still elevated at 6AM after being high at close', 'Unit running but cannot keep up', '{temp}', 'last_temp_f', NULL, NULL, '°F', 360, 60, 'Check before opening — door ajar? Compressor failed?', true, '{overnight_pattern,business_hours}', false, NULL),
('temp_sustained_danger', 'Sustained Danger Zone', '41-135°F continuously for >=120 minutes', 'temperature', 'general_temp', 'emergency', 35, 'T2', '1x LHT65', 'Definitive (time+temp)', '41-135°F continuously for ≥120 minutes', 'FDA Food Code requires discard of TCS foods', '{temp}', 'last_temp_f', 41, 135, '°F', 120, 15, 'DISCARD all TCS foods per FDA 3-501.16, document for HACCP', true, '{sustained_threshold}', true, 'FDA Food Code 3-501.16'),
('temp_defrost_no_recovery', 'Defrost Recovery Failure', 'Temp rose 10-20°F then plateaued', 'temperature', 'general_temp', 'warning', 36, 'T2', '1x LHT65', 'Medium (inferring defrost)', 'Temp rose 10-20°F then plateaued instead of dropping', 'Defrost heater stuck, timer broken, drain clogged', '{temp}', 'last_temp_f', NULL, NULL, '°F', 45, 60, 'Check defrost timer/heater/drain', true, '{spike_plateau_detect,defrost_pattern}', false, NULL),
('temp_freeze_thaw_cycle', 'Freeze/Thaw Cycling', 'Temperature crossing 32°F repeatedly', 'temperature', 'general_temp', 'critical', 37, 'T2', '1x LHT65', 'Definitive (pattern)', 'Temperature crossing 32°F repeatedly', 'Intermittent compressor or thermostat issue', '{temp}', 'last_temp_f', 28, 36, '°F', 30, 15, 'Product quality compromised — check compressor', true, '{threshold_crossing_count,oscillation_detect}', true, NULL),
('humidity_high', 'High Humidity', 'Humidity reading 85-95% RH', 'temperature', 'humidity', 'warning', 38, 'T1', '1x LHT65', 'Definitive', 'Humidity reading 85-95% RH', 'Poor seal, frequent door openings, defrost drain issue', '{temp}', 'last_humidity', 85, 95, '%RH', 15, 60, 'Check door seals, check defrost drain', true, '{}', false, NULL);

-- TEMPERATURE T3: MULTI-SENSOR (5)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('door_closed_temp_rising', 'Door Closed But Temp Rising', 'Door sensor closed but temp rising >2°F/hr', 'temperature', 'general_temp', 'critical', 40, 'T3', '1x LHT65 + 1x LDS02', 'High (door ruled out)', 'Door sensor: closed. Temp sensor: rising >2°F/hr', 'NOT a door issue. Likely: compressor, refrigerant, condenser', '{temp,door}', 'last_temp_f', NULL, NULL, '°F/hr', 15, 15, 'Compressor or refrigerant issue — call HVAC/R tech', true, '{cross_sensor_correlate,rule_out_door}', false),
('door_open_temp_rising', 'Door Open — Temp Rising (Expected)', 'Door open and temp rising — expected correlation', 'temperature', 'general_temp', 'warning', 41, 'T3', '1x LHT65 + 1x LDS02', 'Definitive (correlated)', 'Door sensor: open. Temp sensor: rising', 'Expected — temp rises when door is open', '{temp,door}', 'last_temp_f', NULL, NULL, NULL, 10, 15, 'Close door — temp will recover once sealed', true, '{cross_sensor_correlate}', false),
('post_close_no_recovery', 'Door Closed — Not Recovering', 'Door closed 30+ min ago but temp still elevated', 'temperature', 'general_temp', 'critical', 42, 'T3', '1x LHT65 + 1x LDS02', 'High (door ruled out)', 'Door closed 30+ min ago, temp still elevated', 'Equipment issue — compressor not engaging or gasket leaking', '{temp,door}', 'last_temp_f', NULL, NULL, '°F', 30, 15, 'Check compressor engagement, check gasket, call HVAC/R', true, '{cross_sensor_correlate,recovery_detection,rule_out_door}', false),
('gasket_leak_infer', 'Possible Gasket Leak', 'Door closed but slow temp drift up with rising humidity', 'temperature', 'general_temp', 'warning', 43, 'T3', '1x LHT65 + 1x LDS02', 'Medium (inference)', 'Door: closed. Temp: slow drift up. Humidity: rising', 'Gasket not sealing — warm moist air infiltrating', '{temp,door}', 'last_temp_f', NULL, NULL, '°F/hr', 60, 120, 'Inspect door gasket, check for ice on frame, replace if worn', true, '{cross_sensor_correlate,humidity_temp_correlation}', false),
('tvoc_temp_refrigerant', 'TVOC + Temp Rise — Possible Refrigerant Leak', 'TVOC spiking AND temp rising on same unit', 'temperature', 'general_temp', 'critical', 44, 'T3', '1x R720E + 1x LHT65', 'Medium (inference)', 'TVOC spiking AND temp rising on same unit', 'Refrigerant leak — VOC gases escaping', '{tvoc,temp}', 'tvoc_ppb', NULL, NULL, NULL, NULL, NULL, 'Call HVAC/R immediately — possible refrigerant leak. Ventilate area.', true, '{cross_sensor_correlate,tvoc_temp_correlation}', false);

-- TEMPERATURE T4: SITE-WIDE (3)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('site_wide_temp_rise', 'Site-Wide Temperature Rise', '3+ units at same site all showing temp increase', 'temperature', 'general_temp', 'emergency', 50, 'T4', '3x LHT65 at site', 'Very High', '3+ units at same site all showing temp increase', 'Almost certainly power outage or main breaker trip', '{temp}', 'last_temp_f', 'CHECK POWER — breaker panel, utility outage, generator', true, '{site_wide_correlation,power_outage_detect}', false),
('isolated_unit_failure', 'Isolated Unit Failure', '1 unit warming while 2+ other site units stable', 'temperature', 'general_temp', 'critical', 51, 'T4', '2x LHT65 at site', 'Very High', '1 unit warming while 2+ other site units stable', 'Confirmed unit-specific issue', '{temp}', 'last_temp_f', 'Focus troubleshooting on this specific unit', true, '{site_wide_correlation,isolation_detect}', false),
('ambient_temp_change', 'Ambient Temperature Affecting Units', 'All units drifting similarly by 2-5°F', 'temperature', 'general_temp', 'info', 52, 'T4', '3x LHT65 at site', 'Medium', 'All units drifting similarly by 2-5°F', 'HVAC failure, extreme outdoor temps, loading dock open', '{temp}', 'last_temp_f', 'Check HVAC, check building envelope', true, '{site_wide_correlation}', false);

-- DOOR T1-T3 (7)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('door_open_warning', 'Door Open Warning', 'Door open 3-10 minutes', 'door', 'door_state', 'warning', 60, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact sensor: open for 3-10 minutes', 'Could be: stocking, cleaning, or forgotten', '{door}', 'door_state', 3, 15, 'Close the door', true, '{}', false),
('door_open_critical', 'Door Open Critical', 'Door open 10-30 minutes', 'door', 'door_state', 'critical', 61, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact sensor: open for 10-30 minutes', 'Likely forgotten or propped open', '{door}', 'door_state', 10, 15, 'Close the door immediately, check product', true, '{correlate_with_door}', true),
('door_open_emergency', 'Door Open Emergency', 'Door open 30+ minutes', 'door', 'door_state', 'emergency', 62, 'T1', '1x LDS02 or R311A', 'Definitive', 'Door contact sensor: open for 30+ minutes', 'Major issue — full temp recovery needed', '{door}', 'door_state', 30, 10, 'Close door, check all product temps, may need to discard', true, '{correlate_with_door}', true),
('door_frequent_opens', 'Frequent Door Openings', '>20 open events in 1 hour', 'door', 'door_behavior', 'warning', 63, 'T2', '1x LDS02 or R311A', 'Definitive (pattern)', 'Door opened >20 times in 1 hour', 'High-traffic period, rush, or propping during stocking', '{door}', 'door_open_count', NULL, NULL, 'Review door usage patterns', true, '{frequency_analysis}', false),
('door_overnight_open', 'Door Left Open Overnight', 'Door open during non-business hours', 'door', 'door_state', 'critical', 64, 'T2', '1x LDS02 or R311A', 'Definitive', 'Door sensor: open during non-business hours (10PM-5AM)', 'Forgotten at closing', '{door}', 'door_state', 60, 60, 'Emergency callback — close door immediately', true, '{business_hours}', true),
('door_temp_conflict', 'Door Sensor/Temp Conflict', 'Door sensor says closed but temp behavior suggests open', 'door', 'door_conflict', 'warning', 65, 'T3', '1x LDS02 + 1x LHT65', 'Medium (inference)', 'Door sensor: closed. Temp: behaving as if door open', 'Sensor misaligned, magnet shifted, or gasket leak', '{door,temp}', 'door_state', NULL, 30, 'Check door sensor alignment, check magnet', true, '{cross_sensor_correlate}', false),
('door_multiple_units', 'Multiple Units Doors Open', '2+ unit doors at same site open simultaneously', 'door', 'door_behavior', 'warning', 66, 'T4', '2x LDS02 at site', 'Definitive', '2+ unit doors at same site open simultaneously', 'Stocking event or cleaning', '{door}', 'door_state', 5, 30, 'Check if intentional stocking event', true, '{site_wide_correlation}', false);

-- SENSOR HEALTH (14)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, corrective_action_text, enabled_by_default, ai_hints)
VALUES
('sensor_offline_warning', 'Sensor Offline (Warning)', 'No data for 2x expected interval', 'sensor_health', 'connectivity', 'warning', 70, 'T1', 'Any sensor', 'Definitive', 'No data received for 2x expected interval', 'Battery dead, out of range, or interference', '{any}', 'last_seen_minutes', NULL, NULL, 'min', NULL, 'Check sensor battery and placement', true, '{gap_detection}'),
('sensor_offline_critical', 'Sensor Offline (Critical)', 'No data for 5x expected interval', 'sensor_health', 'connectivity', 'critical', 71, 'T1', 'Any sensor', 'Definitive', 'No data received for 5x expected interval', 'Sensor likely dead or removed', '{any}', 'last_seen_minutes', NULL, NULL, 'min', NULL, 'Replace sensor or investigate', true, '{gap_detection}'),
('battery_low', 'Battery Low', 'Battery level 20-35%', 'sensor_health', 'battery', 'warning', 72, 'T1', 'Any sensor', 'Definitive', 'Battery level 20-35%', 'Battery nearing end of life', '{any}', 'battery_pct', 20, 35, '%', NULL, 'Schedule battery replacement', true, '{battery_drain_rate}'),
('battery_critical', 'Battery Critical', 'Battery level <20%', 'sensor_health', 'battery', 'critical', 73, 'T1', 'Any sensor', 'Definitive', 'Battery level below 20%', 'Imminent failure', '{any}', 'battery_pct', 0, 20, '%', NULL, 'Replace battery immediately', true, '{battery_drain_rate}'),
('signal_weak', 'Weak Signal', 'Signal strength -100 to -110 dBm', 'sensor_health', 'signal', 'warning', 74, 'T1', 'Any sensor', 'Definitive', 'Signal strength -100 to -110 dBm', 'Near range limit', '{any}', 'rssi', -110, -100, 'dBm', NULL, 'Consider relocating sensor or adding gateway', true, '{}'),
('signal_critical', 'Signal Critical', 'Signal strength below -110 dBm', 'sensor_health', 'signal', 'critical', 75, 'T1', 'Any sensor', 'Definitive', 'Signal strength below -110 dBm', 'Unreliable data', '{any}', 'rssi', -130, -110, 'dBm', NULL, 'Relocate sensor or add gateway', true, '{}'),
('reading_stuck', 'Stuck Reading', 'Same exact value for 6+ consecutive readings', 'sensor_health', 'data_integrity', 'warning', 76, 'T2', 'Any sensor', 'High', 'Same exact value for 6+ consecutive readings', 'Sensor malfunction or frozen', '{any}', NULL, NULL, NULL, NULL, NULL, 'Check sensor, may need replacement', true, '{stale_data_detect}'),
('reading_impossible', 'Impossible Reading', 'Value outside physical range for sensor type', 'sensor_health', 'data_integrity', 'critical', 77, 'T1', 'Any sensor', 'Definitive', 'Value outside physical range for sensor type', 'Sensor malfunction', '{any}', NULL, NULL, NULL, NULL, NULL, 'Replace sensor', true, '{range_validation}'),
('calibration_drift', 'Calibration Drift Suspected', 'Two sensors on same unit diverging >5°F', 'sensor_health', 'calibration', 'warning', 78, 'T3', '2x LHT65 on same unit', 'Medium', 'Two sensors on same unit diverging >5°F', 'One sensor drifting out of calibration', '{temp}', NULL, NULL, NULL, NULL, NULL, 'Calibrate both sensors against reference', true, '{sensor_comparison}'),
('gateway_offline', 'Gateway Offline', 'LoRa gateway not responding', 'sensor_health', 'gateway', 'critical', 79, 'T1', 'Gateway', 'Definitive', 'Gateway not responding', 'Gateway power, network, or hardware issue', '{gateway}', 'last_seen_minutes', NULL, NULL, 'min', NULL, 'Check gateway power and network', true, '{}'),
('data_gap', 'Data Gap Detected', 'Missing readings in expected reporting window', 'sensor_health', 'data_integrity', 'warning', 80, 'T2', 'Any sensor', 'Definitive', 'Missing readings in expected reporting window', 'Intermittent connectivity', '{any}', NULL, NULL, NULL, NULL, NULL, 'Check for interference, battery, range', true, '{gap_detection}'),
('battery_drain_fast', 'Rapid Battery Drain', 'Battery dropping >5% per day', 'sensor_health', 'battery', 'warning', 81, 'T2', 'Any sensor', 'High', 'Battery dropping >5% per day', 'Sensor transmitting too frequently or hardware issue', '{any}', 'battery_pct', NULL, NULL, '%/day', NULL, 'Check transmit interval, replace if defective', true, '{battery_drain_rate}'),
('sensor_recurring_offline', 'Recurring Offline Events', 'Sensor going offline repeatedly in 24hr window', 'sensor_health', 'connectivity', 'warning', 82, 'T2', 'Any sensor', 'High', 'Sensor going offline repeatedly in 24hr window', 'Intermittent power, marginal signal, or interference', '{any}', NULL, NULL, NULL, NULL, NULL, 'Investigate root cause of intermittent connectivity', true, '{recurrence_detect,gap_detection}'),
('multiple_sensors_offline', 'Multiple Sensors Offline', '2+ sensors at same site offline simultaneously', 'sensor_health', 'connectivity', 'critical', 83, 'T4', '2x sensors at site', 'Very High', '2+ sensors at same site offline simultaneously', 'Gateway issue or site power problem', '{any}', NULL, NULL, NULL, NULL, NULL, 'Check gateway, check site power', true, '{site_wide_correlation}');

-- ENVIRONMENTAL T5 (10)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, threshold_min, threshold_max, threshold_unit, duration_minutes, cooldown_minutes, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('co2_elevated', 'CO2 Elevated', 'CO2 reading 1000-2000 ppm', 'environmental', 'air_quality', 'warning', 90, 'T5', '1x ERS CO2', 'Definitive', 'CO2 reading 1000-2000 ppm', 'Poor ventilation', '{co2}', 'co2_ppm', 1000, 2000, 'ppm', 15, 60, 'Increase ventilation, check HVAC', true, '{}', false),
('co2_dangerous', 'CO2 Dangerous', 'CO2 reading >2000 ppm', 'environmental', 'air_quality', 'critical', 91, 'T5', '1x ERS CO2', 'Definitive', 'CO2 reading above 2000 ppm', 'Dangerous — health hazard', '{co2}', 'co2_ppm', 2000, NULL, 'ppm', 5, 15, 'Evacuate area, increase ventilation immediately', true, '{}', true),
('water_leak_detected', 'Water Leak Detected', 'Water leak sensor triggered', 'environmental', 'water', 'critical', 92, 'T5', '1x LWL02', 'Definitive', 'Water leak sensor: triggered', 'Active water leak', '{leak}', 'water_leak', NULL, NULL, NULL, NULL, 10, 'Locate source, stop water, protect equipment', true, '{}', true),
('water_leak_resolved', 'Water Leak Resolved', 'Water leak sensor cleared', 'environmental', 'water', 'info', 93, 'T5', '1x LWL02', 'Definitive', 'Water leak sensor: cleared', 'Leak stopped or sensor dried', '{leak}', 'water_leak', NULL, NULL, NULL, NULL, 60, 'Verify leak is fully resolved, check for damage', true, '{}', false),
('tvoc_elevated', 'TVOC Elevated', 'TVOC reading 500-1000 ppb', 'environmental', 'tvoc', 'warning', 94, 'T5', '1x R720E', 'Definitive', 'TVOC reading 500-1000 ppb', 'Cleaning chemicals, new materials, or refrigerant', '{tvoc}', 'tvoc_ppb', 500, 1000, 'ppb', 15, 60, 'Ventilate area, identify source', true, '{tvoc_source_inference}', false),
('tvoc_high', 'TVOC High', 'TVOC reading >1000 ppb', 'environmental', 'tvoc', 'critical', 95, 'T5', '1x R720E', 'Definitive', 'TVOC reading above 1000 ppb', 'Significant air quality concern', '{tvoc}', 'tvoc_ppb', 1000, NULL, 'ppb', 5, 15, 'Evacuate if persistent, identify and eliminate source', true, '{tvoc_source_inference,spike_detect}', true),
('tvoc_spike', 'TVOC Sudden Spike', 'TVOC rose >300 ppb in 15 minutes', 'environmental', 'tvoc', 'critical', 96, 'T5', '1x R720E', 'Definitive (rate)', 'TVOC rose >300 ppb in 15 minutes', 'Chemical spill, refrigerant burst, or strong cleaning agent', '{tvoc}', 'tvoc_ppb', NULL, NULL, 'ppb/15min', 15, 15, 'Identify source immediately, ventilate', true, '{spike_detect,tvoc_source_inference}', false),
('tvoc_sustained', 'TVOC Sustained Elevation', 'TVOC above 500 ppb for 2+ hours', 'environmental', 'tvoc', 'warning', 97, 'T5', '1x R720E', 'Definitive (time)', 'TVOC above 500 ppb for 2+ hours without decay', 'Ongoing source — not just a cleaning event', '{tvoc}', 'tvoc_ppb', 500, NULL, 'ppb', 120, 60, 'Source is continuous — investigate thoroughly', true, '{tvoc_decay_pattern,sustained_threshold}', false),
('humidity_extreme', 'Extreme Humidity', 'Humidity reading >95% RH', 'environmental', 'humidity', 'critical', 98, 'T5', '1x ERS CO2 or R720E', 'Definitive', 'Humidity reading above 95% RH', 'Active leak, condensation, or HVAC failure', '{co2,tvoc}', 'humidity_pct', 95, NULL, '%RH', 10, 30, 'Check for leaks, check HVAC, check drain pans', true, '{humidity_temp_correlation}', false),
('ambient_temp_extreme', 'Extreme Ambient Temperature', 'Ambient/kitchen temp above 95°F', 'environmental', 'ambient', 'warning', 99, 'T5', '1x ERS CO2 or R720E', 'Definitive', 'Ambient temperature above 95°F', 'Kitchen HVAC failure, extreme heat', '{co2,tvoc}', 'temperature', 95, NULL, '°F', 30, 60, 'Check kitchen HVAC, units may struggle to maintain temp', true, '{}', false);

-- COMPLIANCE (6)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, corrective_action_text, enabled_by_default, ai_hints, requires_corrective_action)
VALUES
('manual_log_overdue', 'Manual Log Overdue', 'Manual temperature check not recorded on schedule', 'compliance', 'haccp', 'warning', 100, 'T1', 'None (system)', 'Definitive', 'Manual temperature check not recorded on schedule', 'Staff missed check', '{any}', NULL, 'Record temperature immediately', true, '{}', true),
('corrective_action_pending', 'Corrective Action Pending', 'Critical alarm resolved without corrective action', 'compliance', 'haccp', 'warning', 101, 'T1', 'None (system)', 'Definitive', 'Critical alarm resolved without corrective action documentation', 'Compliance gap', '{any}', NULL, 'Document corrective action taken', true, '{}', true),
('haccp_2hr_violation', 'HACCP 2-Hour Violation', 'TCS food in danger zone for ≥2 hours', 'compliance', 'haccp', 'emergency', 102, 'T2', '1x LHT65', 'Definitive', 'Temperature in 41-135°F danger zone for ≥2 continuous hours', 'FDA Food Code violation — product must be discarded', '{temp}', 'last_temp_f', 'DISCARD affected TCS product, document in HACCP log', true, '{sustained_threshold}', true),
('haccp_4hr_violation', 'HACCP 4-Hour Violation', 'TCS food in danger zone for ≥4 hours', 'compliance', 'haccp', 'emergency', 103, 'T2', '1x LHT65', 'Definitive', 'Temperature in 41-135°F danger zone for ≥4 continuous hours', 'Severe FDA violation', '{temp}', 'last_temp_f', 'DISCARD ALL affected product immediately, full HACCP review', true, '{sustained_threshold}', true),
('escalation_timeout', 'Escalation Timeout', 'Critical alarm not acknowledged within escalation window', 'compliance', 'escalation', 'emergency', 104, 'T1', 'None (system)', 'Definitive', 'Critical alarm not acknowledged within escalation window', 'No one is responding', '{any}', NULL, 'Contact on-call manager directly', true, '{}', false),
('calibration_overdue', 'Calibration Overdue', 'Sensor past scheduled calibration date', 'compliance', 'maintenance', 'warning', 105, 'T1', 'Any sensor', 'Definitive', 'Sensor past scheduled calibration date', 'Readings may not be accurate', '{any}', NULL, 'Schedule calibration check', true, '{}', false);

-- SECURITY (4)
INSERT INTO alarm_definitions (slug, display_name, description, category, subcategory, severity, sort_order, detection_tier, required_sensors, confidence_level, what_we_observe, what_it_might_mean, applicable_sensor_types, eval_field, duration_minutes, corrective_action_text, enabled_by_default, ai_hints)
VALUES
('after_hours_door', 'After-Hours Door Activity', 'Door opened during closed hours', 'security', 'access', 'warning', 110, 'T2', '1x LDS02 or R311A', 'Definitive', 'Door contact: opened during non-business hours', 'Unauthorized access or forgotten close', '{door}', 'door_state', NULL, 'Verify authorized access', true, '{business_hours}'),
('after_hours_temp_change', 'After-Hours Temperature Change', 'Temp rise during closed hours', 'security', 'physical', 'warning', 111, 'T2', '1x LHT65', 'Medium', 'Temperature rising during non-business hours', 'Power cut, equipment failure, or tampering', '{temp}', 'last_temp_f', NULL, 'Investigate cause of temp change', true, '{business_hours,check_site_wide}'),
('sensor_tamper', 'Sensor Tamper Suspected', 'Sensor reporting impossible location or value changes', 'security', 'physical', 'critical', 112, 'T2', 'Any sensor', 'Medium', 'Sensor reporting impossible value changes or signal anomalies', 'Sensor moved, covered, or tampered with', '{any}', NULL, NULL, 'Physically verify sensor placement and integrity', true, '{range_validation}'),
('motion_after_hours', 'Motion After Hours', 'Motion detected during closed hours', 'security', 'access', 'warning', 113, 'T5', '1x ERS CO2', 'Definitive', 'Motion count increasing during non-business hours', 'Unauthorized access', '{co2}', 'motion_count', NULL, 'Verify authorized access, check security cameras', true, '{business_hours}');
