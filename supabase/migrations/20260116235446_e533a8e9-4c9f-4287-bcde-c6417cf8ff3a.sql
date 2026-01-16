-- Fix get_active_impersonation() ambiguous column reference error
-- The function signature includes 'expires_at' as a return column, but the UPDATE
-- and WHERE clauses reference 'expires_at' without table aliases, causing error 42702

CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS TABLE (
  session_id UUID,
  target_user_id UUID,
  target_org_id UUID,
  target_user_email TEXT,
  target_user_name TEXT,
  target_org_name TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins can check impersonation status
  IF NOT public.is_current_user_super_admin() THEN
    RETURN;
  END IF;

  -- Auto-expire old sessions using explicit table alias to avoid ambiguity
  UPDATE impersonation_sessions ise
  SET status = 'ended', ended_at = now(), end_reason = 'timeout'
  WHERE ise.admin_user_id = auth.uid() 
    AND ise.status = 'active' 
    AND ise.expires_at < now();

  -- Return active session with explicit column aliases
  RETURN QUERY
  SELECT 
    i.id AS session_id,
    i.target_user_id,
    i.target_org_id,
    i.target_user_email,
    i.target_user_name,
    i.target_org_name,
    i.started_at,
    i.expires_at
  FROM impersonation_sessions i
  WHERE i.admin_user_id = auth.uid()
    AND i.status = 'active'
    AND i.expires_at > now()
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_active_impersonation() IS 
'Returns the active impersonation session for the current super admin user.
Auto-expires sessions that have passed their expiry time.
Fixed: Uses explicit table aliases to avoid ambiguous column reference errors.';