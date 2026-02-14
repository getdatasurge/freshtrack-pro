-- Phase 1 corrective migration: fix column types, add FK constraints, tighten RLS
-- Addresses issues found during line-by-line audit of 20260214000001

-- ============================================================
-- 1. alert_suppressions — change text columns to uuid + add FKs
-- ============================================================

ALTER TABLE public.alert_suppressions
  ALTER COLUMN organization_id TYPE uuid USING organization_id::uuid,
  ALTER COLUMN site_id TYPE uuid USING site_id::uuid,
  ALTER COLUMN unit_id TYPE uuid USING unit_id::uuid;

ALTER TABLE public.alert_suppressions
  ADD CONSTRAINT alert_suppressions_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  ADD CONSTRAINT alert_suppressions_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES public.sites(id),
  ADD CONSTRAINT alert_suppressions_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES public.units(id);

-- ============================================================
-- 2. alert_audit_log — change organization_id to uuid + add FKs
-- ============================================================

ALTER TABLE public.alert_audit_log
  ALTER COLUMN organization_id TYPE uuid USING organization_id::uuid;

ALTER TABLE public.alert_audit_log
  ADD CONSTRAINT alert_audit_log_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

-- Add FK on actor_user_id so the PostgREST join
-- profiles!alert_audit_log_actor_user_id_fkey works
ALTER TABLE public.alert_audit_log
  ADD CONSTRAINT alert_audit_log_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- ============================================================
-- 3. in_app_notifications — change organization_id to uuid + add FK
-- ============================================================

ALTER TABLE public.in_app_notifications
  ALTER COLUMN organization_id TYPE uuid USING organization_id::uuid;

ALTER TABLE public.in_app_notifications
  ADD CONSTRAINT in_app_notifications_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

-- ============================================================
-- 4. Tighten RLS — replace USING(true) with org-scoped policies
-- ============================================================

-- alert_suppressions: any authenticated user could see all orgs' suppressions
DROP POLICY IF EXISTS "Org members can view suppressions" ON public.alert_suppressions;
CREATE POLICY "Org members can view suppressions"
  ON public.alert_suppressions FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));

-- alert_audit_log: same issue
DROP POLICY IF EXISTS "Org admins can view audit log" ON public.alert_audit_log;
CREATE POLICY "Org admins can view audit log"
  ON public.alert_audit_log FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id));
