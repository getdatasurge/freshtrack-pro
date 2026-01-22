import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg } from "../_shared/ttnConfig.ts";
import { TTN_BASE_URL, assertNam1Only } from "../_shared/ttnBase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Exponential backoff delays in minutes: 1, 5, 15, 60, 240
const RETRY_DELAYS = [1, 5, 15, 60, 240];

interface DeprovisionJob {
  id: string;
  organization_id: string;
  sensor_id: string | null;
  dev_eui: string;
  ttn_device_id: string | null;
  ttn_application_id: string;
  reason: string;
  status: string;
  attempts: number;
  max_attempts: number;
  sensor_name: string | null;
  site_id: string | null;
  unit_id: string | null;
}

interface ErrorClassification {
  error_code: string;
  error_message: string;
  should_retry: boolean;
  should_block: boolean;
}

function classifyError(status: number, errorText: string): ErrorClassification {
  try {
    const parsed = JSON.parse(errorText);
    const message = parsed.message || parsed.error || errorText;
    
    if (status === 403) {
      return {
        error_code: "RIGHTS_ERROR",
        error_message: `Permission denied: ${message}. The TTN API key may lack device delete rights.`,
        should_retry: false,
        should_block: true,
      };
    }
    
    if (status === 404) {
      return {
        error_code: "NOT_FOUND",
        error_message: "Device already deleted from TTN or never existed.",
        should_retry: false,
        should_block: false,
      };
    }
    
    if (status === 429) {
      return {
        error_code: "RATE_LIMIT",
        error_message: "TTN rate limit exceeded. Will retry later.",
        should_retry: true,
        should_block: false,
      };
    }
    
    // Check for cluster mismatch
    if (message.includes("cluster") || message.includes("server address") || 
        message.includes("not found on this tenant")) {
      return {
        error_code: "OTHER_CLUSTER",
        error_message: `Device registered on different cluster: ${message}`,
        should_retry: false,
        should_block: true,
      };
    }
    
    return {
      error_code: "UNKNOWN",
      error_message: message,
      should_retry: true,
      should_block: false,
    };
  } catch {
    return {
      error_code: "UNKNOWN",
      error_message: errorText || "Unknown error",
      should_retry: true,
      should_block: false,
    };
  }
}

// deno-lint-ignore no-explicit-any
async function logEvent(
  supabase: any,
  eventType: string,
  job: DeprovisionJob,
  success: boolean,
  errorCode?: string,
  errorMessage?: string
) {
  const severity = success ? "success" : (errorCode === "BLOCKED" ? "critical" : "warning");
  
  try {
    await supabase.from("event_logs").insert({
      event_type: `ttn.deprovision.${eventType}`,
      category: "system",
      severity,
      title: success 
        ? `TTN device de-provisioned: ${job.sensor_name || job.dev_eui}`
        : `TTN de-provision ${eventType}: ${job.sensor_name || job.dev_eui}`,
      organization_id: job.organization_id,
      site_id: job.site_id,
      unit_id: job.unit_id,
      actor_type: "system",
      event_data: {
        job_id: job.id,
        dev_eui: job.dev_eui,
        ttn_device_id: job.ttn_device_id,
        ttn_application_id: job.ttn_application_id,
        reason: job.reason,
        attempts: job.attempts,
        error_code: errorCode,
        error_message: errorMessage,
      },
    });
  } catch (e) {
    console.error("[ttn-deprovision-worker] Failed to log event:", e);
  }
}

/**
 * Try to delete a device from TTN using multi-endpoint fallback
 * CLUSTER-LOCKED: All endpoints use the same clusterBaseUrl (no EU1/NAM1 split)
 */
async function tryDeleteFromTtn(
  ttnConfig: { clusterBaseUrl: string; apiKey: string },
  targetAppId: string,
  deviceId: string
): Promise<{ success: boolean; alreadyDeleted: boolean; error?: string; statusCode?: number }> {
  const headers = {
    "Authorization": `Bearer ${ttnConfig.apiKey}`,
    "Content-Type": "application/json",
  };

  // CLUSTER-LOCKED: All endpoints use the SAME base URL
  // This prevents split-brain deletion where some planes are on different clusters
  const baseUrl = ttnConfig.clusterBaseUrl;
  
  // NAM1-ONLY: Fail-closed guard - reject non-NAM1 base URLs
  assertNam1Only(baseUrl);
  console.log(`[ttn-deprovision-worker] Cluster locked to NAM1: ${baseUrl}`);
  
  const endpoints = [
    { name: "IS", url: `${baseUrl}/api/v3/applications/${targetAppId}/devices/${deviceId}` },
    { name: "NS", url: `${baseUrl}/api/v3/ns/applications/${targetAppId}/devices/${deviceId}` },
    { name: "AS", url: `${baseUrl}/api/v3/as/applications/${targetAppId}/devices/${deviceId}` },
    { name: "JS", url: `${baseUrl}/api/v3/js/applications/${targetAppId}/devices/${deviceId}` },
  ];

  let lastError = "";
  let lastStatusCode = 0;
  let successCount = 0;
  let notFoundCount = 0;

  for (const endpoint of endpoints) {
    try {
      console.log(`[ttn-deprovision-worker] DELETE ${endpoint.name}: ${endpoint.url}`);
      const response = await fetch(endpoint.url, { method: "DELETE", headers });
      
      if (response.ok) {
        console.log(`[ttn-deprovision-worker] ${endpoint.name} delete succeeded`);
        successCount++;
      } else if (response.status === 404) {
        console.log(`[ttn-deprovision-worker] ${endpoint.name} returned 404 (not found/already deleted)`);
        notFoundCount++;
      } else {
        const errorText = await response.text();
        console.log(`[ttn-deprovision-worker] ${endpoint.name} failed: ${response.status} - ${errorText}`);
        lastError = errorText;
        lastStatusCode = response.status;
        
        // If 403 permission error, don't try other endpoints - same key won't work
        if (response.status === 403) {
          return { success: false, alreadyDeleted: false, error: errorText, statusCode: 403 };
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.log(`[ttn-deprovision-worker] ${endpoint.name} error: ${errMsg}`);
      lastError = errMsg;
    }
  }

  // Success if we deleted from at least one endpoint or all returned 404
  if (successCount > 0) {
    return { success: true, alreadyDeleted: false };
  }
  
  if (notFoundCount === endpoints.length) {
    return { success: true, alreadyDeleted: true };
  }

  return { success: false, alreadyDeleted: false, error: lastError, statusCode: lastStatusCode };
}

serve(async (req) => {
  const BUILD_VERSION = "deprovision-worker-v4-multi-endpoint-20260115";
  console.log(`[ttn-deprovision-worker] Build: ${BUILD_VERSION}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch pending jobs
    const { data: jobs, error: fetchError } = await supabase
      .from("ttn_deprovision_jobs")
      .select("*")
      .in("status", ["PENDING", "RETRYING"])
      .or("next_retry_at.is.null,next_retry_at.lte.now()")
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[ttn-deprovision-worker] Failed to fetch jobs:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch jobs", details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log("[ttn-deprovision-worker] No pending jobs");
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending jobs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ttn-deprovision-worker] Processing ${jobs.length} jobs`);

    const results: Array<{ job_id: string; status: string; error?: string }> = [];

    for (const job of jobs as DeprovisionJob[]) {
      console.log(`[ttn-deprovision-worker] Processing job ${job.id}: ${job.dev_eui}`);
      
      // Mark as running
      await supabase
        .from("ttn_deprovision_jobs")
        .update({ 
          status: "RUNNING", 
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      // Get TTN config for this org (for the API key)
      const ttnConfig = await getTtnConfigForOrg(supabase, job.organization_id);

      if (!ttnConfig || !ttnConfig.apiKey) {
        // No API key - block the job
        await supabase
          .from("ttn_deprovision_jobs")
          .update({
            status: "BLOCKED",
            updated_at: new Date().toISOString(),
            last_error_code: "NO_API_KEY",
            last_error_message: "No TTN API key configured for this organization",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        await logEvent(supabase, "blocked", job, false, "NO_API_KEY", "No TTN API key configured");
        results.push({ job_id: job.id, status: "BLOCKED", error: "No API key" });
        continue;
      }

      // Build device ID if not stored
      const deviceId = job.ttn_device_id || `sensor-${job.dev_eui.toLowerCase()}`;
      
      // Use per-org application ID: prefer job's stored value, fallback to org config
      const targetAppId = job.ttn_application_id || ttnConfig.applicationId;
      
      if (!targetAppId) {
        // No application ID available - block the job
        await supabase
          .from("ttn_deprovision_jobs")
          .update({
            status: "BLOCKED",
            updated_at: new Date().toISOString(),
            last_error_code: "NO_APP_ID",
            last_error_message: "No TTN Application ID available for this sensor or organization",
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        await logEvent(supabase, "blocked", job, false, "NO_APP_ID", "No TTN Application ID available");
        results.push({ job_id: job.id, status: "BLOCKED", error: "No Application ID" });
        continue;
      }
      
      try {
        // CLUSTER-LOCKED: All endpoints use same base URL
        console.log(`[ttn-deprovision-worker] Deleting device ${deviceId} from app ${targetAppId} on cluster ${ttnConfig.clusterBaseUrl}`);
        
        const deleteResult = await tryDeleteFromTtn(
          {
            clusterBaseUrl: ttnConfig.clusterBaseUrl,
            apiKey: ttnConfig.apiKey,
          },
          targetAppId,
          deviceId
        );

        if (deleteResult.success) {
          // Success - device deleted or already gone
          await supabase
            .from("ttn_deprovision_jobs")
            .update({
              status: "SUCCEEDED",
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_error_code: deleteResult.alreadyDeleted ? "NOT_FOUND" : null,
              last_error_message: deleteResult.alreadyDeleted ? "Device was already deleted from TTN" : null,
            })
            .eq("id", job.id);

          await logEvent(supabase, "succeeded", job, true);
          
          results.push({ 
            job_id: job.id, 
            status: "SUCCEEDED",
            error: deleteResult.alreadyDeleted ? "Device was already deleted" : undefined
          });
          
          console.log(`[ttn-deprovision-worker] Job ${job.id} succeeded`);
        } else {
          // Handle error
          const classification = classifyError(deleteResult.statusCode || 500, deleteResult.error || "Unknown error");
          
          const newAttempts = job.attempts + 1;
          const maxAttempts = job.max_attempts || 5;
          
          let newStatus: string;
          let nextRetryAt: string | null = null;
          
          if (classification.should_block) {
            newStatus = "BLOCKED";
          } else if (!classification.should_retry || newAttempts >= maxAttempts) {
            newStatus = "FAILED";
          } else {
            newStatus = "RETRYING";
            const delayMinutes = RETRY_DELAYS[Math.min(newAttempts - 1, RETRY_DELAYS.length - 1)];
            nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          }
          
          await supabase
            .from("ttn_deprovision_jobs")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
              next_retry_at: nextRetryAt,
              last_error_code: classification.error_code,
              last_error_message: classification.error_message,
              last_error_payload: { status: deleteResult.statusCode, body: deleteResult.error },
              completed_at: newStatus === "FAILED" || newStatus === "BLOCKED" 
                ? new Date().toISOString() 
                : null,
            })
            .eq("id", job.id);

          const eventType = newStatus === "BLOCKED" ? "blocked" : 
                           newStatus === "FAILED" ? "failed" : "retrying";
          await logEvent(supabase, eventType, job, false, classification.error_code, classification.error_message);
          
          results.push({ 
            job_id: job.id, 
            status: newStatus,
            error: classification.error_message
          });
          
          console.log(`[ttn-deprovision-worker] Job ${job.id} ${newStatus}: ${classification.error_message}`);
        }
      } catch (error) {
        // Network or unexpected error
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const newAttempts = job.attempts + 1;
        const maxAttempts = job.max_attempts || 5;
        
        const newStatus = newAttempts >= maxAttempts ? "FAILED" : "RETRYING";
        const delayMinutes = RETRY_DELAYS[Math.min(newAttempts - 1, RETRY_DELAYS.length - 1)];
        const nextRetryAt = newStatus === "RETRYING" 
          ? new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
          : null;
        
        await supabase
          .from("ttn_deprovision_jobs")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
            next_retry_at: nextRetryAt,
            last_error_code: "NETWORK_ERROR",
            last_error_message: errorMessage,
            completed_at: newStatus === "FAILED" ? new Date().toISOString() : null,
          })
          .eq("id", job.id);

        await logEvent(supabase, newStatus === "FAILED" ? "failed" : "retrying", job, false, "NETWORK_ERROR", errorMessage);
        
        results.push({ job_id: job.id, status: newStatus, error: errorMessage });
        console.error(`[ttn-deprovision-worker] Job ${job.id} error: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[ttn-deprovision-worker] Fatal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, processed: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
