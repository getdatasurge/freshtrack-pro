import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg } from "../_shared/ttnConfig.ts";
import { assertClusterHost } from "../_shared/ttnBase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface StatusRequest {
  organization_id: string;
  gateway_ids?: string[]; // Optional — if omitted, sync all gateways for the org
}

/**
 * TTN Gateway Status Sync
 *
 * Fetches live connection stats from TTN's Gateway Server API for each
 * registered gateway and updates last_seen_at + signal_quality in Supabase.
 *
 * TTN endpoint: GET /api/v3/gs/gateways/{gateway_id}/connection/stats
 */
serve(async (req) => {
  const BUILD_VERSION = "ttn-gateway-status-v1.0-20260211";
  const requestId = crypto.randomUUID().slice(0, 8);

  console.log(`[ttn-gateway-status] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-gateway-status] [${requestId}] Method: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        status: "healthy",
        function: "ttn-gateway-status",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error", request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: StatusRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON", request_id: requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { organization_id, gateway_ids } = body;
    console.log(`[ttn-gateway-status] [${requestId}] Org: ${organization_id}, specific IDs: ${gateway_ids?.length ?? "all"}`);

    // Get TTN config
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id, { requireEnabled: false });

    if (!ttnConfig || !ttnConfig.apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "TTN not configured for this organization",
          error_code: "TTN_NOT_CONFIGURED",
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch gateways that have been provisioned on TTN (have ttn_gateway_id)
    let query = supabase
      .from("gateways")
      .select("id, ttn_gateway_id, gateway_eui")
      .eq("organization_id", organization_id)
      .not("ttn_gateway_id", "is", null);

    if (gateway_ids && gateway_ids.length > 0) {
      query = query.in("id", gateway_ids);
    }

    const { data: gateways, error: gwError } = await query;

    if (gwError) {
      console.error(`[ttn-gateway-status] [${requestId}] DB error:`, gwError);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to fetch gateways", request_id: requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!gateways || gateways.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          synced: 0,
          message: "No provisioned gateways found",
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = ttnConfig.clusterBaseUrl;
    const apiKey = ttnConfig.orgApiKey || ttnConfig.apiKey;

    const results: Array<{ id: string; ttn_id: string; status: string; error?: string }> = [];

    // Fetch connection stats for each gateway
    for (const gw of gateways) {
      const ttnId = gw.ttn_gateway_id;
      const statsUrl = `${baseUrl}/api/v3/gs/gateways/${ttnId}/connection/stats`;

      try {
        assertClusterHost(statsUrl);
      } catch (e) {
        console.error(`[ttn-gateway-status] [${requestId}] Cluster check failed for ${ttnId}:`, e);
        results.push({ id: gw.id, ttn_id: ttnId, status: "error", error: "cluster_violation" });
        continue;
      }

      try {
        const response = await fetch(statsUrl, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const stats = await response.json();

          // Extract last_seen from connection stats
          // TTN returns: last_status_received_at, connected_at, last_uplink_received_at
          const lastStatusAt = stats.last_status_received_at;
          const connectedAt = stats.connected_at;
          const lastUplinkAt = stats.last_uplink_received_at;

          // Use the most recent timestamp
          const timestamps = [lastStatusAt, connectedAt, lastUplinkAt].filter(Boolean);
          const lastSeenAt = timestamps.length > 0
            ? timestamps.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
            : null;

          // Extract signal quality from round_trip_times or sub_bands
          const signalQuality: Record<string, unknown> = {};
          if (stats.round_trip_times) {
            signalQuality.min_rtt_ms = stats.round_trip_times.min
              ? Math.round(parseDuration(stats.round_trip_times.min))
              : null;
            signalQuality.max_rtt_ms = stats.round_trip_times.max
              ? Math.round(parseDuration(stats.round_trip_times.max))
              : null;
            signalQuality.median_rtt_ms = stats.round_trip_times.median
              ? Math.round(parseDuration(stats.round_trip_times.median))
              : null;
          }
          if (stats.uplink_count) signalQuality.uplink_count = parseInt(stats.uplink_count, 10);
          if (stats.downlink_count) signalQuality.downlink_count = parseInt(stats.downlink_count, 10);

          // Determine status
          let gatewayStatus: string;
          if (lastSeenAt) {
            const diffMs = Date.now() - new Date(lastSeenAt).getTime();
            const diffMin = diffMs / 60_000;
            gatewayStatus = diffMin < 5 ? "online" : diffMin <= 30 ? "degraded" : "offline";
          } else {
            gatewayStatus = "offline";
          }

          await supabase
            .from("gateways")
            .update({
              last_seen_at: lastSeenAt,
              signal_quality: Object.keys(signalQuality).length > 0 ? signalQuality : null,
              status: gatewayStatus,
            })
            .eq("id", gw.id);

          results.push({ id: gw.id, ttn_id: ttnId, status: gatewayStatus });
          console.log(`[ttn-gateway-status] [${requestId}] ${ttnId}: ${gatewayStatus} (last_seen: ${lastSeenAt})`);

        } else if (response.status === 404) {
          // Gateway not connected (no active connection)
          // This is normal for gateways that are powered off
          await supabase
            .from("gateways")
            .update({ status: "offline" })
            .eq("id", gw.id);

          results.push({ id: gw.id, ttn_id: ttnId, status: "offline" });
          console.log(`[ttn-gateway-status] [${requestId}] ${ttnId}: offline (not connected)`);

        } else {
          const errText = await response.text();
          console.warn(`[ttn-gateway-status] [${requestId}] ${ttnId}: API error ${response.status} - ${errText.slice(0, 200)}`);
          results.push({ id: gw.id, ttn_id: ttnId, status: "error", error: `HTTP ${response.status}` });
        }
      } catch (fetchErr) {
        console.error(`[ttn-gateway-status] [${requestId}] ${ttnId}: fetch error:`, fetchErr);
        results.push({ id: gw.id, ttn_id: ttnId, status: "error", error: String(fetchErr) });
      }
    }

    const synced = results.filter((r) => r.status !== "error").length;

    return new Response(
      JSON.stringify({
        ok: true,
        synced,
        total: gateways.length,
        results,
        request_id: requestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[ttn-gateway-status] [${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Parse a Go-style duration string (e.g. "1.234s", "123ms", "0.001s") to milliseconds.
 */
function parseDuration(d: string): number {
  if (typeof d !== "string") return 0;
  if (d.endsWith("ms")) return parseFloat(d);
  if (d.endsWith("s")) return parseFloat(d) * 1000;
  return parseFloat(d);
}
