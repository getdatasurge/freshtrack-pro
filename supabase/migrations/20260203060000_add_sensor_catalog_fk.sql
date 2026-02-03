-- ============================================================================
-- Add sensor_catalog_id FK to lora_sensors
-- Links installed sensors to the platform-wide sensor catalog.
-- ON DELETE SET NULL: if a catalog entry is removed, the sensor keeps working
-- but loses its catalog reference.
-- ============================================================================

ALTER TABLE public.lora_sensors
  ADD COLUMN sensor_catalog_id uuid NULL
    REFERENCES public.sensor_catalog(id) ON DELETE SET NULL;

-- Partial index for join performance (only index non-null values)
CREATE INDEX idx_lora_sensors_catalog_id
  ON public.lora_sensors(sensor_catalog_id)
  WHERE sensor_catalog_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.lora_sensors.sensor_catalog_id IS
  'FK to sensor_catalog. When set, the installed sensor inherits defaults '
  '(decoder, f_ports, battery info, etc.) from the catalog entry.';
