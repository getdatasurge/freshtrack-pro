-- Add tracking columns to alerts table for notification state
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS first_active_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_notified_reason TEXT;

-- Create notification_events table for observability
CREATE TABLE public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  site_id UUID REFERENCES public.sites(id),
  unit_id UUID REFERENCES public.units(id),
  alert_id UUID REFERENCES public.alerts(id),
  channel TEXT NOT NULL DEFAULT 'email',
  event_type TEXT NOT NULL, -- ALERT_ACTIVE, ALERT_RESOLVED, REMINDER
  to_recipients JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL, -- SENT, SKIPPED, FAILED
  reason TEXT, -- required for SKIPPED/FAILED
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notification_settings table for org-level config
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id),
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  notify_temp_excursion BOOLEAN NOT NULL DEFAULT true,
  notify_alarm_active BOOLEAN NOT NULL DEFAULT true,
  notify_manual_required BOOLEAN NOT NULL DEFAULT true,
  notify_offline BOOLEAN NOT NULL DEFAULT false,
  notify_low_battery BOOLEAN NOT NULL DEFAULT false,
  notify_warnings BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_events
CREATE POLICY "Users can view notification events in their org"
ON public.notification_events
FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

-- RLS policies for notification_settings
CREATE POLICY "Users can view notification settings in their org"
ON public.notification_settings
FOR SELECT
USING (user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage notification settings"
ON public.notification_settings
FOR ALL
USING (
  has_role(auth.uid(), organization_id, 'owner'::app_role) OR
  has_role(auth.uid(), organization_id, 'admin'::app_role)
);

-- Add trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();