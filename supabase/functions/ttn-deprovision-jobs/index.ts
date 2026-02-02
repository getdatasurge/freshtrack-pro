/**
 * TTN Deprovision Jobs Edge Function
 * 
 * Provides read access to deprovision run history and step details.
 * Uses service role internally - validates caller access via JWT.
 * 
 * Endpoints:
 *   GET ?organization_id=X&status=RUNNING&limit=50 → List jobs
 *   GET ?job_id=X → Get job + steps detail
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const BUILD_VERSION = "ttn-deprovision-jobs-v1.0-20260124";

interface DeprovisionRun {
  id: string;
  organization_id: string;
  requested_by: string | null;
  source: string;
  action: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  request_id: string | null;
  ttn_region: string | null;
  ttn_org_id: string | null;
  ttn_application_id: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface DeprovisionStep {
  id: string;
  run_id: string;
  step_name: string;
  target_type: string | null;
  target_id: string | null;
  attempt: number;
  status: string;
  http_status: number | null;
  ttn_endpoint: string | null;
  response_snippet: string | null;
  started_at: string | null;
  finished_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  const requestId = generateRequestId();
  console.log(`[ttn-deprovision-jobs] ${BUILD_VERSION} - Request ${requestId}`);

  // Only GET is supported
  if (req.method !== "GET") {
    return new Response(JSON.stringify({
      success: false,
      error: "Method not allowed",
      version: BUILD_VERSION,
      request_id: requestId,
    }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");
    const organizationId = url.searchParams.get("organization_id");
    const statusFilter = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10), 1), 200);

    // Validate auth - get user's JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authorization required",
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify JWT and get user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error(`[ttn-deprovision-jobs] Auth error:`, authError);
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid or expired token",
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for actual queries (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's organization membership to validate access via user_roles table
    const { data: membership, error: membershipError } = await supabase
      .from("user_roles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(`[ttn-deprovision-jobs] Membership error:`, membershipError);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to verify organization access",
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!membership) {
      return new Response(JSON.stringify({
        success: false,
        error: "No organization membership found",
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userOrgId = membership.organization_id;

    // If job_id provided, return single job with steps
    if (jobId) {
      console.log(`[ttn-deprovision-jobs] Fetching job ${jobId}`);

      const { data: job, error: jobError } = await supabase
        .from("ttn_deprovision_runs")
        .select("*")
        .eq("id", jobId)
        .eq("organization_id", userOrgId) // Security: only user's org
        .maybeSingle();

      if (jobError) {
        console.error(`[ttn-deprovision-jobs] Job fetch error:`, jobError);
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to fetch job",
          version: BUILD_VERSION,
          request_id: requestId,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!job) {
        return new Response(JSON.stringify({
          success: false,
          error: "Job not found or access denied",
          version: BUILD_VERSION,
          request_id: requestId,
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch steps for this job
      const { data: steps, error: stepsError } = await supabase
        .from("ttn_deprovision_run_steps")
        .select("*")
        .eq("run_id", jobId)
        .order("created_at", { ascending: true });

      if (stepsError) {
        console.error(`[ttn-deprovision-jobs] Steps fetch error:`, stepsError);
      }

      return new Response(JSON.stringify({
        success: true,
        job: job as DeprovisionRun,
        steps: (steps || []) as DeprovisionStep[],
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List jobs
    console.log(`[ttn-deprovision-jobs] Listing jobs for org ${userOrgId}`);

    let query = supabase
      .from("ttn_deprovision_runs")
      .select("*")
      .eq("organization_id", organizationId || userOrgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by organization access - only allow querying own org
    if (organizationId && organizationId !== userOrgId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Access denied to this organization",
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by status if provided (supports comma-separated)
    if (statusFilter) {
      const statuses = statusFilter.split(",").map(s => s.trim().toUpperCase());
      query = query.in("status", statuses);
    }

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) {
      console.error(`[ttn-deprovision-jobs] Jobs fetch error:`, jobsError);
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch jobs",
        version: BUILD_VERSION,
        request_id: requestId,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      jobs: (jobs || []) as DeprovisionRun[],
      count: (jobs || []).length,
      version: BUILD_VERSION,
      request_id: requestId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[ttn-deprovision-jobs] Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      version: BUILD_VERSION,
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
