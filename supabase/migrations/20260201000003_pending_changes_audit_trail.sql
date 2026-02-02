-- =============================================================================
-- Audit trail: add user tracking to sensor_pending_changes
-- =============================================================================

-- Add email column for display (avoids join to auth.users on every query)
ALTER TABLE sensor_pending_changes
  ADD COLUMN IF NOT EXISTS requested_by_email TEXT;

-- Index for admin audit queries
CREATE INDEX IF NOT EXISTS idx_pending_changes_requested_by
  ON sensor_pending_changes (requested_by)
  WHERE requested_by IS NOT NULL;
