-- EPIC 1: Security Foundation - Global SUPER_ADMIN Role
-- This migration creates the platform_roles table and supporting infrastructure
-- for platform-wide SUPER_ADMIN capabilities.

-- Create enum for platform roles
CREATE TYPE platform_role AS ENUM ('SUPER_ADMIN');

-- Create platform_roles table for global (cross-org) permissions
CREATE TABLE platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role platform_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure one role per user (expandable if we add more platform roles)
  CONSTRAINT unique_platform_role_per_user UNIQUE (user_id, role)
);

-- Create index for fast lookups
CREATE INDEX idx_platform_roles_user_id ON platform_roles(user_id);

-- Add table comment
COMMENT ON TABLE platform_roles IS 'Platform-wide roles that grant cross-organization access. Only manageable via admin scripts, not through the application UI.';
COMMENT ON COLUMN platform_roles.granted_by IS 'The user who granted this role (null for bootstrap grants)';

-- Create function to check if a user is a SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM platform_roles
    WHERE user_id = check_user_id
    AND role = 'SUPER_ADMIN'
  );
END;
$$;

-- Create function to check if current user is SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_super_admin(auth.uid());
END;
$$;

-- RLS Policies for platform_roles table
-- SUPER_ADMINs can read all platform roles
-- NO ONE can insert/update/delete through normal API - only via admin scripts
ALTER TABLE platform_roles ENABLE ROW LEVEL SECURITY;

-- Super admins can view platform roles (for admin UI)
CREATE POLICY "super_admins_can_view_platform_roles"
  ON platform_roles
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Block all inserts/updates/deletes from client - only service role can modify
CREATE POLICY "no_client_modifications"
  ON platform_roles
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;

-- Add audit logging for super admin actions
CREATE TABLE super_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  impersonated_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_type text, -- 'organization', 'user', 'site', 'unit', etc.
  target_id uuid,
  target_organization_id uuid,
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient audit log queries
CREATE INDEX idx_super_admin_audit_actor ON super_admin_audit_log(actor_user_id);
CREATE INDEX idx_super_admin_audit_impersonated ON super_admin_audit_log(impersonated_user_id) WHERE impersonated_user_id IS NOT NULL;
CREATE INDEX idx_super_admin_audit_created ON super_admin_audit_log(created_at DESC);
CREATE INDEX idx_super_admin_audit_action ON super_admin_audit_log(action_type);
CREATE INDEX idx_super_admin_audit_target_org ON super_admin_audit_log(target_organization_id) WHERE target_organization_id IS NOT NULL;

-- RLS for audit log - super admins can read, system can write
ALTER TABLE super_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_can_view_audit_log"
  ON super_admin_audit_log
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Function to log super admin actions
CREATE OR REPLACE FUNCTION public.log_super_admin_action(
  p_action_type text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_target_organization_id uuid DEFAULT NULL,
  p_impersonated_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  -- Only super admins can log actions
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can log super admin actions';
  END IF;

  INSERT INTO super_admin_audit_log (
    actor_user_id,
    impersonated_user_id,
    action_type,
    target_type,
    target_id,
    target_organization_id,
    metadata
  ) VALUES (
    auth.uid(),
    p_impersonated_user_id,
    p_action_type,
    p_target_type,
    p_target_id,
    p_target_organization_id,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_super_admin_action(text, text, uuid, uuid, uuid, jsonb) TO authenticated;

-- Comment on security model
COMMENT ON TABLE super_admin_audit_log IS 'Immutable audit log for all super admin actions including impersonation. Only super admins can view, only system can insert.';
