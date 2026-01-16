-- Add new sensor types to match device categories
-- These values allow the emulator-sync to properly classify sensors based on model
ALTER TYPE lora_sensor_type ADD VALUE IF NOT EXISTS 'motion';
ALTER TYPE lora_sensor_type ADD VALUE IF NOT EXISTS 'leak';
ALTER TYPE lora_sensor_type ADD VALUE IF NOT EXISTS 'metering';
ALTER TYPE lora_sensor_type ADD VALUE IF NOT EXISTS 'gps';
ALTER TYPE lora_sensor_type ADD VALUE IF NOT EXISTS 'air_quality';
ALTER TYPE lora_sensor_type ADD VALUE IF NOT EXISTS 'multi_sensor';