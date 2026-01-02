import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Missing environment configuration",
          hint: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Basic database connectivity
    const queryStart = Date.now();
    const { error: queryError } = await supabase
      .from("organizations")
      .select("id")
      .limit(1);
    const queryLatency = Date.now() - queryStart;

    if (queryError) {
      return new Response(
        JSON.stringify({
          status: "degraded",
          database: {
            connected: false,
            error: queryError.message,
            latencyMs: queryLatency,
          },
          timestamp: new Date().toISOString(),
          totalLatencyMs: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Test 2: Check critical tables exist
    const tablesToCheck = ["organizations", "sites", "units", "alerts", "lora_sensors"];
    const tableResults: Record<string, boolean> = {};

    for (const table of tablesToCheck) {
      const { error } = await supabase.from(table).select("id").limit(1);
      tableResults[table] = !error;
    }

    const allTablesOk = Object.values(tableResults).every((v) => v);

    // Test 3: Check RPC function availability
    const rpcStart = Date.now();
    const { error: rpcError } = await supabase.rpc("check_slug_available", {
      p_slug: "__health_check_test__",
    });
    const rpcLatency = Date.now() - rpcStart;

    const rpcOk = !rpcError;

    // Determine overall status
    const isHealthy = allTablesOk && rpcOk;
    const isDegraded = !isHealthy && (Object.values(tableResults).some((v) => v) || rpcOk);

    return new Response(
      JSON.stringify({
        status: isHealthy ? "ok" : isDegraded ? "degraded" : "error",
        database: {
          connected: true,
          queryLatencyMs: queryLatency,
          rpcLatencyMs: rpcLatency,
          rpcAvailable: rpcOk,
          tables: tableResults,
        },
        timestamp: new Date().toISOString(),
        totalLatencyMs: Date.now() - startTime,
        version: "1.0.0",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[health-check] Error:", err);

    return new Response(
      JSON.stringify({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
        totalLatencyMs: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
