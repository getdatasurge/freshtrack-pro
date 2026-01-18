-- Backfill units that have door_events but stale/unknown door_state
UPDATE units u
SET 
  door_state = de.state,
  door_last_changed_at = de.occurred_at
FROM (
  SELECT DISTINCT ON (unit_id) 
    unit_id, 
    state, 
    occurred_at
  FROM door_events
  ORDER BY unit_id, occurred_at DESC
) de
WHERE u.id = de.unit_id
  AND (u.door_state = 'unknown' OR u.door_state IS NULL);