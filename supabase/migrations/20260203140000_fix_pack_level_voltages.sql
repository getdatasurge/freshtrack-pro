-- Fix battery_profiles voltage values to use pack-level voltages
--
-- The original migration set nominal_voltage and cutoff_voltage using per-cell
-- values for multi-cell chemistries (LiFeS2_AA, Alkaline_AA). Sensors report
-- total pack voltage (e.g. 2×AA = double per-cell), so the DB values must
-- match what the sensor actually reports.
--
-- LiFeS2_AA (2× cells): 1.5V per cell → 3.0V pack nominal, 0.9V per cell → 1.80V pack cutoff
-- Alkaline_AA (2× cells): 1.5V per cell → 3.0V pack nominal, 0.8V per cell → 1.60V pack cutoff

UPDATE public.battery_profiles SET
  nominal_voltage = 3.0,
  cutoff_voltage = 1.80
WHERE chemistry = 'LiFeS2_AA'
  AND (cutoff_voltage < 1.0 OR nominal_voltage < 2.0);

UPDATE public.battery_profiles SET
  nominal_voltage = 3.0,
  cutoff_voltage = 1.60
WHERE chemistry = 'Alkaline_AA'
  AND (cutoff_voltage < 1.0 OR nominal_voltage < 2.0);
