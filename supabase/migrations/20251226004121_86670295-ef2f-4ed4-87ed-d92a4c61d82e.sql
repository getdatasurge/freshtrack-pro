-- Allow new users to create organizations and become owners
-- This is needed for the onboarding flow

-- Create a secure function to handle organization creation with owner role assignment
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_timezone TEXT DEFAULT 'America/New_York',
  p_compliance_mode compliance_mode DEFAULT 'standard'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already belongs to an organization
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;
  
  -- Create the organization
  INSERT INTO public.organizations (name, slug, timezone, compliance_mode)
  VALUES (p_name, p_slug, p_timezone, p_compliance_mode)
  RETURNING id INTO v_org_id;
  
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
  
  RETURN v_org_id;
END;
$$;

-- Function to create a site (for users in an org)
CREATE OR REPLACE FUNCTION public.create_site_for_org(
  p_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_postal_code TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the user's organization
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;
  
  -- Check if user has permission (owner or admin)
  IF NOT (has_role(auth.uid(), v_org_id, 'owner') OR has_role(auth.uid(), v_org_id, 'admin')) THEN
    RAISE EXCEPTION 'User does not have permission to create sites';
  END IF;
  
  -- Create the site
  INSERT INTO public.sites (organization_id, name, address, city, state, postal_code, timezone)
  VALUES (v_org_id, p_name, p_address, p_city, p_state, p_postal_code, p_timezone)
  RETURNING id INTO v_site_id;
  
  RETURN v_site_id;
END;
$$;

-- Function to create an area in a site
CREATE OR REPLACE FUNCTION public.create_area_for_site(
  p_site_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_area_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the organization from the site
  SELECT s.organization_id INTO v_org_id
  FROM public.sites s
  WHERE s.id = p_site_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Site not found';
  END IF;
  
  -- Check if user has permission
  IF NOT (has_role(auth.uid(), v_org_id, 'owner') OR has_role(auth.uid(), v_org_id, 'admin')) THEN
    RAISE EXCEPTION 'User does not have permission to create areas';
  END IF;
  
  -- Create the area
  INSERT INTO public.areas (site_id, name, description)
  VALUES (p_site_id, p_name, p_description)
  RETURNING id INTO v_area_id;
  
  RETURN v_area_id;
END;
$$;

-- Function to create a unit in an area
CREATE OR REPLACE FUNCTION public.create_unit_for_area(
  p_area_id UUID,
  p_name TEXT,
  p_unit_type unit_type DEFAULT 'fridge',
  p_temp_limit_high DECIMAL DEFAULT 41.0,
  p_temp_limit_low DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the organization from the area -> site
  SELECT s.organization_id INTO v_org_id
  FROM public.areas a
  JOIN public.sites s ON s.id = a.site_id
  WHERE a.id = p_area_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Area not found';
  END IF;
  
  -- Check if user has permission
  IF NOT (has_role(auth.uid(), v_org_id, 'owner') OR has_role(auth.uid(), v_org_id, 'admin')) THEN
    RAISE EXCEPTION 'User does not have permission to create units';
  END IF;
  
  -- Set default temp limits based on unit type
  IF p_unit_type IN ('freezer', 'walk_in_freezer', 'blast_chiller') THEN
    p_temp_limit_high := COALESCE(p_temp_limit_high, 0);
    p_temp_limit_low := COALESCE(p_temp_limit_low, -20);
  ELSE
    p_temp_limit_high := COALESCE(p_temp_limit_high, 41);
  END IF;
  
  -- Create the unit
  INSERT INTO public.units (area_id, name, unit_type, temp_limit_high, temp_limit_low)
  VALUES (p_area_id, p_name, p_unit_type, p_temp_limit_high, p_temp_limit_low)
  RETURNING id INTO v_unit_id;
  
  RETURN v_unit_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_site_for_org TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_area_for_site TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_unit_for_area TO authenticated;