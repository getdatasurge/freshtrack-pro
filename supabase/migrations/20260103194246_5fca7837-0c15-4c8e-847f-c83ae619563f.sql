-- Add step-based provisioning state fields to ttn_connections
ALTER TABLE public.ttn_connections 
ADD COLUMN IF NOT EXISTS provisioning_step text,
ADD COLUMN IF NOT EXISTS provisioning_started_at timestamptz,
ADD COLUMN IF NOT EXISTS provisioning_last_heartbeat_at timestamptz,
ADD COLUMN IF NOT EXISTS provisioning_attempt_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_http_status integer,
ADD COLUMN IF NOT EXISTS last_http_body text;

-- Backfill provisioning_status values to new state machine
-- not_started -> idle, completed -> ready
UPDATE public.ttn_connections 
SET provisioning_status = 'idle' 
WHERE provisioning_status = 'not_started';

UPDATE public.ttn_connections 
SET provisioning_status = 'ready' 
WHERE provisioning_status = 'completed';

-- Update default value for provisioning_status
ALTER TABLE public.ttn_connections 
ALTER COLUMN provisioning_status SET DEFAULT 'idle';

-- Add index for watchdog queries (find stale provisioning rows)
CREATE INDEX IF NOT EXISTS idx_ttn_connections_provisioning_stale 
ON public.ttn_connections (provisioning_status, provisioning_last_heartbeat_at) 
WHERE provisioning_status = 'provisioning';

-- Create watchdog function to mark stale provisioning as failed
CREATE OR REPLACE FUNCTION public.watchdog_fail_stale_ttn_provisioning()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE ttn_connections
  SET 
    provisioning_status = 'failed',
    provisioning_error = 'Provisioning stalled (watchdog: no heartbeat for 2+ minutes). Safe to retry.',
    provisioning_step = COALESCE(provisioning_step, 'unknown'),
    provisioning_last_heartbeat_at = now(),
    updated_at = now()
  WHERE provisioning_status = 'provisioning'
    AND (
      provisioning_last_heartbeat_at IS NULL 
      OR provisioning_last_heartbeat_at < now() - interval '2 minutes'
    );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count > 0 THEN
    RAISE LOG '[watchdog_fail_stale_ttn_provisioning] Marked % stale provisioning rows as failed', v_count;
  END IF;
  
  RETURN v_count;
END;
$function$;

-- Fix any currently stuck rows immediately
UPDATE public.ttn_connections
SET 
  provisioning_status = 'failed',
  provisioning_error = 'Provisioning was stuck (migration repair). Safe to retry.',
  provisioning_step = COALESCE(provisioning_step, provisioning_last_step, 'unknown'),
  provisioning_last_heartbeat_at = now(),
  updated_at = now()
WHERE provisioning_status = 'provisioning'
  AND (
    provisioning_last_heartbeat_at IS NULL 
    OR provisioning_last_heartbeat_at < now() - interval '2 minutes'
  );