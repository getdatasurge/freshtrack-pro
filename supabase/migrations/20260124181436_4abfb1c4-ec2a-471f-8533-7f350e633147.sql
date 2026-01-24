-- TTN Deprovision Run Tracking Tables
-- Tracks full organization deprovision runs and their atomic steps
-- Version: 20260124

-- ============================================================================
-- Table 1: ttn_deprovision_runs
-- Tracks a complete deprovision run for an organization
-- ============================================================================
CREATE TABLE public.ttn_deprovision_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  requested_by uuid NULL,
  source text NOT NULL DEFAULT 'edge_function',
  action text NOT NULL DEFAULT 'deprovision',
  status text NOT NULL DEFAULT 'QUEUED',
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  request_id text NULL,
  ttn_region text NULL,
  ttn_org_id text NULL,
  ttn_application_id text NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT ttn_deprovision_runs_status_check CHECK (
    status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL')
  )
);

-- Indexes for common query patterns
CREATE INDEX idx_ttn_deprovision_runs_org_created 
  ON public.ttn_deprovision_runs (organization_id, created_at DESC);

CREATE INDEX idx_ttn_deprovision_runs_status_created 
  ON public.ttn_deprovision_runs (status, created_at DESC);

-- Enable RLS (deny all direct access - service role bypasses)
ALTER TABLE public.ttn_deprovision_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to deprovision runs"
  ON public.ttn_deprovision_runs
  FOR ALL
  USING (false);

-- ============================================================================
-- Table 2: ttn_deprovision_run_steps
-- Tracks individual atomic actions within a deprovision run
-- ============================================================================
CREATE TABLE public.ttn_deprovision_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ttn_deprovision_runs(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  target_type text NULL,
  target_id text NULL,
  attempt int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'PENDING',
  http_status int NULL,
  ttn_endpoint text NULL,
  response_snippet text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT ttn_deprovision_run_steps_status_check CHECK (
    status IN ('PENDING', 'RUNNING', 'OK', 'ERROR', 'SKIPPED')
  ),
  CONSTRAINT ttn_deprovision_run_steps_target_type_check CHECK (
    target_type IS NULL OR target_type IN ('device', 'application', 'organization', 'dev_eui', 'db')
  )
);

-- Index for fetching steps by run
CREATE INDEX idx_ttn_deprovision_run_steps_run_created 
  ON public.ttn_deprovision_run_steps (run_id, created_at ASC);

-- Enable RLS (deny all direct access - service role bypasses)
ALTER TABLE public.ttn_deprovision_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to deprovision run steps"
  ON public.ttn_deprovision_run_steps
  FOR ALL
  USING (false);

-- ============================================================================
-- Trigger: Auto-update updated_at on ttn_deprovision_runs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_ttn_deprovision_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ttn_deprovision_runs_updated_at
  BEFORE UPDATE ON public.ttn_deprovision_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ttn_deprovision_runs_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.ttn_deprovision_runs IS 
  'Tracks full TTN deprovision runs per organization. One run = many steps.';

COMMENT ON TABLE public.ttn_deprovision_run_steps IS 
  'Tracks individual atomic actions (delete, purge, verify) within a deprovision run.';

COMMENT ON COLUMN public.ttn_deprovision_runs.status IS 
  'QUEUED=waiting, RUNNING=in progress, SUCCEEDED=all critical ok, FAILED=critical failed, PARTIAL=some ok some failed';

COMMENT ON COLUMN public.ttn_deprovision_run_steps.status IS 
  'PENDING=not started, RUNNING=in progress, OK=success, ERROR=failed, SKIPPED=not needed (e.g. 404)';

COMMENT ON COLUMN public.ttn_deprovision_run_steps.response_snippet IS 
  'First 400 chars of response for debugging';