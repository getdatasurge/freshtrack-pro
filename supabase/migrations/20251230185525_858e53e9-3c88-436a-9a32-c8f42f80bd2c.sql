-- 1. Create cleanup queue table to stage sensors for TTN de-provisioning
CREATE TABLE public.sensor_cleanup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid NOT NULL,
  sensor_name text NOT NULL,
  dev_eui text NOT NULL,
  ttn_device_id text,
  ttn_application_id text,
  organization_id uuid NOT NULL,
  deleted_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  error_message text
);

-- Enable RLS - only service role can access
ALTER TABLE public.sensor_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- No user access policy - service role bypasses RLS
CREATE POLICY "No user access" ON public.sensor_cleanup_queue
  FOR ALL USING (false);

-- 2. Replace the trigger function to stage sensors synchronously
CREATE OR REPLACE FUNCTION public.trigger_cleanup_user_sensors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Copy sensors to cleanup queue BEFORE the FK cascade nullifies created_by
  -- This captures the data synchronously so we don't lose the association
  INSERT INTO sensor_cleanup_queue (sensor_id, sensor_name, dev_eui, ttn_device_id, ttn_application_id, organization_id, deleted_user_id)
  SELECT id, name, dev_eui, ttn_device_id, ttn_application_id, organization_id, OLD.user_id
  FROM lora_sensors 
  WHERE created_by = OLD.user_id;
  
  RAISE LOG '[trigger_cleanup_user_sensors] Queued % sensors for cleanup (user: %)', 
    (SELECT count(*) FROM lora_sensors WHERE created_by = OLD.user_id), OLD.user_id;
  
  RETURN OLD;
END;
$$;

-- 3. Create the processing function for the queue
CREATE OR REPLACE FUNCTION public.process_sensor_cleanup_queue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  queue_item RECORD;
  processed_count int := 0;
  error_count int := 0;
  result jsonb;
BEGIN
  FOR queue_item IN 
    SELECT * FROM sensor_cleanup_queue 
    WHERE processed_at IS NULL 
    ORDER BY created_at 
    LIMIT 10
  LOOP
    BEGIN
      -- Call TTN de-provision via edge function using pg_net
      PERFORM net.http_post(
        url := 'https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-provision-device',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := jsonb_build_object(
          'action', 'delete',
          'sensor_id', queue_item.sensor_id::text,
          'organization_id', queue_item.organization_id::text
        )
      );
      
      -- Delete the sensor from the database
      DELETE FROM lora_sensors WHERE id = queue_item.sensor_id;
      
      -- Mark as processed
      UPDATE sensor_cleanup_queue 
      SET processed_at = now() 
      WHERE id = queue_item.id;
      
      processed_count := processed_count + 1;
      
      RAISE LOG '[process_sensor_cleanup_queue] Processed sensor % (%)', queue_item.sensor_name, queue_item.sensor_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other items
      UPDATE sensor_cleanup_queue 
      SET error_message = SQLERRM 
      WHERE id = queue_item.id;
      
      error_count := error_count + 1;
      
      RAISE WARNING '[process_sensor_cleanup_queue] Error processing sensor %: %', queue_item.sensor_id, SQLERRM;
    END;
  END LOOP;
  
  result := jsonb_build_object(
    'processed', processed_count,
    'errors', error_count,
    'remaining', (SELECT count(*) FROM sensor_cleanup_queue WHERE processed_at IS NULL)
  );
  
  RETURN result;
END;
$$;

-- 4. Enable pg_cron and pg_net extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 5. Schedule the cleanup job to run every minute
SELECT cron.schedule(
  'process-sensor-cleanup',
  '* * * * *',
  $$SELECT public.process_sensor_cleanup_queue()$$
);