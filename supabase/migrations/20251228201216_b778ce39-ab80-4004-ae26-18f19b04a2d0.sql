-- Enable realtime for notification_events table
ALTER TABLE notification_events REPLICA IDENTITY FULL;

-- Add notification_events to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notification_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification_events;
  END IF;
END $$;

-- Enable realtime for alerts table for toast notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
  END IF;
END $$;

-- Fix existing temp_excursion alerts to have critical severity
UPDATE alerts 
SET severity = 'critical' 
WHERE alert_type = 'temp_excursion' 
  AND severity = 'warning' 
  AND status = 'active';

-- Clear last_notified_at for unnotified temp_excursion alerts so they get processed
UPDATE alerts 
SET last_notified_at = NULL 
WHERE alert_type = 'temp_excursion' 
  AND severity = 'critical' 
  AND status = 'active'
  AND last_notified_at IS NULL
  AND first_active_at IS NULL;