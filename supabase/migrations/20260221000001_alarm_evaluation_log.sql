-- ============================================================
-- ALARM EVALUATION LOG — Side-by-side comparison table
-- Captures every alarm evaluation for rollout validation
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EVALUATION LOG TABLE
-- One row per alarm definition evaluated per uplink
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alarm_evaluation_log (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          text NOT NULL,
  site_id         text,
  unit_id         text NOT NULL,
  dev_eui         text,
  alarm_slug      text NOT NULL,
  detection_tier  text NOT NULL,
  fired           boolean NOT NULL DEFAULT false,
  trigger_value   numeric,
  threshold_min   numeric,
  threshold_max   numeric,
  eval_duration_ms integer,
  eval_detail     jsonb DEFAULT '{}',
  cooldown_active boolean DEFAULT false,
  dedup_hit       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Indexes for querying evaluation results
CREATE INDEX idx_eval_log_unit_time ON alarm_evaluation_log (unit_id, created_at DESC);
CREATE INDEX idx_eval_log_slug ON alarm_evaluation_log (alarm_slug, fired, created_at DESC);
CREATE INDEX idx_eval_log_org ON alarm_evaluation_log (org_id, created_at DESC);

-- Auto-prune: keep only 7 days of evaluation logs
-- (run via pg_cron or manual cleanup)
CREATE OR REPLACE FUNCTION prune_alarm_evaluation_log()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM alarm_evaluation_log WHERE created_at < now() - interval '7 days';
$$;

-- ────────────────────────────────────────────────────────────
-- ADD cooldown_until TO alarm_events for dedup tracking
-- ────────────────────────────────────────────────────────────

ALTER TABLE alarm_events ADD COLUMN IF NOT EXISTS cooldown_until timestamptz;
ALTER TABLE alarm_events ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE alarm_events ADD COLUMN IF NOT EXISTS correlation_type text;

-- Index for fast cooldown/dedup lookups
CREATE INDEX IF NOT EXISTS idx_alarm_events_cooldown
  ON alarm_events (alarm_definition_id, unit_id, state, cooldown_until DESC);

-- Index for correlation lookups
CREATE INDEX IF NOT EXISTS idx_alarm_events_correlation
  ON alarm_events (correlation_id) WHERE correlation_id IS NOT NULL;
