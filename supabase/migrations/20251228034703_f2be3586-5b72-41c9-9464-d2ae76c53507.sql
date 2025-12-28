-- Add temp_excursion to alert_type enum
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'temp_excursion';

-- Add metadata column to alerts table for richer context
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';