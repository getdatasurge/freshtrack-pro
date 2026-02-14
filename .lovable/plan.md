

# Deploy Edge Functions + Fix Build Errors

## Two Categories of Issues

### A. Edge Function Deployment Blockers

**`test-notification`** uses `import { Resend } from "npm:resend"` which doesn't work in Deno edge runtime. The other functions (`process-escalations`, `process-escalation-steps`) correctly use `import { Resend } from "https://esm.sh/resend@2.0.0"`. Additionally, it uses the deprecated `serve` import.

**Fix:** In `test-notification/index.ts`:
- Change `import { Resend } from "npm:resend"` to `import { Resend } from "https://esm.sh/resend@2.0.0"`
- Change `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` to use `Deno.serve()`

The other 4 functions (`process-unit-states`, `process-escalations`, `process-escalation-steps`, `acknowledge-alert`) should deploy without code changes.

### B. Frontend TypeScript Errors (Missing Tables)

Three tables referenced in frontend code do not exist in the database:
- `in_app_notifications` (used by `NotificationDropdown.tsx`)
- `alert_audit_log` (used by `useAlertAuditLog.ts`)
- `alert_suppressions` (used by `useAlertSuppressions.ts`)

**Fix:** Create these tables via database migration. The schema will be inferred from how the frontend code uses them. After the migration, the auto-generated types file will update to include them, resolving all the TypeScript errors.

Additionally, `ComplianceReportDialog.tsx` has a type casting issue with alert types that needs a minor code fix.

## Execution Order

1. **Create missing tables** via SQL migration (`in_app_notifications`, `alert_audit_log`, `alert_suppressions`) with appropriate columns and RLS policies
2. **Fix `test-notification/index.ts`** -- replace `npm:resend` with `esm.sh` import, replace `serve` with `Deno.serve()`
3. **Deploy all 5 edge functions**: `process-unit-states`, `process-escalations`, `process-escalation-steps`, `test-notification`, `acknowledge-alert`
4. **Fix `ComplianceReportDialog.tsx`** type casting for alert types
5. **Verify** deployments via health checks

## Technical Details -- Table Schemas

Based on frontend usage patterns:

```sql
-- in_app_notifications
CREATE TABLE public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid,
  organization_id uuid,
  title text NOT NULL,
  body text,
  severity text DEFAULT 'info',
  action_url text,
  read boolean DEFAULT false,
  dismissed boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- alert_audit_log
CREATE TABLE public.alert_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL,
  organization_id uuid,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_type text DEFAULT 'user',
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- alert_suppressions
CREATE TABLE public.alert_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  unit_id uuid,
  alert_type text,
  reason text,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

RLS will be enabled on all three tables with policies scoped to the user's organization membership.
