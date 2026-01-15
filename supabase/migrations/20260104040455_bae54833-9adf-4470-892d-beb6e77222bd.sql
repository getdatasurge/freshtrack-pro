-- Fix the deferrable constraint issue on ttn_provisioning_queue
-- This is causing 55000 errors during organization creation

-- Step 1: Drop the deferrable constraint
ALTER TABLE public.ttn_provisioning_queue 
DROP CONSTRAINT IF EXISTS unique_pending_org;

-- Step 2: Create a non-deferrable unique index instead
-- Using a partial unique index for pending/running statuses only
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_org_idx 
ON public.ttn_provisioning_queue (organization_id) 
WHERE status IN ('pending', 'running');

-- Step 3: Update the queue_tts_provisioning function to use explicit checks
-- instead of relying on ON CONFLICT with deferrable constraints
CREATE OR REPLACE FUNCTION public.queue_tts_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_job_id uuid;
BEGIN
  -- Explicit check for existing pending/running job (avoids ON CONFLICT issues)
  SELECT id INTO v_existing_job_id
  FROM public.ttn_provisioning_queue 
  WHERE organization_id = NEW.id 
    AND status IN ('pending', 'running')
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  
  -- Only insert if no pending/running job exists
  IF v_existing_job_id IS NULL THEN
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
    );
    
    RAISE LOG '[queue_tts_provisioning] Queued TTS provisioning for org: %', NEW.id;
  ELSE
    RAISE LOG '[queue_tts_provisioning] Pending/running job already exists for org: % (job_id: %)', NEW.id, v_existing_job_id;
  END IF;
  
  RETURN NEW;
EXCEPTION 
  WHEN unique_violation THEN
    -- Race condition: job was inserted by another process, safe to ignore
    RAISE LOG '[queue_tts_provisioning] Job already exists for org: % (race condition handled)', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log but don't block org creation
    RAISE WARNING '[queue_tts_provisioning] Error queuing job for org %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$function$;

-- Step 4: Fix any existing stuck provisioning rows
UPDATE public.ttn_connections
SET 
  provisioning_status = 'failed',
  provisioning_error = 'Marked failed during migration - safe to retry',
  provisioning_step = COALESCE(provisioning_step, 'unknown')
WHERE provisioning_status = 'provisioning'
  AND (
    provisioning_last_heartbeat_at IS NULL 
    OR provisioning_last_heartbeat_at < now() - interval '2 minutes'
  );