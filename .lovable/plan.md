
# Fix Plan: Temperature Decoding Not Working

## Problem Summary

The sensor is sending heartbeats (showing "1 minute ago"), but temperature readings are not being decoded. The edge function logs show:

```
[TTN-WEBHOOK] | No temp or door data in payload. Keys:
[TTN-WEBHOOK] | Processing sensor: sensor-a840415a61897757, temp: N/A
```

This indicates the incoming TTN payload doesn't have recognizable temperature keys, and the JavaScript decoder isn't being invoked to parse the raw payload.

---

## Root Cause Analysis

The decoding pipeline has **3 missing database components**:

| Missing Component | Migration File | Purpose |
|------------------|----------------|---------|
| `lora_sensors.sensor_catalog_id` | `20260203060000_add_sensor_catalog_fk.sql` | Links each sensor to its catalog entry (containing the decoder_js) |
| `lora_sensors.decode_mode_override` | `20260203100000_add_decode_mode.sql` | Per-sensor decode mode control |
| Backfill trigger | `20260203070000_backfill_catalog_id_and_sync_trigger.sql` | Auto-links sensors by matching manufacturer/model |

### How the Decoder is Supposed to Work

The webhook logic (line 496 of `ttn-webhook/index.ts`) checks:

```typescript
if (sensor.sensor_catalog_id != null) {
  const catalogEntry = await getCatalogDecoder(supabase, sensor.sensor_catalog_id);
  // ... runs catalogEntry.decoder_js to decode raw payload
}
```

**Current state:** The `sensor_catalog_id` column doesn't exist on `lora_sensors`, so this check always fails and the decoder is never invoked.

### Additional Issue: Model Mismatch

The active sensor has model `SENSOR-A840415A` but the catalog only contains:
- Dragino LHT65
- Dragino LDS02  
- Dragino LWL02
- Elsys ERS CO2
- Netvox R311A

This sensor won't auto-match unless it's added to the catalog or the sensor's model is updated.

---

## Solution

### Step 1: Apply the Missing Migrations

Apply these 3 migrations to enable the decoding pipeline:

1. **`20260203060000_add_sensor_catalog_fk.sql`**
   - Adds `sensor_catalog_id` column to `lora_sensors`
   - Creates index for join performance

2. **`20260203100000_add_decode_mode.sql`**
   - Adds `decode_mode_override` column to `lora_sensors`
   - Already has `decode_mode` on `sensor_catalog` (applied earlier)

3. **`20260203070000_backfill_catalog_id_and_sync_trigger.sql`**
   - Backfills `sensor_catalog_id` for existing sensors by matching manufacturer/model
   - Creates trigger to auto-sync when catalog reference changes

### Step 2: Add Sensor to Catalog (or Update Model)

After migrations are applied, either:

**Option A:** Add the sensor model to the catalog
- Add an entry for `SENSOR-A840415A` (appears to be a Milesight or similar temp/humidity sensor based on dev_eui prefix A840)

**Option B:** Update the sensor's model to match an existing catalog entry
- If this is actually a Dragino HT65N (which has decoder_js), update the sensor's model field to `HT65N`

### Step 3: Redeploy Edge Function

The `ttn-webhook` edge function needs to be redeployed after migrations so it can:
1. Read `sensor_catalog_id` from `lora_sensors`
2. Fetch the decoder from `sensor_catalog`
3. Run the JavaScript decoder on incoming payloads

---

## Expected Behavior After Fix

1. **Webhook receives uplink** with raw payload (frmPayload)
2. **Checks `sensor.sensor_catalog_id`** → finds linked catalog entry
3. **Fetches `decoder_js`** from catalog
4. **Executes decoder** on raw bytes → produces decoded temperature/humidity
5. **Stores reading** with correct temperature value
6. **UI displays** accurate temperature (not N/A)

---

## Technical Details

### Decoder Execution Flow (ttn-webhook lines 502-560)

```text
┌─────────────────────────────────────────────────────────────┐
│                    Incoming TTN Uplink                      │
│  frmPayload (Base64) → bytes[] → fPort                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Check: sensor.sensor_catalog_id != null ?                  │
│  Currently: FAILS (column doesn't exist)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Fetch catalog entry → getCatalogDecoder()                  │
│  Returns: { decoder_js, decode_mode, temperature_unit }     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Execute: new Function('input', decoderCode)(bytes, fPort)  │
│  Result: { temperature: 23.5, humidity: 62, ... }           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Temperature conversion (C → F if needed)                   │
│  Store in sensor_readings                                   │
└─────────────────────────────────────────────────────────────┘
```

### Files Involved
- `supabase/functions/ttn-webhook/index.ts` - Main ingestion logic
- `supabase/functions/_shared/payloadNormalization.ts` - Key aliasing
- `supabase/migrations/20260203060000_add_sensor_catalog_fk.sql` - FK column
- `supabase/migrations/20260203100000_add_decode_mode.sql` - Decode mode column
- `supabase/migrations/20260203070000_backfill_catalog_id_and_sync_trigger.sql` - Backfill + trigger

### What the Migrations Do

```sql
-- 1. Add sensor_catalog_id FK
ALTER TABLE public.lora_sensors
  ADD COLUMN sensor_catalog_id uuid NULL
    REFERENCES public.sensor_catalog(id) ON DELETE SET NULL;

-- 2. Add decode_mode_override 
ALTER TABLE public.lora_sensors
  ADD COLUMN IF NOT EXISTS decode_mode_override TEXT
    CHECK (decode_mode_override IN ('ttn', 'trust', 'app', 'off'));

-- 3. Backfill existing sensors
UPDATE public.lora_sensors ls
SET sensor_catalog_id = sc.id
FROM public.sensor_catalog sc
WHERE LOWER(ls.model) = LOWER(sc.model)
  AND ls.sensor_catalog_id IS NULL;
```

---

## Summary

| Action | Details |
|--------|---------|
| Apply 3 migrations | Creates `sensor_catalog_id` and `decode_mode_override` columns, backfills existing sensors |
| Add/update catalog entry | Either add `SENSOR-A840415A` to catalog or update sensor's model to match existing entry |
| Redeploy webhook | Edge function picks up new schema |
