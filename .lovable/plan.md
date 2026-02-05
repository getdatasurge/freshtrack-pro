

# Re-Evaluated Fix Plan: Apply Battery Migrations

## Current State Summary

After the pull request, I've verified:

| Component | Status | Details |
|-----------|--------|---------|
| Migration files in codebase | ✅ Present | `20260203140000_fix_pack_level_voltages.sql` and `20260203140001_backfill_battery_voltage.sql` exist |
| Edge function code | ✅ Updated | `ttn-webhook` correctly extracts `battery_voltage` from normalized payload |
| Battery profiles in DB | ❌ Wrong values | Still showing per-cell voltages (1.50V/0.90V) instead of pack (3.0V/1.80V) |
| sensor_readings.battery_voltage | ❌ All NULL | 1,836 readings, 0 have battery_voltage populated |
| app_decoded_payload has BatV | ✅ 654 readings | Data exists but not extracted to the column |

**Root cause**: The migration files exist but have **not been executed** against the database.

---

## What Needs to Happen

### Step 1: Apply Migration A — Fix Battery Profile Voltages

The `battery_profiles` table currently stores per-cell values but sensors report pack-level voltage:

| Chemistry | Current (per-cell) | Correct (pack) |
|-----------|-------------------|----------------|
| LiFeS2_AA | 1.50V / 0.90V | 3.0V / 1.80V |
| Alkaline_AA | 1.50V / 0.80V | 3.0V / 1.60V |

**Migration A** (`20260203140000_fix_pack_level_voltages.sql`):
```sql
UPDATE public.battery_profiles 
SET nominal_voltage = 3.0, cutoff_voltage = 1.80
WHERE chemistry = 'LiFeS2_AA' 
  AND (cutoff_voltage < 1.0 OR nominal_voltage < 2.0);

UPDATE public.battery_profiles 
SET nominal_voltage = 3.0, cutoff_voltage = 1.60
WHERE chemistry = 'Alkaline_AA' 
  AND (cutoff_voltage < 1.0 OR nominal_voltage < 2.0);
```

### Step 2: Apply Migration B — Backfill Battery Voltage

Extract `BatV` from JSONB payloads into the `battery_voltage` column:

**Migration B** (`20260203140001_backfill_battery_voltage.sql`):
```sql
-- From network_decoded_payload.BatV
UPDATE public.sensor_readings
SET battery_voltage = (network_decoded_payload->>'BatV')::numeric(4,3)
WHERE battery_voltage IS NULL
  AND network_decoded_payload->>'BatV' IS NOT NULL
  AND (network_decoded_payload->>'BatV')::numeric BETWEEN 0.5 AND 5.0;

-- From app_decoded_payload.BatV (where the 654 readings actually are)
UPDATE public.sensor_readings
SET battery_voltage = (app_decoded_payload->>'BatV')::numeric(4,3)
WHERE battery_voltage IS NULL
  AND app_decoded_payload->>'BatV' IS NOT NULL
  AND (app_decoded_payload->>'BatV')::numeric BETWEEN 0.5 AND 5.0;

-- Sync latest voltage to lora_sensors
UPDATE public.lora_sensors ls
SET battery_voltage = sub.latest_voltage
FROM (
  SELECT DISTINCT ON (lora_sensor_id)
    lora_sensor_id,
    battery_voltage AS latest_voltage
  FROM public.sensor_readings
  WHERE lora_sensor_id IS NOT NULL AND battery_voltage IS NOT NULL
  ORDER BY lora_sensor_id, recorded_at DESC
) sub
WHERE ls.id = sub.lora_sensor_id AND ls.battery_voltage IS NULL;
```

### Step 3: Deploy Edge Function

The edge function code is already correct but needs to be redeployed to production:

```bash
supabase functions deploy ttn-webhook
```

---

## Expected Results After Fix

| Metric | Before | After |
|--------|--------|-------|
| Battery % displayed | ~3% (wrong) | ~68% (correct) |
| LHT65 cutoff voltage | 0.90V | 1.80V |
| sensor_readings with battery_voltage | 0 | 654+ |
| Battery Health widget | "Collecting data" | Trend graph with data |

### Verification Query

```sql
SELECT 
  bp.model, 
  bp.nominal_voltage, 
  bp.cutoff_voltage,
  ls.battery_level, 
  ls.battery_voltage,
  (SELECT COUNT(*) FROM sensor_readings sr 
   WHERE sr.lora_sensor_id = ls.id 
   AND sr.battery_voltage IS NOT NULL) as readings_with_voltage
FROM lora_sensors ls
LEFT JOIN battery_profiles bp ON bp.model = ls.model
WHERE ls.dev_eui = 'A840415A61897757';
```

**Expected output**:
- `nominal_voltage: 3.0`
- `cutoff_voltage: 1.80`
- `battery_voltage: ~2.985`
- `readings_with_voltage: 654+`

---

## Technical Notes

### Why the migrations weren't auto-applied

Lovable migrations are applied when:
1. Created via the database migration tool, OR
2. Already tracked in the migration history

These migrations were added via pull request and exist as files, but Supabase doesn't know about them yet. They need to be executed manually.

### Battery percentage calculation

With voltage 2.985V on LiFeS2_AA pack curve (1.80V cutoff, 3.0V nominal):
- Position on curve: (2.985 - 1.80) / (3.0 - 1.80) = 98.75% of range
- Using the non-linear discharge curve, maps to approximately **68-70%**

