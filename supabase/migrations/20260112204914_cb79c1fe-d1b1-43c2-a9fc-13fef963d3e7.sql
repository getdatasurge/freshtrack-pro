-- Create table to store Telnyx webhook events for idempotency and audit trail
CREATE TABLE public.telnyx_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_telnyx_webhook_events_event_id ON public.telnyx_webhook_events(event_id);
CREATE INDEX idx_telnyx_webhook_events_message_id ON public.telnyx_webhook_events(message_id);
CREATE INDEX idx_telnyx_webhook_events_created_at ON public.telnyx_webhook_events(created_at DESC);

-- Enable RLS (service role only - webhook events are internal)
ALTER TABLE public.telnyx_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access
CREATE POLICY "Service role can manage webhook events"
ON public.telnyx_webhook_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create table to store Telnyx webhook configuration
CREATE TABLE public.telnyx_webhook_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_id text,
  webhook_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'error')),
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one config row per org (or global if null)
CREATE UNIQUE INDEX idx_telnyx_webhook_config_org ON public.telnyx_webhook_config(COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Enable RLS
ALTER TABLE public.telnyx_webhook_config ENABLE ROW LEVEL SECURITY;

-- Policy: Service role and org members can view
CREATE POLICY "Org members can view webhook config"
ON public.telnyx_webhook_config
FOR SELECT
USING (
  auth.role() = 'service_role' OR
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Policy: Only service role can modify
CREATE POLICY "Service role can manage webhook config"
ON public.telnyx_webhook_config
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add columns to sms_alert_log for enhanced tracking
ALTER TABLE public.sms_alert_log
ADD COLUMN IF NOT EXISTS from_number text,
ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;

-- Create index for delivery status queries
CREATE INDEX IF NOT EXISTS idx_sms_alert_log_delivery_updated ON public.sms_alert_log(delivery_updated_at DESC);

-- Add trigger for updated_at on telnyx_webhook_config
CREATE TRIGGER update_telnyx_webhook_config_updated_at
  BEFORE UPDATE ON public.telnyx_webhook_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();