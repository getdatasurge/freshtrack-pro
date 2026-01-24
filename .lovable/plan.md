
# TTN Deprovision Job Tracking Implementation

## Overview

This implementation adds **full deprovision run tracking** to ensure:
1. Every TTN deprovision run is recorded with a persistent job ID
2. Each atomic action (delete, purge, verify) is tracked as a step
3. `success=true` is only returned when ALL critical steps succeed
4. UI can query pending/completed jobs and drill down into step details

## Key Distinction

| Existing | New |
|----------|-----|
| `ttn_deprovision_jobs` - Tracks individual sensor cleanups (1 job per device) | `ttn_deprovision_runs` - Tracks full org deprovision runs (1 run = many steps) |
| Used by `ttn-deprovision-worker` | Used by `ttn-deprovision` |

## Implementation

### A) Database Migration

**File:** `supabase/migrations/20260124100000_ttn_deprovision_run_tracking.sql`

Creates two tables:

#### Table 1: `ttn_deprovision_runs`
```text
id                uuid PK default gen_random_uuid()
organization_id   uuid NOT NULL
requested_by      uuid NULL
source            text NOT NULL default 'edge_function'
action            text NOT NULL default 'deprovision'
status            text NOT NULL default 'QUEUED'  -- QUEUED/RUNNING/SUCCEEDED/FAILED/PARTIAL
started_at        timestamptz NULL
finished_at       timestamptz NULL
request_id        text NULL
ttn_region        text NULL
ttn_org_id        text NULL
ttn_application_id text NULL
summary           jsonb NOT NULL default '{}'
error             text NULL
created_at        timestamptz NOT NULL default now()
updated_at        timestamptz NOT NULL default now()
```

#### Table 2: `ttn_deprovision_run_steps`
```text
id               uuid PK default gen_random_uuid()
run_id           uuid NOT NULL FK -> ttn_deprovision_runs(id) CASCADE
step_name        text NOT NULL
target_type      text NULL  -- device/application/organization/dev_eui/db
target_id        text NULL
attempt          int NOT NULL default 1
status           text NOT NULL default 'PENDING'  -- PENDING/RUNNING/OK/ERROR/SKIPPED
http_status      int NULL
ttn_endpoint     text NULL
response_snippet text NULL  -- max 400 chars
started_at       timestamptz NULL
finished_at      timestamptz NULL
meta             jsonb NOT NULL default '{}'
created_at       timestamptz NOT NULL default now()
```

#### Indexes & RLS
- Index on `(organization_id, created_at DESC)`
- Index on `(status, created_at DESC)`
- Index on `(run_id, created_at ASC)` for steps
- RLS enabled with `USING (false)` to deny direct access (service role bypasses)
- Trigger for auto-updating `updated_at`

### B) New Edge Function: `ttn-deprovision-jobs`

**File:** `supabase/functions/ttn-deprovision-jobs/index.ts`

Endpoints:
- `GET ?organization_id=X&status=RUNNING&limit=50` → List jobs
- `GET ?job_id=X` → Get job + steps detail

Response format:
```json
{
  "success": true,
  "version": "ttn-deprovision-jobs-v1.0-20260124",
  "jobs": [...],  // or "job": {...}, "steps": [...]
  "request_id": "abc123"
}
```

Uses service role key internally, validates caller has org access via JWT.

### C) Update `ttn-deprovision` Edge Function

**File:** `supabase/functions/ttn-deprovision/index.ts`

Key changes:

#### 1. Create Run at Start
```typescript
const { data: run } = await supabase
  .from("ttn_deprovision_runs")
  .insert({
    organization_id,
    status: "RUNNING",
    started_at: new Date().toISOString(),
    request_id: requestId,
    ttn_org_id: orgId,
    ttn_application_id: appId,
  })
  .select("id")
  .single();
const runId = run.id;
```

#### 2. Track Each Step
New helper function:
```typescript
async function recordStep(
  supabase, runId, stepName, targetType, targetId, 
  status, httpStatus?, endpoint?, snippet?, meta?
): Promise<void>
```

Called for every TTN API call:
- `list_devices` (with pagination meta)
- `delete_device_as`, `delete_device_ns`, `delete_device_js`, `delete_device_is`
- `purge_device` (CRITICAL)
- `verify_dev_eui` (CRITICAL)
- `delete_application`, `purge_application` (CRITICAL)
- `delete_organization`, `purge_organization` (CRITICAL)
- `clear_local_db`

#### 3. Determine Final Status

```typescript
const criticalSteps = steps.filter(s => 
  s.step_name.includes('purge_device') ||
  s.step_name.includes('verify_dev_eui') ||
  s.step_name === 'purge_application' ||
  s.step_name === 'purge_organization'
);

const failedCritical = criticalSteps.filter(s => s.status === 'ERROR');
const okCritical = criticalSteps.filter(s => s.status === 'OK' || s.status === 'SKIPPED');

let finalStatus: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
if (failedCritical.length === 0) {
  finalStatus = 'SUCCEEDED';
} else if (okCritical.length > 0) {
  finalStatus = 'PARTIAL';
} else {
  finalStatus = 'FAILED';
}
```

#### 4. Updated Response
```json
{
  "success": true,  // ONLY if status === 'SUCCEEDED'
  "job_id": "uuid",
  "status": "SUCCEEDED",
  "request_id": "abc123",
  "summary": {
    "devices_found": 5,
    "devices_deleted_ok": 5,
    "devices_purged_ok": 5,
    "euis_verified_ok": 5,
    "failed_euis": [],
    "released_euis": ["eui1", "eui2"],
    "app_purged": true,
    "org_purged": true,
    "db_cleared": true
  },
  "failed_euis": [],
  "released_euis": [...],
  "version": "ttn-deprovision-v2.0-tracked-20260124"
}
```

#### 5. Handle 404 Correctly
- DELETE returning 404 → step status `SKIPPED` (resource already gone)
- PURGE returning 404 → step status `SKIPPED`
- `verify_dev_eui` MUST confirm empty search result → `OK` only if truly released

#### 6. Pagination for Device List
```typescript
let pageToken: string | undefined;
do {
  const url = `/api/v3/applications/${appId}/devices?field_mask=ids&limit=100` +
    (pageToken ? `&page_token=${pageToken}` : '');
  const result = await ttnRequest(...);
  devices.push(...result.data.end_devices);
  pageToken = result.data.next_page_token;
  await recordStep(supabase, runId, 'list_devices', 'device', null, 'OK', 
    result.status, url, null, { page: pageNum++, count: result.data.end_devices.length });
} while (pageToken);
```

### D) Version Constants

| Function | Version |
|----------|---------|
| `ttn-deprovision` | `ttn-deprovision-v2.0-tracked-20260124` |
| `ttn-deprovision-jobs` | `ttn-deprovision-jobs-v1.0-20260124` |

### E) Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/20260124100000_ttn_deprovision_run_tracking.sql` | CREATE |
| `supabase/functions/ttn-deprovision-jobs/index.ts` | CREATE |
| `supabase/functions/ttn-deprovision/index.ts` | MODIFY |

### F) Deployment Commands

```bash
# 1. Apply migration
supabase db push

# 2. Deploy functions
supabase functions deploy ttn-deprovision
supabase functions deploy ttn-deprovision-jobs
```

### G) Verification Commands

```bash
# List last 50 runs
curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-deprovision-jobs?limit=50" \
  -H "Authorization: Bearer <token>"

# List pending/running runs
curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-deprovision-jobs?status=RUNNING,QUEUED" \
  -H "Authorization: Bearer <token>"

# Get job detail with steps
curl -X GET "https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-deprovision-jobs?job_id=<uuid>" \
  -H "Authorization: Bearer <token>"
```

### H) Critical Bug Fixes

1. **404 ≠ Success for verify_dev_eui**: The verify step must actively confirm the DevEUI is no longer registered (empty search result), not just accept 404
2. **success=true only when status=SUCCEEDED**: The response `success` field is derived from job status, not assumed
3. **db_cleared only on success OR force**: Database clearing happens only when all critical steps pass (or force=true)

### I) Summary Table

| Step Name | Target Type | Critical? | Description |
|-----------|-------------|-----------|-------------|
| list_devices | device | No | Fetch all devices (paginated) |
| delete_device_as | device | No | Delete from Application Server |
| delete_device_ns | device | No | Delete from Network Server |
| delete_device_js | device | No | Delete from Join Server |
| delete_device_is | device | No | Delete from Identity Server |
| purge_device | device | **YES** | Hard delete (releases DevEUI) |
| verify_dev_eui | dev_eui | **YES** | Confirm EUI is released |
| delete_application | application | No | Delete application |
| purge_application | application | **YES** | Hard delete application |
| delete_organization | organization | No | Delete organization |
| purge_organization | organization | **YES** | Hard delete organization |
| clear_local_db | db | No | Clear local connection settings |
