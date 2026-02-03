-- Migration 1: Add raw payload columns to sensor_readings
-- These columns store the raw LoRaWAN payload for re-decoding and trust-mode comparison

ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS frm_payload_base64 TEXT,
  ADD COLUMN IF NOT EXISTS f_port INTEGER,
  ADD COLUMN IF NOT EXISTS raw_payload_hex TEXT,
  ADD COLUMN IF NOT EXISTS network_decoded_payload JSONB;

-- Add index for f_port lookups
CREATE INDEX IF NOT EXISTS idx_sensor_readings_f_port ON public.sensor_readings(f_port) WHERE f_port IS NOT NULL;

COMMENT ON COLUMN public.sensor_readings.frm_payload_base64 IS 'Raw LoRaWAN payload as received from TTN (base64 encoded)';
COMMENT ON COLUMN public.sensor_readings.f_port IS 'LoRaWAN port number - determines which decoder to use';
COMMENT ON COLUMN public.sensor_readings.raw_payload_hex IS 'Hex representation of payload for debugging';
COMMENT ON COLUMN public.sensor_readings.network_decoded_payload IS 'Full decoded object from TTN/network server';

-- Migration 2: Add trust-mode columns for decoder comparison
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS app_decoded_payload JSONB,
  ADD COLUMN IF NOT EXISTS decoder_id TEXT,
  ADD COLUMN IF NOT EXISTS decode_match BOOLEAN,
  ADD COLUMN IF NOT EXISTS decode_mismatch_reason TEXT,
  ADD COLUMN IF NOT EXISTS decoder_warnings JSONB,
  ADD COLUMN IF NOT EXISTS decoder_errors JSONB;

-- Add indexes for decoder confidence queries
CREATE INDEX IF NOT EXISTS idx_sensor_readings_decoder_id ON public.sensor_readings(decoder_id) WHERE decoder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sensor_readings_decode_match ON public.sensor_readings(decode_match) WHERE decode_match IS NOT NULL;

COMMENT ON COLUMN public.sensor_readings.app_decoded_payload IS 'Our catalog decoder output for comparison';
COMMENT ON COLUMN public.sensor_readings.decoder_id IS 'Decoder identifier (e.g., catalog:uuid:rev3)';
COMMENT ON COLUMN public.sensor_readings.decode_match IS 'Whether TTN and app decoder outputs matched';
COMMENT ON COLUMN public.sensor_readings.decode_mismatch_reason IS 'Reason for mismatch if decode_match is false';
COMMENT ON COLUMN public.sensor_readings.decoder_warnings IS 'Warnings from decoder execution';
COMMENT ON COLUMN public.sensor_readings.decoder_errors IS 'Errors from decoder execution';

-- Migration 3: Create the decoder_confidence_rollup view
CREATE OR REPLACE VIEW public.decoder_confidence_rollup AS
SELECT
  decoder_id,
  COUNT(*) FILTER (WHERE decode_match IS NOT NULL) AS compared_count,
  COUNT(*) FILTER (WHERE decode_match = true) AS match_count,
  COUNT(*) FILTER (WHERE decode_match = false) AS mismatch_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE decode_match IS NOT NULL) > 0 THEN
      ROUND(
        (COUNT(*) FILTER (WHERE decode_match = true)::NUMERIC / 
         COUNT(*) FILTER (WHERE decode_match IS NOT NULL)::NUMERIC) * 100,
        2
      )
    ELSE NULL
  END AS match_rate_pct,
  MAX(recorded_at) AS last_seen_at,
  MIN(recorded_at) AS first_seen_at,
  (
    SELECT decode_mismatch_reason 
    FROM public.sensor_readings sr2 
    WHERE sr2.decoder_id = sensor_readings.decoder_id 
      AND sr2.decode_match = false 
      AND sr2.decode_mismatch_reason IS NOT NULL
    GROUP BY decode_mismatch_reason
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS top_mismatch_reason
FROM public.sensor_readings
WHERE decoder_id IS NOT NULL
GROUP BY decoder_id;

COMMENT ON VIEW public.decoder_confidence_rollup IS 'Aggregated decoder confidence stats for platform admin dashboard';