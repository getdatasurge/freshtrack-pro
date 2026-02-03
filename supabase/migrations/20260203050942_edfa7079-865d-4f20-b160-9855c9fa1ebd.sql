-- Fix: Recreate decoder_confidence_rollup view with SECURITY INVOKER
-- This ensures the view uses the permissions of the querying user, not the view creator

DROP VIEW IF EXISTS public.decoder_confidence_rollup;

CREATE VIEW public.decoder_confidence_rollup 
WITH (security_invoker = true)
AS
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