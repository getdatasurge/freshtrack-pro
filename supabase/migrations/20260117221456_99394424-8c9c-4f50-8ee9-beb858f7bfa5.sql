-- Backfill initial door events for units with door sensors but no events
-- This creates a baseline event for units that have door readings but no door_events

INSERT INTO door_events (unit_id, state, occurred_at, source, metadata)
SELECT DISTINCT ON (sr.unit_id)
  sr.unit_id,
  CASE WHEN sr.door_open THEN 'open' ELSE 'closed' END as state,
  sr.recorded_at as occurred_at,
  'backfill' as source,
  jsonb_build_object('backfilled', true, 'reason', 'initial_state_missing') as metadata
FROM sensor_readings sr
JOIN units u ON sr.unit_id = u.id
JOIN lora_sensors ls ON ls.unit_id = u.id AND ls.sensor_type = 'door' AND ls.deleted_at IS NULL
WHERE sr.door_open IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM door_events de WHERE de.unit_id = sr.unit_id
)
ORDER BY sr.unit_id, sr.recorded_at ASC;