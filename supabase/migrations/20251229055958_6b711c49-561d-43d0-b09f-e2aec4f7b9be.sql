-- =====================================================
-- PHASE 1: Notification Policies Schema
-- =====================================================

-- Create notification_policies table for per-alert-type notification configuration
CREATE TABLE public.notification_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  
  -- Initial delivery channels: ['WEB_TOAST', 'IN_APP_CENTER', 'EMAIL', 'SMS']
  initial_channels TEXT[] NOT NULL DEFAULT ARRAY['IN_APP_CENTER'],
  
  -- Acknowledgement settings
  requires_ack BOOLEAN NOT NULL DEFAULT false,
  ack_deadline_minutes INTEGER,
  
  -- Escalation steps (JSONB array)
  -- Format: [{ "delay_minutes": 10, "channels": ["EMAIL"], "repeat": false }]
  escalation_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Advanced options
  send_resolved_notifications BOOLEAN NOT NULL DEFAULT false,
  reminders_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_interval_minutes INTEGER,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start_local TIME,
  quiet_hours_end_local TIME,
  severity_threshold TEXT NOT NULL DEFAULT 'WARNING',
  allow_warning_notifications BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Exactly one scope must be set
  CONSTRAINT notification_policies_one_scope CHECK (
    (organization_id IS NOT NULL AND site_id IS NULL AND unit_id IS NULL) OR
    (site_id IS NOT NULL AND organization_id IS NULL AND unit_id IS NULL) OR
    (unit_id IS NOT NULL AND organization_id IS NULL AND site_id IS NULL)
  )
);

-- Create unique indexes for each scope level + alert_type combo
CREATE UNIQUE INDEX notification_policies_org_alert_type_idx 
  ON notification_policies(organization_id, alert_type) 
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX notification_policies_site_alert_type_idx 
  ON notification_policies(site_id, alert_type) 
  WHERE site_id IS NOT NULL;

CREATE UNIQUE INDEX notification_policies_unit_alert_type_idx 
  ON notification_policies(unit_id, alert_type) 
  WHERE unit_id IS NOT NULL;

-- Add index for lookups
CREATE INDEX notification_policies_alert_type_idx ON notification_policies(alert_type);

-- Enable RLS
ALTER TABLE notification_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_policies
CREATE POLICY "Users can view notification policies in their org"
ON notification_policies FOR SELECT
USING (
  (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id)) OR
  (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = notification_policies.site_id 
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  )) OR
  (unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM units u
    JOIN areas a ON a.id = u.area_id
    JOIN sites s ON s.id = a.site_id
    WHERE u.id = notification_policies.unit_id 
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  ))
);

CREATE POLICY "Admins can manage notification policies"
ON notification_policies FOR ALL
USING (
  (organization_id IS NOT NULL AND (
    has_role(auth.uid(), organization_id, 'owner') OR 
    has_role(auth.uid(), organization_id, 'admin')
  )) OR
  (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = notification_policies.site_id 
    AND (has_role(auth.uid(), s.organization_id, 'owner') OR has_role(auth.uid(), s.organization_id, 'admin'))
  )) OR
  (unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM units u
    JOIN areas a ON a.id = u.area_id
    JOIN sites s ON s.id = a.site_id
    WHERE u.id = notification_policies.unit_id 
    AND (has_role(auth.uid(), s.organization_id, 'owner') OR has_role(auth.uid(), s.organization_id, 'admin'))
  ))
);

-- Add ack_required and escalation tracking to alerts table
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ack_required BOOLEAN DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS escalation_steps_sent JSONB DEFAULT '[]'::jsonb;

-- Add user_id, escalation tracking, and read/dismissed to notification_events
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS escalation_step_index INTEGER;
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Create function to get effective notification policy with inheritance
CREATE OR REPLACE FUNCTION public.get_effective_notification_policy(
  p_unit_id UUID,
  p_alert_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_site_id UUID;
  v_unit_policy RECORD;
  v_site_policy RECORD;
  v_org_policy RECORD;
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
  
  -- Get policies at each level
  SELECT * INTO v_unit_policy FROM notification_policies 
    WHERE unit_id = p_unit_id AND alert_type = p_alert_type;
  SELECT * INTO v_site_policy FROM notification_policies 
    WHERE site_id = v_site_id AND alert_type = p_alert_type;
  SELECT * INTO v_org_policy FROM notification_policies 
    WHERE organization_id = v_org_id AND alert_type = p_alert_type;
  
  -- Build result with unit -> site -> org precedence
  -- Default values if nothing is set
  v_result := jsonb_build_object(
    'initial_channels', COALESCE(
      v_unit_policy.initial_channels,
      v_site_policy.initial_channels,
      v_org_policy.initial_channels,
      ARRAY['IN_APP_CENTER']
    ),
    'requires_ack', COALESCE(
      v_unit_policy.requires_ack,
      v_site_policy.requires_ack,
      v_org_policy.requires_ack,
      false
    ),
    'ack_deadline_minutes', COALESCE(
      v_unit_policy.ack_deadline_minutes,
      v_site_policy.ack_deadline_minutes,
      v_org_policy.ack_deadline_minutes
    ),
    'escalation_steps', COALESCE(
      v_unit_policy.escalation_steps,
      v_site_policy.escalation_steps,
      v_org_policy.escalation_steps,
      '[]'::jsonb
    ),
    'send_resolved_notifications', COALESCE(
      v_unit_policy.send_resolved_notifications,
      v_site_policy.send_resolved_notifications,
      v_org_policy.send_resolved_notifications,
      false
    ),
    'reminders_enabled', COALESCE(
      v_unit_policy.reminders_enabled,
      v_site_policy.reminders_enabled,
      v_org_policy.reminders_enabled,
      false
    ),
    'reminder_interval_minutes', COALESCE(
      v_unit_policy.reminder_interval_minutes,
      v_site_policy.reminder_interval_minutes,
      v_org_policy.reminder_interval_minutes
    ),
    'quiet_hours_enabled', COALESCE(
      v_unit_policy.quiet_hours_enabled,
      v_site_policy.quiet_hours_enabled,
      v_org_policy.quiet_hours_enabled,
      false
    ),
    'quiet_hours_start_local', COALESCE(
      v_unit_policy.quiet_hours_start_local::text,
      v_site_policy.quiet_hours_start_local::text,
      v_org_policy.quiet_hours_start_local::text
    ),
    'quiet_hours_end_local', COALESCE(
      v_unit_policy.quiet_hours_end_local::text,
      v_site_policy.quiet_hours_end_local::text,
      v_org_policy.quiet_hours_end_local::text
    ),
    'severity_threshold', COALESCE(
      v_unit_policy.severity_threshold,
      v_site_policy.severity_threshold,
      v_org_policy.severity_threshold,
      'WARNING'
    ),
    'allow_warning_notifications', COALESCE(
      v_unit_policy.allow_warning_notifications,
      v_site_policy.allow_warning_notifications,
      v_org_policy.allow_warning_notifications,
      false
    ),
    'source_unit', v_unit_policy.id IS NOT NULL,
    'source_site', v_site_policy.id IS NOT NULL,
    'source_org', v_org_policy.id IS NOT NULL
  );
  
  RETURN v_result;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_notification_policies_updated_at
  BEFORE UPDATE ON notification_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();