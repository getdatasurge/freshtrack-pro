# Super Admin Architecture & Impersonation System Audit

**Date**: 2026-01-16
**Auditor**: Claude Code Security Audit
**Branch**: `claude/verify-admin-impersonation-oYY60`
**Status**: FIXES IMPLEMENTED

## Implementation Summary

The following fixes have been implemented based on this audit:

| Fix | File(s) Modified | Status |
|-----|------------------|--------|
| Navigation race condition | `src/hooks/useImpersonateAndNavigate.ts` | ✅ Implemented |
| Sidebar orgId sync | `src/components/DashboardLayout.tsx` | ✅ Implemented |
| User count query | `supabase/migrations/20260116230950_*.sql` | ✅ Implemented |
| Membership validation | `supabase/migrations/20260116231000_*.sql` | ✅ Implemented |
| Route guards | `src/App.tsx` | ✅ Implemented |

---

## 1. Architecture Map

### 1.1 Framework & Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vite 5.x + React 18 + TypeScript |
| Routing | React Router v6 (client-side SPA) |
| State | TanStack React Query + React Context |
| Backend | Supabase (PostgreSQL + Row-Level Security) |
| Auth | Supabase Auth (JWT-based) |
| UI | Radix UI + shadcn/ui + Tailwind CSS |

**Key Insight**: This is a **client-side SPA** with no traditional server middleware. All route guards and auth checks happen in React components. Backend security is enforced via Supabase RLS policies and `SECURITY DEFINER` RPC functions.

### 1.2 Directory Structure (Security-Critical Files)

```
src/
├── contexts/
│   └── SuperAdminContext.tsx          # Core impersonation state machine
├── hooks/
│   ├── useEffectiveIdentity.ts        # Single source of truth for identity
│   ├── useImpersonateAndNavigate.ts   # Two-phase impersonation flow
│   ├── useUserRole.ts                 # Org-scoped app role loader
│   └── useNavTree.ts                  # Sidebar data fetcher
├── components/
│   ├── DashboardLayout.tsx            # Main app layout + redirect logic
│   ├── platform/
│   │   ├── PlatformGuard.tsx          # Platform route protection
│   │   ├── PlatformLayout.tsx         # Platform admin layout
│   │   ├── SupportModeBanner.tsx      # Impersonation indicator
│   │   ├── ConfirmSpoofingModal.tsx   # Impersonation confirmation
│   │   └── GlobalUserSearch.tsx       # User search + impersonation trigger
│   └── guards/
│       └── RequireImpersonationGuard.tsx  # (unused in routes currently)
├── pages/
│   ├── platform/                      # Super admin pages
│   │   ├── PlatformOrganizations.tsx
│   │   ├── PlatformUsers.tsx
│   │   └── PlatformAuditLog.tsx
│   ├── Dashboard.tsx                  # Main app dashboard
│   ├── Sites.tsx                      # Sites list
│   └── Units.tsx                      # Units list
└── integrations/supabase/
    └── client.ts                      # Supabase client initialization

supabase/migrations/
├── 20260115000001_super_admin_platform_roles.sql   # platform_roles table
├── 20260115222612_*.sql                            # Cross-org RLS policies
├── 20260116013110_*.sql                            # impersonation_sessions table
└── 20260116201606_*.sql                            # get_platform_organization_stats RPC
```

### 1.3 Role & Permission Model

#### Platform-Level Roles (Cross-Org)
| Table | Column | Description |
|-------|--------|-------------|
| `platform_roles` | `role` | ENUM: `'SUPER_ADMIN'` |
| `platform_roles` | `user_id` | FK to `auth.users` |

**Check Function**: `is_current_user_super_admin()` (SECURITY DEFINER)

#### Organization-Level Roles
| Table | Column | Description |
|-------|--------|-------------|
| `user_roles` | `role` | ENUM: `owner`, `admin`, `manager`, `staff`, `viewer`, `inspector` |
| `user_roles` | `user_id` | FK to `auth.users` |
| `user_roles` | `organization_id` | FK to `organizations` |

### 1.4 Organization Model

```
organizations (id, name, slug, ...)
    └── sites (organization_id)
        └── areas (site_id)
            └── units (area_id)
                └── lora_sensors (unit_id)

profiles (user_id, organization_id)  -- Legacy: single org per user
user_roles (user_id, organization_id, role)  -- Multi-org membership
```

### 1.5 How "Current Org" is Derived

| Scenario | Source | Code Location |
|----------|--------|---------------|
| Normal User | `profiles.organization_id` | `useUserRole.ts:155-159` |
| Super Admin (Platform) | None (cross-org access) | N/A |
| Super Admin (Impersonating) | `impersonation_sessions.target_org_id` via `useEffectiveIdentity.ts` | `useEffectiveIdentity.ts:268-274` |

---

## 2. Impersonation Flow Map

### 2.1 Flow Sequence Diagram

```
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────┐
│  Platform Admin │     │   SuperAdminContext   │     │    Supabase     │
│     UI Page     │     │   (React Context)     │     │   (Database)    │
└────────┬────────┘     └───────────┬───────────┘     └────────┬────────┘
         │                          │                          │
         │ 1. Click "Impersonate"   │                          │
         │─────────────────────────>│                          │
         │                          │                          │
         │ 2. requestImpersonation()│                          │
         │   (sets pendingTarget)   │                          │
         │<─────────────────────────│                          │
         │                          │                          │
         │ 3. Show ConfirmSpoofingModal                        │
         │         (user enters reason)                        │
         │                          │                          │
         │ 4. confirmAndNavigate()  │                          │
         │─────────────────────────>│                          │
         │                          │                          │
         │                          │ 5. enterSupportMode()    │
         │                          │   (if not active)        │
         │                          │                          │
         │                          │ 6. RPC: start_impersonation()
         │                          │─────────────────────────>│
         │                          │                          │
         │                          │   Creates session in     │
         │                          │   impersonation_sessions │
         │                          │   + audit log entry      │
         │                          │<─────────────────────────│
         │                          │                          │
         │                          │ 7. Update local state:   │
         │                          │   - impersonation.is...  │
         │                          │   - localStorage persist │
         │                          │                          │
         │ 8. Invalidate query cache│                          │
         │   (sites, units, etc.)   │                          │
         │                          │                          │
         │ 9. navigate('/dashboard')│                          │
         │─────────────────────────>│                          │
         │                          │                          │
         │ 10. DashboardLayout      │                          │
         │   checks isImpersonating │                          │
         │   → allows access        │                          │
         │                          │                          │
         │ 11. Data queries use     │ 12. RLS allows because   │
         │   effectiveOrgId filter  │   is_current_user_super_admin()
         │                          │─────────────────────────>│
         │                          │                          │
```

### 2.2 File-by-File Function Map

#### Phase 1: Initiate Impersonation Request

| Step | File | Function | Line |
|------|------|----------|------|
| UI Trigger | `PlatformUsers.tsx` or `GlobalUserSearch.tsx` | Button click | Various |
| Set pending target | `useImpersonateAndNavigate.ts` | `requestImpersonation()` | 43-64 |
| Show modal | `ConfirmSpoofingModal.tsx` | Component render | 33-159 |

#### Phase 2: Execute Impersonation

| Step | File | Function | Line |
|------|------|----------|------|
| User confirms | `ConfirmSpoofingModal.tsx` | `handleConfirm()` | 43-56 |
| Enter support mode | `SuperAdminContext.tsx` | `enterSupportMode()` | 348-372 |
| Create server session | `SuperAdminContext.tsx` | `startImpersonation()` | 390-471 |
| Supabase RPC | `20260116013110_*.sql` | `start_impersonation()` | 64-151 |
| Persist to localStorage | `SuperAdminContext.tsx` | Lines 446-454 | - |
| Invalidate caches | `useImpersonateAndNavigate.ts` | `queryClient.invalidateQueries()` | 106-112 |
| Navigate | `useImpersonateAndNavigate.ts` | `navigate('/dashboard')` | 121 |

#### Phase 3: Data Loading with Effective Identity

| Step | File | Function | Line |
|------|------|----------|------|
| Check identity | `useEffectiveIdentity.ts` | Hook initialization | 82-303 |
| Compute effective | `useEffectiveIdentity.ts` | Lines 261-286 | - |
| Load sites | `Sites.tsx` | `loadSites()` | 84-123 |
| Filter by org | `Sites.tsx` | `.eq("organization_id", effectiveOrgId)` | 102 |

#### Phase 4: Stop Impersonation

| Step | File | Function | Line |
|------|------|----------|------|
| UI trigger | `SupportModeBanner.tsx` | "Exit Support Mode" button | 90-98 |
| Stop impersonation | `SuperAdminContext.tsx` | `stopImpersonation()` | 474-505 |
| Server cleanup | `20260116013110_*.sql` | `stop_impersonation()` | 154-190 |

### 2.3 State Storage Locations

| State | Storage | Key | TTL |
|-------|---------|-----|-----|
| Support Mode | localStorage | `ftp_support_mode` | 30 min |
| Impersonation Session | localStorage | `ftp_impersonation_session` | Session expiry |
| Server Session | PostgreSQL | `impersonation_sessions` table | `p_duration_minutes` (default 60) |

---

## 3. Confirmed Bugs

### Bug 1: Sites/Units/Dashboard May Show Empty During Impersonation

**Reproduction**:
1. Log in as Super Admin
2. Go to Platform Admin > Users
3. Click "Impersonate" on a user
4. Navigate to /dashboard - sometimes shows no data

**Observed Behavior**:
- Intermittently, `effectiveOrgId` is `null` when data queries run
- Shows "No Sites" or empty dashboard briefly or permanently

**Evidence**:
- `Sites.tsx:67-82`: Guards require `isInitialized && effectiveOrgId`
- `useEffectiveIdentity.ts:124-137`: `isInitialized` has complex dependency chain
- `useImpersonateAndNavigate.ts:115`: Only 150ms delay before navigation

**Root Cause**:
Race condition between:
1. Navigation to `/dashboard` (line 121)
2. localStorage sync completing
3. `isInitialized` becoming true (depends on 5+ conditions)
4. Data queries firing

The 150ms delay (line 115) may not be sufficient for all state to propagate through React's async render cycle.

**Severity**: High - Breaks core impersonation functionality

---

### Bug 2: Sidebar Shows Wrong/No Data During Impersonation

**Reproduction**:
1. After impersonating, look at sidebar Sites/Units accordions
2. May show previous org's data or empty

**Evidence**:
- `DashboardLayout.tsx:308-311`: Sidebar receives `orgId` prop
- `DashboardLayout.tsx:116-127`: `orgId` state is set via useEffect on `effectiveOrgId`
- `useNavTree.ts:110-141`: Queries use `organizationId` prop

**Root Cause**:
`orgId` state in DashboardLayout updates via useEffect AFTER initial render. Sidebar may query with stale/null `orgId` on first render.

**Severity**: Medium - Confusing UX, data inconsistency

---

### Bug 3: User Count Shows 0 for Organizations Without user_roles Entries

**Reproduction**:
1. Go to Platform Admin > Organizations
2. Observe "Users" column shows 0 for some orgs that have users

**Evidence**:
- `20260116201606_*.sql:27`: `COUNT(DISTINCT ur.user_id) FROM user_roles ur WHERE ur.organization_id = o.id`
- Users may exist in `profiles.organization_id` but not have `user_roles` entries

**Root Cause**:
The query counts from `user_roles` table, but:
1. Legacy users may only have `profiles.organization_id`
2. New users might fail role assignment silently

**Severity**: Medium - Incorrect data in admin view

---

### Bug 4: DashboardLayout Redirect Race Condition

**Reproduction**:
1. As Super Admin, directly navigate to `/dashboard` (not through impersonation)
2. May briefly render then redirect to `/platform`
3. Sometimes gets stuck in redirect loop

**Evidence**:
- `DashboardLayout.tsx:69-90`: Redirect logic with timeout
- Line 75: 50ms timeout added to "allow impersonation state to propagate"
- Line 81: Complex condition `hasOrgContext = isImpersonating || impersonation.isImpersonating || isSupportModeActive || viewingOrg.orgId`

**Root Cause**:
Multiple boolean flags from different sources (`useEffectiveIdentity`, `useSuperAdmin`) may not be synchronized within the 50ms window.

**Severity**: Medium - Poor UX, potential infinite loop

---

## 4. Root Causes Analysis

### RC1: Client-Side State Synchronization

**Problem**: Impersonation state lives in multiple places:
1. `SuperAdminContext` state (React)
2. `useEffectiveIdentity` state (React)
3. localStorage (browser)
4. Server session (PostgreSQL)

These are synchronized via:
- useEffect chains
- localStorage read on mount
- Server RPC validation

**Impact**: Race conditions during navigation when components read state at different points in the sync cycle.

**File Pointers**:
- `SuperAdminContext.tsx:198-227` (localStorage restore)
- `useEffectiveIdentity.ts:96-115` (synchronous localStorage init)
- `useEffectiveIdentity.ts:241-258` (async server validation)

---

### RC2: RLS Relies on Real User Token, Not Effective User

**Problem**: Supabase JWT always contains the **real** user's identity. RLS policies use `auth.uid()`.

**Mitigation in place**: Special RLS policies grant super admins cross-org access:
```sql
CREATE POLICY "Super admins can view all sites"
  ON public.sites FOR SELECT
  USING (public.is_current_user_super_admin());
```

**Remaining risk**: Client-side filtering by `effectiveOrgId` is the ONLY tenant scoping during impersonation. If `effectiveOrgId` is wrong, super admin sees wrong org's data.

**File Pointers**:
- `20260115222612_*.sql:166-171` (super admin RLS policies)
- `Sites.tsx:102` (client-side org filter)

---

### RC3: Query Cache Invalidation Timing

**Problem**: `useImpersonateAndNavigate.ts:106-112` invalidates queries, but:
1. Invalidation is async
2. Navigation happens before re-fetch completes
3. Components may render with stale/empty cache

**File Pointers**:
- `useImpersonateAndNavigate.ts:106-112`
- `useImpersonateAndNavigate.ts:121` (navigate before cache settles)

---

### RC4: User Count Query Schema Mismatch

**Problem**: `get_platform_organization_stats()` counts from `user_roles` but users can exist with only `profiles.organization_id`.

**File Pointers**:
- `20260116201606_*.sql:27`
- `useUserRole.ts:155-174` (loads role from `user_roles`)

---

## 5. Minimal Fix Plan

### Fix 1: Ensure effectiveOrgId Before Navigation (HIGH PRIORITY)

**File**: `src/hooks/useImpersonateAndNavigate.ts`

**Change**: Wait for `effectiveOrgId` to be set before navigating

```typescript
// After line 115 (the current 150ms delay)
// Add: Wait for effective identity to be ready
const maxWait = 1000; // 1 second max
const checkInterval = 50;
let waited = 0;

while (waited < maxWait) {
  // Check if effective identity is ready
  // This requires refactoring to access the hook state
  await new Promise(resolve => setTimeout(resolve, checkInterval));
  waited += checkInterval;
  // Break when ready
}
```

**Better approach**: Make navigation dependent on state, not timeouts:
```typescript
// Create a promise that resolves when effectiveOrgId is set
// Navigate only after promise resolves
```

**Estimated effort**: Small (1-2 hours)

---

### Fix 2: Synchronize Sidebar orgId with Effective Identity (MEDIUM PRIORITY)

**File**: `src/components/DashboardLayout.tsx`

**Current** (line 64):
```typescript
const [orgId, setOrgId] = useState<string | null>(null);
```

**Change**: Initialize from effectiveOrgId directly:
```typescript
const { effectiveOrgId, ... } = useEffectiveIdentity();
// Remove orgId state, use effectiveOrgId directly for sidebar
```

Or ensure sidebar waits:
```typescript
<SidebarSitesAccordion organizationId={isInitialized ? effectiveOrgId || orgId : null} />
```

**Estimated effort**: Small (1 hour)

---

### Fix 3: Fix User Count Query (MEDIUM PRIORITY)

**File**: Create new migration

**Change**: Count from both `user_roles` AND `profiles`:
```sql
CREATE OR REPLACE FUNCTION get_platform_organization_stats()
RETURNS TABLE (org_id UUID, user_count BIGINT, site_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_roles WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Access denied: Super Admin required';
  END IF;

  RETURN QUERY
  SELECT
    o.id as org_id,
    (
      SELECT COUNT(DISTINCT COALESCE(ur.user_id, p.user_id))
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.user_id AND ur.organization_id = o.id
      WHERE p.organization_id = o.id OR ur.organization_id = o.id
    ) as user_count,
    (SELECT COUNT(*) FROM sites s WHERE s.organization_id = o.id AND s.deleted_at IS NULL) as site_count
  FROM organizations o
  WHERE o.deleted_at IS NULL;
END;
$$;
```

**Estimated effort**: Small (1 hour)

---

### Fix 4: Add State Machine for Impersonation Transitions (LOW PRIORITY)

**File**: `src/contexts/SuperAdminContext.tsx`

**Change**: Add explicit transition states:
```typescript
type ImpersonationStatus =
  | 'idle'           // Not impersonating
  | 'starting'       // Server call in progress
  | 'syncing'        // Waiting for state propagation
  | 'active'         // Ready for data access
  | 'stopping';      // Cleanup in progress
```

Use status to gate navigation and data queries.

**Estimated effort**: Medium (4-6 hours)

---

### Fix 5: Add RequireImpersonationGuard to Main App Routes (LOW PRIORITY)

**File**: `src/App.tsx`

**Current**: `RequireImpersonationGuard` exists but is not used in routes.

**Change**: Wrap main app routes:
```tsx
<Route path="/dashboard" element={
  <RequireImpersonationGuard>
    <Dashboard />
  </RequireImpersonationGuard>
} />
```

**Note**: This is defensive; DashboardLayout already has redirect logic.

**Estimated effort**: Small (30 min)

---

## 6. Security Review Checklist

### 6.1 Authorization Checks

| Check | Status | Evidence |
|-------|--------|----------|
| Super admin impersonation requires SUPER_ADMIN role | ✅ PASS | `start_impersonation()` calls `is_current_user_super_admin()` |
| Cannot impersonate user not in target org | ⚠️ WARN | No validation that target_user_id belongs to target_org_id |
| Impersonation sessions have TTL | ✅ PASS | `expires_at` column, auto-cleanup in `get_active_impersonation()` |
| Actions logged with actor + target | ✅ PASS | `super_admin_audit_log` table, `log_super_admin_action()` |

### 6.2 Data Access

| Check | Status | Evidence |
|-------|--------|----------|
| RLS enforced on all tables | ✅ PASS | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| Super admin bypass is explicit | ✅ PASS | Separate policies with `is_current_user_super_admin()` |
| Client cannot override effective org | ⚠️ WARN | Client passes `effectiveOrgId` to queries; RLS allows all for super admin |

### 6.3 Session Security

| Check | Status | Evidence |
|-------|--------|----------|
| Server-side session validation | ✅ PASS | `impersonation_sessions` table |
| Session expiry enforced | ✅ PASS | `expires_at` checked in `get_active_impersonation()` |
| localStorage can be tampered | ⚠️ INFO | Yes, but server validates via RPC on page load |
| Support mode timeout | ✅ PASS | 30 min timeout, inactivity detection |

### 6.4 Security Recommendations

1. **Add user-org membership validation** in `start_impersonation()`:
```sql
-- Verify target user belongs to target org
IF NOT EXISTS (
  SELECT 1 FROM profiles
  WHERE user_id = p_target_user_id
  AND organization_id = p_target_org_id
) AND NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = p_target_user_id
  AND organization_id = p_target_org_id
) THEN
  RAISE EXCEPTION 'Target user is not a member of target organization';
END IF;
```

2. **Rate limit impersonation starts** to prevent abuse:
```sql
-- Check for too many recent sessions
IF (SELECT COUNT(*) FROM impersonation_sessions
    WHERE admin_user_id = auth.uid()
    AND started_at > now() - interval '1 hour') > 10 THEN
  RAISE EXCEPTION 'Too many impersonation sessions. Please wait.';
END IF;
```

3. **Add IP/User-Agent logging** (partially implemented but not populated):
```typescript
// In startImpersonation(), pass request context to RPC
```

---

## 7. Tests to Add

### Unit Tests

```typescript
// src/hooks/__tests__/useEffectiveIdentity.test.ts
describe('useEffectiveIdentity', () => {
  it('returns real user identity when not impersonating', () => {});
  it('returns impersonated identity when active', () => {});
  it('initializes from localStorage synchronously', () => {});
  it('validates against server on mount', () => {});
  it('clears localStorage when server session expired', () => {});
});

// src/hooks/__tests__/useImpersonateAndNavigate.test.ts
describe('useImpersonateAndNavigate', () => {
  it('requires super admin role', () => {});
  it('requires target to have org membership', () => {});
  it('enters support mode if not active', () => {});
  it('invalidates caches before navigation', () => {});
  it('waits for effective identity before navigation', () => {});
});
```

### Integration Tests

```typescript
// e2e/impersonation.spec.ts
describe('Super Admin Impersonation', () => {
  it('can impersonate user and see their data', () => {
    // Login as super admin
    // Navigate to platform users
    // Click impersonate
    // Confirm modal
    // Verify dashboard shows target org data
  });

  it('sidebar shows correct sites after impersonation', () => {});

  it('data clears when exiting support mode', () => {});

  it('session expires after timeout', () => {});
});
```

### Database Tests

```sql
-- Test super admin RPC functions
BEGIN;
  -- Setup: Create test users and orgs
  -- Test start_impersonation validates permissions
  -- Test get_active_impersonation returns correct session
  -- Test stop_impersonation cleans up properly
ROLLBACK;
```

---

## 8. Rollback Plan

### Feature Flag Approach

Add to `SuperAdminContext.tsx`:
```typescript
const IMPERSONATION_ENABLED = import.meta.env.VITE_IMPERSONATION_ENABLED !== 'false';

if (!IMPERSONATION_ENABLED) {
  return {
    canImpersonate: false,
    startImpersonation: async () => false,
    // ... stub implementations
  };
}
```

### Emergency Disable

1. Set environment variable: `VITE_IMPERSONATION_ENABLED=false`
2. Redeploy frontend
3. Optionally, revoke RLS super admin policies:
```sql
DROP POLICY "Super admins can view all sites" ON sites;
-- etc.
```

### Data Cleanup

If sessions become corrupted:
```sql
-- End all active impersonation sessions
UPDATE impersonation_sessions
SET status = 'ended', ended_at = now(), end_reason = 'emergency_cleanup'
WHERE status = 'active';
```

---

## 9. Open Questions

1. **Should super admins be able to WRITE data while impersonating?**
   - Current: RLS allows SELECT only for super admin bypass
   - Need to clarify: Can impersonating admin create/update on behalf of user?

2. **What happens to in-flight requests when impersonation ends?**
   - Need to test: Mutations that started during impersonation

3. **Should impersonation reason be required or optional?**
   - Current: Optional (`ConfirmSpoofingModal.tsx:113`)
   - Recommendation: Make required for compliance

4. **Is 30-minute support mode timeout appropriate?**
   - Current: Auto-exits after 30 min inactivity
   - May need adjustment based on support workflow

5. **Should there be org-level impersonation restrictions?**
   - Some orgs may opt out of being impersonated
   - Need product decision

---

## 10. Summary

### Critical Fixes (Do First)
1. Fix navigation race condition in `useImpersonateAndNavigate.ts`
2. Synchronize sidebar `orgId` with effective identity

### Medium Priority
3. Fix user count query to include profiles-only users
4. Add user-org membership validation to `start_impersonation()`

### Low Priority (Hardening)
5. Add impersonation state machine
6. Add `RequireImpersonationGuard` to routes
7. Implement rate limiting on impersonation

### Security Status
- Core impersonation is **server-enforced** via RLS and RPC functions
- Audit logging is **comprehensive**
- Client-side race conditions cause **UX issues** but not security vulnerabilities
- Recommendation: Add membership validation to prevent cross-org impersonation

---

*Report generated by Claude Code Security Audit*
