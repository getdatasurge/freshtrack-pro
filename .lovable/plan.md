

# TTN Cleanup Log: Per-Step Visibility for Sensor Archival

## What This Solves

When a sensor is archived, the `ttn-deprovision-worker` deletes it from TTN across 4 endpoints (IS, NS, AS, JS) but only records the final pass/fail on the job row. There is no per-step visibility, so when cleanup partially fails, you cannot tell which step broke. The Recently Deleted page also has zero awareness of TTN cleanup status.

## Changes

### 1. New Database Table: `ttn_cleanup_log`

Create a table to record each TTN API call made during sensor-level deprovision:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid (PK) | Auto-generated |
| `job_id` | uuid (FK to ttn_deprovision_jobs) | Links to the parent cleanup job |
| `sensor_id` | uuid (nullable) | The archived sensor |
| `dev_eui` | text | Device EUI being cleaned |
| `organization_id` | uuid | Org scope for RLS |
| `action` | text | One of: `deprovision_is`, `deprovision_ns`, `deprovision_as`, `deprovision_js` |
| `status` | text | `success`, `failed`, `skipped` |
| `ttn_response` | jsonb | Raw TTN response body |
| `ttn_status_code` | integer | HTTP status from TTN |
| `ttn_endpoint` | text | Full URL that was called |
| `cluster` | text | `eu1` or `nam1` |
| `error_message` | text | Human-readable error if failed |
| `created_at` | timestamptz | When the step ran |

RLS policy: read access for org members (matching the existing pattern for `ttn_deprovision_jobs`).

### 2. Update `ttn-deprovision-worker` Edge Function

Modify the `tryDeleteFromTtn` function to write a row to `ttn_cleanup_log` after each of the 4 endpoint calls (IS, NS, AS, JS). Each call gets its own row with:
- The raw response body (success or error)
- HTTP status code
- Which cluster was hit (`eu1` for IS, `nam1` for NS/AS/JS)
- Status: `success` if 2xx, `skipped` if 404, `failed` otherwise

This requires passing the `supabase` client and job metadata into `tryDeleteFromTtn`.

### 3. Add "TTN Cleanup Log" Tab to Recently Deleted Page

Add a new tab called "TTN Cleanup" to the existing `TabsList` on the Recently Deleted page. This tab will show:

- A table of recent cleanup log entries (joined with `ttn_deprovision_jobs` for sensor name)
- Columns: Sensor Name, DevEUI, Step (IS/NS/AS/JS), Status (green check / red X / gray skip badge), HTTP Code, Cluster, Timestamp
- Clicking a row expands (using `Collapsible`) to show the raw `ttn_response` JSON in a monospace code block
- Auto-refreshes every 30 seconds

### 4. Warning Badge on Archived Sensors

In the existing sensor rows on the Recently Deleted page:
- Query `ttn_deprovision_jobs` for each archived sensor by `sensor_id`
- If any job has status `FAILED` or `BLOCKED`, show an orange/red warning badge: "TTN Cleanup Failed"
- If job status is `PENDING` or `RUNNING` or `RETRYING`, show a yellow "Cleanup In Progress" badge
- If `SUCCEEDED`, show a green "TTN Cleaned" badge
- If no job exists (non-TTN sensor), show nothing

To avoid N+1 queries, batch-fetch all deprovision jobs for the org's archived sensors in a single query.

### 5. New Hook: `useTTNCleanupLog`

Create `src/hooks/useTTNCleanupLog.ts` with:
- `useTTNCleanupLogs(orgId)` -- fetches recent cleanup log entries
- `useSensorCleanupStatus(orgId, sensorIds)` -- batch-fetches job statuses for archived sensors
- Query key: `qk.org(orgId).ttnCleanupLogs()` (add to `queryKeys.ts`)

### Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Create `ttn_cleanup_log` table with RLS |
| `supabase/functions/ttn-deprovision-worker/index.ts` | Write per-step log rows after each TTN API call |
| `src/pages/RecentlyDeleted.tsx` | Add "TTN Cleanup" tab, warning badges on sensor rows |
| `src/hooks/useTTNCleanupLog.ts` | New hook for cleanup log queries |
| `src/lib/queryKeys.ts` | Add `ttnCleanupLogs` key |

