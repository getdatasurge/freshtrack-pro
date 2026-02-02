-- =============================================================================
-- Pending Changes: timeout support indexes and cron schedule
-- =============================================================================

-- Optimized partial index for the timeout sweep query
-- (only rows that are still 'sent' and have a sent_at timestamp)
CREATE INDEX IF NOT EXISTS idx_pending_changes_sent_timeout
  ON sensor_pending_changes (sent_at)
  WHERE status = 'sent' AND sent_at IS NOT NULL;

-- Index to speed up the webhook confirmation query:
-- "find all 'sent' changes for a given sensor_id"
CREATE INDEX IF NOT EXISTS idx_pending_changes_sensor_sent
  ON sensor_pending_changes (sensor_id, sent_at)
  WHERE status = 'sent';

-- Optional: pg_cron schedule for the timeout sweep.
-- This requires the pg_cron extension to be enabled in Supabase.
-- Uncomment if pg_cron is available; otherwise invoke from an external scheduler.
--
-- SELECT cron.schedule(
--   'sensor-change-timeout-sweep',    -- job name
--   '*/15 * * * *',                   -- every 15 minutes
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/sensor-change-timeout',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{"timeout_hours": 24}'::jsonb
--   );
--   $$
-- );
