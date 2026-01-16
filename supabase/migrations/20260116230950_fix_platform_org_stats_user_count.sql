-- Fix user count in get_platform_organization_stats to include all users
-- Previously only counted users with user_roles entries
-- Now also includes users who have profiles.organization_id set

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
    -- Count users from BOTH user_roles AND profiles tables
    -- A user belongs to an org if they have user_roles entry OR profiles.organization_id
    (
      SELECT COUNT(DISTINCT user_id) FROM (
        -- Users with explicit role assignment
        SELECT ur.user_id
        FROM user_roles ur
        WHERE ur.organization_id = o.id

        UNION

        -- Users with profile organization (legacy or fallback)
        SELECT p.user_id
        FROM profiles p
        WHERE p.organization_id = o.id
      ) AS all_org_users
    ) as user_count,
    (SELECT COUNT(*) FROM sites s WHERE s.organization_id = o.id AND s.deleted_at IS NULL) as site_count
  FROM organizations o
  WHERE o.deleted_at IS NULL;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_platform_organization_stats() IS
  'Returns organization stats (user/site counts) for Super Admins, bypassing RLS.
   User count includes both user_roles entries and profiles.organization_id for comprehensive counting.';
