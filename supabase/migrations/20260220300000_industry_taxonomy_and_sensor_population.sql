-- ============================================================
-- INDUSTRY TAXONOMY & SENSOR POPULATION
-- Adds industry classification to sensor_catalog and populates
-- 33 new sensor entries from the lorawan-devices submodule.
-- ============================================================

-- ─── 1. Extend sensor_kind CHECK constraint ─────────────────
-- Add new kinds: light, panic_button, multi_sensor, occupancy,
-- level, analog_digital. Keep existing kinds intact.

ALTER TABLE sensor_catalog DROP CONSTRAINT IF EXISTS sensor_catalog_kind_check;
ALTER TABLE sensor_catalog ADD CONSTRAINT sensor_catalog_kind_check CHECK (
  sensor_kind IN (
    'temp', 'temp_humidity', 'door', 'combo', 'co2', 'leak', 'gps',
    'pulse', 'soil', 'air_quality', 'vibration', 'meter', 'tilt',
    'light', 'panic_button', 'multi_sensor', 'occupancy', 'level',
    'analog_digital'
  )
);

-- ─── 2. Add industry classification columns ─────────────────

ALTER TABLE sensor_catalog
  ADD COLUMN IF NOT EXISTS industries      TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS industry_use_cases JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subcategory     TEXT;

-- GIN index for fast array-contains queries on industries
CREATE INDEX IF NOT EXISTS idx_sensor_catalog_industries
  ON sensor_catalog USING gin(industries);

-- ─── 3. Update existing 5 sensors with industry tags ────────

UPDATE sensor_catalog SET
  industries = '{food_service,cold_chain,healthcare}',
  industry_use_cases = '{"food_service":"Walk-in cooler/freezer monitoring","cold_chain":"Cold storage temperature tracking","healthcare":"Vaccine refrigerator compliance"}'::jsonb,
  subcategory = 'temperature'
WHERE manufacturer = 'Dragino' AND model = 'LHT65';

UPDATE sensor_catalog SET
  industries = '{food_service,cold_chain,healthcare}',
  industry_use_cases = '{"food_service":"Walk-in door monitoring","cold_chain":"Loading dock door tracking","healthcare":"Medication cabinet access"}'::jsonb,
  subcategory = 'door_contact'
WHERE manufacturer = 'Dragino' AND model = 'LDS02';

UPDATE sensor_catalog SET
  industries = '{food_service,cold_chain,smart_building,healthcare}',
  industry_use_cases = '{"food_service":"Walk-in cooler/freezer monitoring","cold_chain":"Cold storage temperature tracking","smart_building":"Room temperature monitoring","healthcare":"Vaccine storage compliance"}'::jsonb,
  subcategory = 'temperature'
WHERE manufacturer = 'Dragino' AND model = 'LHT65N';

UPDATE sensor_catalog SET
  industries = '{food_service,cold_chain,healthcare}',
  industry_use_cases = '{"food_service":"Cooler door monitoring","cold_chain":"Container door access","healthcare":"Restricted access monitoring"}'::jsonb,
  subcategory = 'door_contact'
WHERE manufacturer = 'Netvox' AND model = 'R311A';

UPDATE sensor_catalog SET
  industries = '{food_service,smart_building}',
  industry_use_cases = '{"food_service":"Kitchen ventilation and CO2 monitoring","smart_building":"Indoor air quality and CO2 compliance"}'::jsonb,
  subcategory = 'air_quality'
WHERE manufacturer = 'Elsys' AND model = 'ERS CO2';

-- Update LWL02 (already exists) with industries
UPDATE sensor_catalog SET
  industries = '{food_service,smart_building,industrial}',
  industry_use_cases = '{"food_service":"Floor drain and pipe leak detection","smart_building":"Water damage prevention","industrial":"Equipment leak detection"}'::jsonb,
  subcategory = 'water_leak'
WHERE manufacturer = 'Dragino' AND model = 'LWL02';

-- ─── 4. Insert new sensors ──────────────────────────────────

INSERT INTO sensor_catalog (
  manufacturer, model, display_name, sensor_kind, description,
  frequency_bands, lorawan_version, supports_otaa, supports_class,
  ttn_device_repo_id, is_supported, is_visible, sort_order, tags,
  industries, industry_use_cases, subcategory,
  repo_decoder_source, active_decoder_source,
  decode_mode, temperature_unit
) VALUES

-- ─── DRAGINO ────────────────────────────────────────────────

-- LHT52
(
  'Dragino', 'LHT52',
  'Dragino LHT52 Temperature & Humidity Sensor',
  'temp_humidity',
  'Compact indoor LoRaWAN temperature and humidity sensor. Budget-friendly option for ambient monitoring in dry storage, offices, and supply rooms.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/lht52', true, true, 100,
  '{"temperature","humidity","indoor","budget"}',
  '{food_service,cold_chain,smart_building,healthcare}',
  '{"food_service":"Dry storage monitoring","cold_chain":"Ambient temp tracking","smart_building":"Room temperature","healthcare":"Supply room monitoring"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- LHT65N
(
  'Dragino', 'LHT65N',
  'Dragino LHT65N Temperature & Humidity Sensor',
  'temp_humidity',
  'Next-gen indoor LoRaWAN temperature and humidity sensor with NFC provisioning and improved battery life. Successor to the LHT65.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/lht65n', true, true, 15,
  '{"temperature","humidity","indoor","nfc","probe"}',
  '{food_service,cold_chain,smart_building,healthcare}',
  '{"food_service":"Walk-in cooler/freezer monitoring","cold_chain":"Cold storage tracking","smart_building":"Room temperature monitoring","healthcare":"Vaccine storage compliance"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- LDS03A
(
  'Dragino', 'LDS03A',
  'Dragino LDS03A Door/Window Sensor',
  'door',
  'LoRaWAN door/window contact sensor with open count, open duration, and alarm features. Successor to the LDS02 with improved range and battery life.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/lds03a', true, true, 110,
  '{"door","contact","magnetic","alarm"}',
  '{food_service,cold_chain,healthcare}',
  '{"food_service":"Walk-in door monitoring","cold_chain":"Loading dock doors","healthcare":"Medication cabinet access"}'::jsonb,
  'door_contact',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- LSN50v2-D20
(
  'Dragino', 'LSN50v2-D20',
  'Dragino LSN50v2-D20 Waterproof Temperature Sensor',
  'temp',
  'Waterproof LoRaWAN temperature sensor with dual DS18B20 probes. Supports up to 20 external temperature probes for multi-point monitoring in transport and industrial settings.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/lsn50v2-d20', true, true, 120,
  '{"temperature","waterproof","multi-probe","industrial","transport"}',
  '{cold_chain,industrial,agriculture}',
  '{"cold_chain":"Multi-point temp in transport","industrial":"Process temperature monitoring","agriculture":"Greenhouse zone monitoring"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- LSN50v2-S31
(
  'Dragino', 'LSN50v2-S31',
  'Dragino LSN50v2-S31 Temperature & Humidity Sensor',
  'temp_humidity',
  'LoRaWAN sensor with SHT31 temperature and humidity probe. Waterproof enclosure suitable for kitchens, greenhouses, and HVAC monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/lsn50v2-s31', true, true, 130,
  '{"temperature","humidity","waterproof","sht31"}',
  '{food_service,smart_building,agriculture}',
  '{"food_service":"Kitchen ambient monitoring","smart_building":"HVAC zone sensing","agriculture":"Barn temperature/humidity"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- LDDS75
(
  'Dragino', 'LDDS75',
  'Dragino LDDS75 Ultrasonic Distance/Level Sensor',
  'level',
  'LoRaWAN ultrasonic distance sensor for liquid level monitoring. Range 28cm to 350cm. Ideal for tank level, reservoir, and waste bin fill monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/ldds75', true, true, 140,
  '{"level","ultrasonic","tank","distance"}',
  '{agriculture,industrial,utilities}',
  '{"agriculture":"Water tank level","industrial":"Chemical tank monitoring","utilities":"Reservoir level"}'::jsonb,
  'level',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- LDDS20
(
  'Dragino', 'LDDS20',
  'Dragino LDDS20 Liquid Level Sensor',
  'level',
  'LoRaWAN liquid level sensor using ultrasonic measurement. Compact design for smaller tanks and containers. Range 20cm to 200cm.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'dragino/ldds20', true, true, 150,
  '{"level","ultrasonic","liquid","compact"}',
  '{agriculture,industrial,utilities}',
  '{"agriculture":"Irrigation tank level","industrial":"Liquid level sensing","utilities":"Water treatment level"}'::jsonb,
  'level',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── NETVOX ─────────────────────────────────────────────────

-- R311G
(
  'Netvox', 'R311G',
  'Netvox R311G Light Sensor',
  'light',
  'LoRaWAN ambient light sensor for monitoring illumination levels. Useful for grow light verification and daylight harvesting in smart buildings.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r311g', true, true, 200,
  '{"light","lux","illumination"}',
  '{smart_building,agriculture}',
  '{"smart_building":"Ambient light monitoring","agriculture":"Grow light monitoring"}'::jsonb,
  'light',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R312A
(
  'Netvox', 'R312A',
  'Netvox R312A Emergency Push Button',
  'panic_button',
  'LoRaWAN wireless emergency push button. Single-press panic alert with battery reporting. Suitable for staff safety and emergency notification.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r312a', true, true, 210,
  '{"panic","button","emergency","alert"}',
  '{smart_building,healthcare}',
  '{"smart_building":"Emergency alert button","healthcare":"Staff panic button"}'::jsonb,
  'panic_button',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R718AB
(
  'Netvox', 'R718AB',
  'Netvox R718AB Temperature & Humidity Sensor',
  'temp_humidity',
  'LoRaWAN temperature and humidity sensor with high accuracy. Compact form factor for indoor climate monitoring in refrigerators, pharmacies, and offices.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r718ab', true, true, 220,
  '{"temperature","humidity","indoor","accurate"}',
  '{food_service,cold_chain,smart_building,healthcare}',
  '{"food_service":"Refrigerator monitoring","cold_chain":"Transport temp/humidity","smart_building":"Indoor climate","healthcare":"Pharma storage"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R718DA
(
  'Netvox', 'R718DA',
  'Netvox R718DA Vibration Sensor (1-Axis)',
  'vibration',
  'LoRaWAN single-axis vibration sensor for machine health monitoring. Detects vibration events and measures acceleration on one axis.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r718da', true, true, 230,
  '{"vibration","accelerometer","machine-health"}',
  '{industrial}',
  '{"industrial":"Motor vibration monitoring"}'::jsonb,
  'vibration',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R718DB
(
  'Netvox', 'R718DB',
  'Netvox R718DB Vibration Sensor (2-Axis)',
  'vibration',
  'LoRaWAN dual-axis vibration sensor. Measures vibration and acceleration on two axes for equipment health monitoring.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r718db', true, true, 240,
  '{"vibration","accelerometer","dual-axis","machine-health"}',
  '{industrial}',
  '{"industrial":"Equipment vibration analysis"}'::jsonb,
  'vibration',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R718E
(
  'Netvox', 'R718E',
  'Netvox R718E 3-Axis Accelerometer + Thermistor',
  'vibration',
  'LoRaWAN 3-axis accelerometer with integrated thermistor. Provides vibration measurement and temperature in a single device for machine health monitoring.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r718e', true, true, 250,
  '{"vibration","accelerometer","3-axis","thermistor","machine-health"}',
  '{industrial}',
  '{"industrial":"3-axis accelerometer + thermistor for machine health"}'::jsonb,
  'vibration',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R718F
(
  'Netvox', 'R718F',
  'Netvox R718F Door/Window Sensor',
  'door',
  'LoRaWAN magnetic contact sensor for door and window monitoring. Reports open/close state and battery voltage.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r718f', true, true, 260,
  '{"door","contact","magnetic"}',
  '{food_service,cold_chain,healthcare}',
  '{"food_service":"Cooler door monitoring","cold_chain":"Container door","healthcare":"Restricted access monitoring"}'::jsonb,
  'door_contact',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- R720A
(
  'Netvox', 'R720A',
  'Netvox R720A Temperature & Humidity Sensor',
  'temp_humidity',
  'Compact LoRaWAN temperature and humidity sensor. Low-power design for indoor environment monitoring.',
  '{US915,EU868,AU915}', '1.0.3', true, 'A',
  'netvox/r720a', true, true, 270,
  '{"temperature","humidity","compact","indoor"}',
  '{food_service,smart_building,healthcare}',
  '{"food_service":"Kitchen climate monitoring","smart_building":"Room temp/humidity","healthcare":"Patient room monitoring"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── ELSYS ──────────────────────────────────────────────────

-- ERS
(
  'Elsys', 'ERS',
  'Elsys ERS Indoor Environment Sensor',
  'multi_sensor',
  'Premium indoor environment sensor measuring temperature, humidity, light, and motion. Compact design with long battery life for smart building applications.',
  '{US915,EU868}', '1.0.3', true, 'A',
  'elsys/ers', true, true, 300,
  '{"indoor","multi-sensor","temperature","humidity","light","motion"}',
  '{smart_building}',
  '{"smart_building":"Indoor environment — temp, humidity, light, motion"}'::jsonb,
  'multi_sensor',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ERS Lite
(
  'Elsys', 'ERS Lite',
  'Elsys ERS Lite Indoor Sensor',
  'multi_sensor',
  'Budget-friendly indoor environment sensor with temperature, humidity, and light. Reduced feature set compared to the full ERS for cost-effective deployments.',
  '{US915,EU868}', '1.0.3', true, 'A',
  'elsys/ers-lite', true, true, 310,
  '{"indoor","multi-sensor","budget","temperature","humidity","light"}',
  '{smart_building}',
  '{"smart_building":"Budget indoor environment monitoring"}'::jsonb,
  'multi_sensor',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ERS Eye
(
  'Elsys', 'ERS Eye',
  'Elsys ERS Eye Occupancy Sensor',
  'occupancy',
  'Indoor environment sensor with people counting capability via IR array. Measures temperature, humidity, light, motion, and provides occupancy counting.',
  '{US915,EU868}', '1.0.3', true, 'A',
  'elsys/ers-eye', true, true, 320,
  '{"occupancy","counting","indoor","motion","ir-array"}',
  '{smart_building}',
  '{"smart_building":"Occupancy counting + indoor environment"}'::jsonb,
  'occupancy',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- EMS
(
  'Elsys', 'EMS',
  'Elsys EMS Compact Sensor',
  'multi_sensor',
  'Ultra-compact LoRaWAN sensor measuring temperature and humidity. Ideal for dense deployments where small form factor is critical.',
  '{US915,EU868}', '1.0.3', true, 'A',
  'elsys/ems', true, true, 330,
  '{"compact","temperature","humidity","ultra-small"}',
  '{smart_building,industrial}',
  '{"smart_building":"Compact temp/humidity","industrial":"Equipment area monitoring"}'::jsonb,
  'multi_sensor',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ELT-2
(
  'Elsys', 'ELT-2',
  'Elsys ELT-2 Analog/Digital Input Sensor',
  'analog_digital',
  'LoRaWAN sensor with analog and digital inputs. Supports 0–10V analog, pulse counting, and dry contact inputs for interfacing with external equipment and meters.',
  '{US915,EU868}', '1.0.3', true, 'A',
  'elsys/elt-2', true, true, 340,
  '{"analog","digital","pulse","input","metering"}',
  '{industrial,utilities}',
  '{"industrial":"Generic analog/digital input","utilities":"Pulse counter for meters"}'::jsonb,
  'analog_digital',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── MILESIGHT ──────────────────────────────────────────────

-- EM300-TH
(
  'Milesight', 'EM300-TH',
  'Milesight EM300-TH Temperature & Humidity Sensor',
  'temp_humidity',
  'IP67-rated outdoor/indoor LoRaWAN temperature and humidity sensor. High accuracy with wide operating range. Built-in NFC for configuration.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'milesight-iot/em300-th', true, true, 400,
  '{"temperature","humidity","ip67","waterproof","nfc"}',
  '{food_service,cold_chain,smart_building,healthcare}',
  '{"food_service":"Commercial refrigeration","cold_chain":"Cold storage rooms","smart_building":"HVAC monitoring","healthcare":"Vaccine storage compliance"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- EM300-MCS
(
  'Milesight', 'EM300-MCS',
  'Milesight EM300-MCS Magnetic Contact Sensor',
  'door',
  'IP67-rated LoRaWAN magnetic contact sensor with temperature reporting. Detects door/window open/close with integrated temperature measurement.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'milesight-iot/em300-mcs', true, true, 410,
  '{"door","contact","magnetic","temperature","ip67"}',
  '{food_service,cold_chain,healthcare}',
  '{"food_service":"Freezer door contact","cold_chain":"Access monitoring","healthcare":"Medication fridge door"}'::jsonb,
  'door_contact',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- EM500-CO2
(
  'Milesight', 'EM500-CO2',
  'Milesight EM500-CO2 Carbon Dioxide Sensor',
  'air_quality',
  'LoRaWAN CO2 sensor with temperature, humidity, and barometric pressure. NDIR sensor with 400–5000 ppm range for indoor air quality monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'milesight-iot/em500-co2', true, true, 420,
  '{"co2","air-quality","ndir","temperature","humidity","pressure"}',
  '{food_service,smart_building}',
  '{"food_service":"Kitchen ventilation monitoring","smart_building":"Indoor air quality and CO2"}'::jsonb,
  'air_quality',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- EM500-SMTC
(
  'Milesight', 'EM500-SMTC',
  'Milesight EM500-SMTC Soil Moisture/Temp/Conductivity',
  'soil',
  'LoRaWAN soil sensor measuring moisture, temperature, and electrical conductivity. Ideal for precision agriculture and greenhouse management.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'milesight-iot/em500-smtc', true, true, 430,
  '{"soil","moisture","temperature","conductivity","agriculture"}',
  '{agriculture}',
  '{"agriculture":"Soil moisture, temperature, and conductivity"}'::jsonb,
  'soil',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- EM500-PT100
(
  'Milesight', 'EM500-PT100',
  'Milesight EM500-PT100 Industrial Temperature Sensor',
  'temp',
  'LoRaWAN high-precision RTD temperature sensor using PT100 probe. Operating range -200°C to 800°C. For industrial processes and ultra-low freezer monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'milesight-iot/em500-pt100', true, true, 440,
  '{"temperature","pt100","rtd","precision","industrial","ultra-low"}',
  '{industrial,healthcare}',
  '{"industrial":"High-precision RTD temperature","healthcare":"Ultra-low freezer monitoring"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- EM310-Tilt
(
  'Milesight', 'EM310-Tilt',
  'Milesight EM310-Tilt Angle Sensor',
  'tilt',
  'LoRaWAN tilt sensor measuring angle on multiple axes. IP67 rated for outdoor use. Suitable for equipment orientation and structural monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'milesight-iot/em310-tilt', true, true, 450,
  '{"tilt","angle","orientation","ip67"}',
  '{industrial}',
  '{"industrial":"Equipment tilt and angle monitoring"}'::jsonb,
  'tilt',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── TEKTELIC ───────────────────────────────────────────────

-- Smart Room Base
(
  'Tektelic', 'Smart Room Base',
  'Tektelic Smart Room Sensor Base',
  'multi_sensor',
  'Premium indoor smart room sensor measuring temperature, humidity, light, and motion. Enterprise-grade build quality with long battery life.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'tektelic/t000489x-smart-room-base', true, true, 500,
  '{"indoor","multi-sensor","enterprise","temperature","humidity","light","motion"}',
  '{smart_building}',
  '{"smart_building":"Room environment — temp, humidity, light, motion"}'::jsonb,
  'multi_sensor',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- Smart Room PIR
(
  'Tektelic', 'Smart Room PIR',
  'Tektelic Smart Room PIR Sensor',
  'occupancy',
  'LoRaWAN PIR motion sensor for occupancy detection. Optimized for room-level presence detection in smart building applications.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'tektelic/t00048xx-smart-room-pir', true, true, 510,
  '{"motion","pir","occupancy","smart-building"}',
  '{smart_building}',
  '{"smart_building":"Motion detection and occupancy"}'::jsonb,
  'occupancy',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── LAIRD ──────────────────────────────────────────────────

-- RS1xx Ext Temp RTD
(
  'Laird', 'RS1xx Ext Temp RTD',
  'Laird RS1xx External Temperature RTD Sensor',
  'temp',
  'LoRaWAN temperature sensor with external RTD probe. High-precision measurement for ultra-low freezers, industrial processes, and pharmaceutical cold chain.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'laird/rs1xx-ext-temp-rtd-sensor', true, true, 600,
  '{"temperature","rtd","precision","ultra-low","pharmaceutical"}',
  '{cold_chain,industrial,healthcare}',
  '{"cold_chain":"Ultra-low freezer monitoring","industrial":"High-precision industrial temp","healthcare":"Pharma cold chain compliance"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── DECENTLAB ──────────────────────────────────────────────

-- DL-TP
(
  'Decentlab', 'DL-TP',
  'Decentlab DL-TP Temperature Profile Sensor',
  'temp',
  'LoRaWAN multi-depth temperature profiling sensor. Measures temperature at multiple depths for soil profiling, compost monitoring, and industrial applications.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'decentlab/dl-tp', true, true, 700,
  '{"temperature","profile","multi-depth","soil","industrial"}',
  '{agriculture,industrial}',
  '{"agriculture":"Soil temperature profile","industrial":"Multi-point temperature profiling"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- ─── SENSECAP ───────────────────────────────────────────────

-- S2103 CO2/Temp/Humid
(
  'SenseCap', 'S2103',
  'SenseCap S2103 CO2/Temperature/Humidity Sensor',
  'air_quality',
  'LoRaWAN CO2, temperature, and humidity sensor. NDIR CO2 measurement for indoor air quality and greenhouse monitoring.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'sensecap/sensecaps2103-co2-temp-humid', true, true, 800,
  '{"co2","temperature","humidity","air-quality","ndir"}',
  '{smart_building,agriculture}',
  '{"smart_building":"Indoor air quality","agriculture":"Greenhouse CO2 monitoring"}'::jsonb,
  'air_quality',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- SenseCap Air TH
(
  'SenseCap', 'Air TH',
  'SenseCap Air Temperature & Humidity Sensor',
  'temp_humidity',
  'Outdoor LoRaWAN weather-grade temperature and humidity sensor. Solar-powered with radiation shield for accurate outdoor measurements.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'sensecap/sensecap-air-th', true, true, 810,
  '{"temperature","humidity","outdoor","weather","solar"}',
  '{agriculture,smart_building}',
  '{"agriculture":"Outdoor weather station","smart_building":"External temp reference"}'::jsonb,
  'temperature',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
),

-- SenseCap CO2
(
  'SenseCap', 'CO2',
  'SenseCap CO2 Concentration Sensor',
  'air_quality',
  'LoRaWAN CO2 concentration sensor. NDIR measurement for monitoring CO2 levels in greenhouses, buildings, and ventilation systems.',
  '{US915,EU868,AU915,AS923}', '1.0.3', true, 'A',
  'sensecap/sensecap-co2', true, true, 820,
  '{"co2","ndir","concentration","ventilation"}',
  '{smart_building,agriculture}',
  '{"smart_building":"CO2 concentration monitoring","agriculture":"Greenhouse gas levels"}'::jsonb,
  'air_quality',
  'TheThingsNetwork/lorawan-devices @ 0db7de31', 'repo',
  'trust', 'C'
)

ON CONFLICT (manufacturer, model, COALESCE(model_variant, '')) DO NOTHING;

-- ─── 5. Update sensor_catalog_public view to include industries ─

CREATE OR REPLACE VIEW sensor_catalog_public AS
SELECT
  id, manufacturer, model, model_variant, display_name, sensor_kind,
  description, frequency_bands, f_ports, decoded_fields, uplink_info,
  battery_info, is_supported, tags,
  industries, industry_use_cases, subcategory
FROM sensor_catalog
WHERE is_visible = true
  AND deprecated_at IS NULL
ORDER BY sort_order, manufacturer, model;

-- ─── 6. Update search function to include industry terms ────

CREATE OR REPLACE FUNCTION search_sensor_catalog(search_term text)
RETURNS SETOF sensor_catalog AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM sensor_catalog
  WHERE
    to_tsvector('english',
      coalesce(manufacturer,'') || ' ' ||
      coalesce(model,'') || ' ' ||
      coalesce(display_name,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(subcategory,'')
    ) @@ plainto_tsquery('english', search_term)
    OR manufacturer ILIKE '%' || search_term || '%'
    OR model ILIKE '%' || search_term || '%'
    OR search_term = ANY(tags)
    OR search_term = ANY(industries)
  ORDER BY sort_order, manufacturer, model;
END;
$$ LANGUAGE plpgsql STABLE;
