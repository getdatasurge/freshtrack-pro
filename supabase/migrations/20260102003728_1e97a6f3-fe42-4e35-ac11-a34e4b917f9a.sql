-- Phase 1: Create org_sync_state table
CREATE TABLE public.org_sync_state (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  is_dirty boolean NOT NULL DEFAULT true,
  last_change_at timestamptz NOT NULL DEFAULT now(),
  sync_version integer NOT NULL DEFAULT 1,
  last_synced_at timestamptz,
  last_synced_version integer
);

-- RLS: Deny all user access (only SECURITY DEFINER functions can access)
ALTER TABLE public.org_sync_state ENABLE ROW LEVEL SECURITY;

-- Phase 2: Create mark_org_dirty() trigger function
CREATE OR REPLACE FUNCTION public.mark_org_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Determine org_id based on table and operation
  IF TG_TABLE_NAME = 'lora_sensors' THEN
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'gateways' THEN
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'sites' THEN
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'ttn_connections' THEN
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);
  END IF;
  
  IF v_org_id IS NOT NULL THEN
    INSERT INTO org_sync_state (organization_id, is_dirty, last_change_at, sync_version)
    VALUES (v_org_id, true, now(), 1)
    ON CONFLICT (organization_id) DO UPDATE SET
      is_dirty = true,
      last_change_at = now(),
      sync_version = org_sync_state.sync_version + 1;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Phase 2: Attach triggers to core tables
CREATE TRIGGER trg_mark_org_dirty_sensors
  AFTER INSERT OR UPDATE OR DELETE ON lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION mark_org_dirty();

CREATE TRIGGER trg_mark_org_dirty_gateways
  AFTER INSERT OR UPDATE OR DELETE ON gateways
  FOR EACH ROW
  EXECUTE FUNCTION mark_org_dirty();

CREATE TRIGGER trg_mark_org_dirty_sites
  AFTER INSERT OR UPDATE OR DELETE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION mark_org_dirty();

CREATE TRIGGER trg_mark_org_dirty_ttn
  AFTER INSERT OR UPDATE OR DELETE ON ttn_connections
  FOR EACH ROW
  EXECUTE FUNCTION mark_org_dirty();

-- Phase 3: Create get_org_sync_payload() function
CREATE OR REPLACE FUNCTION public.get_org_sync_payload(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sites jsonb;
  v_sensors jsonb;
  v_gateways jsonb;
  v_ttn jsonb;
  v_sync_version integer;
  v_result jsonb;
BEGIN
  -- Get current sync version
  SELECT sync_version INTO v_sync_version
  FROM org_sync_state
  WHERE organization_id = p_org_id;
  
  -- Query all ACTIVE sites (exclude soft-deleted)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'address', s.address,
    'city', s.city,
    'state', s.state,
    'timezone', s.timezone,
    'is_active', s.is_active
  )), '[]'::jsonb)
  INTO v_sites
  FROM sites s
  WHERE s.organization_id = p_org_id
    AND s.deleted_at IS NULL;
  
  -- Query all sensors (LIVE, authoritative)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ls.id,
    'name', ls.name,
    'dev_eui', ls.dev_eui,
    'app_eui', ls.app_eui,
    'sensor_type', ls.sensor_type,
    'status', ls.status,
    'site_id', ls.site_id,
    'unit_id', ls.unit_id,
    'ttn_device_id', ls.ttn_device_id,
    'ttn_application_id', ls.ttn_application_id,
    'manufacturer', ls.manufacturer,
    'model', ls.model,
    'is_primary', ls.is_primary,
    'last_seen_at', ls.last_seen_at
  )), '[]'::jsonb)
  INTO v_sensors
  FROM lora_sensors ls
  WHERE ls.organization_id = p_org_id;
  
  -- Query all gateways (LIVE, authoritative)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'gateway_eui', g.gateway_eui,
    'status', g.status,
    'site_id', g.site_id,
    'description', g.description,
    'last_seen_at', g.last_seen_at
  )), '[]'::jsonb)
  INTO v_gateways
  FROM gateways g
  WHERE g.organization_id = p_org_id;
  
  -- Query TTN configuration
  SELECT jsonb_build_object(
    'enabled', COALESCE(tc.is_enabled, false),
    'provisioning_status', COALESCE(tc.provisioning_status, 'not_started'),
    'cluster', tc.ttn_region,
    'application_id', tc.ttn_application_id,
    'webhook_id', tc.ttn_webhook_id,
    'webhook_url', tc.ttn_webhook_url,
    'api_key_last4', tc.ttn_api_key_last4,
    'updated_at', tc.updated_at
  )
  INTO v_ttn
  FROM ttn_connections tc
  WHERE tc.organization_id = p_org_id;
  
  -- Build complete payload
  v_result := jsonb_build_object(
    'organization_id', p_org_id,
    'sync_version', COALESCE(v_sync_version, 1),
    'updated_at', now(),
    'sites', v_sites,
    'sensors', v_sensors,
    'gateways', v_gateways,
    'ttn', COALESCE(v_ttn, jsonb_build_object('enabled', false, 'provisioning_status', 'not_started'))
  );
  
  -- Mark org as clean and record sync
  INSERT INTO org_sync_state (organization_id, is_dirty, last_change_at, sync_version, last_synced_at, last_synced_version)
  VALUES (p_org_id, false, now(), COALESCE(v_sync_version, 1), now(), COALESCE(v_sync_version, 1))
  ON CONFLICT (organization_id) DO UPDATE SET
    is_dirty = false,
    last_synced_at = now(),
    last_synced_version = org_sync_state.sync_version;
  
  RETURN v_result;
END;
$$;

-- Phase 4: Create check_org_dirty() function for lightweight polling
CREATE OR REPLACE FUNCTION public.check_org_dirty(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'organization_id', organization_id,
      'is_dirty', is_dirty,
      'sync_version', sync_version,
      'last_change_at', last_change_at,
      'last_synced_at', last_synced_at
    )
    FROM org_sync_state
    WHERE organization_id = p_org_id),
    jsonb_build_object(
      'organization_id', p_org_id,
      'is_dirty', true,
      'sync_version', 0,
      'last_change_at', null,
      'last_synced_at', null
    )
  );
$$;