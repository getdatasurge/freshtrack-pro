# FrostGuard Deprecations

> Items scheduled for removal or that cannot be safely deleted yet.

## Deprecated Items

### Edge Functions

| Item | Status | Reason | Removal Date |
|------|--------|--------|--------------|
| `check-missed-logs` | **DELETED** | Functionality consolidated into `process-unit-states` | 2025-12-29 |

### Database Tables / Columns

| Item | Status | Reason | Notes |
|------|--------|--------|-------|
| `notification_settings.recipients[]` | DEPRECATED | Replaced by role-based system in `notification_policies` | Keep for rollback capability; do not add new recipients here |

### Frontend Components

| Item | Status | Reason | Notes |
|------|--------|--------|-------|
| Inline `statusConfig` objects | **REMOVED** | Consolidated to `src/lib/statusConfig.ts` | All pages now import from shared module |
| Inline `alertTypeConfig` objects | **REMOVED** | Consolidated to `src/lib/alertConfig.ts` | All components now import from shared module |

### Hooks & Utilities (Deleted 2026-01-01)

| Item | Status | Reason | Notes |
|------|--------|--------|-------|
| `src/hooks/useSlugAvailability.ts` | **DELETED** | Zero imports, never integrated | Edge function `check-slug-available` exists for future use |
| `src/hooks/useCoolingFailureDetection.ts` | **DELETED** | Zero imports, orphaned feature | Detection logic preserved in git history |
| `src/lib/ingestTypes.ts` | **DELETED** | Duplicate types | Superseded by `supabase/functions/_shared/validation.ts` |
| `src/components/ui/use-toast.ts` | **DELETED** | Redundant re-export | Use `@/hooks/use-toast` directly |

### Edge Functions (Deleted 2026-01-01)

| Item | Status | Reason | Notes |
|------|--------|--------|-------|
| `get-ttn-integration-snapshot` | **DELETED** | Legacy TTN lookup | Replaced by user_sync as single source of truth for Emulator TTN config |

## Migration Notes

### notification_settings → notification_policies

The legacy `notification_settings` table provided simple email recipient lists. The new `notification_policies` table provides:
- Per-alert-type configuration
- Role-based recipient selection
- Escalation step definitions
- Quiet hours support

**Migration path:**
1. Keep `notification_settings` readable for backward compatibility
2. New notification logic reads from `notification_policies` only
3. UI only shows `notification_policies` editor
4. After 90 days with no issues, consider removing `notification_settings` table

## Guidelines for Future Deprecations

1. Add items to this list BEFORE removing code
2. Include removal date target
3. Document migration path if applicable
4. Keep deprecated items for minimum 30 days before final removal
5. Ensure no runtime references exist before deletion
