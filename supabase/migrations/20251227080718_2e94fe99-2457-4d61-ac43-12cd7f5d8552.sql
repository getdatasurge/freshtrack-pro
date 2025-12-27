-- Create alert_rules table for configurable thresholds
-- Supports org → site → unit inheritance
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  
  -- Manual logging thresholds
  manual_interval_minutes INTEGER, -- Override for manual_log_cadence
  manual_grace_minutes INTEGER DEFAULT 0, -- Grace period before alert
  
  -- Offline/heartbeat thresholds  
  expected_reading_interval_seconds INTEGER DEFAULT 60,
  offline_trigger_multiplier NUMERIC(3,1) DEFAULT 2.0,
  offline_trigger_additional_minutes INTEGER DEFAULT 2,
  
  -- Door thresholds
  door_open_warning_minutes INTEGER DEFAULT 3,
  door_open_critical_minutes INTEGER DEFAULT 10,
  door_open_max_mask_minutes_per_day INTEGER DEFAULT 60,
  
  -- Temperature excursion thresholds
  excursion_confirm_minutes_door_closed INTEGER DEFAULT 10,
  excursion_confirm_minutes_door_open INTEGER DEFAULT 20,
  max_excursion_minutes INTEGER DEFAULT 60,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: must have exactly one of org/site/unit
  CONSTRAINT alert_rules_scope_check CHECK (
    (organization_id IS NOT NULL AND site_id IS NULL AND unit_id IS NULL) OR
    (organization_id IS NULL AND site_id IS NOT NULL AND unit_id IS NULL) OR
    (organization_id IS NULL AND site_id IS NULL AND unit_id IS NOT NULL)
  ),
  
  -- Unique constraints for each scope
  CONSTRAINT alert_rules_org_unique UNIQUE (organization_id),
  CONSTRAINT alert_rules_site_unique UNIQUE (site_id),
  CONSTRAINT alert_rules_unit_unique UNIQUE (unit_id)
);

-- Enable RLS
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view alert rules in their org"
ON public.alert_rules
FOR SELECT
USING (
  (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id)) OR
  (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = alert_rules.site_id AND user_belongs_to_org(auth.uid(), s.organization_id)
  )) OR
  (unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM units u 
    JOIN areas a ON a.id = u.area_id 
    JOIN sites s ON s.id = a.site_id 
    WHERE u.id = alert_rules.unit_id AND user_belongs_to_org(auth.uid(), s.organization_id)
  ))
);

CREATE POLICY "Admins can manage alert rules"
ON public.alert_rules
FOR ALL
USING (
  (organization_id IS NOT NULL AND (has_role(auth.uid(), organization_id, 'owner') OR has_role(auth.uid(), organization_id, 'admin'))) OR
  (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = alert_rules.site_id AND (has_role(auth.uid(), s.organization_id, 'owner') OR has_role(auth.uid(), s.organization_id, 'admin'))
  )) OR
  (unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM units u 
    JOIN areas a ON a.id = u.area_id 
    JOIN sites s ON s.id = a.site_id 
    WHERE u.id = alert_rules.unit_id AND (has_role(auth.uid(), s.organization_id, 'owner') OR has_role(auth.uid(), s.organization_id, 'admin'))
  ))
);

-- Trigger for updated_at
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to get effective alert rules for a unit
CREATE OR REPLACE FUNCTION public.get_effective_alert_rules(p_unit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'source_unit', v_unit_rules.id IS NOT NULL,
    'source_site', v_site_rules.id IS NOT NULL,
    'source_org', v_org_rules.id IS NOT NULL
  );
  
  RETURN v_result;
END;
$$;