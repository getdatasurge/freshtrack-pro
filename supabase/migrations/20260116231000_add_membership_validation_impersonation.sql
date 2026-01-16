-- Add membership validation to start_impersonation
-- Ensures Super Admins can only impersonate users who belong to the target organization
-- Also adds rate limiting to prevent abuse

CREATE OR REPLACE FUNCTION public.start_impersonation(
  p_target_user_id UUID,
  p_target_org_id UUID,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_target_email TEXT;
  v_target_name TEXT;
  v_org_name TEXT;
  v_expires_at TIMESTAMPTZ;
  v_recent_session_count INTEGER;
  v_is_member BOOLEAN;
BEGIN
  -- Must be super admin
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can impersonate users';
  END IF;

  -- Rate limiting: Check for too many recent sessions (max 20 per hour)
  SELECT COUNT(*) INTO v_recent_session_count
  FROM impersonation_sessions
  WHERE admin_user_id = auth.uid()
    AND started_at > now() - interval '1 hour';

  IF v_recent_session_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before starting more impersonation sessions.';
  END IF;

  -- Validate membership: Target user must belong to target organization
  -- Check both user_roles (explicit assignment) and profiles (legacy/default org)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_target_user_id AND organization_id = p_target_org_id
    UNION
    SELECT 1 FROM profiles
    WHERE user_id = p_target_user_id AND organization_id = p_target_org_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Target user is not a member of the specified organization';
  END IF;

  -- End any existing active sessions for this admin
  UPDATE impersonation_sessions
  SET status = 'ended', ended_at = now(), end_reason = 'replaced'
  WHERE admin_user_id = auth.uid() AND status = 'active';

  -- Get target user details
  SELECT email, full_name INTO v_target_email, v_target_name
  FROM profiles
  WHERE user_id = p_target_user_id;

  -- Get org name
  SELECT name INTO v_org_name
  FROM organizations
  WHERE id = p_target_org_id;

  -- Calculate expiration (max 4 hours for security)
  IF p_duration_minutes > 240 THEN
    p_duration_minutes := 240;
  END IF;
  v_expires_at := now() + (p_duration_minutes || ' minutes')::interval;

  -- Create new session
  INSERT INTO impersonation_sessions (
    admin_user_id,
    target_user_id,
    target_org_id,
    target_user_email,
    target_user_name,
    target_org_name,
    expires_at
  )
  VALUES (
    auth.uid(),
    p_target_user_id,
    p_target_org_id,
    v_target_email,
    v_target_name,
    v_org_name,
    v_expires_at
  )
  RETURNING id INTO v_session_id;

  -- Log to audit
  PERFORM public.log_super_admin_action(
    'IMPERSONATION_STARTED',
    'user',
    p_target_user_id,
    p_target_org_id,
    NULL,
    jsonb_build_object(
      'session_id', v_session_id,
      'target_email', v_target_email,
      'target_name', v_target_name,
      'org_name', v_org_name,
      'duration_minutes', p_duration_minutes
    )
  );

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'target_user_id', p_target_user_id,
    'target_org_id', p_target_org_id,
    'target_user_email', v_target_email,
    'target_user_name', v_target_name,
    'target_org_name', v_org_name,
    'expires_at', v_expires_at
  );
END;
$$;

-- Add comment documenting the security enhancements
COMMENT ON FUNCTION public.start_impersonation(UUID, UUID, INTEGER) IS
  'Start impersonation session as a Super Admin.
   Security features:
   - Validates caller is Super Admin
   - Validates target user is member of target org (via user_roles or profiles)
   - Rate limits to 20 sessions per hour per admin
   - Maximum session duration of 4 hours
   - Auto-ends previous active session
   - Full audit logging';
