-- Create RPC function for platform organization stats
-- This bypasses RLS to allow Super Admins to see accurate counts for all organizations

CREATE OR REPLACE FUNCTION get_platform_organization_stats()
RETURNS TABLE (
  org_id UUID,
  user_count BIGINT,
  site_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is a Super Admin
  IF NOT EXISTS (
    SELECT 1 FROM platform_roles 
    WHERE user_id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super Admin required';
  END IF;

  RETURN QUERY
  SELECT 
    o.id as org_id,
    (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur WHERE ur.organization_id = o.id) as user_count,
    (SELECT COUNT(*) FROM sites s WHERE s.organization_id = o.id AND s.deleted_at IS NULL) as site_count
  FROM organizations o
  WHERE o.deleted_at IS NULL;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_platform_organization_stats() IS 'Returns organization stats (user/site counts) for Super Admins, bypassing RLS';