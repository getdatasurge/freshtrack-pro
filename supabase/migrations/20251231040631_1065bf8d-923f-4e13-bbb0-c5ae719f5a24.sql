-- Replace the emit_user_sync function to include user_sites and default_site_id
CREATE OR REPLACE FUNCTION public.emit_user_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload jsonb;
  service_role_key text;
  v_user_sites jsonb;
  v_default_site_id uuid;
  v_site_count int;
BEGIN
  -- Get all active sites for this user's organization
  IF NEW.organization_id IS NOT NULL THEN
    SELECT 
      COALESCE(jsonb_agg(jsonb_build_object('site_id', s.id, 'site_name', s.name)), '[]'::jsonb),
      COUNT(*)
    INTO v_user_sites, v_site_count
    FROM public.sites s
    WHERE s.organization_id = NEW.organization_id
      AND s.deleted_at IS NULL
      AND s.is_active = true;
    
    -- Determine default_site_id
    -- Priority: 1) explicit profile.site_id, 2) single site auto-select, 3) null
    IF NEW.site_id IS NOT NULL THEN
      v_default_site_id := NEW.site_id;
    ELSIF v_site_count = 1 THEN
      SELECT s.id INTO v_default_site_id
      FROM public.sites s
      WHERE s.organization_id = NEW.organization_id
        AND s.deleted_at IS NULL
        AND s.is_active = true
      LIMIT 1;
    ELSE
      v_default_site_id := NULL;
    END IF;
  ELSE
    v_user_sites := '[]'::jsonb;
    v_default_site_id := NULL;
  END IF;

  -- Build the payload with site membership data
  payload := jsonb_build_object(
    'event_type', TG_OP,
    'user_id', NEW.user_id,
    'email', NEW.email,
    'full_name', NEW.full_name,
    'organization_id', NEW.organization_id,
    'site_id', NEW.site_id,
    'unit_id', NEW.unit_id,
    'updated_at', NEW.updated_at,
    'default_site_id', v_default_site_id,
    'user_sites', v_user_sites
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
  
  -- Log the sync attempt with full payload for debugging
  INSERT INTO public.user_sync_log (user_id, event_type, payload, status)
  VALUES (NEW.user_id, TG_OP, payload, 'pending');
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block the transaction
  INSERT INTO public.user_sync_log (user_id, event_type, payload, status, last_error)
  VALUES (NEW.user_id, TG_OP, payload, 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;