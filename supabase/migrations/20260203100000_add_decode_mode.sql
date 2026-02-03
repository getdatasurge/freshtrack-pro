-- ============================================================================
-- Decode mode control: per-model default + per-sensor override.
--
-- Modes:
--   ttn   — rely on TTN decoded payload, skip app decode
--   trust — run both decoders, compare, store both (current behavior)
--   app   — app decoder is authoritative, TTN can be disabled
--   off   — store raw only, no decoding (debugging/rare)
--
-- The webhook resolves effective mode as:
--   lora_sensors.decode_mode_override ?? sensor_catalog.decode_mode ?? 'trust'
-- ============================================================================

-- Default decode mode on catalog entries
ALTER TABLE public.sensor_catalog
  ADD COLUMN IF NOT EXISTS decode_mode TEXT NOT NULL DEFAULT 'trust'
    CONSTRAINT sensor_catalog_decode_mode_check
    CHECK (decode_mode IN ('ttn', 'trust', 'app', 'off'));

COMMENT ON COLUMN public.sensor_catalog.decode_mode IS
  'Default decode behavior for this sensor model: ttn, trust, app, or off';

-- Per-sensor override (null = use catalog default)
ALTER TABLE public.lora_sensors
  ADD COLUMN IF NOT EXISTS decode_mode_override TEXT
    CONSTRAINT lora_sensors_decode_mode_override_check
    CHECK (decode_mode_override IS NULL OR decode_mode_override IN ('ttn', 'trust', 'app', 'off'));

COMMENT ON COLUMN public.lora_sensors.decode_mode_override IS
  'Optional per-installed-sensor override; if null, uses catalog.decode_mode';

-- Update public view to include decode_mode (org users can see which mode is active)
CREATE OR REPLACE VIEW public.sensor_catalog_public AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, supports_class, f_ports, decoded_fields,
  uplink_info, battery_info, is_supported, tags, decode_mode
FROM public.sensor_catalog
WHERE is_visible = true AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;
