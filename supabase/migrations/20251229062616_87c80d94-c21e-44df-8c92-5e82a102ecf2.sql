-- Add recipient targeting columns to notification_policies
ALTER TABLE notification_policies
ADD COLUMN notify_roles TEXT[] DEFAULT ARRAY['owner', 'admin'],
ADD COLUMN notify_site_managers BOOLEAN DEFAULT true,
ADD COLUMN notify_assigned_users BOOLEAN DEFAULT false;

-- Update escalation_steps type comment - steps can now include contact_priority
COMMENT ON COLUMN notification_policies.escalation_steps IS 'JSON array of escalation steps: { delay_minutes: number, channels: string[], contact_priority?: number, repeat?: boolean }';

-- Update get_effective_notification_policy to include new fields
CREATE OR REPLACE FUNCTION public.get_effective_notification_policy(p_unit_id uuid, p_alert_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'notify_roles', COALESCE(
      v_unit_policy.notify_roles,
      v_site_policy.notify_roles,
      v_org_policy.notify_roles,
      ARRAY['owner', 'admin']
    ),
    'notify_site_managers', COALESCE(
      v_unit_policy.notify_site_managers,
      v_site_policy.notify_site_managers,
      v_org_policy.notify_site_managers,
      true
    ),
    'notify_assigned_users', COALESCE(
      v_unit_policy.notify_assigned_users,
      v_site_policy.notify_assigned_users,
      v_org_policy.notify_assigned_users,
      false
    ),
    'source_unit', v_unit_policy.id IS NOT NULL,
    'source_site', v_site_policy.id IS NOT NULL,
    'source_org', v_org_policy.id IS NOT NULL
  );
  
  RETURN v_result;
END;
$function$;