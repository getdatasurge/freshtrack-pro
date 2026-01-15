-- Phase 1: Fix queue_tts_provisioning to remove ON CONFLICT
CREATE OR REPLACE FUNCTION public.queue_tts_provisioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if a pending job already exists for this org (avoid ON CONFLICT with deferrable constraint)
  IF NOT EXISTS (
    SELECT 1 FROM public.ttn_provisioning_queue 
    WHERE organization_id = NEW.id 
      AND status = 'pending'
  ) THEN
    -- Insert new provisioning job
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
    RAISE LOG '[queue_tts_provisioning] Pending job already exists for org: %', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION 
  WHEN unique_violation THEN
    -- Race condition: job was inserted by another process, safe to ignore
    RAISE LOG '[queue_tts_provisioning] Job already exists for org: % (race condition handled)', NEW.id;
    RETURN NEW;
END;
$$;

-- Phase 2: Rewrite create_organization_with_owner with exact contract
-- First drop the existing function to change return type
DROP FUNCTION IF EXISTS public.create_organization_with_owner(text, text, text, compliance_mode);

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name text,
  p_slug text,
  p_timezone text DEFAULT 'America/New_York'::text,
  p_compliance_mode compliance_mode DEFAULT 'standard'::compliance_mode
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_normalized_slug TEXT;
  v_suggestions TEXT[];
  v_year TEXT;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'User must be authenticated',
      'suggestions', '[]'::jsonb
    );
  END IF;
  
  -- Validate name is non-empty
  IF TRIM(p_name) = '' OR p_name IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Organization name cannot be empty',
      'suggestions', '[]'::jsonb
    );
  END IF;
  
  -- Normalize slug (lowercase, alphanumeric + hyphens only)
  v_normalized_slug := LOWER(REGEXP_REPLACE(p_slug, '[^a-zA-Z0-9]+', '-', 'g'));
  v_normalized_slug := TRIM(BOTH '-' FROM v_normalized_slug);
  
  -- Validate slug length
  IF LENGTH(v_normalized_slug) < 2 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Organization URL must be at least 2 characters',
      'suggestions', '[]'::jsonb
    );
  END IF;
  
  -- Get current year for suggestions
  v_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Build suggestions array (5 suggestions as requested)
  v_suggestions := ARRAY[
    v_normalized_slug || '-1',
    v_normalized_slug || '-2',
    v_normalized_slug || '-' || v_year,
    v_normalized_slug || '-fl',
    v_normalized_slug || '-restaurant'
  ];
  
  -- Case-insensitive slug collision check (excluding soft-deleted)
  IF EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE LOWER(slug) = v_normalized_slug
      AND deleted_at IS NULL
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SLUG_TAKEN',
      'message', 'This organization URL is already in use',
      'suggestions', to_jsonb(v_suggestions)
    );
  END IF;
  
  -- Check if user already belongs to an organization
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'User already belongs to an organization',
      'suggestions', '[]'::jsonb
    );
  END IF;
  
  -- Attempt to create the organization (plain INSERT, no ON CONFLICT)
  BEGIN
    INSERT INTO public.organizations (name, slug, timezone, compliance_mode)
    VALUES (TRIM(p_name), v_normalized_slug, p_timezone, p_compliance_mode)
    RETURNING id INTO v_org_id;
  EXCEPTION 
    WHEN unique_violation THEN
      -- Race condition: slug was taken between check and insert
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'SLUG_TAKEN',
        'message', 'This organization URL was just claimed',
        'suggestions', to_jsonb(v_suggestions)
      );
  END;
  
  -- Assign the user as owner (plain INSERT, no ON CONFLICT)
  BEGIN
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (v_user_id, v_org_id, 'owner');
  EXCEPTION 
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'VALIDATION_ERROR',
        'message', 'User already belongs to an organization',
        'suggestions', '[]'::jsonb
      );
  END;
  
  -- Update the user's profile with the organization
  UPDATE public.profiles
  SET organization_id = v_org_id
  WHERE user_id = v_user_id;
  
  -- Create a subscription for the organization (trial)
  INSERT INTO public.subscriptions (organization_id, plan, status, sensor_limit)
  VALUES (v_org_id, 'starter', 'trial', 5);
  
  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_org_id,
    'slug', v_normalized_slug
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'INTERNAL_ERROR',
    'message', SQLERRM,
    'suggestions', '[]'::jsonb
  );
END;
$$;