
-- ═══════════════════════════════════════════════════════════════════
-- 1. in_app_notifications
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  severity text DEFAULT 'info',
  action_url text,
  read boolean DEFAULT false,
  read_at timestamptz,
  dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  escalation_step integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.in_app_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.in_app_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for in_app_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;

-- ═══════════════════════════════════════════════════════════════════
-- 2. alert_audit_log
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.alert_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_type text DEFAULT 'user',
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.alert_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their org"
  ON public.alert_audit_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON public.alert_audit_log FOR INSERT
  WITH CHECK (true);

-- Foreign key alias for the profile join used in useAlertAuditLog.ts
ALTER TABLE public.alert_audit_log
  ADD CONSTRAINT alert_audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES public.profiles(user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 3. alert_suppressions
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.alert_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  alert_types text[] DEFAULT '{}',
  reason text NOT NULL DEFAULT 'other',
  custom_reason text,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_by uuid,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.alert_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suppressions for their org"
  ON public.alert_suppressions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create suppressions for their org"
  ON public.alert_suppressions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update suppressions for their org"
  ON public.alert_suppressions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );
