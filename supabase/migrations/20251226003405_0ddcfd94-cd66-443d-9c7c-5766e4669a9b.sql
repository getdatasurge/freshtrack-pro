-- FrostGuard Multi-Tenant Database Schema
-- Core tables for refrigeration monitoring SaaS

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.unit_type AS ENUM ('fridge', 'freezer', 'display_case', 'walk_in_cooler', 'walk_in_freezer', 'blast_chiller');
CREATE TYPE public.unit_status AS ENUM ('ok', 'excursion', 'alarm_active', 'monitoring_interrupted', 'manual_required', 'restoring', 'offline');
CREATE TYPE public.alert_type AS ENUM ('alarm_active', 'monitoring_interrupted', 'missed_manual_entry', 'low_battery', 'sensor_fault', 'door_open', 'calibration_due');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'escalated');
CREATE TYPE public.notification_channel AS ENUM ('push', 'email', 'sms');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed');
CREATE TYPE public.device_status AS ENUM ('active', 'inactive', 'pairing', 'fault', 'low_battery');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'pro', 'haccp', 'enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'paused');
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');
CREATE TYPE public.compliance_mode AS ENUM ('standard', 'haccp');
CREATE TYPE public.pairing_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'expired');

-- ============================================
-- ORGANIZATIONS (Tenants)
-- ============================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  compliance_mode compliance_mode NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER PROFILES (linked to auth.users)
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  notification_preferences JSONB DEFAULT '{"push": true, "email": true, "sms": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER ROLES (RBAC)
-- ============================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SITES (Physical Locations)
-- ============================================

CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AREAS (Zones within Sites)
-- ============================================

CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UNITS (Refrigerators/Freezers)
-- ============================================

CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit_type unit_type NOT NULL DEFAULT 'fridge',
  status unit_status NOT NULL DEFAULT 'offline',
  temp_limit_high DECIMAL(5, 2) NOT NULL DEFAULT 41.0,
  temp_limit_low DECIMAL(5, 2),
  temp_hysteresis DECIMAL(3, 2) NOT NULL DEFAULT 1.0,
  confirm_time_door_closed INTEGER NOT NULL DEFAULT 600, -- seconds
  confirm_time_door_open INTEGER NOT NULL DEFAULT 1200, -- seconds
  max_excursion_duration INTEGER NOT NULL DEFAULT 3600, -- seconds
  manual_log_cadence INTEGER NOT NULL DEFAULT 14400, -- seconds (4 hours)
  last_temp_reading DECIMAL(5, 2),
  last_reading_at TIMESTAMPTZ,
  last_status_change TIMESTAMPTZ DEFAULT now(),
  make TEXT,
  model TEXT,
  serial_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HUBS (Local Gateways)
-- ============================================

CREATE TABLE public.hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mac_address TEXT UNIQUE,
  ip_address TEXT,
  firmware_version TEXT,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DEVICES (ESP32 Sensor Nodes)
-- ============================================

CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  hub_id UUID REFERENCES public.hubs(id) ON DELETE SET NULL,
  serial_number TEXT UNIQUE NOT NULL,
  mac_address TEXT,
  firmware_version TEXT,
  battery_level INTEGER,
  status device_status NOT NULL DEFAULT 'inactive',
  last_seen_at TIMESTAMPTZ,
  transmit_interval INTEGER NOT NULL DEFAULT 60, -- seconds
  calibration_offset DECIMAL(4, 2) DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PAIRING SESSIONS
-- ============================================

CREATE TABLE public.pairing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  hub_id UUID NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  status pairing_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pairing_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SENSOR READINGS (High Volume)
-- ============================================

CREATE TABLE public.sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  temperature DECIMAL(5, 2) NOT NULL,
  humidity DECIMAL(5, 2),
  door_open BOOLEAN DEFAULT false,
  battery_level INTEGER,
  signal_strength INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- Index for time-series queries
CREATE INDEX idx_sensor_readings_unit_time ON public.sensor_readings(unit_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_time ON public.sensor_readings(recorded_at DESC);

-- ============================================
-- MANUAL TEMPERATURE LOGS
-- ============================================

CREATE TABLE public.manual_temperature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  logged_by UUID NOT NULL REFERENCES auth.users(id),
  temperature DECIMAL(5, 2) NOT NULL,
  notes TEXT,
  is_in_range BOOLEAN,
  photo_url TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_temperature_logs ENABLE ROW LEVEL SECURITY;

-- Index for manual logs
CREATE INDEX idx_manual_logs_unit_time ON public.manual_temperature_logs(unit_id, logged_at DESC);

-- ============================================
-- EVENT LOG (Append-only, Tamper-evident)
-- ============================================

CREATE TABLE public.event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT DEFAULT 'user',
  ip_address TEXT,
  user_agent TEXT,
  previous_hash TEXT,
  event_hash TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

-- Index for event logs
CREATE INDEX idx_event_logs_org_time ON public.event_logs(organization_id, recorded_at DESC);
CREATE INDEX idx_event_logs_unit_time ON public.event_logs(unit_id, recorded_at DESC);

-- ============================================
-- ALERTS
-- ============================================

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'warning',
  status alert_status NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  message TEXT,
  temp_reading DECIMAL(5, 2),
  temp_limit DECIMAL(5, 2),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  escalation_level INTEGER NOT NULL DEFAULT 1,
  next_escalation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Index for alerts
CREATE INDEX idx_alerts_unit_status ON public.alerts(unit_id, status);
CREATE INDEX idx_alerts_triggered ON public.alerts(triggered_at DESC);

-- ============================================
-- NOTIFICATION DELIVERIES
-- ============================================

CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CORRECTIVE ACTIONS
-- ============================================

CREATE TABLE public.corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  action_taken TEXT NOT NULL,
  root_cause TEXT,
  preventive_measures TEXT,
  photo_urls TEXT[],
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CALIBRATION RECORDS
-- ============================================

CREATE TABLE public.calibration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  reference_temp DECIMAL(5, 2) NOT NULL,
  measured_temp DECIMAL(5, 2) NOT NULL,
  offset_applied DECIMAL(4, 2) NOT NULL,
  notes TEXT,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_calibration_due TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calibration_records ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'starter',
  status subscription_status NOT NULL DEFAULT 'trial',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  sensor_limit INTEGER NOT NULL DEFAULT 5,
  current_sensor_count INTEGER NOT NULL DEFAULT 0,
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INVOICES
-- ============================================

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount_due INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'draft',
  invoice_pdf_url TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user has a specific role in an organization
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- Function to check if user belongs to an organization
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply update triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hubs_updated_at BEFORE UPDATE ON public.hubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their organization"
  ON public.organizations FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), id));

CREATE POLICY "Owners can update their organization"
  ON public.organizations FOR UPDATE
  USING (public.has_role(auth.uid(), id, 'owner') OR public.has_role(auth.uid(), id, 'admin'));

-- Profiles: Users can manage their own profile
CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid() OR public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- User Roles: Only admins can manage roles
CREATE POLICY "Users can view roles in their organization"
  ON public.user_roles FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), organization_id, 'owner') OR public.has_role(auth.uid(), organization_id, 'admin'));

-- Sites: Tenant isolation
CREATE POLICY "Users can view sites in their organization"
  ON public.sites FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage sites"
  ON public.sites FOR ALL
  USING (public.has_role(auth.uid(), organization_id, 'owner') OR public.has_role(auth.uid(), organization_id, 'admin'));

-- Areas: Inherit from site permissions
CREATE POLICY "Users can view areas"
  ON public.areas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = areas.site_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Admins can manage areas"
  ON public.areas FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = areas.site_id
    AND (public.has_role(auth.uid(), s.organization_id, 'owner') OR public.has_role(auth.uid(), s.organization_id, 'admin'))
  ));

-- Units: Inherit from area permissions
CREATE POLICY "Users can view units"
  ON public.units FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.sites s ON s.id = a.site_id
    WHERE a.id = units.area_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Staff can update unit status"
  ON public.units FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.sites s ON s.id = a.site_id
    WHERE a.id = units.area_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Admins can manage units"
  ON public.units FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.areas a
    JOIN public.sites s ON s.id = a.site_id
    WHERE a.id = units.area_id
    AND (public.has_role(auth.uid(), s.organization_id, 'owner') OR public.has_role(auth.uid(), s.organization_id, 'admin'))
  ));

-- Hubs: Site-level access
CREATE POLICY "Users can view hubs"
  ON public.hubs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = hubs.site_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Admins can manage hubs"
  ON public.hubs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = hubs.site_id
    AND (public.has_role(auth.uid(), s.organization_id, 'owner') OR public.has_role(auth.uid(), s.organization_id, 'admin'))
  ));

-- Devices: Unit-level access
CREATE POLICY "Users can view devices"
  ON public.devices FOR SELECT
  USING (
    unit_id IS NULL OR EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE u.id = devices.unit_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
    )
  );

CREATE POLICY "Admins can manage devices"
  ON public.devices FOR ALL
  USING (
    unit_id IS NULL OR EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE u.id = devices.unit_id
      AND (public.has_role(auth.uid(), s.organization_id, 'owner') OR public.has_role(auth.uid(), s.organization_id, 'admin'))
    )
  );

-- Sensor Readings: Read-only for org members
CREATE POLICY "Users can view sensor readings"
  ON public.sensor_readings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = sensor_readings.unit_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

-- Manual Temperature Logs
CREATE POLICY "Users can view manual logs"
  ON public.manual_temperature_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = manual_temperature_logs.unit_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Staff can create manual logs"
  ON public.manual_temperature_logs FOR INSERT
  WITH CHECK (
    logged_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE u.id = manual_temperature_logs.unit_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
    )
  );

-- Alerts
CREATE POLICY "Users can view alerts"
  ON public.alerts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = alerts.unit_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Staff can update alerts"
  ON public.alerts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = alerts.unit_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

-- Event Logs: Read-only for org members
CREATE POLICY "Users can view event logs"
  ON public.event_logs FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Corrective Actions
CREATE POLICY "Users can view corrective actions"
  ON public.corrective_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = corrective_actions.unit_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Staff can create corrective actions"
  ON public.corrective_actions FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE u.id = corrective_actions.unit_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
    )
  );

-- Subscriptions
CREATE POLICY "Users can view their subscription"
  ON public.subscriptions FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Owners can manage subscription"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), organization_id, 'owner'));

-- Invoices
CREATE POLICY "Users can view invoices"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.subscriptions sub
    WHERE sub.id = invoices.subscription_id
    AND public.user_belongs_to_org(auth.uid(), sub.organization_id)
  ));

-- Pairing Sessions
CREATE POLICY "Users can view pairing sessions"
  ON public.pairing_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE u.id = pairing_sessions.unit_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Staff can create pairing sessions"
  ON public.pairing_sessions FOR INSERT
  WITH CHECK (
    initiated_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.units u
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE u.id = pairing_sessions.unit_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
    )
  );

-- Calibration Records
CREATE POLICY "Users can view calibration records"
  ON public.calibration_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.units u ON u.id = d.unit_id
    JOIN public.areas a ON a.id = u.area_id
    JOIN public.sites s ON s.id = a.site_id
    WHERE d.id = calibration_records.device_id
    AND public.user_belongs_to_org(auth.uid(), s.organization_id)
  ));

CREATE POLICY "Staff can create calibration records"
  ON public.calibration_records FOR INSERT
  WITH CHECK (
    performed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.devices d
      JOIN public.units u ON u.id = d.unit_id
      JOIN public.areas a ON a.id = u.area_id
      JOIN public.sites s ON s.id = a.site_id
      WHERE d.id = calibration_records.device_id
      AND public.user_belongs_to_org(auth.uid(), s.organization_id)
    )
  );

-- Notification Deliveries
CREATE POLICY "Users can view their notifications"
  ON public.notification_deliveries FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- PROFILE CREATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();