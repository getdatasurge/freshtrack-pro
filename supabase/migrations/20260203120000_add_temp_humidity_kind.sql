-- Add 'temp_humidity' to sensor_kind CHECK constraint.
-- Sensors like the Dragino LHT65 measure both temperature and humidity
-- and need a distinct kind from plain 'temp' or generic 'combo'.

ALTER TABLE public.sensor_catalog
  DROP CONSTRAINT IF EXISTS sensor_catalog_kind_check;

ALTER TABLE public.sensor_catalog
  ADD CONSTRAINT sensor_catalog_kind_check CHECK (
    sensor_kind IN (
      'temp', 'temp_humidity', 'door', 'combo', 'co2', 'leak', 'gps',
      'pulse', 'soil', 'air_quality', 'vibration',
      'meter', 'tilt'
    )
  );
