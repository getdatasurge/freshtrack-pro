import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg, assertClusterLocked, getLast4 } from "../_shared/ttnConfig.ts";
import { TTN_IDENTITY_URL, TTN_REGIONAL_URL, TTN_NAM1_HOST, assertValidTtnHost, logTtnApiCallWithCred, identifyPlane, getEndpointForPath } from "../_shared/ttnBase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProvisionRequest {
  action: "create" | "delete" | "update" | "diagnose" | "adopt";
  sensor_id: string;
  organization_id: string;
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-device-v14-better-errors-nam1-fallback-20260211";
  console.log(`[ttn-provision-device] Build: ${BUILD_VERSION}`);
  console.log(`[ttn-provision-device] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check / diagnostics endpoint (GET request)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "ttn-provision-device",
        version: BUILD_VERSION,
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
          hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        },
        note: "TWO-TRUTHS: EU1 for Identity Server, NAM1 for JS/NS/AS",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[ttn-provision-device] Missing Supabase credentials");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing database credentials",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: ProvisionRequest;
    try {
      const bodyText = await req.text();
      console.log("[ttn-provision-device] Raw request body:", bodyText);

      if (!bodyText || bodyText.trim() === "") {
        return new Response(
          JSON.stringify({ success: false, error: "Empty request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      body = JSON.parse(bodyText);
      console.log("[ttn-provision-device] Parsed payload:", JSON.stringify(body));
    } catch (parseError) {
      console.error("[ttn-provision-device] JSON parse error:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : "Parse error",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, sensor_id, organization_id } = body;
    console.log(`[ttn-provision-device] Action: ${action}, Sensor: ${sensor_id}, Org: ${organization_id}`);

    // Get TTN config for this org (per-org model: app ID comes from ttn_connections)
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id, { requireEnabled: true });

    if (!ttnConfig) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "TTN not configured for this organization",
          hint: "Provision a TTN application in Settings → Developer → TTN Connection first",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ttnConfig.applicationId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No TTN application provisioned",
          hint: "Click 'Provision TTN Application' in Settings → Developer → TTN Connection",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ttnConfig.apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No TTN API key configured",
          hint: "TTN application was provisioned but API key is missing. Re-provision or contact support.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CROSS-CLUSTER "TWO TRUTHS" ARCHITECTURE (2026-02-10 fix) ==========
    // EU1 = Identity Server (device registry), NAM1 = radio plane (JS/NS/AS)
    // The Identity Server record on EU1 MUST include *_server_address pointing to NAM1
    const identityBaseUrl = TTN_IDENTITY_URL;   // EU1 for device creation/lookup
    const regionalBaseUrl = TTN_REGIONAL_URL;   // NAM1 for JS/NS/AS

    console.log(`[ttn-provision-device] Cross-cluster: IS=${identityBaseUrl} Regional=${regionalBaseUrl}`);

    const ttnAppId = ttnConfig.applicationId;

    // Fetch sensor details
    const { data: sensor, error: sensorError } = await supabase
      .from("lora_sensors")
      .select("*")
      .eq("id", sensor_id)
      .single();

    if (sensorError || !sensor) {
      console.error("Sensor not found:", sensorError);
      return new Response(
        JSON.stringify({ error: "Sensor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deviceId = `sensor-${sensor.dev_eui.toLowerCase()}`;
    // NAM1-ONLY: Always use US frequency plan
    const frequencyPlan = "US_902_928_FSB_2";
    
    console.log(`[ttn-provision-device] TTN App: ${ttnAppId}, Device: ${deviceId}`);
    console.log(`[ttn-provision-device] Region: ${ttnConfig.region}, Frequency plan: ${frequencyPlan}`);
    console.log(`[ttn-provision-device] Cross-cluster: IS=${TTN_IDENTITY_URL} Regional=${TTN_REGIONAL_URL}`);
    
    // Get API key last4 for audit logging
    const credLast4 = getLast4(ttnConfig.apiKey);
    const requestId = crypto.randomUUID().slice(0, 8);

    // ========== CROSS-CLUSTER TTN API HELPER ==========
    // Routes IS endpoints to EU1 and data plane endpoints to NAM1
    const ttnFetch = async (endpoint: string, options: RequestInit = {}, step?: string) => {
      const isDataPlane = endpoint.includes("/api/v3/js/") ||
                          endpoint.includes("/api/v3/ns/") ||
                          endpoint.includes("/api/v3/as/");

      // Cross-cluster: IS → EU1, DATA → NAM1
      const baseUrl = isDataPlane ? regionalBaseUrl : identityBaseUrl;
      const endpointType = isDataPlane ? "DATA" : "IS";
      const url = `${baseUrl}${endpoint}`;
      const method = options.method || "GET";

      // Validate host before call
      assertValidTtnHost(url, endpointType);

      // Enhanced logging with credential fingerprint for audit trail
      logTtnApiCallWithCred(
        "ttn-provision-device",
        method,
        endpoint,
        step || "unknown",
        requestId,
        credLast4,
        organization_id,
        ttnAppId,
        deviceId,
        baseUrl
      );

      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${ttnConfig.apiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      return response;
    };

    // ========== CROSS-CLUSTER DEVICE PROVISIONING ("Two Truths") ==========
    // Step 1: Identity Server (EU1) — Create device with NAM1 home pointers
    // Step 2: Join Server (NAM1)    — Store root keys
    // Step 3: Network Server (NAM1) — MAC/radio settings
    // Step 4: App Server (NAM1)     — Link application server
    if (action === "create") {
      const devEuiUpper = sensor.dev_eui.toUpperCase();
      const joinEui = sensor.app_eui?.toUpperCase() || "0000000000000000";
      const steps: Array<{ step: string; success: boolean; status: number; message: string; error_body?: string }> = [];

      // Step 0: Probe TTN connectivity (app lives on regional cluster)
      console.log(`[ttn-provision-device] Step 0: Probing TTN connectivity for app ${ttnAppId}`);

      const probeResponse = await ttnFetch(`/api/v3/applications/${ttnAppId}`, { method: "GET" }, "probe");

      if (!probeResponse.ok) {
        const probeErrorText = await probeResponse.text();
        const probeUrl = `${identityBaseUrl}/api/v3/applications/${ttnAppId}`;
        console.error(`[ttn-provision-device] TTN probe failed on IS (${identityBaseUrl}): ${probeResponse.status} - ${probeErrorText}`);

        // Fallback: If IS returns 404, try the regional (NAM1) cluster directly
        if (probeResponse.status === 404) {
          console.log(`[ttn-provision-device] Step 0: IS returned 404, trying regional fallback (${regionalBaseUrl})`);
          const regionalProbeUrl = `${regionalBaseUrl}/api/v3/applications/${ttnAppId}`;
          const regionalProbe = await fetch(regionalProbeUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ttnConfig.apiKey}`,
              "Content-Type": "application/json",
            },
          });

          if (regionalProbe.ok) {
            console.log(`[ttn-provision-device] Step 0: Regional probe succeeded — app found on ${regionalBaseUrl}`);
            // Continue with provisioning (probe passed via fallback)
          } else {
            const regionalErrorText = await regionalProbe.text();
            console.error(`[ttn-provision-device] Regional fallback also failed: ${regionalProbe.status} - ${regionalErrorText}`);

            await supabase
              .from("lora_sensors")
              .update({ status: "fault" })
              .eq("id", sensor_id);

            return new Response(
              JSON.stringify({
                success: false,
                error: `TTN connectivity failed — application not found on either cluster`,
                details: `Could not reach TTN application "${ttnAppId}" on Identity Server or Regional Server.`,
                ttn_response: {
                  identity_server: { status: probeResponse.status, body: probeErrorText.substring(0, 500) },
                  regional_server: { status: regionalProbe.status, body: regionalErrorText.substring(0, 500) },
                },
                probe_urls: { identity: probeUrl, regional: regionalProbeUrl },
                app_id: ttnAppId,
                build_version: BUILD_VERSION,
              }),
              { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          // Non-404 error (403, 500, etc.) — return immediately with raw TTN response
          await supabase
            .from("lora_sensors")
            .update({ status: "fault" })
            .eq("id", sensor_id);

          return new Response(
            JSON.stringify({
              success: false,
              error: `TTN connectivity failed (${probeResponse.status})`,
              details: `Could not reach TTN application "${ttnAppId}". The application may need to be re-provisioned.`,
              ttn_response: { status: probeResponse.status, body: probeErrorText.substring(0, 500) },
              probe_url: probeUrl,
              app_id: ttnAppId,
              identity_server: identityBaseUrl,
              regional_server: regionalBaseUrl,
              build_version: BUILD_VERSION,
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      console.log(`[ttn-provision-device] TTN probe successful`);

      // ── Step 1: Identity Server (EU1) — Create/update device with NAM1 home pointers ──
      console.log(`[ttn-provision-device] [1/4] Identity Server (EU1): Registering device ${deviceId}`);

      const isEndpoint = `/api/v3/applications/${ttnAppId}/devices`;
      const getResponse = await ttnFetch(`${isEndpoint}/${deviceId}`, { method: "GET" }, "step1_check_exists");

      // Build identity payload with CRITICAL server address pointers
      const identityPayload = {
        end_device: {
          ids: {
            device_id: deviceId,
            dev_eui: devEuiUpper,
            join_eui: joinEui,
            application_ids: { application_id: ttnAppId },
          },
          // CRITICAL: These three fields tell EU1 that NAM1 is the home for this device
          network_server_address: TTN_NAM1_HOST,
          join_server_address: TTN_NAM1_HOST,
          application_server_address: TTN_NAM1_HOST,
          name: sensor.name,
          lorawan_version: "MAC_V1_0_3",
          lorawan_phy_version: "PHY_V1_0",
          frequency_plan_id: frequencyPlan,
          supports_join: true,
        },
        field_mask: {
          paths: [
            "network_server_address", "join_server_address", "application_server_address",
            "ids.dev_eui", "ids.join_eui",
            "name", "supports_join",
            "lorawan_version", "lorawan_phy_version", "frequency_plan_id",
          ],
        },
      };

      let step1Response: Response;

      if (getResponse.status === 404) {
        // Device doesn't exist — create it
        console.log(`[ttn-provision-device] [1/4] Creating new device identity on EU1`);
        step1Response = await ttnFetch(isEndpoint, { method: "POST", body: JSON.stringify(identityPayload) }, "step1_create");
      } else if (getResponse.ok) {
        // Device exists — update server address pointers
        console.log(`[ttn-provision-device] [1/4] Updating existing device identity on EU1`);
        const updatePayload = {
          ...identityPayload,
          field_mask: {
            paths: [
              "network_server_address", "join_server_address", "application_server_address",
            ],
          },
        };
        step1Response = await ttnFetch(`${isEndpoint}/${deviceId}`, { method: "PUT", body: JSON.stringify(updatePayload) }, "step1_update");
      } else {
        // Unexpected error checking device existence
        const errorText = await getResponse.text();
        console.error(`[ttn-provision-device] [1/4] Failed to check device on EU1: ${getResponse.status} - ${errorText}`);
        steps.push({ step: "1_identity_server", success: false, status: getResponse.status, message: `Failed to check device on EU1`, error_body: errorText });
        await supabase.from("lora_sensors").update({ status: "fault" }).eq("id", sensor_id);
        return new Response(
          JSON.stringify({ success: false, steps, error: `Identity Server check failed (${getResponse.status})` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!step1Response.ok && step1Response.status !== 200 && step1Response.status !== 201) {
        const errorText = await step1Response.text();

        // Handle 409 Conflict (DevEUI already registered)
        if (step1Response.status === 409) {
          console.log(`[ttn-provision-device] [1/4] 409 Conflict: ${errorText}`);

          if (errorText.includes("end_device_euis_taken") || errorText.includes("already registered")) {
            const appMatch = errorText.match(/application[`\s]+([a-z0-9-]+)/i);
            const existingApp = appMatch?.[1] || "another application";

            if (existingApp !== ttnAppId) {
              await supabase.from("lora_sensors").update({
                status: "fault",
                provisioning_state: "conflict",
                last_provision_check_error: `DevEUI already registered in TTN application: ${existingApp}`,
              }).eq("id", sensor_id);

              return new Response(
                JSON.stringify({
                  success: false,
                  error: `DevEUI already registered in TTN application: ${existingApp}`,
                  hint: `Delete device from "${existingApp}" in TTN Console first.`,
                  existing_application: existingApp,
                }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }

          // Device exists in same app — treat as success
          console.log(`[ttn-provision-device] [1/4] Device exists in target app, continuing...`);
        } else {
          console.error(`[ttn-provision-device] [1/4] Identity Server failed: ${step1Response.status} - ${errorText}`);
          steps.push({ step: "1_identity_server", success: false, status: step1Response.status, message: `Identity Server (EU1) registration failed`, error_body: errorText });
          await supabase.from("lora_sensors").update({ status: "fault" }).eq("id", sensor_id);
          return new Response(
            JSON.stringify({ success: false, steps, error: "Failed to register device on Identity Server (EU1)" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      steps.push({ step: "1_identity_server", success: true, status: step1Response.status, message: "Identity registered on EU1 with NAM1 home pointers" });
      console.log(`[ttn-provision-device] [1/4] Identity Server registered with NAM1 pointers`);

      // ── Step 2: Join Server (NAM1) — Store root keys ──
      if (sensor.app_key) {
        console.log(`[ttn-provision-device] [2/4] Join Server (NAM1): Storing root keys`);

        const jsPayload = {
          end_device: {
            ids: {
              device_id: deviceId,
              dev_eui: devEuiUpper,
              join_eui: joinEui,
            },
            root_keys: {
              app_key: { key: sensor.app_key.toUpperCase() },
              nwk_key: { key: sensor.app_key.toUpperCase() },  // Same as app_key for LoRaWAN 1.0.3
            },
          },
          field_mask: {
            paths: ["root_keys.app_key.key", "root_keys.nwk_key.key"],
          },
        };

        const jsResponse = await ttnFetch(
          `/api/v3/js/applications/${ttnAppId}/devices/${deviceId}`,
          { method: "PUT", body: JSON.stringify(jsPayload) },
          "step2_join_server"
        );

        if (!jsResponse.ok) {
          const errorText = await jsResponse.text();
          console.error(`[ttn-provision-device] [2/4] Join Server failed: ${errorText}`);

          if (errorText.includes("end_device_euis_taken") || errorText.includes("already registered")) {
            const appMatch = errorText.match(/application[`\s]+([a-z0-9-]+)/i);
            const existingApp = appMatch?.[1] || "another application";

            await supabase.from("lora_sensors").update({
              status: "fault",
              provisioning_state: "conflict",
              last_provision_check_error: `Keys already claimed by: ${existingApp}`,
            }).eq("id", sensor_id);

            return new Response(
              JSON.stringify({ success: false, steps, error: "Keys already claimed by another application", existing_application: existingApp }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          steps.push({ step: "2_join_server", success: false, status: jsResponse.status, message: `Join Server (NAM1) key storage failed`, error_body: errorText });
          await supabase.from("lora_sensors").update({ status: "fault" }).eq("id", sensor_id);
          return new Response(
            JSON.stringify({ success: false, steps, error: "Failed to store root keys on Join Server (NAM1)" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        steps.push({ step: "2_join_server", success: true, status: jsResponse.status, message: "Root keys stored on NAM1 Join Server" });
        console.log(`[ttn-provision-device] [2/4] Root keys stored (app_key + nwk_key)`);
      } else {
        steps.push({ step: "2_join_server", success: true, status: 0, message: "Skipped - no app_key configured" });
        console.log(`[ttn-provision-device] [2/4] Skipped Join Server (no app_key)`);
      }

      // ── Step 3: Network Server (NAM1) — MAC/radio settings ──
      console.log(`[ttn-provision-device] [3/4] Network Server (NAM1): Storing radio settings`);

      const nsPayload = {
        end_device: {
          ids: {
            device_id: deviceId,
            dev_eui: devEuiUpper,
            join_eui: joinEui,
          },
          lorawan_version: "MAC_V1_0_3",
          lorawan_phy_version: "PHY_V1_0",
          frequency_plan_id: frequencyPlan,
          supports_join: true,
        },
        field_mask: {
          paths: ["lorawan_version", "lorawan_phy_version", "frequency_plan_id", "supports_join"],
        },
      };

      const nsResponse = await ttnFetch(
        `/api/v3/ns/applications/${ttnAppId}/devices/${deviceId}`,
        { method: "PUT", body: JSON.stringify(nsPayload) },
        "step3_network_server"
      );

      if (!nsResponse.ok) {
        const errorText = await nsResponse.text();
        console.error(`[ttn-provision-device] [3/4] Network Server failed: ${errorText}`);
        steps.push({ step: "3_network_server", success: false, status: nsResponse.status, message: `Network Server (NAM1) radio config failed`, error_body: errorText });
        await supabase.from("lora_sensors").update({ status: "fault" }).eq("id", sensor_id);
        return new Response(
          JSON.stringify({ success: false, steps, error: "Failed to configure Network Server (NAM1)" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      steps.push({ step: "3_network_server", success: true, status: nsResponse.status, message: "Radio settings stored on NAM1 Network Server" });
      console.log(`[ttn-provision-device] [3/4] Network Server registration ensured`);

      // ── Step 4: Application Server (NAM1) — Link ──
      console.log(`[ttn-provision-device] [4/4] Application Server (NAM1): Linking`);

      const asPayload = {
        end_device: {
          ids: {
            device_id: deviceId,
          },
        },
        field_mask: { paths: [] as string[] },
      };

      const asResponse = await ttnFetch(
        `/api/v3/as/applications/${ttnAppId}/devices/${deviceId}`,
        { method: "PUT", body: JSON.stringify(asPayload) },
        "step4_application_server"
      );

      if (!asResponse.ok) {
        const errorText = await asResponse.text();
        console.error(`[ttn-provision-device] [4/4] Application Server failed: ${errorText}`);
        steps.push({ step: "4_application_server", success: false, status: asResponse.status, message: `Application Server (NAM1) link failed`, error_body: errorText });
        await supabase.from("lora_sensors").update({ status: "fault" }).eq("id", sensor_id);
        return new Response(
          JSON.stringify({ success: false, steps, error: "Failed to link Application Server (NAM1)" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      steps.push({ step: "4_application_server", success: true, status: asResponse.status, message: "Application Server linked on NAM1" });
      console.log(`[ttn-provision-device] [4/4] Application Server linked`);

      // ── All 4 steps passed — update sensor record ──
      console.log(`[ttn-provision-device] All 4 steps succeeded. Updating lora_sensors.`);

      await supabase
        .from("lora_sensors")
        .update({
          status: "joining",
          ttn_device_id: deviceId,
          ttn_application_id: ttnAppId,
          ttn_cluster: "nam1",
          provisioning_state: "provisioned",
        })
        .eq("id", sensor_id);

      return new Response(
        JSON.stringify({
          success: true,
          device_id: deviceId,
          application_id: ttnAppId,
          status: "joining",
          cluster: "nam1",
          identity_server: identityBaseUrl,
          regional_server: regionalBaseUrl,
          steps,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== DELETE ACTION ==========
    if (action === "delete") {
      console.log(`[ttn-provision-device] Deleting device ${deviceId} from TTN`);

      const deleteResponse = await ttnFetch(
        `/api/v3/applications/${ttnAppId}/devices/${deviceId}`,
        { method: "DELETE" },
        "delete"
      );

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorText = await deleteResponse.text();
        console.error(`[ttn-provision-device] Failed to delete device: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to delete device from TTN", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear TTN fields from sensor
      await supabase
        .from("lora_sensors")
        .update({
          ttn_device_id: null,
          ttn_application_id: null,
          ttn_cluster: null,
          status: "pending",
          provisioning_state: "not_provisioned",
        })
        .eq("id", sensor_id);

      return new Response(
        JSON.stringify({ success: true, message: "Device deleted from TTN" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== DIAGNOSE ACTION ==========
    // Non-mutating checks to verify device state across all TTN planes
    if (action === "diagnose") {
      console.log(`[ttn-provision-device] DIAGNOSE: Starting diagnostics for ${deviceId}`);
      
      // Step 1: Assert cluster lock (use imported helper)
      try {
        assertClusterLocked(ttnConfig);
      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cluster mismatch detected",
          details: err instanceof Error ? err.message : String(err),
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const checks: Record<string, { ok: boolean; status: number; error?: string }> = {};

      // Step 2: Probe application
      const appProbe = await ttnFetch(`/api/v3/applications/${ttnAppId}`, { method: "GET" }, "diagnose_app");
      checks.appProbe = { ok: appProbe.ok, status: appProbe.status };
      
      // Handle 403 errors with actionable context
      if (!appProbe.ok && appProbe.status === 403) {
        const errorText = await appProbe.text();
        checks.appProbe.error = errorText.substring(0, 200);
        
        // Check if this is an API key rights issue
        if (errorText.includes("no_application_rights") || errorText.includes("forbidden")) {
          // Fetch provisioning status for context
          const { data: connStatus } = await supabase
            .from("ttn_connections")
            .select("provisioning_status, provisioning_error")
            .eq("organization_id", organization_id)
            .single();
          
          const isProvisioningFailed = connStatus?.provisioning_status === "failed";
          const isProvisioningPending = connStatus?.provisioning_status === "pending";
          
          let errorMessage = "API key lacks rights for this application";
          let hint = "Go to Settings → Developer → TTN Connection and click 'Retry Provisioning' or 'Start Fresh' to get a valid API key.";
          
          if (isProvisioningFailed) {
            errorMessage = `TTN provisioning incomplete: ${connStatus?.provisioning_error || "API key creation failed"}`;
          } else if (isProvisioningPending) {
            errorMessage = "TTN provisioning is still pending";
            hint = "Go to Settings → Developer → TTN Connection to complete the provisioning process.";
          }
          
          return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
            hint,
            provisioningStatus: connStatus?.provisioning_status,
            provisioningError: connStatus?.provisioning_error,
            identityServerUrl: identityBaseUrl,
            regionalServerUrl: regionalBaseUrl,
            region: ttnConfig.region,
            appId: ttnAppId,
            deviceId,
            checks,
            diagnosis: "api_key_invalid",
            diagnosedAt: new Date().toISOString(),
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else if (!appProbe.ok) {
        checks.appProbe.error = (await appProbe.text()).substring(0, 200);
      }

      // Step 3: Check IS device registry (main endpoint)
      const isCheck = await ttnFetch(`/api/v3/applications/${ttnAppId}/devices/${deviceId}`, { method: "GET" }, "diagnose_is");
      checks.is = { ok: isCheck.ok, status: isCheck.status };
      if (!isCheck.ok && isCheck.status !== 404) checks.is.error = (await isCheck.text()).substring(0, 200);

      // Step 4: Check JS (Join Server - has root keys)
      const jsCheck = await ttnFetch(`/api/v3/js/applications/${ttnAppId}/devices/${deviceId}`, { method: "GET" }, "diagnose_js");
      checks.js = { ok: jsCheck.ok, status: jsCheck.status };
      if (!jsCheck.ok && jsCheck.status !== 404) checks.js.error = (await jsCheck.text()).substring(0, 200);

      // Step 5: Check NS (Network Server)
      const nsCheck = await ttnFetch(`/api/v3/ns/applications/${ttnAppId}/devices/${deviceId}`, { method: "GET" }, "diagnose_ns");
      checks.ns = { ok: nsCheck.ok, status: nsCheck.status };
      if (!nsCheck.ok && nsCheck.status !== 404) checks.ns.error = (await nsCheck.text()).substring(0, 200);

      // Step 6: Check AS (Application Server)
      const asCheck = await ttnFetch(`/api/v3/as/applications/${ttnAppId}/devices/${deviceId}`, { method: "GET" }, "diagnose_as");
      checks.as = { ok: asCheck.ok, status: asCheck.status };
      if (!asCheck.ok && asCheck.status !== 404) checks.as.error = (await asCheck.text()).substring(0, 200);

      // Analyze results for split-brain detection
      const isExists = checks.is.ok;
      const jsExists = checks.js.ok;
      const nsExists = checks.ns.ok;
      const asExists = checks.as.ok;
      
      let diagnosis = "unknown";
      let hint = "";
      
      if (isExists && jsExists && nsExists && asExists) {
        diagnosis = "fully_provisioned";
        hint = "Device is registered in all TTN planes. Ready for uplinks.";
      } else if (!isExists && !jsExists && !nsExists && !asExists) {
        diagnosis = "not_provisioned";
        hint = "Device not found in any TTN plane. Click 'Provision' to register.";
      } else if (isExists && !jsExists) {
        diagnosis = "split_brain_no_keys";
        hint = "Device exists in Identity Server but missing from Join Server. Keys may not be set. Try re-provisioning.";
      } else if (!isExists && (jsExists || nsExists || asExists)) {
        diagnosis = "split_brain_orphaned";
        hint = "Device missing from Identity Server but exists in other planes. Orphaned state - may need manual cleanup in TTN Console.";
      } else {
        diagnosis = "partial";
        hint = "Device is partially provisioned. Some planes are missing. Try re-provisioning.";
      }

      console.log(`[ttn-provision-device] DIAGNOSE complete: ${diagnosis}`);

      return new Response(JSON.stringify({
        success: true,
        identityServerUrl: identityBaseUrl,
        regionalServerUrl: regionalBaseUrl,
        region: ttnConfig.region,
        appId: ttnAppId,
        deviceId,
        sensorName: sensor.name,
        devEui: sensor.dev_eui,
        checks,
        diagnosis,
        hint,
        diagnosedAt: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== ADOPT ACTION ==========
    // Adopt a manually-added TTN device by searching for DevEUI
    if (action === "adopt") {
      console.log(`[ttn-provision-device] ADOPT: Attempting to adopt manually-added device for DevEUI ${sensor.dev_eui}`);
      
      const devEuiUpper = sensor.dev_eui.toUpperCase();
      const standardDeviceId = `sensor-${sensor.dev_eui.toLowerCase()}`;
      
      // Step 0: Verify the TTN application exists first
      console.log(`[ttn-provision-device] ADOPT Step 0: Verifying application ${ttnAppId} exists`);
      
      const appCheck = await ttnFetch(
        `/api/v3/applications/${ttnAppId}`,
        { method: "GET" },
        "adopt_check_app"
      );
      
      if (!appCheck.ok) {
        const appErrorText = await appCheck.text();
        console.error(`[ttn-provision-device] ADOPT: Application not found: ${appCheck.status} - ${appErrorText}`);
        
        // Fetch provisioning status for context
        const { data: connStatus } = await supabase
          .from("ttn_connections")
          .select("provisioning_status, provisioning_error")
          .eq("organization_id", organization_id)
          .single();
        
        return new Response(JSON.stringify({
          success: false,
          adopted: false,
          error: "TTN application not found",
          hint: "The FrostGuard TTN application doesn't exist in TTN. Go to Settings → TTN Connection and click 'Provision' to create it first.",
          needs_provisioning: true,
          app_id: ttnAppId,
          app_status: appCheck.status,
          provisioningStatus: connStatus?.provisioning_status,
          provisioningError: connStatus?.provisioning_error,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      console.log(`[ttn-provision-device] ADOPT: Application ${ttnAppId} verified`);
      
      // Step 1: Check if device exists in our application with any device ID
      // First try the standard naming convention
      console.log(`[ttn-provision-device] ADOPT Step 1: Checking for device in application ${ttnAppId}`);
      
      const checkStandard = await ttnFetch(
        `/api/v3/applications/${ttnAppId}/devices/${standardDeviceId}`,
        { method: "GET" },
        "adopt_check_standard"
      );
      
      if (checkStandard.ok) {
        // Device found with standard naming - adopt it
        console.log(`[ttn-provision-device] ADOPT: Found device with standard ID ${standardDeviceId}`);
        
        await supabase
          .from("lora_sensors")
          .update({
            ttn_device_id: standardDeviceId,
            ttn_application_id: ttnAppId,
            ttn_cluster: ttnConfig.region,
            provisioning_state: "exists_in_ttn",
            provisioned_source: "manual",
            status: "active",
            last_provision_check_at: new Date().toISOString(),
            last_provision_check_error: null,
          })
          .eq("id", sensor_id);
        
        return new Response(JSON.stringify({
          success: true,
          adopted: true,
          device_id: standardDeviceId,
          application_id: ttnAppId,
          cluster: ttnConfig.region,
          source: "manual",
          message: "Device adopted successfully. It was found with standard naming.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // Step 2: List all devices and search by DevEUI
      console.log(`[ttn-provision-device] ADOPT Step 2: Searching all devices in ${ttnAppId} for DevEUI ${devEuiUpper}`);
      
      let foundDevice: { device_id: string; dev_eui: string } | null = null;
      let pageToken: string | undefined;
      let pageNum = 0;
      
      do {
        const listUrl = `/api/v3/applications/${ttnAppId}/devices?field_mask=ids&limit=100` +
          (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : '');
        
        const listResponse = await ttnFetch(listUrl, { method: "GET" }, `adopt_list_page_${pageNum}`);
        
        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          console.error(`[ttn-provision-device] ADOPT: Failed to list devices: ${errorText}`);
          
          return new Response(JSON.stringify({
            success: false,
            error: "Failed to search for device in TTN",
            details: errorText.substring(0, 200),
            hint: "Check TTN API key permissions.",
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        const listData = await listResponse.json();
        const devices = listData.end_devices || [];
        
        console.log(`[ttn-provision-device] ADOPT: Page ${pageNum}, found ${devices.length} devices`);
        
        // Search for matching DevEUI
        for (const device of devices) {
          const deviceDevEui = device.ids?.dev_eui?.toUpperCase();
          if (deviceDevEui === devEuiUpper) {
            foundDevice = {
              device_id: device.ids.device_id,
              dev_eui: deviceDevEui,
            };
            break;
          }
        }
        
        if (foundDevice) break;
        
        pageToken = listData.next_page_token;
        pageNum++;
      } while (pageToken && pageNum < 50); // Safety limit
      
      if (foundDevice) {
        console.log(`[ttn-provision-device] ADOPT: Found device ${foundDevice.device_id} with DevEUI ${foundDevice.dev_eui}`);
        
        // Update local database to recognize this device
        await supabase
          .from("lora_sensors")
          .update({
            ttn_device_id: foundDevice.device_id,
            ttn_application_id: ttnAppId,
            ttn_cluster: ttnConfig.region,
            provisioning_state: "exists_in_ttn",
            provisioned_source: "manual",
            status: "active",
            last_provision_check_at: new Date().toISOString(),
            last_provision_check_error: null,
          })
          .eq("id", sensor_id);
        
        return new Response(JSON.stringify({
          success: true,
          adopted: true,
          device_id: foundDevice.device_id,
          application_id: ttnAppId,
          cluster: ttnConfig.region,
          source: "manual",
          message: `Device adopted successfully. TTN device ID: ${foundDevice.device_id}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // Step 3: Device not found in our application
      console.log(`[ttn-provision-device] ADOPT: DevEUI ${devEuiUpper} not found in application ${ttnAppId}`);
      
      // Check if device exists in data planes (orphaned state)
      const jsCheck = await ttnFetch(`/api/v3/js/applications/${ttnAppId}/devices/${standardDeviceId}`, { method: "GET" }, "adopt_check_js");
      const nsCheck = await ttnFetch(`/api/v3/ns/applications/${ttnAppId}/devices/${standardDeviceId}`, { method: "GET" }, "adopt_check_ns");
      const asCheck = await ttnFetch(`/api/v3/as/applications/${ttnAppId}/devices/${standardDeviceId}`, { method: "GET" }, "adopt_check_as");
      
      const inDataPlanes = jsCheck.ok || nsCheck.ok || asCheck.ok;
      
      if (inDataPlanes) {
        // Orphaned state - device in data planes but not IS
        return new Response(JSON.stringify({
          success: false,
          adopted: false,
          error: "Device found in TTN data planes but not in registry",
          hint: "The device appears to be in an orphaned state. It may be registered in a different TTN application, or TTN's Identity Server cache is out of sync. Try waiting 2 minutes and running 'Adopt' again, or check TTN Console for the correct application.",
          details: {
            js_found: jsCheck.ok,
            ns_found: nsCheck.ok,
            as_found: asCheck.ok,
          },
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      // Device truly not found
      return new Response(JSON.stringify({
        success: false,
        adopted: false,
        error: "Device not found in TTN",
        hint: `No device with DevEUI ${devEuiUpper} was found in application ${ttnAppId}. Ensure the device was registered in TTN Console with the correct DevEUI, or click 'Provision' to register it automatically.`,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[ttn-provision-device] Unhandled error:", message, stack);
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        error: message,
        stack: stack?.substring(0, 500),
        function: "ttn-provision-device",
        build_version: "ttn-provision-device-v14-better-errors-20260211",
        request_url: req.url,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
