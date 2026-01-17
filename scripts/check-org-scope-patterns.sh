#!/bin/bash
#
# check-org-scope-patterns.sh
#
# Detects anti-patterns that bypass impersonation context in org-scoped queries.
# Run this script in CI or before commits to catch regressions.
#
# Anti-patterns detected:
# 1. Profile org lookup in pages/components (should use useOrgScope)
# 2. session.user.id for org derivation (not for audit fields)
#
# Usage:
#   ./scripts/check-org-scope-patterns.sh
#
# Exit codes:
#   0 - No anti-patterns found
#   1 - Anti-patterns detected

set -e

echo "🔍 Checking for org-scope anti-patterns..."
echo ""

ERRORS_FOUND=0

# Pattern 1: Profile org lookup for data queries in pages/components
# This is an anti-pattern because it uses the real user's org, not impersonated org
echo "Checking for profile.organization_id lookups..."
PATTERN1=$(grep -rn "profiles.*organization_id" src/pages src/components --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".test." | \
  grep -v "// @org-scope-verified" | \
  grep -v "// Audit trail" || true)

if [ -n "$PATTERN1" ]; then
  echo "⚠️  Found profile.organization_id lookups (use useOrgScope().orgId instead):"
  echo "$PATTERN1"
  echo ""
  ERRORS_FOUND=1
fi

# Pattern 2: session.user.id for org derivation (excluding audit trail fields)
# Audit fields like logged_by, created_by, resolved_by, deleted_by are OK
echo "Checking for session.user.id usage for org derivation..."
PATTERN2=$(grep -rn "session\.user\.id" src/pages src/components --include="*.tsx" 2>/dev/null | \
  grep -v "logged_by" | \
  grep -v "created_by" | \
  grep -v "resolved_by" | \
  grep -v "deleted_by" | \
  grep -v "acknowledged_by" | \
  grep -v "performed_by" | \
  grep -v "// @org-scope-verified" | \
  grep -v "// Audit trail" | \
  grep -v "node_modules" || true)

if [ -n "$PATTERN2" ]; then
  echo "⚠️  Found session.user.id usage (verify this is for audit, not org derivation):"
  echo "$PATTERN2"
  echo ""
  # Don't automatically fail for this - it might be legitimate audit usage
  # ERRORS_FOUND=1
fi

# Pattern 3: useUserRole().organizationId for data queries
echo "Checking for useUserRole().organizationId in data queries..."
PATTERN3=$(grep -rn "useUserRole.*organizationId" src/pages src/components --include="*.tsx" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".test." | \
  grep -v "// @org-scope-verified" || true)

if [ -n "$PATTERN3" ]; then
  echo "⚠️  Found useUserRole().organizationId usage (use useOrgScope().orgId instead):"
  echo "$PATTERN3"
  echo ""
  ERRORS_FOUND=1
fi

# Pattern 4: PostgREST multi-level nested filter paths (these don't work)
# PostgREST can't filter through multiple nested relationships like units->areas->sites->org
# The filter is silently ignored, causing data leaks across organizations
echo "Checking for broken multi-level PostgREST filter paths..."
PATTERN4=$(grep -rn '\.eq(["\x27]areas\.sites\.' src --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".test." | \
  grep -v "// @filter-verified" || true)

if [ -n "$PATTERN4" ]; then
  echo "⚠️  Found multi-level nested filter paths (PostgREST silently ignores these!):"
  echo "$PATTERN4"
  echo ""
  ERRORS_FOUND=1
fi

# Pattern 4b: Alias-based filter paths (also broken)
PATTERN4B=$(grep -rn '\.eq(["\x27]area\.site\.' src --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".test." | \
  grep -v "// @filter-verified" || true)

if [ -n "$PATTERN4B" ]; then
  echo "⚠️  Found alias-based filter paths (also broken):"
  echo "$PATTERN4B"
  echo ""
  ERRORS_FOUND=1
fi

echo ""

if [ $ERRORS_FOUND -eq 1 ]; then
  echo "❌ Anti-patterns detected!"
  echo ""
  echo "To fix:"
  echo "  1. Replace profile.organization_id lookups with useOrgScope().orgId"
  echo "  2. Replace useUserRole().organizationId with useOrgScope().orgId"
  echo "  3. Multi-level filters like .eq('areas.sites.organization_id', orgId) DON'T WORK!"
  echo "     Use a two-step approach:"
  echo "       a) First query areas with .eq('sites.organization_id', orgId) to get areaIds"
  echo "       b) Then query units with .in('area_id', areaIds)"
  echo "  4. If usage is intentional, add comment: // @org-scope-verified or // @filter-verified"
  echo ""
  exit 1
else
  echo "✅ No org-scope anti-patterns detected."
  exit 0
fi
