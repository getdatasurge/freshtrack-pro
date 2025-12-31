-- Add site_id and unit_id columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
ADD COLUMN unit_id uuid REFERENCES units(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_profiles_site_id ON public.profiles(site_id);
CREATE INDEX idx_profiles_unit_id ON public.profiles(unit_id);

-- Create sync log table for audit and retry tracking
CREATE TABLE public.user_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- RLS: Only service role can access (no user access)
ALTER TABLE public.user_sync_log ENABLE ROW LEVEL SECURITY;

-- Create the trigger function using pg_net
CREATE OR REPLACE FUNCTION public.emit_user_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload jsonb;
  service_role_key text;
BEGIN
  -- Build the payload
  payload := jsonb_build_object(
    'event_type', TG_OP,
    'user_id', NEW.user_id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'organization_id', NEW.organization_id,
    'site_id', NEW.site_id,
    'unit_id', NEW.unit_id,
    'updated_at', NEW.updated_at
  );
  
  -- Get service role key from vault or env
  service_role_key := current_setting('supabase.service_role_key', true);
  
  -- Call the edge function asynchronously using pg_net
  PERFORM net.http_post(
    url := 'https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/user-sync-emitter',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );
  
  -- Log the sync attempt
  INSERT INTO public.user_sync_log (user_id, event_type, payload, status)
  VALUES (NEW.user_id, TG_OP, payload, 'pending');
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block the transaction
  INSERT INTO public.user_sync_log (user_id, event_type, payload, status, last_error)
  VALUES (NEW.user_id, TG_OP, payload, 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table for INSERT and UPDATE
CREATE TRIGGER on_profile_sync
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_user_sync();