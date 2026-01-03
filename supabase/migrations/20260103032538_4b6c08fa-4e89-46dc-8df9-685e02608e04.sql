-- ============================================================================
-- Self-Hosted TTS Multi-Tenant Provisioning Schema
-- ============================================================================

-- 1. Add self-hosted TTS columns to ttn_connections
ALTER TABLE public.ttn_connections 
  ADD COLUMN IF NOT EXISTS tts_base_url text,
  ADD COLUMN IF NOT EXISTS tts_organization_id text,
  ADD COLUMN IF NOT EXISTS tts_org_provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS tts_org_provisioning_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS tts_org_admin_added boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provisioning_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_provisioning_attempt_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.ttn_connections.tts_base_url IS 'Self-hosted TTS instance URL (e.g., https://tts.frostguard.io)';
COMMENT ON COLUMN public.ttn_connections.tts_organization_id IS 'TTS Organization ID (fg-{customer_uuid_prefix})';
COMMENT ON COLUMN public.ttn_connections.tts_org_provisioning_status IS 'Status: not_started, pending, provisioning, completed, failed';

-- 2. Create TTS provisioning queue table for async processing
CREATE TABLE IF NOT EXISTS public.ttn_provisioning_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, blocked
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  
  -- Progress tracking
  current_step text,  -- create_org, add_collaborator, create_app, create_api_key, configure_webhook
  completed_steps text[] DEFAULT '{}',
  
  -- Error tracking
  last_error text,
  last_error_at timestamptz,
  error_code text,
  
  -- Metadata
  triggered_by uuid REFERENCES auth.users(id),
  trigger_reason text DEFAULT 'org_created',  -- org_created, manual_retry, activation
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  
  -- Ensure one queue entry per org
  CONSTRAINT unique_pending_org UNIQUE (organization_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Enable RLS
ALTER TABLE public.ttn_provisioning_queue ENABLE ROW LEVEL SECURITY;

-- Admins can view queue entries for their org
CREATE POLICY "Admins can view provisioning queue"
  ON public.ttn_provisioning_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), organization_id, 'owner'::app_role) OR
    has_role(auth.uid(), organization_id, 'admin'::app_role)
  );

-- Admins can insert retry entries
CREATE POLICY "Admins can create retry entries"
  ON public.ttn_provisioning_queue
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), organization_id, 'owner'::app_role) OR
    has_role(auth.uid(), organization_id, 'admin'::app_role)
  );

-- 3. Create function to queue TTS provisioning on org creation
CREATE OR REPLACE FUNCTION public.queue_tts_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Queue TTS provisioning for new organizations
  INSERT INTO public.ttn_provisioning_queue (
    organization_id,
    status,
    trigger_reason,
    triggered_by
  ) VALUES (
    NEW.id,
    'pending',
    'org_created',
    auth.uid()
  )
  ON CONFLICT DO NOTHING;
  
  RAISE LOG '[queue_tts_provisioning] Queued TTS provisioning for org: %', NEW.id;
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger to auto-queue on org creation
DROP TRIGGER IF EXISTS on_organization_created_queue_tts ON public.organizations;
CREATE TRIGGER on_organization_created_queue_tts
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_tts_provisioning();

-- 5. Helper function to get next pending job
CREATE OR REPLACE FUNCTION public.get_next_tts_provisioning_job()
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  org_name text,
  org_slug text,
  attempts integer,
  current_step text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH locked_job AS (
    SELECT pq.id
    FROM public.ttn_provisioning_queue pq
    WHERE pq.status IN ('pending', 'running')
      AND (pq.next_retry_at IS NULL OR pq.next_retry_at <= now())
      AND pq.attempts < pq.max_attempts
    ORDER BY pq.priority DESC, pq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ttn_provisioning_queue q
  SET 
    status = 'running',
    started_at = COALESCE(q.started_at, now()),
    attempts = q.attempts + 1,
    last_provisioning_attempt_at = now()
  FROM locked_job
  WHERE q.id = locked_job.id
  RETURNING 
    q.id,
    q.organization_id,
    (SELECT o.name FROM public.organizations o WHERE o.id = q.organization_id) as org_name,
    (SELECT o.slug FROM public.organizations o WHERE o.id = q.organization_id) as org_slug,
    q.attempts,
    q.current_step;
END;
$$;

-- 6. Helper function to mark job status
CREATE OR REPLACE FUNCTION public.update_tts_provisioning_job(
  p_job_id uuid,
  p_status text,
  p_current_step text DEFAULT NULL,
  p_completed_steps text[] DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ttn_provisioning_queue
  SET
    status = p_status,
    current_step = COALESCE(p_current_step, current_step),
    completed_steps = COALESCE(p_completed_steps, completed_steps),
    last_error = CASE WHEN p_error IS NOT NULL THEN p_error ELSE last_error END,
    last_error_at = CASE WHEN p_error IS NOT NULL THEN now() ELSE last_error_at END,
    error_code = CASE WHEN p_error_code IS NOT NULL THEN p_error_code ELSE error_code END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    next_retry_at = CASE 
      WHEN p_status = 'failed' AND attempts < max_attempts 
      THEN now() + (attempts * interval '1 minute')  -- Exponential backoff
      ELSE NULL 
    END
  WHERE id = p_job_id;
END;
$$;

-- 7. Index for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_ttn_provisioning_queue_pending 
  ON public.ttn_provisioning_queue (status, priority DESC, created_at ASC)
  WHERE status IN ('pending', 'running');

-- 8. Index for org lookup
CREATE INDEX IF NOT EXISTS idx_ttn_provisioning_queue_org
  ON public.ttn_provisioning_queue (organization_id);

-- 9. Index on ttn_connections for TTS org lookup
CREATE INDEX IF NOT EXISTS idx_ttn_connections_tts_org
  ON public.ttn_connections (tts_organization_id)
  WHERE tts_organization_id IS NOT NULL;