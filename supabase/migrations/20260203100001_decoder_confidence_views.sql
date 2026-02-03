-- ============================================================================
-- Decoder confidence rollup view for the platform admin dashboard.
-- Aggregates match/mismatch stats per decoder_id so admins can see
-- which sensor models are safe to switch from trust → app mode.
-- ============================================================================

CREATE OR REPLACE VIEW public.decoder_confidence_rollup AS
SELECT
  decoder_id,
  COUNT(*) FILTER (WHERE decode_match IS NOT NULL) AS compared_count,
  COUNT(*) FILTER (WHERE decode_match = true)      AS match_count,
  COUNT(*) FILTER (WHERE decode_match = false)     AS mismatch_count,
  ROUND(
    CASE
      WHEN COUNT(*) FILTER (WHERE decode_match IS NOT NULL) = 0 THEN NULL
      ELSE (COUNT(*) FILTER (WHERE decode_match = true)::numeric
        / COUNT(*) FILTER (WHERE decode_match IS NOT NULL)::numeric) * 100
    END
  , 2) AS match_rate_pct,
  MAX(recorded_at) AS last_seen_at,
  MIN(recorded_at) AS first_seen_at,
  -- Most common mismatch reason for quick diagnosis
  (SELECT sr2.decode_mismatch_reason
   FROM public.sensor_readings sr2
   WHERE sr2.decoder_id = sensor_readings.decoder_id
     AND sr2.decode_match = false
   GROUP BY sr2.decode_mismatch_reason
   ORDER BY COUNT(*) DESC
   LIMIT 1) AS top_mismatch_reason
FROM public.sensor_readings
WHERE decoder_id IS NOT NULL
GROUP BY decoder_id;

COMMENT ON VIEW public.decoder_confidence_rollup IS
  'Aggregated match/mismatch statistics per decoder_id for trust-mode confidence monitoring';

-- RLS: The view reads from sensor_readings which already has RLS.
-- Super admins bypass RLS via service_role in edge functions.
-- For the frontend, we'll query this view through a platform-only hook.

-- Index for fast decoder_id grouping
CREATE INDEX IF NOT EXISTS idx_sensor_readings_decoder_id_recorded_at
  ON public.sensor_readings (decoder_id, recorded_at DESC)
  WHERE decoder_id IS NOT NULL;
