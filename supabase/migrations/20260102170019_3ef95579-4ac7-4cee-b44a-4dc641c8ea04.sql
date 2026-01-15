-- Add webhook tracking columns for audit trail
ALTER TABLE ttn_connections 
ADD COLUMN IF NOT EXISTS ttn_webhook_last_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS ttn_webhook_last_updated_by uuid;