-- Create sms_alert_log table for tracking SMS deliveries
CREATE TABLE public.sms_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  twilio_sid TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_alert_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for viewing logs (users can see their org's logs)
CREATE POLICY "Users can view SMS logs in their org"
  ON public.sms_alert_log FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

-- RLS policy for inserting (system can insert via service role)
CREATE POLICY "System can insert SMS logs"
  ON public.sms_alert_log FOR INSERT
  WITH CHECK (true);

-- Index for rate limiting queries (check recent SMS by user and alert type)
CREATE INDEX sms_alert_log_rate_limit_idx 
  ON public.sms_alert_log(user_id, alert_type, created_at DESC);

-- Index for organization queries
CREATE INDEX sms_alert_log_org_idx 
  ON public.sms_alert_log(organization_id, created_at DESC);

-- Comment on table
COMMENT ON TABLE public.sms_alert_log IS 'Logs all SMS alerts sent via Twilio, including rate-limited and failed attempts';