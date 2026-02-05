-- ============================================================================
-- Battery chemistry seed data for sensor_catalog.
-- Updates the battery_info JSONB column with accurate chemistry, capacity,
-- quantity, rechargeable flag, and maintenance notes per manufacturer/model.
-- ============================================================================

-- Dragino LHT65 / LHT65N / LHT65S — 1x Li-MnO₂ 2400mAh 3.0V (Replaceable)
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '1x AA Li-MnO₂',
  'chemistry', 'Li-MnO2',
  'quantity', 1,
  'capacity_mah', 2400,
  'voltage_nominal', 3.0,
  'voltage_range', jsonb_build_array(2.1, 3.6),
  'expected_life_years', 2,
  'low_threshold_v', 2.5,
  'rechargeable', false,
  'reporting_format', 'millivolts_div10',
  'notes', 'Replaceable 2400mAh Li-MnO₂ AA battery. Use Dragino LHT65-BAT-CA kit or equivalent. Non-linear discharge curve — percentage estimates unreliable.'
)
WHERE manufacturer = 'Dragino' AND model IN ('LHT65', 'LHT65N', 'LHT65S');

-- Dragino LDS02 — 2x AAA Li-MnO₂
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '2x AAA Li-MnO₂',
  'chemistry', 'Li-MnO2',
  'quantity', 2,
  'capacity_mah', 2400,
  'voltage_nominal', 3.0,
  'voltage_range', jsonb_build_array(2.1, 3.6),
  'expected_life_years', 3,
  'low_threshold_v', 2.5,
  'rechargeable', false,
  'notes', '2x AAA Li-MnO₂ batteries. Non-linear discharge — percentage estimates unreliable. Replace both at the same time.'
)
WHERE manufacturer = 'Dragino' AND model = 'LDS02';

-- Dragino LWL02 — 2x AAA Li-MnO₂
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '2x AAA Li-MnO₂',
  'chemistry', 'Li-MnO2',
  'quantity', 2,
  'capacity_mah', 2400,
  'voltage_nominal', 3.0,
  'voltage_range', jsonb_build_array(2.1, 3.6),
  'expected_life_years', 3,
  'rechargeable', false,
  'notes', '2x AAA Li-MnO₂ batteries. Non-linear discharge. Replace both at the same time.'
)
WHERE manufacturer = 'Dragino' AND model = 'LWL02';

-- Elsys ERS Lite / ELT-2 / ELT-2-HP — 1x ER14505 (Li-SOCl₂)
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '1x ER14505 AA',
  'chemistry', 'Li-SOCl2',
  'quantity', 1,
  'capacity_mah', 2600,
  'voltage_nominal', 3.6,
  'voltage_range', jsonb_build_array(2.8, 3.6),
  'expected_life_years', 5,
  'low_threshold_v', 3.0,
  'rechargeable', false,
  'notes', 'ER14505 AA lithium thionyl chloride. 10-year shelf life. Watch for passivation on first use; may need 15–30 min activation.'
)
WHERE manufacturer = 'Elsys' AND model IN ('ERS Lite', 'ELT-2', 'ELT-2-HP');

-- Elsys ERS / ERS Desk / ERS Sound / ERS Eye / ERS CO2 / ERS Display — 2x ER14505 parallel
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '2x ER14505 AA',
  'chemistry', 'Li-SOCl2',
  'quantity', 2,
  'capacity_mah', 2600,
  'voltage_nominal', 3.6,
  'voltage_range', jsonb_build_array(2.8, 3.6),
  'expected_life_years', 5,
  'low_threshold_v', 3.0,
  'rechargeable', false,
  'notes', 'Two ER14505 AA cells in parallel configuration (same voltage, ~2600 mAh total). 10-year shelf life. Watch for passivation on first use.'
)
WHERE manufacturer = 'Elsys' AND model IN ('ERS', 'ERS Desk', 'ERS Sound', 'ERS Eye', 'ERS CO2', 'ERS Display');

-- Netvox R718A / R718AB / R720A / R720B / R720E — 2x ER14505 parallel
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '2x ER14505 AA',
  'chemistry', 'Li-SOCl2',
  'quantity', 2,
  'capacity_mah', 2600,
  'voltage_nominal', 3.6,
  'voltage_range', jsonb_build_array(2.8, 3.6),
  'expected_life_years', 5,
  'low_threshold_v', 3.0,
  'rechargeable', false,
  'notes', 'Two ER14505 AA cells in parallel. Suitable for low-temperature refrigeration monitoring.'
)
WHERE manufacturer = 'Netvox' AND model IN ('R718A', 'R718AB', 'R720A', 'R720B', 'R720E');

-- Netvox R712 — 2x AA Alkaline
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '2x AA Alkaline',
  'chemistry', 'Alkaline',
  'quantity', 2,
  'capacity_mah', 2500,
  'voltage_nominal', 3.0,
  'voltage_range', jsonb_build_array(1.8, 3.0),
  'expected_life_years', 2,
  'low_threshold_v', 2.0,
  'rechargeable', false,
  'notes', 'Standard AA alkaline batteries (1.5V each). Budget option with 2–3 year lifespan. Shorter than lithium alternatives. NOT interchangeable with lithium.'
)
WHERE manufacturer = 'Netvox' AND model = 'R712';

-- Netvox R72615 / R72624 (Solar) — 3x 18650 Li-ion rechargeable
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '3x 18650 Li-ion',
  'chemistry', 'Li-ion',
  'quantity', 3,
  'capacity_mah', 2600,
  'voltage_nominal', 11.1,
  'voltage_range', jsonb_build_array(9.0, 12.6),
  'expected_life_years', 5,
  'low_threshold_v', 9.5,
  'rechargeable', true,
  'notes', '3x 18650 Li-ion cells in series (user-sourced). Solar-powered with trickle charging. Use Panasonic/Samsung brand cells.'
)
WHERE manufacturer = 'Netvox' AND model IN ('R72615', 'R72624');

-- Netvox R311A — CR2450 coin cell
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', 'CR2450',
  'chemistry', 'Li-MnO2',
  'quantity', 1,
  'capacity_mah', 620,
  'voltage_nominal', 3.0,
  'voltage_range', jsonb_build_array(2.1, 3.0),
  'expected_life_years', 3,
  'rechargeable', false,
  'notes', 'CR2450 coin cell. Non-replaceable in some enclosures. Non-linear discharge.'
)
WHERE manufacturer = 'Netvox' AND model = 'R311A';

-- Netvox R731 series — 2x ER14505
UPDATE public.sensor_catalog SET battery_info = jsonb_build_object(
  'type', '2x ER14505 AA',
  'chemistry', 'Li-SOCl2',
  'quantity', 2,
  'capacity_mah', 2600,
  'voltage_nominal', 3.6,
  'voltage_range', jsonb_build_array(2.8, 3.6),
  'expected_life_years', 5,
  'low_threshold_v', 3.0,
  'rechargeable', false,
  'notes', 'Two ER14505 AA cells in parallel. Watch for passivation on first use.'
)
WHERE manufacturer = 'Netvox' AND model LIKE 'R731%';
