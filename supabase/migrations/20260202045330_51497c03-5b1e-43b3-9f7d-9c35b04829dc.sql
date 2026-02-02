-- Create battery_profiles table for LoRaWAN sensor battery specifications
CREATE TABLE public.battery_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL UNIQUE,
  manufacturer TEXT,
  battery_type TEXT NOT NULL,
  nominal_capacity_mah INTEGER NOT NULL,
  mah_per_uplink NUMERIC(6,4) NOT NULL DEFAULT 0.025,
  sleep_current_ua INTEGER NOT NULL DEFAULT 5,
  usable_capacity_pct INTEGER NOT NULL DEFAULT 85,
  replacement_threshold INTEGER NOT NULL DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.battery_profiles IS 'Battery specifications per sensor model for accurate life estimation';
COMMENT ON COLUMN public.battery_profiles.mah_per_uplink IS 'Energy consumed per uplink transmission in mAh';
COMMENT ON COLUMN public.battery_profiles.sleep_current_ua IS 'Sleep mode current draw in microamps';
COMMENT ON COLUMN public.battery_profiles.usable_capacity_pct IS 'Usable capacity percentage (accounts for cold environments)';
COMMENT ON COLUMN public.battery_profiles.replacement_threshold IS 'SOC percentage at which battery should be replaced';

-- Enable RLS
ALTER TABLE public.battery_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access (battery profiles are reference data)
CREATE POLICY "Battery profiles are publicly readable"
ON public.battery_profiles
FOR SELECT
USING (true);

-- Only authenticated users can insert/update (future admin feature)
CREATE POLICY "Authenticated users can manage battery profiles"
ON public.battery_profiles
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create updated_at trigger
CREATE TRIGGER update_battery_profiles_updated_at
BEFORE UPDATE ON public.battery_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed data for common LoRaWAN sensor models
INSERT INTO public.battery_profiles (model, manufacturer, battery_type, nominal_capacity_mah, mah_per_uplink, sleep_current_ua, usable_capacity_pct, replacement_threshold, notes)
VALUES
  -- Dragino sensors
  ('LDS02', 'Dragino', '2×AAA Alkaline', 1000, 0.020, 3, 80, 10, 'Door sensor, low power consumption'),
  ('LDDS75', 'Dragino', '2×AA Lithium', 3600, 0.030, 5, 85, 10, 'Distance sensor, slightly higher consumption'),
  ('LHT65', 'Dragino', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Temp/humidity sensor'),
  ('LHT65N', 'Dragino', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Temp/humidity with NTC probe'),
  ('LHT52', 'Dragino', '2×AA Lithium', 3600, 0.022, 4, 85, 10, 'Indoor temp/humidity sensor'),
  ('LSN50v2', 'Dragino', '2×AA Lithium', 3600, 0.028, 5, 85, 10, 'Universal I/O sensor'),
  ('S31-LB', 'Dragino', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Temp/humidity sensor'),
  
  -- Milesight sensors
  ('EM300-TH', 'Milesight', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Industrial temp/humidity'),
  ('EM300-MCS', 'Milesight', '2×AA Lithium', 3600, 0.028, 5, 85, 10, 'Magnetic contact sensor'),
  ('EM300-DI', 'Milesight', '2×AA Lithium', 3600, 0.030, 6, 85, 10, 'Dry contact sensor'),
  ('EM500-LGT', 'Milesight', '2×AA Lithium', 3600, 0.032, 6, 85, 10, 'Light sensor'),
  ('WS301', 'Milesight', 'CR2477', 1000, 0.015, 2, 80, 15, 'Magnetic contact (coin cell)'),
  ('WS302', 'Milesight', 'CR2477', 1000, 0.018, 3, 80, 15, 'PIR motion sensor'),
  
  -- Elsys sensors
  ('ERS', 'Elsys', 'CR2032', 230, 0.015, 2, 75, 15, 'Room sensor, coin cell battery'),
  ('ERS-CO2', 'Elsys', '2×AA Lithium', 3600, 0.045, 8, 85, 10, 'CO2 sensor, higher consumption'),
  ('EMS', 'Elsys', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Multi-sensor'),
  ('ELT-2', 'Elsys', '2×AA Lithium', 3600, 0.022, 4, 85, 10, 'External temp sensor'),
  
  -- Netvox sensors
  ('R311A', 'Netvox', 'CR2450', 620, 0.018, 3, 80, 15, 'Door/window sensor'),
  ('R718N1', 'Netvox', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Temperature sensor'),
  ('R718N3', 'Netvox', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Temp/humidity sensor'),
  
  -- Browan sensors
  ('TBHH100', 'Browan', '2×AA Lithium', 3600, 0.022, 4, 85, 10, 'Temp/humidity sensor'),
  ('TBDW100', 'Browan', 'CR2032', 230, 0.012, 2, 75, 15, 'Door/window sensor'),
  
  -- Generic fallback profiles
  ('GENERIC_AA', 'Generic', '2×AA Lithium', 3600, 0.025, 5, 85, 10, 'Fallback for AA-powered sensors'),
  ('GENERIC_AAA', 'Generic', '2×AAA Alkaline', 1000, 0.020, 3, 80, 10, 'Fallback for AAA-powered sensors'),
  ('GENERIC_COIN', 'Generic', 'CR2032', 230, 0.015, 2, 75, 15, 'Fallback for coin cell sensors');