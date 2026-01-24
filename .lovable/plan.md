

# Fix TTN 403 Error Handling for Failed Provisioning States

## Problem Analysis

The user sees "Diagnostics Failed - Edge Function returned a non-2xx status code" with a cryptic 403 error when clicking "Check Failed" on a sensor. 

**Root Cause:** The organization's TTN provisioning previously failed (`provisioning_status: "failed"`, `provisioning_error: "Failed to create application API key: 403"`). The stored API key doesn't have rights for the TTN application `fg-7873654e-fz`.

**Key Finding:** The dual-endpoint architecture is working correctly - logs confirm calls are correctly routed to EU1 (Identity Server). This is purely a configuration/permissions issue.

---

## Solution Overview

Improve error messaging and user guidance when TTN API returns 403 due to failed/incomplete provisioning.

---

## Phase 1: Enhance check-ttn-device-exists Error Handling

**File:** `supabase/functions/check-ttn-device-exists/index.ts`

When a 403 error is returned from TTN, check the `provisioning_status` in the database and provide contextual error messages:

```typescript
// After catching TTN 403 error, check provisioning status
if (listResponse.status === 403) {
  const errorBody = await listResponse.text();
  
  // Check if this is an API key rights issue
  if (errorBody.includes("no_application_rights")) {
    // Query provisioning_status for this org
    const { data: connStatus } = await supabase
      .from("ttn_connections")
      .select("provisioning_status, provisioning_error")
      .eq("organization_id", orgId)
      .single();
    
    if (connStatus?.provisioning_status === "failed") {
      listError = `TTN provisioning failed: ${connStatus.provisioning_error || "Unknown error"}. Go to Settings → Developer → TTN Connection to retry provisioning.`;
    } else {
      listError = `API key lacks rights for application '${config.application_id}'. This may indicate a stale or orphaned API key. Try re-provisioning in Settings → Developer → TTN Connection.`;
    }
  } else {
    listError = `TTN API error 403: ${errorBody.substring(0, 200)}`;
  }
}
```

---

## Phase 2: Enhance TtnDiagnoseModal with Actionable Guidance

**File:** `src/components/settings/TtnDiagnoseModal.tsx`

Add detection for 403/provisioning errors and show a clear call-to-action:

1. Parse the error message for `no_application_rights` pattern
2. Show a specific error state with guidance
3. Add a "Go to TTN Settings" button that navigates to the Developer tab

```typescript
// Add to TtnDiagnoseModal component
const isProvisioningError = result?.error?.includes("no_application_rights") || 
                            result?.error?.includes("provisioning failed");

// In the error display section, add:
{isProvisioningError && (
  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
      TTN Configuration Issue Detected
    </p>
    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
      Your organization's TTN connection may need to be re-provisioned. 
      The stored API key doesn't have access to the TTN application.
    </p>
    <Button 
      variant="outline" 
      size="sm" 
      className="mt-2"
      onClick={() => {
        onOpenChange(false);
        // Navigate to Settings → Developer tab
        window.location.href = `/settings?tab=developer`;
      }}
    >
      Go to TTN Settings
    </Button>
  </div>
)}
```

---

## Phase 3: Enhance diagnose Action in ttn-provision-device

**File:** `supabase/functions/ttn-provision-device/index.ts`

When the app probe returns 403, provide more context about the failure:

1. Add provisioning status check before returning error
2. Include actionable hints in the response

```typescript
// In diagnose action, after appProbe fails with 403:
if (!appProbe.ok && appProbe.status === 403) {
  const errorText = await appProbe.text();
  
  // Check if this is a rights issue
  if (errorText.includes("no_application_rights")) {
    // Fetch provisioning status
    const { data: connStatus } = await supabase
      .from("ttn_connections")
      .select("provisioning_status, provisioning_error")
      .eq("organization_id", organization_id)
      .single();
    
    const isProvisioningFailed = connStatus?.provisioning_status === "failed";
    
    return new Response(JSON.stringify({
      success: false,
      error: isProvisioningFailed 
        ? `TTN provisioning incomplete: ${connStatus?.provisioning_error || "API key creation failed"}`
        : "API key lacks rights for this application",
      hint: "Go to Settings → Developer → TTN Connection and click 'Retry Provisioning' or 'Start Fresh' to get a valid API key.",
      provisioningStatus: connStatus?.provisioning_status,
      clusterBaseUrl,
      region: ttnConfig.region,
      appId: ttnAppId,
      deviceId,
      checks: { appProbe: { ok: false, status: 403, error: errorText.substring(0, 200) } },
      diagnosis: "api_key_invalid",
      diagnosedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
```

---

## Phase 4: Add Provisioning Status Badge to Sensor Table

**File:** `src/components/settings/TtnProvisioningStatusBadge.tsx`

When clicking "Check Failed", show context about the organization's TTN status:

1. Query `ttn_connections.provisioning_status` 
2. Show warning if status is "failed" or "pending"
3. Guide users to fix the root cause before trying to check sensors

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/check-ttn-device-exists/index.ts` | Add provisioning status check on 403, improve error messages |
| `supabase/functions/ttn-provision-device/index.ts` | Enhance diagnose action 403 handling |
| `src/components/settings/TtnDiagnoseModal.tsx` | Add provisioning error detection and "Go to Settings" button |
| `src/hooks/useCheckTtnProvisioningState.ts` | Include provisioning status in error context |

---

## Expected Outcome

When a user clicks "Check Failed" on a sensor with a failed TTN provisioning state:

**Before (current):**
> ❌ Diagnostics Failed
> Edge Function returned a non-2xx status code

**After (improved):**
> ⚠️ TTN Configuration Issue Detected
> 
> Your organization's TTN provisioning failed during API key creation. 
> The stored API key doesn't have access to the TTN application.
>
> [Go to TTN Settings] [Retry]

---

## Technical Notes

- The dual-endpoint architecture (EU1 for IS, NAM1 for data planes) is working correctly
- The issue is purely a configuration problem with stale/invalid API keys
- No changes needed to the routing logic - only error handling and UX improvements

