-- Add ttn_webhook_events column to track which events the webhook is configured for
ALTER TABLE public.ttn_connections
ADD COLUMN IF NOT EXISTS ttn_webhook_events text[] DEFAULT ARRAY['uplink_message', 'join_accept'];

-- Un-deprecate ttn_webhook_url and ttn_webhook_id since they are actively used
COMMENT ON COLUMN public.ttn_connections.ttn_webhook_id IS 'Webhook ID in TTN (e.g., freshtracker)';
COMMENT ON COLUMN public.ttn_connections.ttn_webhook_url IS 'Full webhook URL pointing to our ttn-webhook edge function';
COMMENT ON COLUMN public.ttn_connections.ttn_webhook_events IS 'Array of enabled webhook event types (e.g., uplink_message, join_accept)';
