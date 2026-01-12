# Debugging Guide

> Troubleshooting common issues and debugging strategies

---

## Table of Contents

1. [Debugging Philosophy](#debugging-philosophy)
2. [Quick Diagnosis Checklist](#quick-diagnosis-checklist)
3. [Frontend Debugging](#frontend-debugging)
4. [Backend Debugging](#backend-debugging)
5. [Database Debugging](#database-debugging)
6. [TTN Integration Issues](#ttn-integration-issues)
7. [Alert System Issues](#alert-system-issues)
8. [Common Error Patterns](#common-error-patterns)
9. [Performance Issues](#performance-issues)
10. [Known Sharp Edges](#known-sharp-edges)

---

## Debugging Philosophy

### Follow the Data Flow

Most bugs occur at boundaries. Trace data through the system:

```
User Action → React State → Supabase Query → Database → Response → React Query Cache → UI
```

**Ask yourself:**
1. Where does the data enter the system?
2. Where does it transform?
3. Where does it render?

### Check These First (90% of issues)

1. **Console errors** — Browser DevTools console
2. **Network failures** — Browser DevTools Network tab
3. **Wrong environment** — Check `.env` values
4. **Stale cache** — Hard refresh or clear query cache
5. **RLS blocking** — User doesn't have access

---

## Quick Diagnosis Checklist

When something isn't working, check in this order:

```
□ Browser console (F12 → Console)
□ Network tab (F12 → Network)
□ Terminal running dev server
□ Supabase function logs
□ Database query directly in Supabase Studio
```

### One-Liner Diagnostics

```bash
# Check if frontend is running
curl http://localhost:8080

# Check if Supabase is running
supabase status

# Check function logs
supabase functions logs <function-name>

# Check database connection
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT 1"
```

---

## Frontend Debugging

### React DevTools

Install the React DevTools browser extension. It lets you:
- Inspect component hierarchy
- View props and state
- See what triggered re-renders

### TanStack Query DevTools

The app includes TanStack Query DevTools (in development mode):
- See all cached queries
- Inspect query states (loading, error, success)
- Manually invalidate queries
- Trigger refetches

**Location:** Bottom-right corner of the screen (flower icon).

### Debug Mode

FreshTrack Pro has a built-in debug mode:

1. Enable in `.env`: `VITE_ENABLE_DEBUG_MODE="true"`
2. Opens a debug terminal with system information
3. Shows real-time events and state changes

### Common Frontend Issues

#### Issue: Data not updating after mutation

**Symptom:** You save something, but the UI doesn't update.

**Cause:** Query cache not invalidated.

**Solution:**
```typescript
// In your mutation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["your-query-key"] });
},
```

#### Issue: Component re-renders infinitely

**Symptom:** Browser freezes, "Maximum update depth" error.

**Cause:** Dependency array issue in useEffect or useMemo.

**Debug:**
```typescript
// Add logging to see what's changing
useEffect(() => {
  console.log("Effect ran", { dep1, dep2 });
}, [dep1, dep2]);
```

**Solution:** Ensure dependencies are stable (use useMemo/useCallback).

#### Issue: "Cannot read property of undefined"

**Symptom:** White screen, error in console.

**Cause:** Data not loaded yet, or null check missing.

**Solution:**
```typescript
// Add loading state check
if (isLoading) return <Spinner />;
if (!data) return <EmptyState />;

// Use optional chaining
const value = data?.nested?.property;
```

#### Issue: Toast not showing

**Symptom:** Action completes but no feedback.

**Solution:**
```typescript
import { toast } from "@/hooks/use-toast";

toast({
  title: "Success",
  description: "Your action completed.",
});
```

---

## Backend Debugging

### Viewing Edge Function Logs

```bash
# Stream logs in real-time (local)
supabase functions serve

# View logs in Supabase Dashboard (remote)
# Go to: Project → Edge Functions → Logs
```

### Adding Debug Logging

```typescript
// In edge functions
console.log("Debug:", JSON.stringify({ variable, anotherVariable }));

// These appear in:
// - Terminal (local development)
// - Supabase Dashboard logs (production)
```

### Testing Functions Locally

```bash
# Serve all functions
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer $(supabase status | grep anon | awk '{print $3}')" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Common Backend Issues

#### Issue: Function returns 401 Unauthorized

**Cause:** Missing or invalid auth token.

**Debug:**
```typescript
// Log the auth state
const { data: { user }, error } = await supabase.auth.getUser();
console.log("Auth:", { user: user?.id, error });
```

**Solutions:**
- Ensure frontend passes auth header
- Check if user is logged in
- Verify JWT hasn't expired

#### Issue: Function returns 500 Internal Server Error

**Debug:**
```typescript
try {
  // Your code
} catch (error) {
  console.error("Function error:", error);
  return new Response(
    JSON.stringify({ error: error.message, stack: error.stack }),
    { status: 500 }
  );
}
```

#### Issue: CORS errors

**Symptom:** "Access-Control-Allow-Origin" error in console.

**Solution:** Ensure you return CORS headers:
```typescript
import { corsHeaders } from "../_shared/cors.ts";

// For preflight
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}

// For all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

---

## Database Debugging

### Direct Database Access

```bash
# Connect to local database
psql "postgresql://postgres:postgres@localhost:54322/postgres"

# Or use Supabase Studio
supabase studio  # Opens at http://localhost:54323
```

### Debugging RLS Policies

RLS issues are silent — you get empty results, not errors.

**Debug approach:**

1. **Test as service role (bypasses RLS):**
```sql
-- In Supabase Studio SQL editor
SELECT * FROM units;  -- Service role bypasses RLS
```

2. **Test as user:**
```sql
-- Simulate RLS as a specific user
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM units;
```

3. **Check the policy:**
```sql
-- View policies on a table
SELECT * FROM pg_policies WHERE tablename = 'units';
```

### Common Database Issues

#### Issue: Insert/Update silently fails

**Cause:** RLS policy blocks the operation.

**Debug:**
```sql
-- Check if user has organization access
SELECT organization_id FROM profiles WHERE id = 'user-uuid';

-- Check policy conditions
SELECT organization_id FROM units WHERE id = 'unit-uuid';
```

#### Issue: Cascading settings not working

**Cause:** `get_effective_*` RPC not being used.

**Solution:** Always use the RPC for settings that cascade:
```typescript
const { data } = await supabase.rpc("get_effective_alert_rules", {
  p_unit_id: unitId,
});
```

#### Issue: Migration fails

**Debug:**
```bash
# See migration status
supabase migration list

# Reset and reapply all migrations
supabase db reset

# Check for SQL errors
supabase db push --dry-run
```

---

## TTN Integration Issues

### DevEUI Normalization

DevEUIs must be normalized (uppercase, no separators):

```typescript
// Correct
const devEUI = "70B3D57ED005A123";

// Incorrect (will fail to match)
const devEUI = "70:B3:D5:7E:D0:05:A1:23";  // Has colons
const devEUI = "70b3d57ed005a123";          // Lowercase
```

**Debug:**
```typescript
// In ttn-webhook
console.log("Raw DevEUI:", payload.end_device_ids.dev_eui);
console.log("Normalized:", normalizeDevEUI(payload.end_device_ids.dev_eui));
```

### Webhook Not Receiving Data

1. **Check TTN Console:**
   - Go to Applications → Your App → Webhooks
   - Verify webhook URL is correct
   - Check "Last sent" timestamp

2. **Check webhook secret:**
   - TTN sends an `X-Downlink-Apikey` header
   - Must match what's configured in our database

3. **Check function logs:**
```bash
supabase functions logs ttn-webhook --follow
```

### Device Not Joining

1. **Check device registration:**
   - Device registered in TTN Console?
   - AppKey correct?
   - DevEUI matches physical device?

2. **Check gateway:**
   - Gateway online in TTN Console?
   - Device in range of gateway?

### Sensor Shows "Offline"

**Possible causes:**
- Device battery dead
- Device out of range
- Gateway offline
- Webhook not processing

**Debug path:**
1. Check TTN Console for recent uplinks
2. Check `sensor_readings` table for recent data
3. Check `lora_sensors` table for `last_seen_at`
4. Check function logs for errors

---

## Alert System Issues

### Alerts Not Triggering

The SSOT for alerts is `process-unit-states`. Debug there:

```bash
# Check function logs
supabase functions logs process-unit-states --follow

# Manually trigger for a unit
curl -X POST http://localhost:54321/functions/v1/process-unit-states \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"unit_id": "your-unit-uuid"}'
```

**Common causes:**
- Confirm time not elapsed (needs X minutes of excursion)
- Alert rule not applied (check `get_effective_alert_rules`)
- Unit status already in alarm state

### Alerts Not Resolving

**Check:**
1. Temperature returned to safe range?
2. Clear condition met (in `alertConfig.ts`)?
3. `process-unit-states` running on schedule?

### Escalations Not Sending

The SSOT for notifications is `process-escalations`.

**Check:**
1. Notification policy configured?
2. User has valid contact (email/phone)?
3. Escalation delay elapsed?

```bash
supabase functions logs process-escalations --follow
```

---

## Common Error Patterns

### "TypeError: Cannot read properties of null"

**Pattern:**
```
TypeError: Cannot read properties of null (reading 'map')
```

**Cause:** Trying to iterate over null/undefined data.

**Fix:**
```typescript
// Before
{data.map(item => ...)}

// After
{data?.map(item => ...) ?? <EmptyState />}
```

### "Uncaught (in promise) Error"

**Pattern:** Async operation fails without being caught.

**Fix:**
```typescript
// Add error handling
try {
  await someAsyncOperation();
} catch (error) {
  console.error("Operation failed:", error);
  toast({ title: "Error", description: error.message, variant: "destructive" });
}
```

### "PostgrestError: permission denied for table"

**Cause:** RLS policy blocking access.

**Fix:** Check user's organization membership and policy conditions.

### "FunctionsFetchError: Failed to fetch"

**Cause:** Edge function not running or network issue.

**Check:**
1. Function is deployed/serving
2. URL is correct
3. No CORS issues

---

## Performance Issues

### Slow Initial Load

**Diagnose:**
1. Check Network tab for slow requests
2. Look for large bundle sizes
3. Check for unnecessary data fetching

**Solutions:**
- Use React.lazy for code splitting
- Limit initial data fetch (pagination)
- Check for N+1 query patterns

### Slow Database Queries

**Diagnose:**
```sql
-- Find slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

**Solutions:**
- Add indexes for frequently filtered columns
- Use `.select()` to limit returned columns
- Add pagination

### Memory Leaks

**Symptoms:** App slows down over time.

**Common causes:**
- Subscriptions not cleaned up
- Timers not cleared
- Event listeners not removed

**Fix:**
```typescript
useEffect(() => {
  const subscription = supabase.channel('...').subscribe();

  return () => {
    subscription.unsubscribe();  // Cleanup!
  };
}, []);
```

---

## Known Sharp Edges

### 1. DevEUI Case Sensitivity

DevEUIs from different sources may have different cases. Always normalize:

```typescript
import { normalizeDevEUI } from "@/lib/ttnConfig";
const normalized = normalizeDevEUI(rawDevEUI);
```

### 2. Timezone Handling

All timestamps are stored in UTC. Display conversion happens on frontend:

```typescript
// Database stores UTC
created_at: "2026-01-12T10:00:00Z"

// Display in user's timezone
new Date(created_at).toLocaleString()
```

### 3. RLS Doesn't Error, It Filters

If a user can't access data, they get empty results — not an error. This is intentional for security but can confuse debugging.

### 4. Cascading Settings Evaluation

Settings cascade: Org → Site → Unit. The most specific setting wins. Use `get_effective_*` RPCs.

### 5. Alert Confirm Time

Alerts don't trigger immediately. They wait for `confirm_time_minutes` to avoid false alarms from brief fluctuations.

### 6. Supabase Types Regeneration

After database changes, regenerate types:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

Forgetting this causes TypeScript errors about missing columns.

### 7. Edge Function Cold Starts

First request after deployment may be slow (cold start). This is normal.

### 8. Query Key Inconsistency

If query keys don't match between fetch and invalidation, cache updates won't work:

```typescript
// These must match!
useQuery({ queryKey: ["units", orgId] })  // Fetch
queryClient.invalidateQueries({ queryKey: ["units", orgId] })  // Invalidate
```

---

## Debugging Toolkit

### Browser DevTools

- **Console (F12):** JavaScript errors and logs
- **Network:** API requests and responses
- **Application → Storage:** Local storage, cookies
- **React DevTools:** Component inspection
- **TanStack Query DevTools:** Query cache state

### Terminal Commands

```bash
# Frontend
npm run dev             # Start with hot reload
npm run lint            # Check for errors
npm run build           # Build (catches type errors)

# Backend
supabase start          # Start local Supabase
supabase functions serve # Run functions locally
supabase functions logs <name> # View function logs
supabase db reset       # Reset database

# Database
psql <connection-string> # Direct database access
supabase studio         # Visual database browser
```

### Useful Queries

```sql
-- Recent sensor readings
SELECT * FROM sensor_readings ORDER BY created_at DESC LIMIT 10;

-- Active alerts
SELECT * FROM alerts WHERE status = 'triggered';

-- User's organization
SELECT p.*, o.name as org_name
FROM profiles p
JOIN organizations o ON p.organization_id = o.id
WHERE p.id = 'user-uuid';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

---

## Getting Help

1. **Check this guide** for common issues
2. **Search the codebase** for similar patterns
3. **Check Supabase docs** for database/auth issues
4. **Check React Query docs** for caching issues
5. **Ask the team** with context:
   - What you're trying to do
   - What you expected
   - What actually happened
   - Error messages
   - Steps to reproduce

---

## Related Documents

- [LOCAL_DEV.md](./LOCAL_DEV.md) — Development environment setup
- [COMMON_TASKS.md](./COMMON_TASKS.md) — How to do common tasks
- [REPO_TOUR.md](./REPO_TOUR.md) — Codebase structure
- [GETTING_STARTED.md](./GETTING_STARTED.md) — System mental model
