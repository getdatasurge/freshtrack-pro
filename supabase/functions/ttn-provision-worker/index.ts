/**
 * TTN Provisioning Worker Edge Function
 * 
 * Processes jobs from the ttn_provisioning_queue table:
 * 1. Claims the next pending job using FOR UPDATE SKIP LOCKED
 * 2. Calls ttn-provision-org to create TTN application
 * 3. Updates job status based on result
 * 
 * Invocation:
 * - Scheduled via pg_cron every 30 seconds
 * - Manual POST for immediate processing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUILD_VERSION = "ttn-provision-worker-v5-nam1-only-20260119";

// Error codes that indicate permanent failure (no retry)
const PERMANENT_ERROR_CODES = [
  "INVALID_ORG",
  "ORG_NOT_FOUND",
  "TTN_ADMIN_NOT_CONFIGURED",
];

interface ProvisionJob {
  id: string;
  organization_id: string;
  org_name: string;
  org_slug: string;
  attempts: number;
  current_step: string;
}

interface WorkerRequest {
  source?: "cron" | "manual";
  max_jobs?: number;
  organization_id?: string; // For manual single-org provisioning
}

serve(async (req) => {
  console.log(`[ttn-provision-worker] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-worker] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "ttn-provision-worker",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing Supabase credentials" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: WorkerRequest = await req.json().catch(() => ({}));
    const maxJobs = Math.min(body.max_jobs || 5, 10); // Cap at 10 jobs per invocation
    const source = body.source || "manual";

    console.log(`[ttn-provision-worker] Processing up to ${maxJobs} jobs (source: ${source})`);

    let jobsProcessed = 0;
    let jobsSucceeded = 0;
    let jobsFailed = 0;
    const results: Array<{ job_id: string; org_id: string; status: string; error?: string }> = [];

    // Process jobs in a loop
    for (let i = 0; i < maxJobs; i++) {
      // Get and lock the next pending job
      const { data: jobs, error: jobError } = await supabase
        .rpc("get_next_tts_provisioning_job");

      if (jobError) {
        console.error(`[ttn-provision-worker] Error getting job:`, jobError);
        break;
      }

      if (!jobs || jobs.length === 0) {
        console.log(`[ttn-provision-worker] No pending jobs found`);
        break;
      }

      const job: ProvisionJob = jobs[0];
      console.log(`[ttn-provision-worker] Processing job ${job.id} for org ${job.organization_id} (attempt ${job.attempts})`);
      jobsProcessed++;

      try {
        // Update job step
        await supabase.rpc("update_tts_provisioning_job", {
          p_job_id: job.id,
          p_status: "running",
          p_current_step: "calling_ttn_provision_org",
        });

        // Call ttn-provision-org to do the actual provisioning
        const provisionResponse = await fetch(
          `${supabaseUrl}/functions/v1/ttn-provision-org`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "provision",
              organization_id: job.organization_id,
              // NAM1 ONLY - standardized cluster for all orgs
              ttn_region: "nam1",
            }),
          }
        );

        const provisionResult = await provisionResponse.json();
        console.log(`[ttn-provision-worker] Provision result for ${job.organization_id}:`, provisionResult);

        if (provisionResult.success || provisionResult.ok) {
          // Success!
          await supabase.rpc("update_tts_provisioning_job", {
            p_job_id: job.id,
            p_status: "completed",
            p_current_step: "done",
            p_completed_steps: ["create_application", "create_api_key", "create_webhook", "save_credentials"],
          });

          // Log success event
          await supabase.from("event_logs").insert({
            organization_id: job.organization_id,
            event_type: "ttn.provision.worker.completed",
            category: "ttn",
            severity: "info",
            title: "TTN Application Provisioned",
            event_data: {
              job_id: job.id,
              attempts: job.attempts,
              ttn_application_id: provisionResult.ttn_application_id,
            },
          });

          jobsSucceeded++;
          results.push({
            job_id: job.id,
            org_id: job.organization_id,
            status: "completed",
          });
        } else {
          // Failure - check if retryable
          const errorCode = provisionResult.error_code || "UNKNOWN";
          const errorMessage = provisionResult.error || provisionResult.message || "Unknown error";
          const isPermanent = PERMANENT_ERROR_CODES.includes(errorCode);

          const newStatus = isPermanent ? "failed" : "retrying";

          await supabase.rpc("update_tts_provisioning_job", {
            p_job_id: job.id,
            p_status: newStatus,
            p_current_step: "error",
            p_error: errorMessage,
            p_error_code: errorCode,
          });

          // Log failure event
          await supabase.from("event_logs").insert({
            organization_id: job.organization_id,
            event_type: `ttn.provision.worker.${isPermanent ? "failed" : "retrying"}`,
            category: "ttn",
            severity: isPermanent ? "error" : "warn",
            title: isPermanent ? "TTN Provisioning Failed" : "TTN Provisioning Retrying",
            event_data: {
              job_id: job.id,
              attempts: job.attempts,
              error: errorMessage,
              error_code: errorCode,
              will_retry: !isPermanent,
            },
          });

          jobsFailed++;
          results.push({
            job_id: job.id,
            org_id: job.organization_id,
            status: newStatus,
            error: errorMessage,
          });
        }
      } catch (processingError) {
        // Unexpected error during processing
        const errorMessage = processingError instanceof Error ? processingError.message : String(processingError);
        console.error(`[ttn-provision-worker] Processing error for job ${job.id}:`, errorMessage);

        await supabase.rpc("update_tts_provisioning_job", {
          p_job_id: job.id,
          p_status: "retrying",
          p_current_step: "error",
          p_error: errorMessage,
          p_error_code: "PROCESSING_ERROR",
        });

        jobsFailed++;
        results.push({
          job_id: job.id,
          org_id: job.organization_id,
          status: "retrying",
          error: errorMessage,
        });
      }
    }

    console.log(`[ttn-provision-worker] Completed: ${jobsProcessed} processed, ${jobsSucceeded} succeeded, ${jobsFailed} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        jobs_processed: jobsProcessed,
        jobs_succeeded: jobsSucceeded,
        jobs_failed: jobsFailed,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[ttn-provision-worker] Fatal error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
