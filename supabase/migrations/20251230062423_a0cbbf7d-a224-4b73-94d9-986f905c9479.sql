-- Add partial unique indexes for case-insensitive uniqueness (excluding soft-deleted records)

-- Unique site names per organization
CREATE UNIQUE INDEX idx_sites_unique_name_per_org 
ON sites (organization_id, LOWER(name)) 
WHERE deleted_at IS NULL;

-- Unique area names per site
CREATE UNIQUE INDEX idx_areas_unique_name_per_site 
ON areas (site_id, LOWER(name)) 
WHERE deleted_at IS NULL;

-- Unique unit names per area
CREATE UNIQUE INDEX idx_units_unique_name_per_area 
ON units (area_id, LOWER(name)) 
WHERE deleted_at IS NULL;

-- Update create_site_for_org to check for duplicates
CREATE OR REPLACE FUNCTION public.create_site_for_org(p_name text, p_address text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_postal_code text DEFAULT NULL::text, p_timezone text DEFAULT 'America/New_York'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Check for duplicate name in this organization
  IF EXISTS (
    SELECT 1 FROM public.sites 
    WHERE organization_id = v_org_id 
    AND LOWER(name) = LOWER(p_name) 
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A site named "%" already exists in this organization', p_name;
  END IF;
  
  -- Create the site
  INSERT INTO public.sites (organization_id, name, address, city, state, postal_code, timezone)
  VALUES (v_org_id, p_name, p_address, p_city, p_state, p_postal_code, p_timezone)
  RETURNING id INTO v_site_id;
  
  RETURN v_site_id;
END;
$function$;

-- Update create_area_for_site to check for duplicates
CREATE OR REPLACE FUNCTION public.create_area_for_site(p_site_id uuid, p_name text, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Check for duplicate name in this site
  IF EXISTS (
    SELECT 1 FROM public.areas 
    WHERE site_id = p_site_id 
    AND LOWER(name) = LOWER(p_name) 
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'An area named "%" already exists in this site', p_name;
  END IF;
  
  -- Create the area
  INSERT INTO public.areas (site_id, name, description)
  VALUES (p_site_id, p_name, p_description)
  RETURNING id INTO v_area_id;
  
  RETURN v_area_id;
END;
$function$;

-- Update create_unit_for_area to check for duplicates
CREATE OR REPLACE FUNCTION public.create_unit_for_area(p_area_id uuid, p_name text, p_unit_type unit_type DEFAULT 'fridge'::unit_type, p_temp_limit_high numeric DEFAULT 41.0, p_temp_limit_low numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Check for duplicate name in this area
  IF EXISTS (
    SELECT 1 FROM public.units 
    WHERE area_id = p_area_id 
    AND LOWER(name) = LOWER(p_name) 
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A unit named "%" already exists in this area', p_name;
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
$function$;