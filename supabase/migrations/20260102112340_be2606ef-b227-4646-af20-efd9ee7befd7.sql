-- Add 'contact' value to lora_sensor_type enum for door/contact sensors
ALTER TYPE public.lora_sensor_type ADD VALUE IF NOT EXISTS 'contact';