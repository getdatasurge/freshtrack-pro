-- Phase 1: Add soft-delete columns to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Drop existing unique constraint on slug
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_slug_key;

-- Create partial unique index (only enforce uniqueness for active orgs)
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_active_key 
ON public.organizations(slug) 
WHERE deleted_at IS NULL;

-- Create org_cleanup_jobs table
CREATE TABLE IF NOT EXISTS public.org_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('NO_USERS', 'MANUAL_CLEANUP', 'USER_DELETED')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  dependent_counts jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.org_cleanup_jobs ENABLE ROW LEVEL SECURITY;

-- Admin-only access to cleanup jobs
CREATE POLICY "Admins can manage org cleanup jobs"
ON public.org_cleanup_jobs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Index for pending jobs
CREATE INDEX IF NOT EXISTS idx_org_cleanup_jobs_status ON public.org_cleanup_jobs(status) WHERE status = 'PENDING';

-- Function to find orphan organizations (orgs with no users)
CREATE OR REPLACE FUNCTION public.find_orphan_organizations()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_slug text,
  org_created_at timestamptz,
  sites_count bigint,
  areas_count bigint,
  units_count bigint,
  sensors_count bigint,
  gateways_count bigint,
  alerts_count bigint,
  event_logs_count bigint,
  has_subscription boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    o.created_at as org_created_at,
    (SELECT COUNT(*) FROM sites WHERE organization_id = o.id AND deleted_at IS NULL) as sites_count,
    (SELECT COUNT(*) FROM areas a JOIN sites s ON s.id = a.site_id WHERE s.organization_id = o.id AND a.deleted_at IS NULL) as areas_count,
    (SELECT COUNT(*) FROM units u JOIN areas a ON a.id = u.area_id JOIN sites s ON s.id = a.site_id WHERE s.organization_id = o.id AND u.deleted_at IS NULL) as units_count,
    (SELECT COUNT(*) FROM lora_sensors WHERE organization_id = o.id) as sensors_count,
    (SELECT COUNT(*) FROM gateways WHERE organization_id = o.id) as gateways_count,
    (SELECT COUNT(*) FROM alerts WHERE organization_id = o.id) as alerts_count,
    (SELECT COUNT(*) FROM event_logs WHERE organization_id = o.id) as event_logs_count,
    EXISTS(SELECT 1 FROM subscriptions WHERE organization_id = o.id AND status != 'canceled') as has_subscription
  FROM organizations o
  LEFT JOIN user_roles ur ON ur.organization_id = o.id
  WHERE o.deleted_at IS NULL
  GROUP BY o.id
  HAVING COUNT(ur.user_id) = 0
$$;

-- Function to check if a slug is available
CREATE OR REPLACE FUNCTION public.check_slug_available(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE slug = p_slug AND deleted_at IS NULL
  )
$$;

-- Function to soft delete an organization and cascade to children
CREATE OR REPLACE FUNCTION public.soft_delete_organization(p_org_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_sites_deleted int := 0;
  v_areas_deleted int := 0;
  v_units_deleted int := 0;
  v_sensors_queued int := 0;
  v_gateways_count int := 0;
BEGIN
  -- Soft delete all units under the org
  UPDATE units u
  SET deleted_at = now(), deleted_by = p_user_id, is_active = false
  FROM areas a
  JOIN sites s ON s.id = a.site_id
  WHERE u.area_id = a.id 
    AND s.organization_id = p_org_id 
    AND u.deleted_at IS NULL;
  GET DIAGNOSTICS v_units_deleted = ROW_COUNT;
  
  -- Soft delete all areas under the org
  UPDATE areas a
  SET deleted_at = now(), deleted_by = p_user_id, is_active = false
  FROM sites s
  WHERE a.site_id = s.id 
    AND s.organization_id = p_org_id 
    AND a.deleted_at IS NULL;
  GET DIAGNOSTICS v_areas_deleted = ROW_COUNT;
  
  -- Soft delete all sites
  UPDATE sites 
  SET deleted_at = now(), deleted_by = p_user_id, is_active = false 
  WHERE organization_id = p_org_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_sites_deleted = ROW_COUNT;
  
  -- Queue TTN deprovision jobs for all sensors with TTN devices
  INSERT INTO ttn_deprovision_jobs (
    organization_id, sensor_id, dev_eui, ttn_device_id, 
    ttn_application_id, reason, sensor_name, site_id, unit_id
  )
  SELECT 
    ls.organization_id, ls.id, ls.dev_eui, ls.ttn_device_id,
    ls.ttn_application_id, 'ORG_DELETED', ls.name, ls.site_id, ls.unit_id
  FROM lora_sensors ls
  WHERE ls.organization_id = p_org_id 
    AND ls.ttn_device_id IS NOT NULL
    AND ls.ttn_application_id IS NOT NULL;
  GET DIAGNOSTICS v_sensors_queued = ROW_COUNT;
  
  -- Get gateway count
  SELECT COUNT(*) INTO v_gateways_count FROM gateways WHERE organization_id = p_org_id;
  
  -- Soft delete the organization
  UPDATE organizations 
  SET deleted_at = now(), deleted_by = p_user_id 
  WHERE id = p_org_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'sites_deleted', v_sites_deleted,
    'areas_deleted', v_areas_deleted,
    'units_deleted', v_units_deleted,
    'sensors_queued', v_sensors_queued,
    'gateways_count', v_gateways_count
  );
  
  RETURN v_result;
END;
$$;

-- Function to hard delete an organization and all its data
CREATE OR REPLACE FUNCTION public.hard_delete_organization(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_org_name text;
  v_org_slug text;
BEGIN
  -- Get org info before deletion
  SELECT name, slug INTO v_org_name, v_org_slug
  FROM organizations WHERE id = p_org_id;
  
  IF v_org_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;
  
  -- Delete in order of dependencies (children first)
  
  -- Delete sensor readings
  DELETE FROM sensor_readings sr
  USING units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE sr.unit_id = u.id AND s.organization_id = p_org_id;
  
  -- Delete manual temperature logs
  DELETE FROM manual_temperature_logs mtl
  USING units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE mtl.unit_id = u.id AND s.organization_id = p_org_id;
  
  -- Delete door events
  DELETE FROM door_events de
  USING units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE de.unit_id = u.id AND s.organization_id = p_org_id;
  
  -- Delete corrective actions
  DELETE FROM corrective_actions ca
  USING units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE ca.unit_id = u.id AND s.organization_id = p_org_id;
  
  -- Delete alerts
  DELETE FROM alerts WHERE organization_id = p_org_id;
  
  -- Delete notification events
  DELETE FROM notification_events WHERE organization_id = p_org_id;
  
  -- Delete event logs
  DELETE FROM event_logs WHERE organization_id = p_org_id;
  
  -- Delete lora sensors (triggers TTN deprovision queue)
  DELETE FROM lora_sensors WHERE organization_id = p_org_id;
  
  -- Delete devices
  DELETE FROM devices d
  USING units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE d.unit_id = u.id AND s.organization_id = p_org_id;
  
  -- Delete units
  DELETE FROM units u
  USING areas a
  JOIN sites s ON s.id = a.site_id
  WHERE u.area_id = a.id AND s.organization_id = p_org_id;
  
  -- Delete areas
  DELETE FROM areas a
  USING sites s
  WHERE a.site_id = s.id AND s.organization_id = p_org_id;
  
  -- Delete gateways
  DELETE FROM gateways WHERE organization_id = p_org_id;
  
  -- Delete hubs
  DELETE FROM hubs h
  USING sites s
  WHERE h.site_id = s.id AND s.organization_id = p_org_id;
  
  -- Delete sites
  DELETE FROM sites WHERE organization_id = p_org_id;
  
  -- Delete notification settings and policies
  DELETE FROM notification_settings WHERE organization_id = p_org_id;
  DELETE FROM notification_policies WHERE organization_id = p_org_id;
  DELETE FROM escalation_policies WHERE organization_id = p_org_id;
  DELETE FROM escalation_contacts WHERE organization_id = p_org_id;
  
  -- Delete alert rules
  DELETE FROM alert_rules WHERE organization_id = p_org_id;
  
  -- Delete subscriptions and invoices
  DELETE FROM invoices i
  USING subscriptions sub
  WHERE i.subscription_id = sub.id AND sub.organization_id = p_org_id;
  DELETE FROM subscriptions WHERE organization_id = p_org_id;
  
  -- Delete cleanup jobs
  DELETE FROM org_cleanup_jobs WHERE organization_id = p_org_id;
  DELETE FROM ttn_deprovision_jobs WHERE organization_id = p_org_id;
  
  -- Delete profiles referencing this org
  UPDATE profiles SET organization_id = NULL WHERE organization_id = p_org_id;
  
  -- Delete user roles
  DELETE FROM user_roles WHERE organization_id = p_org_id;
  
  -- Delete inspector sessions
  DELETE FROM inspector_sessions WHERE organization_id = p_org_id;
  
  -- Delete pilot feedback
  DELETE FROM pilot_feedback WHERE organization_id = p_org_id;
  
  -- Finally delete the organization
  DELETE FROM organizations WHERE id = p_org_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'org_name', v_org_name,
    'org_slug', v_org_slug
  );
  
  RETURN v_result;
END;
$$;