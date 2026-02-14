-- Phase 1: Alert & Notification System Enhancements
-- Adds columns for resolution tracking, alert correlation, and the in-app notifications table

-- ============================================================
-- 1. Enhance alerts table with resolution tracking & correlation
-- ============================================================

-- Track how an alert was resolved (auto by sensor recovery, manual by user, or expired)
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS resolution_type text
  CHECK (resolution_type IN ('auto', 'manual', 'expired'));

-- Link correlated alerts (e.g., door_open causes temp_excursion)
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS correlated_with_alert_id uuid REFERENCES public.alerts(id);

-- Track the sensor that triggered the alert (for sensor-level alerts like low_battery, sensor_fault)
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS sensor_dev_eui text;

-- Acknowledgement notes (required for compliance)
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS acknowledgment_notes text;

-- Index for correlation lookups
CREATE INDEX IF NOT EXISTS idx_alerts_correlated ON public.alerts(correlated_with_alert_id)
  WHERE correlated_with_alert_id IS NOT NULL;

-- Index for sensor-level alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_sensor ON public.alerts(sensor_dev_eui, alert_type, status)
  WHERE sensor_dev_eui IS NOT NULL;

-- Index for escalation processing (unacknowledged alerts needing escalation)
CREATE INDEX IF NOT EXISTS idx_alerts_escalation ON public.alerts(status, next_escalation_at)
  WHERE status = 'active' AND next_escalation_at IS NOT NULL;

-- ============================================================
-- 2. Create in_app_notifications table (per-user notification records)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  organization_id text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  dismissed boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz,
  action_url text,
  escalation_step integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notif_user
  ON public.in_app_notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notif_alert
  ON public.in_app_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notif_org
  ON public.in_app_notifications(organization_id, created_at DESC);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.in_app_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.in_app_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert (from edge functions)
CREATE POLICY "Service can insert notifications"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for in_app_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;

-- ============================================================
-- 3. Create alert_suppressions table (snooze, maintenance, defrost)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.alert_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  site_id text,
  unit_id text,
  alert_types text[],                      -- which alert types to suppress; empty/null = all
  reason text NOT NULL
    CHECK (reason IN ('maintenance', 'defrost', 'relocation', 'snooze', 'other')),
  custom_reason text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  alert_id uuid REFERENCES public.alerts(id),  -- for snooze: which alert was snoozed
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_suppressions_active
  ON public.alert_suppressions(organization_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_suppressions_unit
  ON public.alert_suppressions(unit_id, starts_at, ends_at)
  WHERE unit_id IS NOT NULL;

ALTER TABLE public.alert_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view suppressions"
  ON public.alert_suppressions FOR SELECT
  USING (true);

CREATE POLICY "Service can manage suppressions"
  ON public.alert_suppressions FOR ALL
  WITH CHECK (true);

-- ============================================================
-- 4. Create alert_audit_log table (immutable compliance trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.alert_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  organization_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'confirmed', 'severity_escalated', 'notification_sent',
    'notification_failed', 'escalation_triggered', 'acknowledged',
    'snoozed', 'snooze_expired', 'suppressed', 'resolved_auto',
    'resolved_manual', 'expired', 'reopened', 'corrective_action_logged',
    'correlated'
  )),
  actor_user_id uuid,
  actor_type text NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('system', 'user', 'cron')),
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- APPEND ONLY — no updates or deletes at application level
CREATE INDEX IF NOT EXISTS idx_audit_alert
  ON public.alert_audit_log(alert_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org
  ON public.alert_audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type
  ON public.alert_audit_log(event_type, created_at DESC);

ALTER TABLE public.alert_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view audit log"
  ON public.alert_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Service can insert audit log"
  ON public.alert_audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 5. Add user notification preferences columns to profiles
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_start time,
ADD COLUMN IF NOT EXISTS quiet_hours_end time,
ADD COLUMN IF NOT EXISTS quiet_hours_timezone text,
ADD COLUMN IF NOT EXISTS quiet_hours_allow_critical boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS vacation_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vacation_alternate_user_id uuid REFERENCES auth.users(id);
