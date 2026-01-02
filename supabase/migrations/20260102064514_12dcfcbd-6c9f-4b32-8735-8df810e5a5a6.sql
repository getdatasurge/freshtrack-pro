-- Update get_org_sync_payload to include units array
-- Units are accessed via: units → areas → sites → organization

CREATE OR REPLACE FUNCTION public.get_org_sync_payload(p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sites jsonb;
  v_sensors jsonb;
  v_gateways jsonb;
  v_units jsonb;
  v_areas jsonb;
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
  
  -- Query all ACTIVE areas (exclude soft-deleted)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'description', a.description,
    'site_id', a.site_id,
    'sort_order', a.sort_order,
    'is_active', a.is_active
  )), '[]'::jsonb)
  INTO v_areas
  FROM areas a
  JOIN sites s ON s.id = a.site_id
  WHERE s.organization_id = p_org_id
    AND a.deleted_at IS NULL
    AND s.deleted_at IS NULL;
  
  -- Query all ACTIVE units (exclude soft-deleted)
  -- Derive site_id from the unit's area → site relationship
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'name', u.name,
    'unit_type', u.unit_type,
    'area_id', u.area_id,
    'site_id', s.id,
    'temp_limit_high', u.temp_limit_high,
    'temp_limit_low', u.temp_limit_low,
    'status', u.status,
    'is_active', u.is_active,
    'created_at', u.created_at
  )), '[]'::jsonb)
  INTO v_units
  FROM units u
  JOIN areas a ON a.id = u.area_id
  JOIN sites s ON s.id = a.site_id
  WHERE s.organization_id = p_org_id
    AND u.deleted_at IS NULL
    AND a.deleted_at IS NULL
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
  
  -- Build complete payload with units and areas
  v_result := jsonb_build_object(
    'organization_id', p_org_id,
    'sync_version', COALESCE(v_sync_version, 1),
    'updated_at', now(),
    'sites', v_sites,
    'areas', v_areas,
    'units', v_units,
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
$function$;