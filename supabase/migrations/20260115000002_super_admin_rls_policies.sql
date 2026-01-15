-- EPIC 2: Backend Enforcement - SUPER_ADMIN RLS Policies
-- This migration updates RLS policies to allow SUPER_ADMIN full cross-org access
-- while maintaining normal user isolation.

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

-- Drop existing select policy and recreate with super admin support
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
CREATE POLICY "Users can view organizations"
  ON organizations
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), id)
  );

-- Super admins can update any org (but normal users still restricted to their own)
DROP POLICY IF EXISTS "Admins can update organization" ON organizations;
CREATE POLICY "Admins can update organization"
  ON organizations
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.user_belongs_to_org(auth.uid(), id)
      AND public.has_role(auth.uid(), id, 'owner')
    )
  );

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

-- Super admins can view all profiles
DROP POLICY IF EXISTS "Users can view profiles in own org" ON profiles;
CREATE POLICY "Users can view profiles"
  ON profiles
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- USER_ROLES TABLE
-- ============================================================================

-- Super admins can view all user roles
DROP POLICY IF EXISTS "Members can view roles in org" ON user_roles;
CREATE POLICY "Members can view roles"
  ON user_roles
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- SITES TABLE
-- ============================================================================

-- Super admins can view all sites
DROP POLICY IF EXISTS "Users can view sites in own org" ON sites;
CREATE POLICY "Users can view sites"
  ON sites
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- Super admins can manage all sites
DROP POLICY IF EXISTS "Admins can manage sites" ON sites;
CREATE POLICY "Admins can manage sites"
  ON sites
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.user_belongs_to_org(auth.uid(), organization_id)
      AND (
        public.has_role(auth.uid(), organization_id, 'owner')
        OR public.has_role(auth.uid(), organization_id, 'admin')
      )
    )
  );

-- ============================================================================
-- AREAS TABLE
-- ============================================================================

-- Super admins can view all areas
DROP POLICY IF EXISTS "Users can view areas in own org" ON areas;
CREATE POLICY "Users can view areas"
  ON areas
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = areas.site_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- Super admins can manage all areas
DROP POLICY IF EXISTS "Admins can manage areas" ON areas;
CREATE POLICY "Admins can manage areas"
  ON areas
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = areas.site_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
      AND (
        public.has_role(auth.uid(), sites.organization_id, 'owner')
        OR public.has_role(auth.uid(), sites.organization_id, 'admin')
      )
    )
  );

-- ============================================================================
-- UNITS TABLE
-- ============================================================================

-- Super admins can view all units
DROP POLICY IF EXISTS "Users can view units in own org" ON units;
CREATE POLICY "Users can view units"
  ON units
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM areas
      JOIN sites ON sites.id = areas.site_id
      WHERE areas.id = units.area_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- Super admins can manage all units
DROP POLICY IF EXISTS "Admins can manage units" ON units;
CREATE POLICY "Admins can manage units"
  ON units
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM areas
      JOIN sites ON sites.id = areas.site_id
      WHERE areas.id = units.area_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
      AND (
        public.has_role(auth.uid(), sites.organization_id, 'owner')
        OR public.has_role(auth.uid(), sites.organization_id, 'admin')
      )
    )
  );

-- ============================================================================
-- ALERTS TABLE
-- ============================================================================

-- Super admins can view all alerts
DROP POLICY IF EXISTS "Users can view alerts in own org" ON alerts;
CREATE POLICY "Users can view alerts"
  ON alerts
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- Super admins can update any alert
DROP POLICY IF EXISTS "Staff can update alerts" ON alerts;
CREATE POLICY "Users can update alerts"
  ON alerts
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- SENSOR_READINGS TABLE
-- ============================================================================

-- Super admins can view all readings
DROP POLICY IF EXISTS "Users can view readings in own org" ON sensor_readings;
CREATE POLICY "Users can view sensor_readings"
  ON sensor_readings
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM units
      JOIN areas ON areas.id = units.area_id
      JOIN sites ON sites.id = areas.site_id
      WHERE units.id = sensor_readings.unit_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- ============================================================================
-- MANUAL_TEMPERATURE_LOGS TABLE
-- ============================================================================

-- Super admins can view all manual logs
DROP POLICY IF EXISTS "Users can view manual logs in own org" ON manual_temperature_logs;
CREATE POLICY "Users can view manual_temperature_logs"
  ON manual_temperature_logs
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM units
      JOIN areas ON areas.id = units.area_id
      JOIN sites ON sites.id = areas.site_id
      WHERE units.id = manual_temperature_logs.unit_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- ============================================================================
-- EVENT_LOGS TABLE
-- ============================================================================

-- Super admins can view all event logs
DROP POLICY IF EXISTS "Users can view event logs in own org" ON event_logs;
CREATE POLICY "Users can view event_logs"
  ON event_logs
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- NOTIFICATION_POLICIES TABLE
-- ============================================================================

-- Super admins can view all notification policies
DROP POLICY IF EXISTS "Users can view notification policies in own org" ON notification_policies;
CREATE POLICY "Users can view notification_policies"
  ON notification_policies
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- TTN_CONNECTIONS TABLE
-- ============================================================================

-- Super admins can view all TTN connections
DROP POLICY IF EXISTS "Users can view TTN connections in own org" ON ttn_connections;
CREATE POLICY "Users can view ttn_connections"
  ON ttn_connections
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- DEVICES TABLE
-- ============================================================================

-- Super admins can view all devices
DROP POLICY IF EXISTS "Users can view devices in own org" ON devices;
CREATE POLICY "Users can view devices"
  ON devices
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM units
      JOIN areas ON areas.id = units.area_id
      JOIN sites ON sites.id = areas.site_id
      WHERE units.id = devices.unit_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- ============================================================================
-- HUBS TABLE
-- ============================================================================

-- Super admins can view all hubs
DROP POLICY IF EXISTS "Users can view hubs in own org" ON hubs;
CREATE POLICY "Users can view hubs"
  ON hubs
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = hubs.site_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- ============================================================================
-- LORA_SENSORS TABLE
-- ============================================================================

-- Super admins can view all LoRa sensors
DROP POLICY IF EXISTS "Users can view lora sensors in own org" ON lora_sensors;
CREATE POLICY "Users can view lora_sensors"
  ON lora_sensors
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- CORRECTIVE_ACTIONS TABLE
-- ============================================================================

-- Super admins can view all corrective actions
DROP POLICY IF EXISTS "Users can view corrective actions in own org" ON corrective_actions;
CREATE POLICY "Users can view corrective_actions"
  ON corrective_actions
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM units
      JOIN areas ON areas.id = units.area_id
      JOIN sites ON sites.id = areas.site_id
      WHERE units.id = corrective_actions.unit_id
      AND public.user_belongs_to_org(auth.uid(), sites.organization_id)
    )
  );

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

-- Super admins can view all subscriptions
DROP POLICY IF EXISTS "Users can view subscriptions in own org" ON subscriptions;
CREATE POLICY "Users can view subscriptions"
  ON subscriptions
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- COMMENT ON SECURITY MODEL
-- ============================================================================

COMMENT ON FUNCTION public.is_super_admin(uuid) IS
'Checks if a user has the SUPER_ADMIN platform role. Used by RLS policies to grant cross-org access.';

COMMENT ON FUNCTION public.is_current_user_super_admin() IS
'Checks if the current authenticated user has the SUPER_ADMIN platform role. Used by frontend to conditionally show admin features.';
