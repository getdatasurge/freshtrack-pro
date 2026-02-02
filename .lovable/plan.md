

# Fix: Edge Function Using Wrong Authorization Table

## Problem

The `ttn-send-downlink` edge function is returning a **403 "Not authorized for this sensor"** error because it's checking the wrong table for organization membership.

The function queries `organization_members` table (which doesn't exist), but the project uses `user_roles` for organization membership.

```text
Current Code (Broken):
┌────────────────────────────────────────────┐
│ db.from("organization_members")            │
│    .select("id")                           │
│    .eq("organization_id", sensor.org_id)   │
│    .eq("user_id", user.id)                 │
└────────────────────────────────────────────┘
         ↓
   Table doesn't exist → Query returns null → 403 Forbidden
```

```text
Required Pattern (Used by other functions):
┌────────────────────────────────────────────┐
│ db.from("user_roles")                      │
│    .select("role")                         │
│    .eq("organization_id", sensor.org_id)   │
│    .eq("user_id", user.id)                 │
└────────────────────────────────────────────┘
         ↓
   User has "owner" role → Authorized → Proceed
```

## Evidence

User's current role in `user_roles` table:
| user_id | organization_id | role |
|---------|-----------------|------|
| d7df62e3-... | 7873654e-... | owner |

## Fix

Update `supabase/functions/ttn-send-downlink/index.ts` lines 284-300 to use `user_roles` table instead of `organization_members`:

```typescript
// Verify user belongs to this org via user_roles table
const { data: roleCheck } = await db
  .from("user_roles")
  .select("role")
  .eq("organization_id", sensor.organization_id)
  .eq("user_id", user.id)
  .maybeSingle();

if (!roleCheck) {
  return new Response(
    JSON.stringify({ ok: false, error: "Not authorized for this sensor" }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
```

## Secondary Fix (Same Issue)

The `ttn-deprovision-jobs` function also references `organization_members` and needs the same fix for consistency.

## After Deployment

Once the fix is deployed, clicking preset buttons will successfully queue downlinks to TTN.

