
-- Create ttn_cleanup_log table for per-step TTN deprovision visibility
CREATE TABLE public.ttn_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.ttn_deprovision_jobs(id) ON DELETE SET NULL,
  sensor_id uuid,
  dev_eui text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('deprovision_is', 'deprovision_ns', 'deprovision_as', 'deprovision_js')),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  ttn_response jsonb,
  ttn_status_code integer,
  ttn_endpoint text,
  cluster text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ttn_cleanup_log_org ON public.ttn_cleanup_log(organization_id, created_at DESC);
CREATE INDEX idx_ttn_cleanup_log_job ON public.ttn_cleanup_log(job_id);
CREATE INDEX idx_ttn_cleanup_log_sensor ON public.ttn_cleanup_log(sensor_id);

-- Enable RLS
ALTER TABLE public.ttn_cleanup_log ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read their own org's logs
CREATE POLICY "Org members can view cleanup logs"
  ON public.ttn_cleanup_log
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (edge functions use service role)
CREATE POLICY "Service role can insert cleanup logs"
  ON public.ttn_cleanup_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);
