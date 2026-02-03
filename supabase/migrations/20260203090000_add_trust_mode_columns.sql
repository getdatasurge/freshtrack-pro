-- ============================================================================
-- Trust-mode columns: server-side decoding results alongside network decoding.
--
-- When a sensor has a catalog entry with decoder_js, the webhook runs it
-- against the raw payload and stores the result here. This enables:
--   1) Side-by-side comparison of TTN vs our decoder output
--   2) Confidence scoring before disabling TTN payload formatters
--   3) Decoder version tracking for audit/rollback
--   4) Flagging mismatches for platform admin review
-- ============================================================================

-- Our decoder's output (from sensor_catalog.decoder_js applied to frm_payload)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS app_decoded_payload JSONB;

-- Which decoder produced app_decoded_payload
-- Format: "catalog:<sensor_catalog_id>:rev<revision>"
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS decoder_id TEXT;

-- Whether network vs app decoding matched (null = not compared / no decoder)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS decode_match BOOLEAN;

-- If there was a mismatch or decode error, store the reason
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS decode_mismatch_reason TEXT;

-- Index for finding mismatches (admin review dashboard)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_decode_mismatch
  ON public.sensor_readings (recorded_at DESC)
  WHERE decode_match = false;

COMMENT ON COLUMN public.sensor_readings.app_decoded_payload IS
  'Decoded payload from our server-side decoder (sensor_catalog.decoder_js)';
COMMENT ON COLUMN public.sensor_readings.decoder_id IS
  'Decoder identity string, e.g. "catalog:<uuid>:rev3"';
COMMENT ON COLUMN public.sensor_readings.decode_match IS
  'true if network_decoded_payload matches app_decoded_payload, null if not compared';
COMMENT ON COLUMN public.sensor_readings.decode_mismatch_reason IS
  'Reason for mismatch or decode error, e.g. "key_diff:temperature" or "decode_error:..."';

-- Warnings emitted by the decoder (decodeUplink().warnings)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS decoder_warnings JSONB;

-- Errors emitted by the decoder (decodeUplink().errors)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS decoder_errors JSONB;

COMMENT ON COLUMN public.sensor_readings.decoder_warnings IS
  'Warnings array from decodeUplink().warnings, if any';
COMMENT ON COLUMN public.sensor_readings.decoder_errors IS
  'Errors array from decodeUplink().errors, if any';
