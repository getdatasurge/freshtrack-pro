

# Fix Plan: CORS Error on ttn-send-downlink Edge Function

## Problem

When clicking a preset button in the Sensor Settings drawer, the downlink request fails with:

```
Access to fetch at '.../functions/v1/ttn-send-downlink' from origin 'https://safe-temps-everywhere.lovable.app' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status.
```

## Root Cause

The `ttn-send-downlink` edge function has two issues preventing CORS preflight requests from succeeding:

| Issue | Problem |
|-------|---------|
| Missing config.toml entry | Function defaults to `verify_jwt = true`, which blocks OPTIONS requests at the gateway level |
| Incomplete CORS headers | Missing Supabase client headers like `x-supabase-client-platform` |

## Fix Steps

### Step 1: Add config.toml entry

Add the function to `supabase/config.toml` with `verify_jwt = false` to allow CORS preflight requests:

```toml
# TTN downlink sender - handles CORS preflight and custom JWT verification
[functions.ttn-send-downlink]
verify_jwt = false
```

This allows the OPTIONS preflight request to reach the function, where it's handled properly.

### Step 2: Update CORS headers

Update the `corsHeaders` in `supabase/functions/ttn-send-downlink/index.ts` to include all headers the Supabase client sends:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": 
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
```

---

## Technical Details

### Why verify_jwt = false is safe

The function already implements its own JWT verification at lines 223-241:

```typescript
const authHeader = req.headers.get("authorization") ?? "";
const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } },
});

const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
if (authError || !user) {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

It also checks organization membership at lines 284-299.

### Files to Modify

1. **`supabase/config.toml`** - Add `[functions.ttn-send-downlink]` entry
2. **`supabase/functions/ttn-send-downlink/index.ts`** - Expand CORS headers

### After Deployment

Once deployed, the Sensor Settings drawer will be able to:
- Send uplink interval presets (Power Saver, Standard, Debug)
- Apply custom settings (interval, ext mode, time sync, alarms)
- Track pending changes in the Recent Changes section

