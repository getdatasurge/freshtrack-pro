import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg } from "../_shared/ttnConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProvisionRequest {
  action: "create" | "delete" | "update";
  sensor_id: string;
  organization_id: string;
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-provision-device-v8-cluster-validation-20260109";
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
        note: "Per-org model: TTN application IDs come from ttn_connections table",
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
    const frequencyPlan = ttnConfig.region === "eu1" ? "EU_863_870_TTN" : ttnConfig.region === "au1" ? "AU_915_928_FSB_2" : "US_902_928_FSB_2";
    
    console.log(`[ttn-provision-device] TTN App: ${ttnAppId}, Device: ${deviceId}`);
    console.log(`[ttn-provision-device] Region from config: ${ttnConfig.region}`);
    console.log(`[ttn-provision-device] Frequency plan: ${frequencyPlan}`);
    console.log(`[ttn-provision-device] Identity Server URL: ${ttnConfig.identityBaseUrl}`);
    console.log(`[ttn-provision-device] Regional Server URL: ${ttnConfig.regionalBaseUrl}`);

    // Log cluster configuration (multi-cluster support: nam1, eu1, au1)
    console.log(`[ttn-provision-device] ✓ Cluster config: region=${ttnConfig.region}, IS=${ttnConfig.identityBaseUrl}, Regional=${ttnConfig.regionalBaseUrl}`);

    // Helper for TTN Identity Server API calls
    const ttnIsFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${ttnConfig.identityBaseUrl}${endpoint}`;
      console.log(`[ttn-provision-device] TTN IS API: ${options.method || "GET"} ${url}`);
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

    // Helper for TTN Regional Server API calls
    const ttnRegionalFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${ttnConfig.regionalBaseUrl}${endpoint}`;
      console.log(`[ttn-provision-device] TTN Regional API: ${options.method || "GET"} ${url}`);
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

    if (action === "create") {
      // Step 0: Probe TTN connectivity
      console.log(`[ttn-provision-device] Step 0: Probing TTN connectivity for app ${ttnAppId}`);
      
      const probeResponse = await ttnIsFetch(`/api/v3/applications/${ttnAppId}`, {
        method: "GET",
      });
      
      if (!probeResponse.ok) {
        const probeErrorText = await probeResponse.text();
        console.error(`[ttn-provision-device] TTN probe failed: ${probeResponse.status} - ${probeErrorText}`);
        
        await supabase
          .from("lora_sensors")
          .update({ status: "fault" })
          .eq("id", sensor_id);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `TTN connectivity failed (${probeResponse.status})`, 
            details: `Could not reach TTN application "${ttnAppId}". The application may need to be re-provisioned.`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[ttn-provision-device] TTN probe successful`);

      // Step 1: Create device in Identity Server
      console.log(`[ttn-provision-device] Step 1: Creating device in Identity Server`);
      
      const devicePayload = {
        end_device: {
          ids: {
            device_id: deviceId,
            dev_eui: sensor.dev_eui.toUpperCase(),
            join_eui: sensor.app_eui?.toUpperCase() || "0000000000000000",
            application_ids: { application_id: ttnAppId },
          },
          name: sensor.name,
          description: sensor.description || `FreshTracker ${sensor.sensor_type} sensor`,
          lorawan_version: "MAC_V1_0_3",
          lorawan_phy_version: "PHY_V1_0_3_REV_A",
          frequency_plan_id: ttnConfig.region === "eu1" ? "EU_863_870_TTN" : ttnConfig.region === "au1" ? "AU_915_928_FSB_2" : "US_902_928_FSB_2",
          supports_join: true,
        },
        field_mask: {
          paths: [
            "ids.device_id",
            "ids.dev_eui",
            "ids.join_eui",
            "name",
            "description",
            "lorawan_version",
            "lorawan_phy_version",
            "frequency_plan_id",
            "supports_join",
          ],
        },
      };

      const createDeviceResponse = await ttnIsFetch(
        `/api/v3/applications/${ttnAppId}/devices`,
        {
          method: "POST",
          body: JSON.stringify(devicePayload),
        }
      );

      if (!createDeviceResponse.ok && createDeviceResponse.status !== 409) {
        const errorText = await createDeviceResponse.text();
        console.error(`[ttn-provision-device] Failed to create device in IS: ${errorText}`);
        
        await supabase
          .from("lora_sensors")
          .update({ status: "fault" })
          .eq("id", sensor_id);
        
        return new Response(
          JSON.stringify({ error: "Failed to register device in TTN", details: errorText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: Set device in Join Server (OTAA credentials)
      if (sensor.app_key) {
        console.log(`[ttn-provision-device] Step 2: Setting device in Join Server`);
        
        const jsPayload = {
          end_device: {
            ids: {
              device_id: deviceId,
              dev_eui: sensor.dev_eui.toUpperCase(),
              join_eui: sensor.app_eui?.toUpperCase() || "0000000000000000",
              application_ids: { application_id: ttnAppId },
            },
            root_keys: {
              app_key: { key: sensor.app_key.toUpperCase() },
            },
          },
          field_mask: {
            paths: ["root_keys.app_key.key"],
          },
        };

        const jsResponse = await ttnRegionalFetch(
          `/api/v3/js/applications/${ttnAppId}/devices/${deviceId}`,
          {
            method: "PUT",
            body: JSON.stringify(jsPayload),
          }
        );

        if (!jsResponse.ok) {
          const errorText = await jsResponse.text();
          console.warn(`[ttn-provision-device] JS registration warning: ${errorText}`);
        }
      }

      // Step 3: Set device in Network Server
      console.log(`[ttn-provision-device] Step 3: Setting device in Network Server`);
      
      const nsPayload = {
        end_device: {
          ids: {
            device_id: deviceId,
            dev_eui: sensor.dev_eui.toUpperCase(),
            join_eui: sensor.app_eui?.toUpperCase() || "0000000000000000",
            application_ids: { application_id: ttnAppId },
          },
          lorawan_version: "MAC_V1_0_3",
          lorawan_phy_version: "PHY_V1_0_3_REV_A",
          frequency_plan_id: ttnConfig.region === "eu1" ? "EU_863_870_TTN" : ttnConfig.region === "au1" ? "AU_915_928_FSB_2" : "US_902_928_FSB_2",
          supports_join: true,
        },
        field_mask: {
          paths: [
            "lorawan_version",
            "lorawan_phy_version",
            "frequency_plan_id",
            "supports_join",
          ],
        },
      };

      const nsResponse = await ttnRegionalFetch(
        `/api/v3/ns/applications/${ttnAppId}/devices/${deviceId}`,
        {
          method: "PUT",
          body: JSON.stringify(nsPayload),
        }
      );

      if (!nsResponse.ok) {
        const errorText = await nsResponse.text();
        console.warn(`[ttn-provision-device] NS registration warning: ${errorText}`);
      }

      // Step 4: Set device in Application Server
      console.log(`[ttn-provision-device] Step 4: Setting device in Application Server`);
      
      const asPayload = {
        end_device: {
          ids: {
            device_id: deviceId,
            dev_eui: sensor.dev_eui.toUpperCase(),
            join_eui: sensor.app_eui?.toUpperCase() || "0000000000000000",
            application_ids: { application_id: ttnAppId },
          },
        },
        field_mask: {
          paths: [],
        },
      };

      const asResponse = await ttnRegionalFetch(
        `/api/v3/as/applications/${ttnAppId}/devices/${deviceId}`,
        {
          method: "PUT",
          body: JSON.stringify(asPayload),
        }
      );

      if (!asResponse.ok) {
        const errorText = await asResponse.text();
        console.warn(`[ttn-provision-device] AS registration warning: ${errorText}`);
      }

      // Step 5: Verify device exists in correct cluster
      console.log(`[ttn-provision-device] Step 5: Verifying device in ${ttnConfig.region?.toUpperCase() || 'EU1'} cluster`);

      const verifyUrl = `${ttnConfig.identityBaseUrl}/api/v3/applications/${ttnAppId}/devices/${deviceId}`;
      const verifyResponse = await ttnIsFetch(`/api/v3/applications/${ttnAppId}/devices/${deviceId}`, {
        method: "GET",
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error(`[ttn-provision-device] Cluster verification failed: ${verifyResponse.status} - ${errorText}`);

        // Check for "other cluster" indicator
        if (errorText.includes("other_cluster") || errorText.includes("Other cluster")) {
          await supabase
            .from("lora_sensors")
            .update({ status: "fault" })
            .eq("id", sensor_id);

          return new Response(
            JSON.stringify({
              success: false,
              error: "TTN resource created in wrong cluster",
              details: `Device was provisioned to the wrong TTN cluster. ${ttnConfig.region?.toUpperCase() || 'EU1'} is required.`,
              hint: "The device needs to be deleted and re-provisioned to the correct cluster",
              cluster_error: true,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.log(`[ttn-provision-device] Device verified in ${ttnConfig.region?.toUpperCase() || 'EU1'} cluster`);
      }

      // Define cluster verification status for response
      const clusterVerified = verifyResponse.ok;
      const clusterWarning = !verifyResponse.ok 
        ? `Device verification returned ${verifyResponse.status}` 
        : null;

      // Update sensor with TTN info
      await supabase
        .from("lora_sensors")
        .update({
          status: "joining",
          ttn_device_id: deviceId,
          ttn_application_id: ttnAppId,
        })
        .eq("id", sensor_id);

      console.log(`[ttn-provision-device] Device ${deviceId} provisioned successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          device_id: deviceId,
          application_id: ttnAppId,
          status: "joining",
          cluster: ttnConfig.region,
          cluster_verified: clusterVerified,
          cluster_warning: clusterWarning,
          identity_server: ttnConfig.identityBaseUrl,
          regional_server: ttnConfig.regionalBaseUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      console.log(`[ttn-provision-device] Deleting device ${deviceId} from TTN`);

      const deleteResponse = await ttnIsFetch(
        `/api/v3/applications/${ttnAppId}/devices/${deviceId}`,
        { method: "DELETE" }
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
          status: "pending",
        })
        .eq("id", sensor_id);

      return new Response(
        JSON.stringify({ success: true, message: "Device deleted from TTN" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[ttn-provision-device] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
