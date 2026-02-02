-- Add voltage columns to lora_sensors for voltage-based battery tracking
ALTER TABLE public.lora_sensors 
ADD COLUMN IF NOT EXISTS battery_voltage NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS battery_voltage_filtered NUMERIC(4,3),
ADD COLUMN IF NOT EXISTS battery_health_state TEXT DEFAULT 'OK' CHECK (battery_health_state IN ('OK', 'WARNING', 'LOW', 'CRITICAL', 'REPLACE_ASAP'));

-- Add battery_voltage to sensor_readings for historical voltage tracking
ALTER TABLE public.sensor_readings
ADD COLUMN IF NOT EXISTS battery_voltage NUMERIC(4,3);

-- Update battery_profiles with voltage curve and chemistry fields
ALTER TABLE public.battery_profiles
ADD COLUMN IF NOT EXISTS chemistry TEXT,
ADD COLUMN IF NOT EXISTS nominal_voltage NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS cutoff_voltage NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS voltage_curve JSONB;

-- Add index for health state queries
CREATE INDEX IF NOT EXISTS idx_lora_sensors_battery_health_state 
ON public.lora_sensors(battery_health_state) 
WHERE battery_health_state IS NOT NULL;

-- Update existing battery profiles with chemistry and voltage data
UPDATE public.battery_profiles SET
  chemistry = CASE 
    WHEN battery_type LIKE '%CR17450%' OR battery_type LIKE '%Li-MnO2%' THEN 'CR17450'
    WHEN battery_type LIKE '%LiFeS2%' OR battery_type LIKE '%Lithium%' THEN 'LiFeS2_AA'
    WHEN battery_type LIKE '%Alkaline%' THEN 'Alkaline_AA'
    WHEN battery_type LIKE '%CR2032%' THEN 'CR2032'
    ELSE 'LiFeS2_AA'
  END,
  nominal_voltage = CASE 
    WHEN battery_type LIKE '%CR17450%' OR battery_type LIKE '%Li-MnO2%' THEN 3.0
    WHEN battery_type LIKE '%CR2032%' THEN 3.0
    WHEN battery_type LIKE '%LiFeS2%' OR battery_type LIKE '%Lithium%' THEN 1.5
    WHEN battery_type LIKE '%Alkaline%' THEN 1.5
    ELSE 3.0
  END,
  cutoff_voltage = CASE 
    WHEN battery_type LIKE '%CR17450%' OR battery_type LIKE '%Li-MnO2%' THEN 2.5
    WHEN battery_type LIKE '%CR2032%' THEN 2.2
    WHEN battery_type LIKE '%LiFeS2%' OR battery_type LIKE '%Lithium%' THEN 0.9
    WHEN battery_type LIKE '%Alkaline%' THEN 0.8
    ELSE 2.5
  END
WHERE chemistry IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lora_sensors.battery_voltage IS 'Raw battery voltage from device (V)';
COMMENT ON COLUMN public.lora_sensors.battery_voltage_filtered IS 'Median-filtered voltage (V) for stable state determination';
COMMENT ON COLUMN public.lora_sensors.battery_health_state IS 'Battery health state: OK, WARNING, LOW, CRITICAL, REPLACE_ASAP';
COMMENT ON COLUMN public.sensor_readings.battery_voltage IS 'Battery voltage at time of reading (V)';