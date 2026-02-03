-- ============================================================================
-- Add raw payload columns to sensor_readings for decoder independence.
--
-- Storing the raw LoRaWAN frame payload alongside decoded data means:
--   1) Historical readings can be re-decoded with updated decoders
--   2) TTN payload formatters can be disabled/changed safely
--   3) Trust-mode comparison (TTN decoded vs our decoder) is possible
--   4) Debug payload issues without asking for screenshots from TTN console
-- ============================================================================

-- Raw frame payload exactly as received from the network server (base64)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS frm_payload_base64 TEXT;

-- LoRaWAN FPort (determines which decoder/codec applies)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS f_port INTEGER;

-- Hex representation of the raw payload for quick visual inspection
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS raw_payload_hex TEXT;

-- Full decoded payload object as received from TTN (or other network server).
-- Kept for trust-mode comparison: compare this against our own decoder output.
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS network_decoded_payload JSONB;

-- Index for finding readings that have raw payloads (useful for re-decoding jobs)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_has_raw_payload
  ON public.sensor_readings (recorded_at DESC)
  WHERE frm_payload_base64 IS NOT NULL;

COMMENT ON COLUMN public.sensor_readings.frm_payload_base64 IS
  'Raw LoRaWAN FRMPayload as base64, exactly as received from the network server';
COMMENT ON COLUMN public.sensor_readings.f_port IS
  'LoRaWAN FPort number — determines which decoder codec applies';
COMMENT ON COLUMN public.sensor_readings.raw_payload_hex IS
  'Hex representation of frm_payload for quick visual inspection';
COMMENT ON COLUMN public.sensor_readings.network_decoded_payload IS
  'Full decoded_payload object from the network server (TTN). Kept for trust-mode comparison.';
