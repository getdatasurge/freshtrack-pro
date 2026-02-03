-- ============================================================================
-- Temperature unit: specifies whether a sensor model reports in °C or °F.
--
-- Most LoRaWAN sensors (Dragino, Milesight, Sensecap, etc.) report Celsius.
-- The FrostGuard application stores and displays Fahrenheit.
-- The webhook uses this field to convert incoming temperatures when needed.
-- ============================================================================

ALTER TABLE public.sensor_catalog
  ADD COLUMN IF NOT EXISTS temperature_unit TEXT NOT NULL DEFAULT 'C'
    CONSTRAINT sensor_catalog_temperature_unit_check
    CHECK (temperature_unit IN ('C', 'F'));

COMMENT ON COLUMN public.sensor_catalog.temperature_unit IS
  'Temperature unit reported by this sensor model: C (Celsius) or F (Fahrenheit). Used by webhook to convert to Fahrenheit for storage.';

-- Update public view to include temperature_unit
CREATE OR REPLACE VIEW public.sensor_catalog_public AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, supports_class, f_ports, decoded_fields,
  uplink_info, battery_info, is_supported, tags, decode_mode, temperature_unit
FROM public.sensor_catalog
WHERE is_visible = true AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;
