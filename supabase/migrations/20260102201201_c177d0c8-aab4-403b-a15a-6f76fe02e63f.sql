-- Add ttn_webhook_events column to track which events the webhook is configured for
ALTER TABLE public.ttn_connections
ADD COLUMN IF NOT EXISTS ttn_webhook_events text[] DEFAULT ARRAY['uplink_message', 'join_accept'];

-- Update column comments for documentation
COMMENT ON COLUMN public.ttn_connections.ttn_webhook_events IS 'Array of enabled webhook event types (e.g., uplink_message, join_accept)';