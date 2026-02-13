import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg } from "../_shared/ttnConfig.ts";
import { assertValidTtnHost } from "../_shared/ttnBase.ts";

const BUILD_VERSION = "check-ttn-gateway-exists-v2.1-keyscope-fix-20260213";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckRequest {
  gateway_id?: string;
  gateway_ids?: string[];
  organization_id?: string;
}

interface CheckResult {
  gateway_id: string;
  organization_id: string;
  provisioning_state: "not_configured" | "unknown" | "exists_in_ttn" | "missing_in_ttn" | "error";
  ttn_gateway_id?: string;
  error?: string;
  checked_at: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[check-ttn-gateway-exists] [${requestId}] Build: ${BUILD_VERSION}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      status: "ok",
      function: "check-ttn-gateway-exists",
      version: BUILD_VERSION,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckRequest = await req.json();
    const gatewayIds: string[] = body.gateway_ids || (body.gateway_id ? [body.gateway_id] : []);
    const orgFilter = body.organization_id;

    // If org provided but no specific IDs, check all gateways for this org
    // that don't already have ttn_gateway_id set (skip already-provisioned)
    if (gatewayIds.length === 0 && orgFilter) {
      const { data: orgGateways } = await supabase
        .from("gateways")
        .select("id")
        .eq("organization_id", orgFilter)
        .is("ttn_gateway_id", null);

      if (orgGateways) {
        for (const gw of orgGateways) gatewayIds.push(gw.id);
      }
    }

    if (gatewayIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        checked_count: 0,
        message: "No unlinked gateways to check",
        summary: { total: 0, exists_in_ttn: 0, missing_in_ttn: 0, not_configured: 0, error: 0 },
        results: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[check-ttn-gateway-exists] [${requestId}] Checking ${gatewayIds.length} gateway(s)`);

    // Fetch gateway details
    const { data: gateways, error: gwError } = await supabase
      .from("gateways")
      .select("id, gateway_eui, ttn_gateway_id, organization_id, name")
      .in("id", gatewayIds);

    if (gwError || !gateways || gateways.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "No gateways found",
        summary: { total: 0, exists_in_ttn: 0, missing_in_ttn: 0, not_configured: 0, error: 0 },
        results: [],
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by org
    const gwByOrg = new Map<string, typeof gateways>();
    for (const gw of gateways) {
      const list = gwByOrg.get(gw.organization_id) || [];
      list.push(gw);
      gwByOrg.set(gw.organization_id, list);
    }

    const results: CheckResult[] = [];
    const now = new Date().toISOString();

    for (const [orgId, orgGateways] of gwByOrg.entries()) {
      const ttnConfig = await getTtnConfigForOrg(supabase, orgId, { requireEnabled: false });

      if (!ttnConfig || !ttnConfig.apiKey) {
        for (const gw of orgGateways) {
          const result: CheckResult = {
            gateway_id: gw.id,
            organization_id: orgId,
            provisioning_state: "not_configured",
            error: "TTN not configured for organization",
            checked_at: now,
          };
          await updateGateway(supabase, gw.id, result);
          results.push(result);
        }
        continue;
      }

      // ---------------------------------------------------------------
      // KEY SCOPE CHECK: Application API keys CANNOT read the gateway
      // registry. Only Organization or Personal (User) keys can.
      // If we only have the application key (no orgApiKey, no gatewayApiKey),
      // we must report this clearly instead of making a doomed API call
      // that returns 404 — which we'd wrongly interpret as "missing_in_ttn".
      // ---------------------------------------------------------------
      const hasGatewayCapableKey = ttnConfig.hasOrgApiKey || ttnConfig.hasGatewayKey;
      const primaryKey = ttnConfig.orgApiKey || ttnConfig.gatewayApiKey || ttnConfig.apiKey;
      // fallbackKey is the other key type (if we have both org/gateway key AND app key)
      const fallbackKey = hasGatewayCapableKey ? ttnConfig.apiKey : undefined;

      if (!hasGatewayCapableKey) {
        console.warn(
          `[check-ttn-gateway-exists] [${requestId}] Org ${orgId}: ` +
          `Only application API key available — cannot verify gateways. ` +
          `Application keys lack gateway registry access on TTN Identity Server.`
        );
        for (const gw of orgGateways) {
          // Skip gateways already linked
          if (gw.ttn_gateway_id) {
            results.push({
              gateway_id: gw.id,
              organization_id: orgId,
              provisioning_state: "exists_in_ttn",
              ttn_gateway_id: gw.ttn_gateway_id,
              checked_at: now,
            });
            continue;
          }
          const result: CheckResult = {
            gateway_id: gw.id,
            organization_id: orgId,
            provisioning_state: "error",
            error: "Application API key cannot verify gateways. Configure an Organization API key in Settings → Developer → TTN Connection with gateway read/write rights.",
            checked_at: now,
          };
          await updateGateway(supabase, gw.id, result);
          results.push(result);
        }
        continue;
      }

      // Gateway registry lives on EU1 Identity Server, not regional cluster
      const baseUrl = ttnConfig.identityServerUrl;
      console.log(`[check-ttn-gateway-exists] [${requestId}] Org ${orgId}: Using ${hasGatewayCapableKey ? "org/gateway" : "app"} key, IS=${baseUrl}`);

      for (const gw of orgGateways) {
        // Skip gateways already linked to TTN
        if (gw.ttn_gateway_id) {
          results.push({
            gateway_id: gw.id,
            organization_id: orgId,
            provisioning_state: "exists_in_ttn",
            ttn_gateway_id: gw.ttn_gateway_id,
            checked_at: now,
          });
          continue;
        }

        const euiClean = gw.gateway_eui.toLowerCase().replace(/[:-]/g, "");
        const ttnGatewayId = `eui-${euiClean}`;
        const gatewayUrl = `${baseUrl}/api/v3/gateways/${ttnGatewayId}`;

        // Validate URL targets EU1 Identity Server (gateway registry)
        try {
          assertValidTtnHost(gatewayUrl, "IS");
        } catch (e) {
          const result: CheckResult = {
            gateway_id: gw.id,
            organization_id: orgId,
            provisioning_state: "error",
            error: `URL validation failed: ${e instanceof Error ? e.message : String(e)}`,
            checked_at: now,
          };
          await updateGateway(supabase, gw.id, result);
          results.push(result);
          continue;
        }

        try {
          console.log(`[check-ttn-gateway-exists] [${requestId}] Checking ${gw.name}: GET ${ttnGatewayId} on ${baseUrl}`);

          let response = await fetch(gatewayUrl, {
            headers: {
              Authorization: `Bearer ${primaryKey}`,
              "Content-Type": "application/json",
            },
          });

          // If primary key gets 403 or 404, try fallback key before giving up.
          // TTN returns 404 (not 403) when key lacks access to gateway registry.
          if ((response.status === 404 || response.status === 403) && fallbackKey) {
            console.log(`[check-ttn-gateway-exists] [${requestId}] ${gw.name}: ${response.status} with primary key, retrying with fallback key`);
            response = await fetch(gatewayUrl, {
              headers: {
                Authorization: `Bearer ${fallbackKey}`,
                "Content-Type": "application/json",
              },
            });
          }

          if (response.ok) {
            // Gateway exists on TTN — claim it
            console.log(`[check-ttn-gateway-exists] [${requestId}] ${gw.name}: EXISTS in TTN as ${ttnGatewayId}`);

            const result: CheckResult = {
              gateway_id: gw.id,
              organization_id: orgId,
              provisioning_state: "exists_in_ttn",
              ttn_gateway_id: ttnGatewayId,
              checked_at: now,
            };

            // Link the gateway to TTN
            await supabase
              .from("gateways")
              .update({
                ttn_gateway_id: ttnGatewayId,
                provisioning_state: "exists_in_ttn",
                last_provision_check_at: now,
                last_provision_check_error: null,
              })
              .eq("id", gw.id);

            results.push(result);
          } else if (response.status === 404) {
            // 404 = gateway genuinely not found (we already have a gateway-capable key)
            console.log(`[check-ttn-gateway-exists] [${requestId}] ${gw.name}: NOT FOUND in TTN (tried ${fallbackKey ? '2 keys' : '1 key'})`);
            const result: CheckResult = {
              gateway_id: gw.id,
              organization_id: orgId,
              provisioning_state: "missing_in_ttn",
              checked_at: now,
            };
            await updateGateway(supabase, gw.id, result);
            results.push(result);
          } else if (response.status === 403) {
            // 403 = key exists but lacks gateway rights
            const errText = await response.text().then(t => t.substring(0, 200));
            console.error(`[check-ttn-gateway-exists] [${requestId}] ${gw.name}: PERMISSION DENIED (${response.status})`);

            const result: CheckResult = {
              gateway_id: gw.id,
              organization_id: orgId,
              provisioning_state: "error",
              error: `API key lacks gateway read rights. Regenerate your Organization API key with 'View gateway' permission in TTN Console.`,
              checked_at: now,
            };
            await updateGateway(supabase, gw.id, result);
            results.push(result);
          } else {
            const errText = await response.text().then(t => t.substring(0, 200));
            console.error(`[check-ttn-gateway-exists] [${requestId}] ${gw.name}: API error ${response.status}`);

            const result: CheckResult = {
              gateway_id: gw.id,
              organization_id: orgId,
              provisioning_state: "error",
              error: `TTN API error (${response.status}): ${errText}`,
              checked_at: now,
            };
            await updateGateway(supabase, gw.id, result);
            results.push(result);
          }
        } catch (fetchErr) {
          console.error(`[check-ttn-gateway-exists] [${requestId}] ${gw.name}: fetch error:`, fetchErr);
          const result: CheckResult = {
            gateway_id: gw.id,
            organization_id: orgId,
            provisioning_state: "error",
            error: `Connection error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
            checked_at: now,
          };
          await updateGateway(supabase, gw.id, result);
          results.push(result);
        }
      }
    }

    const summary = {
      total: results.length,
      exists_in_ttn: results.filter(r => r.provisioning_state === "exists_in_ttn").length,
      missing_in_ttn: results.filter(r => r.provisioning_state === "missing_in_ttn").length,
      not_configured: results.filter(r => r.provisioning_state === "not_configured").length,
      error: results.filter(r => r.provisioning_state === "error").length,
    };
    console.log(`[check-ttn-gateway-exists] [${requestId}] Summary:`, summary);

    return new Response(
      JSON.stringify({ success: true, checked_count: results.length, summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[check-ttn-gateway-exists] [${requestId}] Unhandled error:`, err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function updateGateway(supabase: any, gatewayId: string, result: CheckResult): Promise<void> {
  const updates: Record<string, string | null> = {
    provisioning_state: result.provisioning_state,
    last_provision_check_at: result.checked_at,
    last_provision_check_error: result.error || null,
  };

  if (result.provisioning_state === "exists_in_ttn" && result.ttn_gateway_id) {
    updates.ttn_gateway_id = result.ttn_gateway_id;
  }

  const { error } = await supabase
    .from("gateways")
    .update(updates)
    .eq("id", gatewayId);

  if (error) {
    console.error(`[check-ttn-gateway-exists] Failed to update gateway ${gatewayId}:`, error);
  }
}
