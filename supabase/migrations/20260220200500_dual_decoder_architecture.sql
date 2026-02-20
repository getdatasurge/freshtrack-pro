-- ============================================================
-- DUAL DECODER ARCHITECTURE
-- Adds repo_decoder_js (official TTN) and user_decoder_js (admin override)
-- alongside the existing decoder_js column (left untouched).
--
-- Priority system:
--   1. user_decoder_js (admin custom override)
--   2. repo_decoder_js (official TTN decoder from submodule)
--   3. None — rely on TTN decoded_payload as-is
-- ============================================================

-- ─── New columns on sensor_catalog ───────────────────────────

ALTER TABLE sensor_catalog
  ADD COLUMN IF NOT EXISTS repo_decoder_js        TEXT,
  ADD COLUMN IF NOT EXISTS repo_decoder_source     TEXT,
  ADD COLUMN IF NOT EXISTS repo_decoder_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_decoder_js         TEXT,
  ADD COLUMN IF NOT EXISTS user_decoder_notes      TEXT,
  ADD COLUMN IF NOT EXISTS user_decoder_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS repo_test_fixtures      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active_decoder_source   TEXT DEFAULT 'repo';

-- Add CHECK constraint for active_decoder_source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sensor_catalog_active_decoder_source_check'
  ) THEN
    ALTER TABLE sensor_catalog
      ADD CONSTRAINT sensor_catalog_active_decoder_source_check
      CHECK (active_decoder_source IN ('repo', 'user', 'ttn_only'));
  END IF;
END $$;

-- ─── decoder_confidence_results table ─────────────────────────

CREATE TABLE IF NOT EXISTS decoder_confidence_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id         UUID REFERENCES sensors(id) ON DELETE SET NULL,
  sensor_model      TEXT,
  ttn_decoded       JSONB,
  local_decoded     JSONB,
  decoder_source    TEXT,
  is_match          BOOLEAN,
  mismatched_fields TEXT[],
  frm_payload_hex   TEXT,
  f_port            INTEGER,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dcr_sensor_created
  ON decoder_confidence_results(sensor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dcr_mismatches
  ON decoder_confidence_results(is_match) WHERE is_match = false;

-- RLS for decoder_confidence_results
ALTER TABLE decoder_confidence_results ENABLE ROW LEVEL SECURITY;

-- Super admins can read all
DROP POLICY IF EXISTS "Super admins can read decoder_confidence_results" ON decoder_confidence_results;
CREATE POLICY "Super admins can read decoder_confidence_results" ON decoder_confidence_results
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Service role inserts (bypasses RLS by default in Supabase)
-- No explicit insert policy needed for service_role.

-- ─── Populate repo_decoder_js for known sensors ──────────────
-- NOTE: The actual JS content is populated below. We match on
-- manufacturer + model since those are the stable identifiers.

-- Dragino LHT65 — ttn_only (production, don't change behavior)
UPDATE sensor_catalog
SET
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de31',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'ttn_only',
  ttn_device_repo_id = COALESCE(ttn_device_repo_id, 'dragino/lht65'),
  repo_test_fixtures = '[
    {
      "description": "Temperature with DS18B20 external probe",
      "fPort": 2,
      "bytes": "CBF60B0D037601 0ADD7FFF",
      "expectedOutput": {"BatV": 3.062, "Bat_status": 3, "Ext_sensor": "Temperature Sensor", "Hum_SHT": 88.6, "TempC_DS": 27.81, "TempC_SHT": 28.29}
    },
    {
      "description": "Unknown FPort",
      "fPort": 42,
      "bytes": "CBF60B0D037601 0ADD7FFF",
      "expectedOutput": null,
      "expectedErrors": ["unknown FPort"]
    }
  ]'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LHT65';

-- Dragino LDS02 — ttn_only (production, don't change behavior)
UPDATE sensor_catalog
SET
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de31',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'ttn_only',
  ttn_device_repo_id = COALESCE(ttn_device_repo_id, 'dragino/lds02'),
  repo_test_fixtures = '[
    {
      "description": "Door mode - distance detection",
      "fPort": 10,
      "bytes": "0B8801002500010000000000",
      "expectedOutput": {"ALARM": 0, "BAT_V": 2.952, "DOOR_OPEN_STATUS": 0, "DOOR_OPEN_TIMES": 9472, "LAST_DOOR_OPEN_DURATION": 65536, "MOD": 1}
    }
  ]'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LDS02';

-- Dragino LHT65N — repo (use official TTN decoder)
UPDATE sensor_catalog
SET
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de31',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'repo',
  ttn_device_repo_id = COALESCE(ttn_device_repo_id, 'dragino/lht65n'),
  repo_test_fixtures = '[
    {
      "description": "Temperature with DS18B20 external probe",
      "fPort": 2,
      "bytes": "CBF60B0D037601 0ADD7FFF",
      "expectedOutput": {"BatV": 3.062, "Bat_status": 3, "Ext_sensor": "Temperature Sensor", "Hum_SHT": 88.6, "TempC_DS": 27.81, "TempC_SHT": 28.29}
    }
  ]'::jsonb
WHERE manufacturer = 'Dragino' AND model = 'LHT65N';

-- Netvox R311A — repo
UPDATE sensor_catalog
SET
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de31',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'repo',
  ttn_device_repo_id = COALESCE(ttn_device_repo_id, 'netvox/r311a'),
  repo_test_fixtures = '[
    {
      "description": "Startup version report",
      "fPort": 6,
      "bytes": "01020064 0B202004 240000",
      "expectedOutput": {"Device": "R311A", "SWver": 10, "HWver": 11, "Datecode": "20200424"}
    },
    {
      "description": "Status report - door open",
      "fPort": 6,
      "bytes": "0102011E 0100000000 0000",
      "expectedOutput": {"Device": "R311A", "Volt": 3, "OnOff": 1}
    }
  ]'::jsonb
WHERE manufacturer = 'Netvox' AND model = 'R311A';

-- Elsys ERS CO2 — repo
UPDATE sensor_catalog
SET
  repo_decoder_source = 'TheThingsNetwork/lorawan-devices @ 0db7de31',
  repo_decoder_updated_at = now(),
  active_decoder_source = 'repo',
  ttn_device_repo_id = COALESCE(ttn_device_repo_id, 'elsys/ers-co2'),
  repo_test_fixtures = '[
    {
      "description": "ERS CO2 temperature, humidity, light, motion and co2",
      "fPort": 1,
      "bytes": "0100E2022900270506060308",
      "expectedOutput": {"temperature": 22.6, "humidity": 41, "light": 39, "motion": 6, "co2": 776}
    }
  ]'::jsonb
WHERE manufacturer = 'Elsys' AND model = 'ERS CO2';

-- NOTE: The repo_decoder_js content for each sensor is set via a separate
-- data migration script or application-level sync tool that reads from
-- the lib/lorawan-devices submodule. The SQL UPDATE statements below
-- embed the JS directly for the initial population.

-- The actual JS contents will be populated by the application sync script.
-- For now, we leave repo_decoder_js NULL and rely on the codec loader
-- to read from the submodule files at runtime.
