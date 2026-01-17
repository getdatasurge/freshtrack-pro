-- Epic 4: Security & Audit Hardening
-- Add impersonation audit columns to event_logs table

-- Add columns to capture impersonation context for all write operations
ALTER TABLE public.event_logs
ADD COLUMN IF NOT EXISTS acting_user_id UUID,
ADD COLUMN IF NOT EXISTS impersonation_session_id UUID,
ADD COLUMN IF NOT EXISTS was_impersonated BOOLEAN DEFAULT FALSE;

-- Add index for impersonation audit queries
CREATE INDEX IF NOT EXISTS idx_event_logs_impersonation 
ON public.event_logs(was_impersonated) 
WHERE was_impersonated = TRUE;

-- Add index for acting user queries
CREATE INDEX IF NOT EXISTS idx_event_logs_acting_user 
ON public.event_logs(acting_user_id) 
WHERE acting_user_id IS NOT NULL;

-- Create function to log impersonated actions with server-side validation
CREATE OR REPLACE FUNCTION public.log_impersonated_action(
  p_event_type TEXT,
  p_category TEXT DEFAULT 'user_action',
  p_severity TEXT DEFAULT 'info',
  p_title TEXT DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_site_id UUID DEFAULT NULL,
  p_area_id UUID DEFAULT NULL,
  p_unit_id UUID DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_impersonation RECORD;
  v_acting_user_id UUID;
  v_impersonation_session_id UUID;
  v_was_impersonated BOOLEAN := FALSE;
  v_effective_user_id UUID;
  v_effective_org_id UUID;
BEGIN
  v_acting_user_id := auth.uid();
  
  -- Check for active impersonation session
  SELECT 
    session_id,
    target_user_id,
    target_org_id
  INTO v_impersonation
  FROM public.get_active_impersonation()
  LIMIT 1;
  
  IF v_impersonation.session_id IS NOT NULL THEN
    v_was_impersonated := TRUE;
    v_impersonation_session_id := v_impersonation.session_id;
    v_effective_user_id := v_impersonation.target_user_id;
    v_effective_org_id := v_impersonation.target_org_id;
    
    -- Security: Verify the target org matches the action's org to prevent cross-tenant writes
    IF p_organization_id IS NOT NULL AND v_impersonation.target_org_id != p_organization_id THEN
      RAISE EXCEPTION 'Cross-tenant write attempt blocked: impersonation org (%) does not match target org (%)', 
        v_impersonation.target_org_id, p_organization_id;
    END IF;
    
    -- Use impersonation org if none provided
    IF p_organization_id IS NULL THEN
      p_organization_id := v_effective_org_id;
    END IF;
  ELSE
    v_effective_user_id := v_acting_user_id;
    v_effective_org_id := p_organization_id;
  END IF;
  
  -- Ensure we have an organization ID
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required for event logging';
  END IF;
  
  -- Insert event log with impersonation context
  INSERT INTO public.event_logs (
    organization_id,
    site_id,
    area_id,
    unit_id,
    event_type,
    category,
    severity,
    title,
    actor_id,
    actor_type,
    acting_user_id,
    impersonation_session_id,
    was_impersonated,
    event_data,
    recorded_at
  ) VALUES (
    p_organization_id,
    p_site_id,
    p_area_id,
    p_unit_id,
    p_event_type,
    p_category,
    p_severity,
    p_title,
    v_effective_user_id, -- Effective user (impersonated user or real user)
    CASE WHEN v_was_impersonated THEN 'impersonated' ELSE 'user' END,
    v_acting_user_id, -- Real admin ID who performed the action
    v_impersonation_session_id,
    v_was_impersonated,
    p_event_data || jsonb_build_object(
      'impersonation_context', jsonb_build_object(
        'was_impersonated', v_was_impersonated,
        'acting_admin_id', CASE WHEN v_was_impersonated THEN v_acting_user_id::text ELSE NULL END,
        'session_id', v_impersonation_session_id::text
      )
    ),
    now()
  )
  RETURNING id INTO v_event_id;
  
  -- Also log to super_admin_audit_log if this was an impersonated action
  IF v_was_impersonated THEN
    PERFORM public.log_super_admin_action(
      'IMPERSONATED_WRITE_ACTION',
      'event_log',
      v_event_id::text,
      p_organization_id,
      v_impersonation.target_user_id,
      jsonb_build_object(
        'event_type', p_event_type,
        'title', p_title,
        'session_id', v_impersonation_session_id::text,
        'event_id', v_event_id::text
      )
    );
  END IF;
  
  RETURN v_event_id;
END;
$$;

-- Create function to expire all active impersonation sessions for current admin
CREATE OR REPLACE FUNCTION public.expire_all_admin_impersonation_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only super admins can expire sessions
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can expire impersonation sessions';
  END IF;
  
  -- End all active sessions for this admin
  UPDATE public.impersonation_sessions
  SET 
    status = 'ended',
    ended_at = now(),
    end_reason = 'support_mode_exited'
  WHERE 
    admin_user_id = auth.uid() 
    AND status = 'active';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Log the action
  PERFORM public.log_super_admin_action(
    'SUPPORT_MODE_SESSIONS_EXPIRED',
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('sessions_expired', v_count)
  );
  
  RETURN v_count;
END;
$$;

-- Create helper function to check if impersonation org matches for RLS
CREATE OR REPLACE FUNCTION public.check_impersonation_org_match(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_impersonation RECORD;
BEGIN
  -- Check for active impersonation
  SELECT target_org_id INTO v_impersonation
  FROM public.get_active_impersonation()
  LIMIT 1;
  
  -- If impersonating, target org must match
  IF v_impersonation.target_org_id IS NOT NULL THEN
    RETURN v_impersonation.target_org_id = target_org_id;
  END IF;
  
  -- Not impersonating - allow (regular RLS will apply)
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_impersonated_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_all_admin_impersonation_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_impersonation_org_match TO authenticated;