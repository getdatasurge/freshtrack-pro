/**
 * TTN Deprovision Edge Function v2.0
 *
 * Comprehensive deprovisioning of TTN resources for an organization.
 * NOW WITH FULL JOB TRACKING - every step is recorded for audit.
 *
 * Properly cleans up in the correct order to prevent orphaned DevEUIs:
 * 1. Delete + Purge all end devices (releases DevEUIs)
 * 2. Verify each DevEUI is released
 * 3. Delete + Purge application
 * 4. Delete + Purge organization
 * 5. Clear local DB records
 *
 * CRITICAL: success=true ONLY when ALL critical steps succeed.
 *
 * Uses single-cluster architecture (2026-01-24 fix):
 * - ALL operations use NAM1 - no cross-cluster mixing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  IDENTITY_SERVER_URL,
  CLUSTER_BASE_URL,
  logTtnApiCallWithCred
} from "../_shared/ttnBase.ts";
import { deobfuscateKey } from "../_shared/ttnConfig.ts";

const BUILD_VERSION = "ttn-deprovision-v2.0-tracked-20260124";

// ============================================================================
// Types
// ============================================================================

type StepStatus = "PENDING" | "RUNNING" | "OK" | "ERROR" | "SKIPPED";
type TargetType = "device" | "application" | "organization" | "dev_eui" | "db";
type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL";

interface TtnDevice {
  ids?: {
    device_id?: string;
    dev_eui?: string;
    application_ids?: {
      application_id?: string;
    };
  };
}

interface StepRecord {
  step_name: string;
  target_type: TargetType | null;
  target_id: string | null;
  status: StepStatus;
  http_status?: number;
  ttn_endpoint?: string;
  response_snippet?: string;
  meta?: Record<string, unknown>;
  is_critical: boolean;
}

interface RunSummary {
  devices_found: number;
  devices_deleted_ok: number;
  devices_purged_ok: number;
  euis_verified_ok: number;
  failed_euis: string[];
  released_euis: string[];
  app_purged: boolean;
  org_purged: boolean;
  db_cleared: boolean;
}

// ============================================================================
// Step Recording Helper
// ============================================================================

/**
 * Record a step in the database
 */
async function recordStep(
  supabase: SupabaseClient,
  runId: string,
  stepName: string,
  targetType: TargetType | null,
  targetId: string | null,
  status: StepStatus,
  httpStatus?: number,
  endpoint?: string,
  snippet?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  
  // Trim snippet to 400 chars max
  const trimmedSnippet = snippet ? snippet.slice(0, 400) : null;
  
  const { error } = await supabase
    .from("ttn_deprovision_run_steps")
    .insert({
      run_id: runId,
      step_name: stepName,
      target_type: targetType,
      target_id: targetId,
      status,
      http_status: httpStatus ?? null,
      ttn_endpoint: endpoint ?? null,
      response_snippet: trimmedSnippet,
      started_at: now,
      finished_at: now,
      meta: meta ?? {},
    });

  if (error) {
    console.warn(`[Deprovision] Failed to record step ${stepName}:`, error.message);
  }
}

// ============================================================================
// TTN API Helper
// ============================================================================

/**
 * Make a TTN API request with proper logging
 */
async function ttnRequest(
  baseUrl: string,
  endpoint: string,
  method: string,
  apiKey: string,
  requestId: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; rawText?: string }> {
  const url = `${baseUrl}${endpoint}`;
  const apiKeyLast4 = apiKey.slice(-4);

  logTtnApiCallWithCred(
    "ttn-deprovision",
    method,
    endpoint,
    "deprovision",
    requestId,
    apiKeyLast4
  );

  console.log(`[TTN] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `FrostGuard/${BUILD_VERSION}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText.slice(0, 200) };
    }
    
    console.log(`[TTN] Response: ${response.status}`, rawText.slice(0, 200));

    return { ok: response.ok, status: response.status, data, rawText };
  } catch (err) {
    console.error(`[TTN] Network error:`, err);
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : "Network error" }
    };
  }
}

// ============================================================================
// Device Operations with Step Tracking
// ============================================================================

/**
 * Delete and purge a single device from TTN, recording each step
 */
async function deleteAndPurgeDeviceTracked(
  supabase: SupabaseClient,
  runId: string,
  appId: string,
  deviceId: string,
  apiKey: string,
  requestId: string,
  steps: StepRecord[]
): Promise<boolean> {
  console.log(`[Deprovision] Deleting device: ${appId}/${deviceId}`);

  // Step 1: Delete from Application Server (NAM1)
  const asEndpoint = `/api/v3/as/applications/${appId}/devices/${deviceId}`;
  const asResult = await ttnRequest(CLUSTER_BASE_URL, asEndpoint, "DELETE", apiKey, requestId);
  const asStatus: StepStatus = asResult.ok || asResult.status === 404 ? "OK" : "ERROR";
  await recordStep(supabase, runId, "delete_device_as", "device", deviceId, asStatus, asResult.status, asEndpoint, JSON.stringify(asResult.data).slice(0, 400));
  steps.push({ step_name: "delete_device_as", target_type: "device", target_id: deviceId, status: asStatus, http_status: asResult.status, is_critical: false });

  // Step 2: Delete from Network Server (NAM1)
  const nsEndpoint = `/api/v3/ns/applications/${appId}/devices/${deviceId}`;
  const nsResult = await ttnRequest(CLUSTER_BASE_URL, nsEndpoint, "DELETE", apiKey, requestId);
  const nsStatus: StepStatus = nsResult.ok || nsResult.status === 404 ? "OK" : "ERROR";
  await recordStep(supabase, runId, "delete_device_ns", "device", deviceId, nsStatus, nsResult.status, nsEndpoint, JSON.stringify(nsResult.data).slice(0, 400));
  steps.push({ step_name: "delete_device_ns", target_type: "device", target_id: deviceId, status: nsStatus, http_status: nsResult.status, is_critical: false });

  // Step 3: Delete from Join Server (NAM1)
  const jsEndpoint = `/api/v3/js/applications/${appId}/devices/${deviceId}`;
  const jsResult = await ttnRequest(CLUSTER_BASE_URL, jsEndpoint, "DELETE", apiKey, requestId);
  const jsStatus: StepStatus = jsResult.ok || jsResult.status === 404 ? "OK" : "ERROR";
  await recordStep(supabase, runId, "delete_device_js", "device", deviceId, jsStatus, jsResult.status, jsEndpoint, JSON.stringify(jsResult.data).slice(0, 400));
  steps.push({ step_name: "delete_device_js", target_type: "device", target_id: deviceId, status: jsStatus, http_status: jsResult.status, is_critical: false });

  // Step 4: Delete from Identity Server (NAM1 - single cluster)
  const isEndpoint = `/api/v3/applications/${appId}/devices/${deviceId}`;
  const deleteResult = await ttnRequest(IDENTITY_SERVER_URL, isEndpoint, "DELETE", apiKey, requestId);
  const isStatus: StepStatus = deleteResult.ok || deleteResult.status === 404 ? "OK" : "ERROR";
  await recordStep(supabase, runId, "delete_device_is", "device", deviceId, isStatus, deleteResult.status, isEndpoint, JSON.stringify(deleteResult.data).slice(0, 400));
  steps.push({ step_name: "delete_device_is", target_type: "device", target_id: deviceId, status: isStatus, http_status: deleteResult.status, is_critical: false });

  // Step 5: Purge from Identity Server (CRITICAL - hard delete releases DevEUI)
  const purgeEndpoint = `/api/v3/applications/${appId}/devices/${deviceId}/purge`;
  const purgeResult = await ttnRequest(IDENTITY_SERVER_URL, purgeEndpoint, "DELETE", apiKey, requestId);
  
  // 404 on purge is acceptable - means already gone
  let purgeStatus: StepStatus;
  if (purgeResult.ok) {
    purgeStatus = "OK";
  } else if (purgeResult.status === 404) {
    purgeStatus = "SKIPPED"; // Already gone
  } else {
    purgeStatus = "ERROR";
  }
  
  await recordStep(supabase, runId, "purge_device", "device", deviceId, purgeStatus, purgeResult.status, purgeEndpoint, JSON.stringify(purgeResult.data).slice(0, 400));
  steps.push({ step_name: "purge_device", target_type: "device", target_id: deviceId, status: purgeStatus, http_status: purgeResult.status, is_critical: true });

  console.log(`[Deprovision] Device ${deviceId} purge status: ${purgeStatus}`);
  return purgeStatus === "OK" || purgeStatus === "SKIPPED";
}

/**
 * Verify that a DevEUI has been released from TTN (CRITICAL step)
 */
async function verifyDevEuiReleasedTracked(
  supabase: SupabaseClient,
  runId: string,
  devEui: string,
  apiKey: string,
  requestId: string,
  steps: StepRecord[]
): Promise<boolean> {
  console.log(`[Deprovision] Verifying DevEUI released: ${devEui}`);

  // Small delay to let TTN propagate the delete
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Search on Identity Server to verify the EUI is truly released
  const searchEndpoint = `/api/v3/end_devices?dev_eui=${devEui}&field_mask=ids`;
  const searchResult = await ttnRequest(IDENTITY_SERVER_URL, searchEndpoint, "GET", apiKey, requestId);

  let verifyStatus: StepStatus;
  let released = false;

  if (searchResult.status === 404) {
    // 404 on search means EUI not found = released
    verifyStatus = "OK";
    released = true;
  } else if (searchResult.ok) {
    // Check if empty results
    const devices = (searchResult.data as { end_devices?: TtnDevice[] })?.end_devices;
    if (!devices || devices.length === 0) {
      verifyStatus = "OK";
      released = true;
    } else {
      // EUI still registered - this is an ERROR for verification
      verifyStatus = "ERROR";
      console.log(`[Deprovision] WARNING: DevEUI ${devEui} still registered!`);
    }
  } else {
    // API error
    verifyStatus = "ERROR";
  }

  await recordStep(
    supabase, runId, "verify_dev_eui", "dev_eui", devEui, verifyStatus,
    searchResult.status, searchEndpoint,
    JSON.stringify(searchResult.data).slice(0, 400),
    { devices_found: (searchResult.data as { end_devices?: TtnDevice[] })?.end_devices?.length ?? 0 }
  );
  steps.push({ step_name: "verify_dev_eui", target_type: "dev_eui", target_id: devEui, status: verifyStatus, http_status: searchResult.status, is_critical: true });

  return released;
}

// ============================================================================
// Application & Organization Operations
// ============================================================================

/**
 * Delete and purge a TTN application (purge is CRITICAL)
 */
async function deleteAndPurgeApplicationTracked(
  supabase: SupabaseClient,
  runId: string,
  appId: string,
  apiKey: string,
  requestId: string,
  steps: StepRecord[]
): Promise<boolean> {
  console.log(`[Deprovision] Deleting application: ${appId}`);

  // Delete application from Identity Server
  const deleteEndpoint = `/api/v3/applications/${appId}`;
  const deleteResult = await ttnRequest(IDENTITY_SERVER_URL, deleteEndpoint, "DELETE", apiKey, requestId);
  const deleteStatus: StepStatus = deleteResult.ok || deleteResult.status === 404 ? "OK" : "ERROR";
  await recordStep(supabase, runId, "delete_application", "application", appId, deleteStatus, deleteResult.status, deleteEndpoint, JSON.stringify(deleteResult.data).slice(0, 400));
  steps.push({ step_name: "delete_application", target_type: "application", target_id: appId, status: deleteStatus, http_status: deleteResult.status, is_critical: false });

  // Purge application from Identity Server (CRITICAL)
  const purgeEndpoint = `/api/v3/applications/${appId}/purge`;
  const purgeResult = await ttnRequest(IDENTITY_SERVER_URL, purgeEndpoint, "DELETE", apiKey, requestId);
  
  let purgeStatus: StepStatus;
  if (purgeResult.ok) {
    purgeStatus = "OK";
  } else if (purgeResult.status === 404) {
    purgeStatus = "SKIPPED"; // Already gone
  } else {
    purgeStatus = "ERROR";
  }
  
  await recordStep(supabase, runId, "purge_application", "application", appId, purgeStatus, purgeResult.status, purgeEndpoint, JSON.stringify(purgeResult.data).slice(0, 400));
  steps.push({ step_name: "purge_application", target_type: "application", target_id: appId, status: purgeStatus, http_status: purgeResult.status, is_critical: true });

  console.log(`[Deprovision] Application ${appId} purge status: ${purgeStatus}`);
  return purgeStatus === "OK" || purgeStatus === "SKIPPED";
}

/**
 * Delete and purge a TTN organization (purge is CRITICAL)
 */
async function deleteAndPurgeOrganizationTracked(
  supabase: SupabaseClient,
  runId: string,
  orgId: string,
  apiKey: string,
  requestId: string,
  steps: StepRecord[]
): Promise<boolean> {
  console.log(`[Deprovision] Deleting organization: ${orgId}`);

  // Delete organization from Identity Server
  const deleteEndpoint = `/api/v3/organizations/${orgId}`;
  const deleteResult = await ttnRequest(IDENTITY_SERVER_URL, deleteEndpoint, "DELETE", apiKey, requestId);
  const deleteStatus: StepStatus = deleteResult.ok || deleteResult.status === 404 ? "OK" : "ERROR";
  await recordStep(supabase, runId, "delete_organization", "organization", orgId, deleteStatus, deleteResult.status, deleteEndpoint, JSON.stringify(deleteResult.data).slice(0, 400));
  steps.push({ step_name: "delete_organization", target_type: "organization", target_id: orgId, status: deleteStatus, http_status: deleteResult.status, is_critical: false });

  // Purge organization from Identity Server (CRITICAL)
  const purgeEndpoint = `/api/v3/organizations/${orgId}/purge`;
  const purgeResult = await ttnRequest(IDENTITY_SERVER_URL, purgeEndpoint, "DELETE", apiKey, requestId);
  
  let purgeStatus: StepStatus;
  if (purgeResult.ok) {
    purgeStatus = "OK";
  } else if (purgeResult.status === 404) {
    purgeStatus = "SKIPPED"; // Already gone
  } else {
    purgeStatus = "ERROR";
  }
  
  await recordStep(supabase, runId, "purge_organization", "organization", orgId, purgeStatus, purgeResult.status, purgeEndpoint, JSON.stringify(purgeResult.data).slice(0, 400));
  steps.push({ step_name: "purge_organization", target_type: "organization", target_id: orgId, status: purgeStatus, http_status: purgeResult.status, is_critical: true });

  console.log(`[Deprovision] Organization ${orgId} purge status: ${purgeStatus}`);
  return purgeStatus === "OK" || purgeStatus === "SKIPPED";
}

// ============================================================================
// Status Derivation
// ============================================================================

/**
 * Derive final run status from step outcomes
 * CRITICAL: success=true ONLY if ALL critical steps succeeded
 */
function deriveRunStatus(steps: StepRecord[]): RunStatus {
  const criticalSteps = steps.filter(s => s.is_critical);
  
  if (criticalSteps.length === 0) {
    // No critical steps means nothing was done (e.g., no devices found)
    return "SUCCEEDED";
  }
  
  const failedCritical = criticalSteps.filter(s => s.status === "ERROR");
  const okCritical = criticalSteps.filter(s => s.status === "OK" || s.status === "SKIPPED");
  
  if (failedCritical.length === 0) {
    return "SUCCEEDED";
  } else if (okCritical.length > 0) {
    // Some succeeded, some failed
    return "PARTIAL";
  } else {
    return "FAILED";
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[ttn-deprovision] ${BUILD_VERSION} - Request ${requestId} received`);

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      status: "healthy",
      function: "ttn-deprovision",
      version: BUILD_VERSION,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  let runId: string | null = null;
  let supabase: SupabaseClient | null = null;

  try {
    const { organization_id, force } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({
        success: false,
        error: "organization_id is required",
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSalt = Deno.env.get("TTN_ENCRYPTION_SALT") ||
      supabaseServiceKey.slice(0, 32);

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get TTN config for this org from ttn_connections
    const { data: ttnConnection, error: configError } = await supabase
      .from("ttn_connections")
      .select("*")
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (configError) {
      console.error(`[Deprovision] Error fetching TTN config:`, configError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${configError.message}`,
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    if (!ttnConnection) {
      console.log(`[Deprovision] No TTN config found for org ${organization_id}`);
      return new Response(JSON.stringify({
        success: true,
        message: "No TTN config found - nothing to deprovision",
        version: BUILD_VERSION
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appId = ttnConnection.ttn_application_id;
    const orgId = ttnConnection.ttn_organization_id;

    // ========================================================================
    // CREATE RUN RECORD
    // ========================================================================
    const { data: runData, error: runError } = await supabase
      .from("ttn_deprovision_runs")
      .insert({
        organization_id,
        status: "RUNNING",
        started_at: new Date().toISOString(),
        request_id: requestId,
        ttn_region: "nam1",
        ttn_org_id: orgId,
        ttn_application_id: appId,
        source: "edge_function",
        action: "deprovision",
      })
      .select("id")
      .single();

    if (runError || !runData) {
      console.error(`[Deprovision] Failed to create run record:`, runError);
      // Continue anyway - tracking failure shouldn't block deprovision
    } else {
      runId = runData.id;
      console.log(`[Deprovision] Created run ${runId}`);
    }

    // Decrypt API key - prefer org API key, fallback to app API key
    const encryptedKey = ttnConnection.ttn_org_api_key_encrypted ||
                        ttnConnection.ttn_api_key_encrypted;

    if (!encryptedKey) {
      console.log(`[Deprovision] No API key found for org ${organization_id}`);
      
      // Update run status
      if (runId && supabase) {
        await supabase.from("ttn_deprovision_runs").update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error: "No API key available for deprovisioning",
        }).eq("id", runId);
      }
      
      return new Response(JSON.stringify({
        success: false,
        job_id: runId,
        status: "FAILED",
        error: "No API key available for deprovisioning",
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const apiKey = deobfuscateKey(encryptedKey, encryptionSalt);

    if (!apiKey) {
      if (runId && supabase) {
        await supabase.from("ttn_deprovision_runs").update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error: "Failed to decrypt API key",
        }).eq("id", runId);
      }
      
      return new Response(JSON.stringify({
        success: false,
        job_id: runId,
        status: "FAILED",
        error: "Failed to decrypt API key",
        version: BUILD_VERSION
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // ========================================================================
    // DEPROVISION PROCESS WITH STEP TRACKING
    // ========================================================================
    const steps: StepRecord[] = [];
    const summary: RunSummary = {
      devices_found: 0,
      devices_deleted_ok: 0,
      devices_purged_ok: 0,
      euis_verified_ok: 0,
      failed_euis: [],
      released_euis: [],
      app_purged: false,
      org_purged: false,
      db_cleared: false,
    };

    // STEP 1: Get all devices in the application (with pagination)
    const allDevices: TtnDevice[] = [];
    
    if (appId && runId) {
      console.log(`[Deprovision] Fetching devices for app: ${appId}`);
      
      let pageToken: string | undefined;
      let pageNum = 1;
      
      do {
        const listEndpoint = `/api/v3/applications/${appId}/devices?field_mask=ids&limit=100` +
          (pageToken ? `&page_token=${pageToken}` : "");
        
        const devicesResult = await ttnRequest(IDENTITY_SERVER_URL, listEndpoint, "GET", apiKey, requestId);
        
        const listStatus: StepStatus = devicesResult.ok ? "OK" : "ERROR";
        const pageDevices = ((devicesResult.data as { end_devices?: TtnDevice[] })?.end_devices || []);
        const nextPageToken = (devicesResult.data as { next_page_token?: string })?.next_page_token;
        
        await recordStep(
          supabase!, runId, "list_devices", "device", null, listStatus,
          devicesResult.status, listEndpoint,
          JSON.stringify(devicesResult.data).slice(0, 400),
          { page: pageNum, count: pageDevices.length, has_more: !!nextPageToken }
        );
        steps.push({ step_name: "list_devices", target_type: "device", target_id: null, status: listStatus, http_status: devicesResult.status, is_critical: false });
        
        allDevices.push(...pageDevices);
        pageToken = nextPageToken;
        pageNum++;
        
        // Safety limit - max 10 pages (1000 devices)
        if (pageNum > 10) {
          console.warn(`[Deprovision] Hit pagination limit at ${allDevices.length} devices`);
          break;
        }
      } while (pageToken);
      
      summary.devices_found = allDevices.length;
      console.log(`[Deprovision] Found ${allDevices.length} devices to clean up`);

      // STEP 2: Delete + Purge each device
      for (const device of allDevices) {
        const deviceId = device.ids?.device_id;
        const devEui = device.ids?.dev_eui;

        if (deviceId) {
          const purgeOk = await deleteAndPurgeDeviceTracked(supabase!, runId, appId, deviceId, apiKey, requestId, steps);
          
          if (purgeOk) {
            summary.devices_deleted_ok++;
            summary.devices_purged_ok++;
          }

          // STEP 3: Verify DevEUI is released
          if (devEui) {
            const released = await verifyDevEuiReleasedTracked(supabase!, runId, devEui, apiKey, requestId, steps);
            if (released) {
              summary.released_euis.push(devEui);
              summary.euis_verified_ok++;
            } else {
              summary.failed_euis.push(devEui);
            }
          }
        }
      }

      // STEP 4: Delete + Purge application
      summary.app_purged = await deleteAndPurgeApplicationTracked(supabase!, runId, appId, apiKey, requestId, steps);
    }

    // STEP 5: Delete + Purge organization (if exists)
    if (orgId && runId) {
      summary.org_purged = await deleteAndPurgeOrganizationTracked(supabase!, runId, orgId, apiKey, requestId, steps);
    }

    // ========================================================================
    // DETERMINE FINAL STATUS
    // ========================================================================
    const finalStatus = deriveRunStatus(steps);
    const allSuccess = finalStatus === "SUCCEEDED";

    // STEP 6: Clear local DB (only if all success OR force=true)
    if ((allSuccess || force) && runId) {
      console.log(`[Deprovision] Clearing local TTN connection settings`);

      const { error: updateError } = await supabase!
        .from("ttn_connections")
        .update({
          ttn_api_key_encrypted: null,
          ttn_api_key_last4: null,
          ttn_api_key_id: null,
          ttn_org_api_key_encrypted: null,
          ttn_org_api_key_last4: null,
          ttn_org_api_key_id: null,
          ttn_application_id: null,
          ttn_application_name: null,
          ttn_organization_id: null,
          ttn_organization_name: null,
          ttn_webhook_secret_encrypted: null,
          ttn_webhook_secret_last4: null,
          ttn_webhook_url: null,
          provisioning_status: "deprovisioned",
          provisioning_error: null,
          ttn_application_provisioned_at: null,
          is_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id);

      if (updateError) {
        console.error(`[Deprovision] Failed to clear ttn_connections:`, updateError);
        await recordStep(supabase!, runId, "clear_local_db", "db", organization_id, "ERROR", undefined, undefined, updateError.message);
        steps.push({ step_name: "clear_local_db", target_type: "db", target_id: organization_id, status: "ERROR", is_critical: false });
      } else {
        summary.db_cleared = true;
        await recordStep(supabase!, runId, "clear_local_db", "db", organization_id, "OK");
        steps.push({ step_name: "clear_local_db", target_type: "db", target_id: organization_id, status: "OK", is_critical: false });
      }

      // Also clear any device records that reference this org's TTN app
      const { error: sensorsError } = await supabase!
        .from("sensors")
        .update({
          ttn_device_id: null,
          provisioned_at: null,
        })
        .eq("organization_id", organization_id);

      if (sensorsError) {
        console.warn(`[Deprovision] Failed to clear sensor TTN references:`, sensorsError);
      }
    }

    // ========================================================================
    // UPDATE RUN RECORD WITH FINAL STATUS
    // ========================================================================
    if (runId && supabase) {
      await supabase.from("ttn_deprovision_runs").update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        summary: summary as unknown as Record<string, unknown>,
        error: finalStatus === "FAILED" ? `${summary.failed_euis.length} EUIs failed to release` : null,
      }).eq("id", runId);
    }

    // ========================================================================
    // RESPONSE
    // ========================================================================
    const response = {
      success: allSuccess, // TRUE ONLY IF SUCCEEDED
      job_id: runId,
      status: finalStatus,
      request_id: requestId,
      summary,
      failed_euis: summary.failed_euis,
      released_euis: summary.released_euis,
      version: BUILD_VERSION
    };

    console.log(`[Deprovision] Complete - Status: ${finalStatus}`, JSON.stringify(summary));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[Deprovision] Error:`, error);
    
    // Update run record if we have one
    if (runId && supabase) {
      await supabase.from("ttn_deprovision_runs").update({
        status: "FAILED",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      }).eq("id", runId);
    }
    
    return new Response(JSON.stringify({
      success: false,
      job_id: runId,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown error",
      version: BUILD_VERSION
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
