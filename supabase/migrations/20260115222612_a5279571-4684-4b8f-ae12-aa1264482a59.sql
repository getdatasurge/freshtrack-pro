-- Super Admin Activation Migration (Fixed)
-- Applies all SUPER_ADMIN infrastructure for FreshTrack Pro

-- ============================================
-- 1. CREATE ENUM TYPE
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE public.platform_role AS ENUM ('SUPER_ADMIN');
  END IF;
END $$;

-- ============================================
-- 2. CREATE PLATFORM_ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.platform_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role platform_role NOT NULL DEFAULT 'SUPER_ADMIN',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE (user_id, role)
);

COMMENT ON TABLE public.platform_roles IS 'Platform-level roles (SUPER_ADMIN) - separate from org-scoped app_role';

-- ============================================
-- 3. CREATE HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles
    WHERE user_id = check_user_id
      AND role = 'SUPER_ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(auth.uid());
$$;

-- ============================================
-- 4. CREATE AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  target_org_id UUID,
  impersonated_user_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_admin_user_id 
  ON public.super_admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_created_at 
  ON public.super_admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_super_admin_audit_log_action 
  ON public.super_admin_audit_log(action);

COMMENT ON TABLE public.super_admin_audit_log IS 'Immutable audit trail for all Super Admin actions';

-- ============================================
-- 5. CREATE AUDIT LOGGING FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.log_super_admin_action(
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_org_id UUID DEFAULT NULL,
  p_impersonated_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can log super admin actions';
  END IF;

  INSERT INTO public.super_admin_audit_log (
    admin_user_id,
    action,
    target_type,
    target_id,
    target_org_id,
    impersonated_user_id,
    details
  ) VALUES (
    auth.uid(),
    p_action,
    p_target_type,
    p_target_id,
    p_target_org_id,
    p_impersonated_user_id,
    p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================
-- 6. ENABLE RLS AND CREATE POLICIES
-- ============================================

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view platform roles"
  ON public.platform_roles
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view audit log"
  ON public.super_admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

CREATE POLICY "Allow audit log inserts via function"
  ON public.super_admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_super_admin());

-- ============================================
-- 7. UPDATE CROSS-ORG RLS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Super admins can view all organizations" ON public.organizations;
CREATE POLICY "Super admins can view all organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "Super admins can view all sites" ON public.sites;
CREATE POLICY "Super admins can view all sites"
  ON public.sites
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "Super admins can view all units" ON public.units;
CREATE POLICY "Super admins can view all units"
  ON public.units
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "Super admins can view all lora_sensors" ON public.lora_sensors;
CREATE POLICY "Super admins can view all lora_sensors"
  ON public.lora_sensors
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "Super admins can view all gateways" ON public.gateways;
CREATE POLICY "Super admins can view all gateways"
  ON public.gateways
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON TYPE public.platform_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_super_admin_action(TEXT, TEXT, UUID, UUID, UUID, JSONB) TO authenticated;