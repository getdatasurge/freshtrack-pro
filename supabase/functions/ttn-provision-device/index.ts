import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  // Version banner for deployment verification
  const BUILD_VERSION = "probe-v2-20251230-0253";
  console.log(`[ttn-provision-device] Build: ${BUILD_VERSION}`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ttnApiKey = Deno.env.get("TTN_API_KEY");
    const ttnApiBaseUrl = Deno.env.get("TTN_API_BASE_URL");

    if (!ttnApiKey || !ttnApiBaseUrl) {
      console.error("TTN credentials not configured");
      return new Response(
        JSON.stringify({ error: "TTN credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ProvisionRequest = await req.json();
    const { action, sensor_id, organization_id } = body;

    console.log(`[ttn-provision-device] Action: ${action}, Sensor: ${sensor_id}, Org: ${organization_id}`);

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

    // Ensure TTN application exists for this org
    console.log(`[ttn-provision-device] Ensuring TTN application for org: ${organization_id}`);
    
    const ensureAppResponse = await supabase.functions.invoke("ttn-manage-application", {
      body: { action: "ensure", organization_id },
    });

    if (ensureAppResponse.error) {
      console.error("Failed to ensure TTN application:", ensureAppResponse.error);
      return new Response(
        JSON.stringify({ error: "Failed to ensure TTN application" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch org to get TTN app ID
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("ttn_application_id")
      .eq("id", organization_id)
      .single();

    if (orgError || !org?.ttn_application_id) {
      console.error("TTN application ID not found:", orgError);
      return new Response(
        JSON.stringify({ error: "TTN application not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttnAppId = org.ttn_application_id;
    const deviceId = `sensor-${sensor.dev_eui.toLowerCase()}`;

    console.log(`[ttn-provision-device] TTN App: ${ttnAppId}, Device: ${deviceId}`);

    // Normalize base URL - remove trailing slashes and any /api/v3 suffix
    let effectiveBaseUrl = ttnApiBaseUrl.trim().replace(/\/+$/, "");
    if (effectiveBaseUrl.endsWith("/api/v3")) {
      effectiveBaseUrl = effectiveBaseUrl.slice(0, -7);
    }
    console.log(`[ttn-provision-device] Effective TTN base URL: ${effectiveBaseUrl}`);

    // Helper for TTN API calls with proper URL construction
    const ttnFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${effectiveBaseUrl}${endpoint}`;
      console.log(`[ttn-provision-device] TTN API: ${options.method || "GET"} ${url}`);
      const response = await fetch(url, {
        ...options,
        headers: {
          "Authorization": `Bearer ${ttnApiKey}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      return response;
    };

    if (action === "create") {
      // Step 0: Probe TTN connectivity by fetching the application
      console.log(`[ttn-provision-device] Step 0: Probing TTN connectivity for app ${ttnAppId}`);
      
      const probeResponse = await ttnFetch(`/api/v3/applications/${ttnAppId}`, {
        method: "GET",
      });
      
      if (!probeResponse.ok) {
        const probeErrorText = await probeResponse.text();
        console.error(`[ttn-provision-device] TTN probe failed: ${probeResponse.status} - ${probeErrorText}`);
        
        // Parse error for more details
        let errorDetail = probeErrorText;
        try {
          const parsed = JSON.parse(probeErrorText);
          if (parsed.message) errorDetail = parsed.message;
          if (parsed.details) errorDetail += ` (${JSON.stringify(parsed.details)})`;
        } catch {
          // Keep raw text
        }
        
        // Update sensor status to fault
        await supabase
          .from("lora_sensors")
          .update({ status: "fault" })
          .eq("id", sensor_id);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `TTN connectivity failed (${probeResponse.status})`, 
            details: `Could not reach TTN application "${ttnAppId}" at ${effectiveBaseUrl}. Response: ${errorDetail}. Check if TTN_API_BASE_URL matches your TTN cluster and TTN_API_KEY has read/write rights.`,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[ttn-provision-device] TTN probe successful - application ${ttnAppId} is reachable`);

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
          description: sensor.description || `FrostGuard ${sensor.sensor_type} sensor`,
          lorawan_version: "MAC_V1_0_3",
          lorawan_phy_version: "PHY_V1_0_3_REV_A",
          frequency_plan_id: "US_902_928_FSB_2", // Default to US frequency plan
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

      const createDeviceResponse = await ttnFetch(
        `/api/v3/applications/${ttnAppId}/devices`,
        {
          method: "POST",
          body: JSON.stringify(devicePayload),
        }
      );

      if (!createDeviceResponse.ok && createDeviceResponse.status !== 409) {
        const errorText = await createDeviceResponse.text();
        console.error(`[ttn-provision-device] Failed to create device in IS: ${errorText}`);
        
        // Update sensor status to fault
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

        const jsResponse = await ttnFetch(
          `/api/v3/js/applications/${ttnAppId}/devices/${deviceId}`,
          {
            method: "PUT",
            body: JSON.stringify(jsPayload),
          }
        );

        if (!jsResponse.ok) {
          const errorText = await jsResponse.text();
          console.warn(`[ttn-provision-device] JS registration warning: ${errorText}`);
          // Continue - device might still work
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
          frequency_plan_id: "US_902_928_FSB_2",
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

      const nsResponse = await ttnFetch(
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

      const asResponse = await ttnFetch(
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

      // Update sensor status to joining and store TTN device ID
      console.log(`[ttn-provision-device] Updating sensor status to 'joining'`);
      
      await supabase
        .from("lora_sensors")
        .update({
          status: "joining",
          ttn_device_id: deviceId,
          ttn_application_id: ttnAppId,
        })
        .eq("id", sensor_id);

      return new Response(
        JSON.stringify({
          success: true,
          ttn_device_id: deviceId,
          ttn_application_id: ttnAppId,
          status: "joining",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "delete") {
      // Delete device from TTN
      console.log(`[ttn-provision-device] Deleting device from TTN: ${deviceId}`);
      
      const deleteResponse = await ttnFetch(
        `/api/v3/applications/${ttnAppId}/devices/${deviceId}`,
        { method: "DELETE" }
      );

      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const errorText = await deleteResponse.text();
        console.warn(`[ttn-provision-device] Delete warning: ${errorText}`);
      }

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
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
