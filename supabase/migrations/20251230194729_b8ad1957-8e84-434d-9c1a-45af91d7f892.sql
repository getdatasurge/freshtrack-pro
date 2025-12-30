-- Create the ttn_deprovision_jobs table for reliable TTN device cleanup
CREATE TABLE public.ttn_deprovision_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sensor_id uuid,  -- nullable: sensor may already be deleted
  dev_eui text NOT NULL,
  ttn_device_id text,
  ttn_application_id text NOT NULL,
  
  -- Job metadata
  reason text NOT NULL CHECK (reason IN (
    'SENSOR_DELETED', 'USER_DELETED', 'ORG_DELETED', 
    'SITE_DELETED', 'UNIT_DELETED', 'MANUAL_CLEANUP'
  )),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING', 'BLOCKED'
  )),
  
  -- Retry logic
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz,
  
  -- Error tracking
  last_error_code text,  -- RIGHTS_ERROR, OTHER_CLUSTER, NOT_FOUND, RATE_LIMIT, UNKNOWN
  last_error_message text,
  last_error_payload jsonb,
  
  -- Audit
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  
  -- Context for event logging
  site_id uuid,
  unit_id uuid,
  sensor_name text
);

-- Indexes for efficient processing
CREATE INDEX idx_deprovision_jobs_pending ON ttn_deprovision_jobs(status, next_retry_at) 
  WHERE status IN ('PENDING', 'RETRYING');
CREATE INDEX idx_deprovision_jobs_org ON ttn_deprovision_jobs(organization_id);
CREATE INDEX idx_deprovision_jobs_blocked ON ttn_deprovision_jobs(organization_id, status) 
  WHERE status IN ('FAILED', 'BLOCKED');
CREATE INDEX idx_deprovision_jobs_dev_eui ON ttn_deprovision_jobs(dev_eui);

-- RLS: Admins can view their org's jobs
ALTER TABLE ttn_deprovision_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view jobs" ON ttn_deprovision_jobs
  FOR SELECT USING (
    has_role(auth.uid(), organization_id, 'owner') OR 
    has_role(auth.uid(), organization_id, 'admin')
  );

-- Create trigger function to enqueue TTN deprovision job on sensor delete
CREATE OR REPLACE FUNCTION public.enqueue_ttn_deprovision_on_sensor_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id uuid;
BEGIN
  -- Only create job if sensor was provisioned to TTN
  IF OLD.ttn_device_id IS NOT NULL AND OLD.ttn_application_id IS NOT NULL THEN
    -- Get site_id from unit if available
    IF OLD.unit_id IS NOT NULL THEN
      SELECT a.site_id INTO v_site_id
      FROM units u
      JOIN areas a ON a.id = u.area_id
      WHERE u.id = OLD.unit_id;
    END IF;
    
    INSERT INTO ttn_deprovision_jobs (
      organization_id, sensor_id, dev_eui, ttn_device_id, 
      ttn_application_id, reason, sensor_name, unit_id, site_id
    ) VALUES (
      OLD.organization_id, OLD.id, OLD.dev_eui, OLD.ttn_device_id,
      OLD.ttn_application_id, 'SENSOR_DELETED', OLD.name, OLD.unit_id, v_site_id
    );
    
    RAISE LOG '[enqueue_ttn_deprovision] Queued deprovision job for sensor % (dev_eui: %)', OLD.name, OLD.dev_eui;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger on lora_sensors
CREATE TRIGGER trg_enqueue_deprovision
  BEFORE DELETE ON lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_ttn_deprovision_on_sensor_delete();

-- Function to enqueue jobs for bulk operations (called from edge functions)
CREATE OR REPLACE FUNCTION public.enqueue_deprovision_jobs_for_unit(p_unit_id uuid, p_reason text, p_created_by uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_site_id uuid;
BEGIN
  -- Get site_id
  SELECT a.site_id INTO v_site_id
  FROM units u
  JOIN areas a ON a.id = u.area_id
  WHERE u.id = p_unit_id;
  
  -- Insert jobs for all TTN-provisioned sensors in this unit
  INSERT INTO ttn_deprovision_jobs (
    organization_id, sensor_id, dev_eui, ttn_device_id, 
    ttn_application_id, reason, sensor_name, unit_id, site_id, created_by
  )
  SELECT 
    ls.organization_id, ls.id, ls.dev_eui, ls.ttn_device_id,
    ls.ttn_application_id, p_reason, ls.name, ls.unit_id, v_site_id, p_created_by
  FROM lora_sensors ls
  WHERE ls.unit_id = p_unit_id
    AND ls.ttn_device_id IS NOT NULL
    AND ls.ttn_application_id IS NOT NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get count of jobs needing attention
CREATE OR REPLACE FUNCTION public.get_deprovision_job_stats(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'PENDING'),
    'running', COUNT(*) FILTER (WHERE status = 'RUNNING'),
    'retrying', COUNT(*) FILTER (WHERE status = 'RETRYING'),
    'failed', COUNT(*) FILTER (WHERE status = 'FAILED'),
    'blocked', COUNT(*) FILTER (WHERE status = 'BLOCKED'),
    'succeeded', COUNT(*) FILTER (WHERE status = 'SUCCEEDED'),
    'needs_attention', COUNT(*) FILTER (WHERE status IN ('FAILED', 'BLOCKED'))
  )
  FROM ttn_deprovision_jobs
  WHERE organization_id = p_organization_id
$$;