-- Drop the old function first (return type changed from uuid to jsonb)
DROP FUNCTION IF EXISTS public.create_organization_with_owner(text, text, text, compliance_mode);

-- Rewrite create_organization_with_owner to return structured JSON (no exceptions)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_timezone TEXT DEFAULT 'America/New_York',
  p_compliance_mode compliance_mode DEFAULT 'standard'
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
      'code', 'AUTH_REQUIRED',
      'message', 'User must be authenticated'
    );
  END IF;
  
  -- Check if user already belongs to an organization
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'ALREADY_IN_ORG',
      'message', 'User already belongs to an organization'
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
      'message', 'Organization URL must be at least 2 characters'
    );
  END IF;
  
  -- Get current year for suggestions
  v_year := EXTRACT(YEAR FROM now())::TEXT;
  
  -- Case-insensitive slug collision check (excluding soft-deleted)
  IF EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE LOWER(slug) = v_normalized_slug
      AND deleted_at IS NULL
  ) THEN
    -- Generate suggestions
    v_suggestions := ARRAY[
      v_normalized_slug || '-2',
      v_normalized_slug || '-' || v_year,
      'my-' || v_normalized_slug,
      v_normalized_slug || '-co',
      v_normalized_slug || '-app'
    ];
    
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'SLUG_TAKEN',
      'message', 'This organization URL is already in use',
      'suggestions', to_jsonb(v_suggestions)
    );
  END IF;
  
  -- Attempt to create the organization
  BEGIN
    INSERT INTO public.organizations (name, slug, timezone, compliance_mode)
    VALUES (p_name, v_normalized_slug, p_timezone, p_compliance_mode)
    RETURNING id INTO v_org_id;
  EXCEPTION 
    WHEN unique_violation THEN
      -- Race condition: slug was taken between check and insert
      v_suggestions := ARRAY[
        v_normalized_slug || '-2',
        v_normalized_slug || '-' || v_year,
        'my-' || v_normalized_slug
      ];
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'SLUG_TAKEN',
        'message', 'This organization URL was just claimed',
        'suggestions', to_jsonb(v_suggestions)
      );
  END;
  
  -- Assign the user as owner
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'owner');
  
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
    'message', SQLERRM
  );
END;
$$;