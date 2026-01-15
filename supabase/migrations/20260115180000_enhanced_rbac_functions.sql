-- Enhanced RBAC Functions for Hierarchical Role Checking
-- This migration adds functions that support the RBAC permission system

-- ============================================
-- ROLE HIERARCHY ENUM ORDER
-- ============================================
-- Roles are ordered from highest to lowest privilege:
-- owner (1) > admin (2) > manager (3) > staff (4) > viewer (5) > inspector (6)
-- Note: inspector is a special role - parallel to viewer but with export capabilities

-- ============================================
-- FUNCTION: get_role_level
-- Returns the numeric level of a role (lower = more privileged)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_role_level(_role app_role)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'staff' THEN 4
    WHEN 'viewer' THEN 5
    WHEN 'inspector' THEN 5  -- Same level as viewer
    ELSE 999
  END
$$;

COMMENT ON FUNCTION public.get_role_level IS 'Returns numeric privilege level for a role (lower = more privileged)';

-- ============================================
-- FUNCTION: has_role_or_higher
-- Checks if user has a specific role or higher in the hierarchy
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role_or_higher(
  _user_id UUID,
  _org_id UUID,
  _minimum_role app_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _org_id
      AND public.get_role_level(ur.role) <= public.get_role_level(_minimum_role)
  )
$$;

COMMENT ON FUNCTION public.has_role_or_higher IS 'Checks if user has the specified role or a more privileged role';

-- ============================================
-- FUNCTION: has_any_role
-- Checks if user has any of the specified roles
-- ============================================

CREATE OR REPLACE FUNCTION public.has_any_role(
  _user_id UUID,
  _org_id UUID,
  _roles app_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _org_id
      AND ur.role = ANY(_roles)
  )
$$;

COMMENT ON FUNCTION public.has_any_role IS 'Checks if user has any of the specified roles';

-- ============================================
-- FUNCTION: get_user_role
-- Returns the user's role in an organization
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID, _org_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND organization_id = _org_id
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_user_role IS 'Returns the user''s role in the specified organization';

-- ============================================
-- FUNCTION: can_manage_role
-- Checks if an actor can manage (assign/change) a target role
-- Owners can manage anyone, admins can manage everyone except owners
-- ============================================

CREATE OR REPLACE FUNCTION public.can_manage_role(
  _actor_user_id UUID,
  _org_id UUID,
  _target_role app_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Owners can manage any role
    WHEN public.has_role(_actor_user_id, _org_id, 'owner') THEN TRUE
    -- Admins can manage anyone except owners and other admins
    WHEN public.has_role(_actor_user_id, _org_id, 'admin')
      AND _target_role NOT IN ('owner', 'admin') THEN TRUE
    ELSE FALSE
  END
$$;

COMMENT ON FUNCTION public.can_manage_role IS 'Checks if actor can assign/change the target role';

-- ============================================
-- FUNCTION: is_last_owner
-- Checks if the specified user is the only owner of the organization
-- ============================================

CREATE OR REPLACE FUNCTION public.is_last_owner(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, _org_id, 'owner')
    AND (
      SELECT COUNT(*)
      FROM public.user_roles
      WHERE organization_id = _org_id
        AND role = 'owner'
    ) = 1
$$;

COMMENT ON FUNCTION public.is_last_owner IS 'Checks if user is the only owner (prevents demoting last owner)';

-- ============================================
-- ENHANCED RLS POLICIES
-- Add more granular policies using the new functions
-- ============================================

-- Drop existing policies we're enhancing
DROP POLICY IF EXISTS "Staff can update unit status" ON public.units;
DROP POLICY IF EXISTS "Staff can update alerts" ON public.alerts;

-- Units: Staff+ can update unit status (using hierarchy)
CREATE POLICY "Staff and above can update unit status"
  ON public.units FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.sites s ON s.id = a.site_id
    WHERE a.id = units.area_id
    AND public.has_role_or_higher(auth.uid(), s.organization_id, 'staff')
  ));

-- Alerts: Staff+ can acknowledge/update alerts
CREATE POLICY "Staff and above can update alerts"
  ON public.alerts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = alerts.unit_id
    AND public.has_role_or_higher(auth.uid(), s.organization_id, 'staff')
  ));

-- ============================================
-- POLICY: Prevent last owner demotion
-- This is enforced at the trigger level for safety
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_last_owner_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if trying to change owner role to something else
  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    -- Check if this is the last owner
    IF (
      SELECT COUNT(*)
      FROM public.user_roles
      WHERE organization_id = OLD.organization_id
        AND role = 'owner'
    ) <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner. Transfer ownership first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_last_owner_demotion_trigger ON public.user_roles;

-- Create trigger
CREATE TRIGGER prevent_last_owner_demotion_trigger
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_owner_demotion();

-- ============================================
-- POLICY: Prevent owner deletion if last owner
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_last_owner_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if deleting an owner role
  IF OLD.role = 'owner' THEN
    -- Check if this is the last owner
    IF (
      SELECT COUNT(*)
      FROM public.user_roles
      WHERE organization_id = OLD.organization_id
        AND role = 'owner'
    ) <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner. Transfer ownership first.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_last_owner_deletion_trigger ON public.user_roles;

-- Create trigger
CREATE TRIGGER prevent_last_owner_deletion_trigger
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_owner_deletion();

-- ============================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================

-- Index for role lookups by organization
CREATE INDEX IF NOT EXISTS idx_user_roles_org_role
  ON public.user_roles(organization_id, role);

-- Partial index for finding owners quickly
CREATE INDEX IF NOT EXISTS idx_user_roles_owners
  ON public.user_roles(organization_id)
  WHERE role = 'owner';

COMMENT ON INDEX idx_user_roles_org_role IS 'Improves role lookup performance by organization';
COMMENT ON INDEX idx_user_roles_owners IS 'Quickly find owners within an organization';
