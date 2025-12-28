-- Add missed check-in threshold columns to alert_rules (org-level settings)
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS offline_warning_missed_checkins INTEGER DEFAULT 1;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS offline_critical_missed_checkins INTEGER DEFAULT 5;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS manual_log_missed_checkins_threshold INTEGER DEFAULT 5;

-- Add check-in interval to units table (per-sensor setting)
ALTER TABLE units ADD COLUMN IF NOT EXISTS checkin_interval_minutes INTEGER DEFAULT 5;

-- Update the get_effective_alert_rules function to include new columns
CREATE OR REPLACE FUNCTION public.get_effective_alert_rules(p_unit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_site_id UUID;
  v_unit_rules RECORD;
  v_site_rules RECORD;
  v_org_rules RECORD;
  v_result JSONB;
BEGIN
  -- Get org and site for this unit
  SELECT s.organization_id, a.site_id INTO v_org_id, v_site_id
  FROM units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE u.id = p_unit_id;
  
  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get rules at each level
  SELECT * INTO v_unit_rules FROM alert_rules WHERE unit_id = p_unit_id;
  SELECT * INTO v_site_rules FROM alert_rules WHERE site_id = v_site_id;
  SELECT * INTO v_org_rules FROM alert_rules WHERE organization_id = v_org_id;
  
  -- Build result with unit -> site -> org -> default precedence
  v_result := jsonb_build_object(
    'manual_interval_minutes', COALESCE(
      v_unit_rules.manual_interval_minutes,
      v_site_rules.manual_interval_minutes,
      v_org_rules.manual_interval_minutes,
      (SELECT manual_log_cadence / 60 FROM units WHERE id = p_unit_id)
    ),
    'manual_grace_minutes', COALESCE(
      v_unit_rules.manual_grace_minutes,
      v_site_rules.manual_grace_minutes,
      v_org_rules.manual_grace_minutes,
      0
    ),
    'expected_reading_interval_seconds', COALESCE(
      v_unit_rules.expected_reading_interval_seconds,
      v_site_rules.expected_reading_interval_seconds,
      v_org_rules.expected_reading_interval_seconds,
      60
    ),
    'offline_trigger_multiplier', COALESCE(
      v_unit_rules.offline_trigger_multiplier,
      v_site_rules.offline_trigger_multiplier,
      v_org_rules.offline_trigger_multiplier,
      2.0
    ),
    'offline_trigger_additional_minutes', COALESCE(
      v_unit_rules.offline_trigger_additional_minutes,
      v_site_rules.offline_trigger_additional_minutes,
      v_org_rules.offline_trigger_additional_minutes,
      2
    ),
    'door_open_warning_minutes', COALESCE(
      v_unit_rules.door_open_warning_minutes,
      v_site_rules.door_open_warning_minutes,
      v_org_rules.door_open_warning_minutes,
      3
    ),
    'door_open_critical_minutes', COALESCE(
      v_unit_rules.door_open_critical_minutes,
      v_site_rules.door_open_critical_minutes,
      v_org_rules.door_open_critical_minutes,
      10
    ),
    'door_open_max_mask_minutes_per_day', COALESCE(
      v_unit_rules.door_open_max_mask_minutes_per_day,
      v_site_rules.door_open_max_mask_minutes_per_day,
      v_org_rules.door_open_max_mask_minutes_per_day,
      60
    ),
    'excursion_confirm_minutes_door_closed', COALESCE(
      v_unit_rules.excursion_confirm_minutes_door_closed,
      v_site_rules.excursion_confirm_minutes_door_closed,
      v_org_rules.excursion_confirm_minutes_door_closed,
      10
    ),
    'excursion_confirm_minutes_door_open', COALESCE(
      v_unit_rules.excursion_confirm_minutes_door_open,
      v_site_rules.excursion_confirm_minutes_door_open,
      v_org_rules.excursion_confirm_minutes_door_open,
      20
    ),
    'max_excursion_minutes', COALESCE(
      v_unit_rules.max_excursion_minutes,
      v_site_rules.max_excursion_minutes,
      v_org_rules.max_excursion_minutes,
      60
    ),
    'offline_warning_missed_checkins', COALESCE(
      v_unit_rules.offline_warning_missed_checkins,
      v_site_rules.offline_warning_missed_checkins,
      v_org_rules.offline_warning_missed_checkins,
      1
    ),
    'offline_critical_missed_checkins', COALESCE(
      v_unit_rules.offline_critical_missed_checkins,
      v_site_rules.offline_critical_missed_checkins,
      v_org_rules.offline_critical_missed_checkins,
      5
    ),
    'manual_log_missed_checkins_threshold', COALESCE(
      v_unit_rules.manual_log_missed_checkins_threshold,
      v_site_rules.manual_log_missed_checkins_threshold,
      v_org_rules.manual_log_missed_checkins_threshold,
      5
    ),
    'source_unit', v_unit_rules.id IS NOT NULL,
    'source_site', v_site_rules.id IS NOT NULL,
    'source_org', v_org_rules.id IS NOT NULL
  );
  
  RETURN v_result;
END;
$function$;