-- Backfill battery_voltage from network_decoded_payload/app_decoded_payload
--
-- Historical sensor_readings have battery_voltage = NULL because the old
-- webhook code never stored it. The raw voltage IS available in the JSONB
-- payload columns (BatV, battery_v). This migration extracts it.

-- Extract from network_decoded_payload.BatV (Dragino format)
UPDATE public.sensor_readings
SET battery_voltage = (network_decoded_payload->>'BatV')::numeric(4,3)
WHERE battery_voltage IS NULL
  AND network_decoded_payload->>'BatV' IS NOT NULL
  AND (network_decoded_payload->>'BatV')::numeric BETWEEN 0.5 AND 5.0;

-- Extract from network_decoded_payload.battery_v (catalog decoder format)
UPDATE public.sensor_readings
SET battery_voltage = (network_decoded_payload->>'battery_v')::numeric(4,3)
WHERE battery_voltage IS NULL
  AND network_decoded_payload->>'battery_v' IS NOT NULL
  AND (network_decoded_payload->>'battery_v')::numeric BETWEEN 0.5 AND 5.0;

-- Extract from app_decoded_payload.battery_v (app-side decoder format)
UPDATE public.sensor_readings
SET battery_voltage = (app_decoded_payload->>'battery_v')::numeric(4,3)
WHERE battery_voltage IS NULL
  AND app_decoded_payload->>'battery_v' IS NOT NULL
  AND (app_decoded_payload->>'battery_v')::numeric BETWEEN 0.5 AND 5.0;

-- Extract from app_decoded_payload.BatV
UPDATE public.sensor_readings
SET battery_voltage = (app_decoded_payload->>'BatV')::numeric(4,3)
WHERE battery_voltage IS NULL
  AND app_decoded_payload->>'BatV' IS NOT NULL
  AND (app_decoded_payload->>'BatV')::numeric BETWEEN 0.5 AND 5.0;

-- Also backfill lora_sensors.battery_voltage from the latest reading
-- for each sensor that has null battery_voltage
UPDATE public.lora_sensors ls
SET battery_voltage = sub.latest_voltage
FROM (
  SELECT DISTINCT ON (lora_sensor_id)
    lora_sensor_id,
    battery_voltage AS latest_voltage
  FROM public.sensor_readings
  WHERE lora_sensor_id IS NOT NULL
    AND battery_voltage IS NOT NULL
  ORDER BY lora_sensor_id, recorded_at DESC
) sub
WHERE ls.id = sub.lora_sensor_id
  AND ls.battery_voltage IS NULL;
