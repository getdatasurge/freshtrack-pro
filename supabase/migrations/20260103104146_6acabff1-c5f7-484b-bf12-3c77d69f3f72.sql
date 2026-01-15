-- Update check_slug_available function to be case-insensitive and support excluding an org
CREATE OR REPLACE FUNCTION public.check_slug_available(
  p_slug text,
  p_exclude_org_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE LOWER(slug) = LOWER(p_slug) 
      AND deleted_at IS NULL
      AND (p_exclude_org_id IS NULL OR id != p_exclude_org_id)
  )
$$;