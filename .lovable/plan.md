

# Fix Plan: Apply Decoder Confidence Migrations

## Problem Summary

The Decoder Confidence page shows 404 errors because:
1. The `decoder_confidence_rollup` view doesn't exist in the database
2. The view depends on columns in `sensor_readings` that also don't exist yet

**Evidence:**
- Network request to `/rest/v1/decoder_confidence_rollup` returns 404
- Database query confirms no decoder-related views exist
- The required columns (`decoder_id`, `decode_match`, `decode_mismatch_reason`) are missing from `sensor_readings`

---

## Solution: Apply 3 Dependent Migrations

These migrations must be applied in order:

| Order | Migration File | Purpose |
|-------|---------------|---------|
| 1 | `20260203080000_add_raw_payload_columns.sql` | Adds `frm_payload_base64`, `f_port`, `raw_payload_hex`, `network_decoded_payload` to `sensor_readings` |
| 2 | `20260203090000_add_trust_mode_columns.sql` | Adds `app_decoded_payload`, `decoder_id`, `decode_match`, `decode_mismatch_reason`, `decoder_warnings`, `decoder_errors` to `sensor_readings` |
| 3 | `20260203100001_decoder_confidence_views.sql` | Creates the `decoder_confidence_rollup` view that aggregates match/mismatch stats |

---

## What Each Migration Does

### Migration 1: Raw Payload Columns
Adds columns to store the raw LoRaWAN payload for re-decoding and trust-mode comparison:
- `frm_payload_base64` - Raw payload as received from TTN
- `f_port` - LoRaWAN port number (determines decoder)
- `raw_payload_hex` - Hex representation for debugging
- `network_decoded_payload` - Full decoded object from TTN

### Migration 2: Trust-Mode Columns
Adds columns for side-by-side decoder comparison:
- `app_decoded_payload` - Our decoder's output
- `decoder_id` - Which decoder produced the output (e.g., `catalog:uuid:rev3`)
- `decode_match` - Whether TTN and app outputs matched
- `decode_mismatch_reason` - Why they didn't match
- `decoder_warnings` / `decoder_errors` - Decoder diagnostic info

### Migration 3: Confidence Rollup View
Creates the aggregated view for the platform admin dashboard:
```sql
CREATE VIEW public.decoder_confidence_rollup AS
SELECT
  decoder_id,
  COUNT(*) FILTER (WHERE decode_match IS NOT NULL) AS compared_count,
  COUNT(*) FILTER (WHERE decode_match = true) AS match_count,
  COUNT(*) FILTER (WHERE decode_match = false) AS mismatch_count,
  ROUND(...) AS match_rate_pct,
  MAX(recorded_at) AS last_seen_at,
  MIN(recorded_at) AS first_seen_at,
  (...) AS top_mismatch_reason
FROM public.sensor_readings
WHERE decoder_id IS NOT NULL
GROUP BY decoder_id;
```

---

## Expected Behavior After Fix

1. **Decoder Confidence page loads** without 404 errors
2. **Table shows "No trust-mode data yet"** (empty state) until sensors with catalog decoders report data
3. **Future readings** with `decode_match` data will populate the rollup statistics
4. **The ttn-webhook** (already updated) will start populating these columns for incoming uplinks

---

## Files Involved

| File | Purpose |
|------|---------|
| `supabase/migrations/20260203080000_add_raw_payload_columns.sql` | Schema migration (raw payload) |
| `supabase/migrations/20260203090000_add_trust_mode_columns.sql` | Schema migration (trust mode) |
| `supabase/migrations/20260203100001_decoder_confidence_views.sql` | View creation |
| `src/hooks/useDecoderConfidence.ts` | Frontend hook (already using correct table name) |
| `src/pages/platform/PlatformDecoderConfidence.tsx` | UI component (already built) |

