-- Add 'inspector' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inspector';

-- Create inspector_sessions for shareable links
CREATE TABLE public.inspector_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  allowed_site_ids UUID[] DEFAULT NULL, -- NULL = all sites
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.inspector_sessions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage inspector sessions
CREATE POLICY "Admins can manage inspector sessions"
ON public.inspector_sessions
FOR ALL
USING (
  has_role(auth.uid(), organization_id, 'owner') OR 
  has_role(auth.uid(), organization_id, 'admin')
);

-- Create escalation_policies table
CREATE TABLE public.escalation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  
  -- Critical alert escalation (minutes)
  critical_primary_delay_minutes INTEGER NOT NULL DEFAULT 0,
  critical_secondary_delay_minutes INTEGER DEFAULT 15,
  critical_owner_delay_minutes INTEGER DEFAULT 30,
  
  -- Warning alert escalation
  warning_primary_delay_minutes INTEGER NOT NULL DEFAULT 0,
  warning_secondary_delay_minutes INTEGER DEFAULT NULL, -- NULL = no escalation
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '06:00',
  quiet_hours_behavior TEXT DEFAULT 'queue', -- queue, owner_only, skip
  
  -- Notification settings
  acknowledge_stops_notifications BOOLEAN NOT NULL DEFAULT true,
  repeat_notification_interval_minutes INTEGER DEFAULT NULL, -- NULL = no repeat
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Either org-level or site-level
  CONSTRAINT escalation_policy_scope_check CHECK (
    (organization_id IS NOT NULL AND site_id IS NULL) OR
    (organization_id IS NULL AND site_id IS NOT NULL)
  ),
  CONSTRAINT escalation_policy_org_unique UNIQUE (organization_id),
  CONSTRAINT escalation_policy_site_unique UNIQUE (site_id)
);

ALTER TABLE public.escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view escalation policies"
ON public.escalation_policies
FOR SELECT
USING (
  (organization_id IS NOT NULL AND user_belongs_to_org(auth.uid(), organization_id)) OR
  (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = escalation_policies.site_id 
    AND user_belongs_to_org(auth.uid(), s.organization_id)
  ))
);

CREATE POLICY "Admins can manage escalation policies"
ON public.escalation_policies
FOR ALL
USING (
  (organization_id IS NOT NULL AND (has_role(auth.uid(), organization_id, 'owner') OR has_role(auth.uid(), organization_id, 'admin'))) OR
  (site_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM sites s WHERE s.id = escalation_policies.site_id 
    AND (has_role(auth.uid(), s.organization_id, 'owner') OR has_role(auth.uid(), s.organization_id, 'admin'))
  ))
);

-- Create escalation_contacts table
CREATE TABLE public.escalation_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID, -- NULL if external contact
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  priority INTEGER NOT NULL DEFAULT 1, -- 1=primary, 2=secondary, 3=tertiary
  notification_channels TEXT[] NOT NULL DEFAULT ARRAY['email'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view escalation contacts"
ON public.escalation_contacts
FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage escalation contacts"
ON public.escalation_contacts
FOR ALL
USING (
  has_role(auth.uid(), organization_id, 'owner') OR 
  has_role(auth.uid(), organization_id, 'admin')
);

-- Create pilot_feedback table
CREATE TABLE public.pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  logging_speed_rating INTEGER CHECK (logging_speed_rating BETWEEN 1 AND 5),
  alert_fatigue_rating INTEGER CHECK (alert_fatigue_rating BETWEEN 1 AND 5),
  report_usefulness_rating INTEGER CHECK (report_usefulness_rating BETWEEN 1 AND 5),
  notes TEXT,
  submitted_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT pilot_feedback_weekly_unique UNIQUE (organization_id, site_id, week_start)
);

ALTER TABLE public.pilot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pilot feedback"
ON public.pilot_feedback
FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Staff can submit pilot feedback"
ON public.pilot_feedback
FOR INSERT
WITH CHECK (
  user_belongs_to_org(auth.uid(), organization_id) AND
  submitted_by = auth.uid()
);

-- Add last_manual_log_at to units if not exists (for faster queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'last_manual_log_at'
  ) THEN
    ALTER TABLE public.units ADD COLUMN last_manual_log_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create function to update last_manual_log_at on insert
CREATE OR REPLACE FUNCTION public.update_unit_last_manual_log()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.units 
  SET last_manual_log_at = NEW.logged_at
  WHERE id = NEW.unit_id 
    AND (last_manual_log_at IS NULL OR last_manual_log_at < NEW.logged_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for manual log updates
DROP TRIGGER IF EXISTS update_unit_last_manual_log_trigger ON public.manual_temperature_logs;
CREATE TRIGGER update_unit_last_manual_log_trigger
  AFTER INSERT ON public.manual_temperature_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_unit_last_manual_log();

-- Trigger for updated_at on escalation_policies
CREATE TRIGGER update_escalation_policies_updated_at
  BEFORE UPDATE ON public.escalation_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();