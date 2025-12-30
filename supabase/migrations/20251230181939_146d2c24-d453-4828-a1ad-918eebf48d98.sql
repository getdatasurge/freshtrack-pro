-- Create function to trigger sensor cleanup when a user profile is deleted
CREATE OR REPLACE FUNCTION public.trigger_cleanup_user_sensors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only proceed if the user has an organization
  IF OLD.organization_id IS NOT NULL THEN
    -- Check if user has any sensors before making the call
    IF EXISTS (SELECT 1 FROM lora_sensors WHERE created_by = OLD.user_id LIMIT 1) THEN
      -- Make async HTTP call to cleanup edge function using pg_net
      PERFORM net.http_post(
        url := 'https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/cleanup-user-sensors',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := jsonb_build_object(
          'user_id', OLD.user_id::text,
          'organization_id', OLD.organization_id::text
        )
      );
      
      RAISE LOG '[trigger_cleanup_user_sensors] Initiated cleanup for user % in org %', 
        OLD.user_id, OLD.organization_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger on profiles table
CREATE TRIGGER on_profile_deleted_cleanup_sensors
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_cleanup_user_sensors();

-- Fallback: Nullify created_by if edge function call fails (runs after the HTTP call)
CREATE OR REPLACE FUNCTION public.nullify_sensor_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE lora_sensors 
  SET created_by = NULL 
  WHERE created_by = OLD.user_id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_profile_deleted_nullify_sensors
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.nullify_sensor_creator();