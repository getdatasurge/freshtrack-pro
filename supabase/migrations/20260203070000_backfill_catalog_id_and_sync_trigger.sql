-- ============================================================================
-- Backfill sensor_catalog_id on existing lora_sensors,
-- add sync trigger to keep manufacturer/model authoritative from catalog,
-- and update the public view to include supports_class.
-- ============================================================================

-- ============================================================
-- 1. BACKFILL: Link existing sensors to catalog entries
-- Match on LOWER(manufacturer) + LOWER(model), only where
-- sensor_catalog_id is not already set and sensor is not deleted.
-- ============================================================

UPDATE public.lora_sensors ls
SET sensor_catalog_id = sc.id
FROM public.sensor_catalog sc
WHERE LOWER(TRIM(ls.manufacturer)) = LOWER(TRIM(sc.manufacturer))
  AND LOWER(TRIM(ls.model)) = LOWER(TRIM(sc.model))
  AND ls.sensor_catalog_id IS NULL
  AND ls.deleted_at IS NULL
  AND sc.deprecated_at IS NULL;

-- ============================================================
-- 2. TRIGGER: Sync manufacturer/model from catalog on change
-- When sensor_catalog_id is set or changed, overwrite the
-- denormalized manufacturer and model fields from the catalog.
-- This prevents drift — catalog is the source of truth.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_sensor_from_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when sensor_catalog_id actually changes (or is first set)
  IF NEW.sensor_catalog_id IS NOT NULL
     AND (OLD.sensor_catalog_id IS DISTINCT FROM NEW.sensor_catalog_id) THEN

    SELECT sc.manufacturer, sc.model
    INTO NEW.manufacturer, NEW.model
    FROM sensor_catalog sc
    WHERE sc.id = NEW.sensor_catalog_id;

    -- If catalog entry was not found (shouldn't happen due to FK),
    -- leave manufacturer/model unchanged.
  END IF;

  -- When sensor_catalog_id is cleared, leave existing manufacturer/model
  -- so the sensor doesn't lose its metadata reference.

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_sensor_from_catalog() IS
  'BEFORE trigger: copies manufacturer and model from sensor_catalog '
  'into lora_sensors whenever sensor_catalog_id changes.';

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS trg_sync_sensor_from_catalog ON public.lora_sensors;

CREATE TRIGGER trg_sync_sensor_from_catalog
  BEFORE INSERT OR UPDATE OF sensor_catalog_id
  ON public.lora_sensors
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sensor_from_catalog();

-- ============================================================
-- 3. UPDATE VIEW: Add supports_class to sensor_catalog_public
-- The Add Sensor dialog shows supports_class, so the public
-- view needs to expose it.
-- ============================================================

CREATE OR REPLACE VIEW public.sensor_catalog_public AS
SELECT
  id,
  manufacturer,
  model,
  model_variant,
  display_name,
  sensor_kind,
  description,
  frequency_bands,
  supports_class,
  f_ports,
  decoded_fields,
  uplink_info,
  battery_info,
  is_supported,
  tags
FROM public.sensor_catalog
WHERE is_visible = true
  AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;

COMMENT ON VIEW public.sensor_catalog_public IS
  'Read-only view of non-deprecated, visible catalog entries for org-level users. '
  'Excludes internal fields: provenance, notes, test vectors, decoder code, sample payloads.';
