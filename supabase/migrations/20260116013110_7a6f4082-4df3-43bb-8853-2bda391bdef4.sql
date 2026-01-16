-- Impersonation Sessions Table
-- Stores server-side impersonation sessions with TTL for security

CREATE TABLE public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_user_email TEXT,
  target_user_name TEXT,
  target_org_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (end_reason IS NULL OR end_reason IN ('manual', 'timeout', 'replaced', 'logout')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active session lookup (most common query)
CREATE INDEX idx_impersonation_active ON impersonation_sessions(admin_user_id, status) WHERE status = 'active';
CREATE INDEX idx_impersonation_expires ON impersonation_sessions(expires_at) WHERE status = 'active';

-- Table comments
COMMENT ON TABLE impersonation_sessions IS 'Server-side impersonation sessions for Super Admins to view as users';
COMMENT ON COLUMN impersonation_sessions.end_reason IS 'How the session ended: manual (user clicked exit), timeout (expired), replaced (new session started), logout (admin signed out)';

-- RLS: Only super admins can manage their own sessions
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Super admins can read their own sessions
CREATE POLICY "super_admins_read_own_sessions"
  ON impersonation_sessions
  FOR SELECT
  USING (
    public.is_current_user_super_admin() 
    AND admin_user_id = auth.uid()
  );

-- Super admins can insert their own sessions
CREATE POLICY "super_admins_insert_own_sessions"
  ON impersonation_sessions
  FOR INSERT
  WITH CHECK (
    public.is_current_user_super_admin() 
    AND admin_user_id = auth.uid()
  );

-- Super admins can update their own sessions (to end them)
CREATE POLICY "super_admins_update_own_sessions"
  ON impersonation_sessions
  FOR UPDATE
  USING (
    public.is_current_user_super_admin() 
    AND admin_user_id = auth.uid()
  );

-- ============================================================
-- RPC Functions for Impersonation Management
-- ============================================================

-- Start impersonation (creates new session, ends any existing)
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
BEGIN
  -- Must be super admin
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can impersonate users';
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

  -- Calculate expiration
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

-- Stop impersonation
CREATE OR REPLACE FUNCTION public.stop_impersonation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session impersonation_sessions%ROWTYPE;
BEGIN
  -- Get active session for logging
  SELECT * INTO v_session
  FROM impersonation_sessions
  WHERE admin_user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  -- End all active sessions for this admin
  UPDATE impersonation_sessions
  SET status = 'ended', ended_at = now(), end_reason = 'manual'
  WHERE admin_user_id = auth.uid() AND status = 'active';

  -- Log to audit if there was an active session
  IF v_session.id IS NOT NULL THEN
    PERFORM public.log_super_admin_action(
      'IMPERSONATION_ENDED',
      'user',
      v_session.target_user_id,
      v_session.target_org_id,
      v_session.target_user_id,
      jsonb_build_object(
        'session_id', v_session.id,
        'duration_seconds', EXTRACT(EPOCH FROM (now() - v_session.started_at))::integer,
        'end_reason', 'manual'
      )
    );
  END IF;
END;
$$;

-- Get active impersonation session
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
  -- Must be super admin
  IF NOT public.is_current_user_super_admin() THEN
    RETURN;
  END IF;

  -- Auto-expire old sessions
  UPDATE impersonation_sessions
  SET status = 'ended', ended_at = now(), end_reason = 'timeout'
  WHERE admin_user_id = auth.uid() 
    AND status = 'active' 
    AND expires_at < now();

  -- Return active session
  RETURN QUERY
  SELECT 
    i.id,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.start_impersonation(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_impersonation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_impersonation() TO authenticated;