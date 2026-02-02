/**
 * Sensor Change Timeout Sweep
 *
 * Marks 'sent' pending changes as 'timeout' if the sensor hasn't confirmed
 * them within the timeout window. Designed to run as a cron job (e.g. every
 * 15 minutes via Supabase pg_cron or an external scheduler).
 *
 * Timeout logic:
 *  - Default: 24 hours after sent_at
 *  - Respects sensor uplink intervals: if a sensor reports every 30 min,
 *    a 24h timeout is conservative enough to cover sleep cycles,
 *    network issues, and at least ~48 uplink opportunities.
 *
 * Also cleans up the sensor_configurations.pending_change_id FK when the
 * referenced change is timed out.
 *
 * Invocation:
 *  - POST with optional { timeout_hours: number } body (default: 24)
 *  - GET for health check
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        function: "sensor-change-timeout",
        description: "Sweeps stale sent changes → timeout",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Parse optional timeout_hours from body
    let timeoutHours = 24;
    try {
      const body = await req.json();
      if (body?.timeout_hours && typeof body.timeout_hours === "number") {
        timeoutHours = Math.max(1, Math.min(168, body.timeout_hours)); // 1h..168h (7 days)
      }
    } catch {
      // No body or invalid JSON — use default
    }

    const cutoff = new Date(
      Date.now() - timeoutHours * 60 * 60 * 1000
    ).toISOString();

    console.log(
      `[TIMEOUT] Sweeping sent changes older than ${timeoutHours}h (cutoff: ${cutoff})`
    );

    // Find all 'sent' changes past the cutoff
    const { data: staleChanges, error: fetchErr } = await db
      .from("sensor_pending_changes")
      .select("id, sensor_id, change_type, sent_at")
      .eq("status", "sent")
      .lt("sent_at", cutoff)
      .limit(200);

    if (fetchErr) {
      throw new Error(`Fetch failed: ${fetchErr.message}`);
    }

    if (!staleChanges || staleChanges.length === 0) {
      console.log("[TIMEOUT] No stale changes found.");
      return new Response(
        JSON.stringify({ ok: true, timed_out: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[TIMEOUT] Found ${staleChanges.length} stale change(s)`);

    const staleIds = staleChanges.map((c: any) => c.id);

    // Batch-update to 'timeout'
    const { error: updateErr } = await db
      .from("sensor_pending_changes")
      .update({
        status: "timeout",
        failed_at: new Date().toISOString(),
      })
      .in("id", staleIds);

    if (updateErr) {
      throw new Error(`Update failed: ${updateErr.message}`);
    }

    // Clear pending_change_id references in sensor_configurations
    const affectedSensorIds = [
      ...new Set(staleChanges.map((c: any) => c.sensor_id)),
    ];

    for (const sensorId of affectedSensorIds) {
      await db
        .from("sensor_configurations")
        .update({ pending_change_id: null })
        .eq("sensor_id", sensorId)
        .in("pending_change_id", staleIds);
    }

    console.log(
      `[TIMEOUT] Timed out ${staleIds.length} change(s) across ${affectedSensorIds.length} sensor(s)`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        timed_out: staleIds.length,
        affected_sensors: affectedSensorIds.length,
        cutoff,
        timeout_hours: timeoutHours,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[TIMEOUT] Error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
