import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getTtnConfigForOrg, getGlobalApplicationId } from "../_shared/ttnConfig.ts";
import { CLUSTER_BASE_URL, assertClusterHost } from "../_shared/ttnBase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ListDevicesRequest {
  organization_id: string;
}

interface TTNDevice {
  device_id: string;
  dev_eui: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
}

serve(async (req) => {
  const BUILD_VERSION = "ttn-list-devices-v2-global-app-20251231";
  console.log(`[ttn-list-devices] Build: ${BUILD_VERSION}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get global TTN Application ID
    let ttnAppId: string;
    try {
      ttnAppId = getGlobalApplicationId();
    } catch {
      return new Response(
        JSON.stringify({ 
          error: "TTN not configured", 
          hint: "TTN_APPLICATION_ID environment variable is not set",
          devices: [],
          orphans: []
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ListDevicesRequest = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has admin access to this org
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .in("role", ["owner", "admin"])
      .single();

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get TTN config for this org
    const ttnConfig = await getTtnConfigForOrg(supabase, organization_id);

    if (!ttnConfig || !ttnConfig.apiKey) {
      return new Response(
        JSON.stringify({ 
          error: "TTN not configured for this organization",
          hint: "Add a TTN API key in Settings → Developer → TTN Connection",
          devices: [],
          orphans: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NAM1-ONLY: Use clusterBaseUrl for all TTN operations
    const baseUrl = ttnConfig.clusterBaseUrl;
    
    // HARD GUARD: Verify cluster host before any TTN call
    assertClusterHost(`${baseUrl}/api/v3/applications/${ttnAppId}`);

    console.log(`[ttn-list-devices] Listing devices for TTN app: ${ttnAppId} on ${baseUrl}`);

    // List devices from TTN
    const listUrl = `${baseUrl}/api/v3/applications/${ttnAppId}/devices?field_mask=name,created_at,updated_at,ids.dev_eui`;
    
    console.log(JSON.stringify({
      event: "ttn_api_call",
      method: "GET",
      endpoint: `/api/v3/applications/${ttnAppId}/devices`,
      baseUrl,
      step: "list_devices",
      timestamp: new Date().toISOString(),
    }));
    
    const response = await fetch(listUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ttnConfig.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ttn-list-devices] TTN API error: ${response.status} ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          error: `TTN API error: ${response.status}`,
          details: errorText,
          devices: [],
          orphans: []
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const ttnDevices: TTNDevice[] = (result.end_devices || []).map((d: Record<string, unknown>) => ({
      device_id: (d.ids as Record<string, string>)?.device_id,
      dev_eui: (d.ids as Record<string, string>)?.dev_eui,
      name: d.name as string,
      created_at: d.created_at as string,
      updated_at: d.updated_at as string,
    }));

    console.log(`[ttn-list-devices] Found ${ttnDevices.length} devices in TTN`);

    // Get all sensors from FrostGuard for this org
    const { data: sensors, error: sensorsError } = await supabase
      .from("lora_sensors")
      .select("id, dev_eui, name, ttn_device_id")
      .eq("organization_id", organization_id);

    if (sensorsError) {
      console.error(`[ttn-list-devices] Failed to fetch sensors:`, sensorsError);
    }

    const fgDevEuis = new Set((sensors || []).map(s => s.dev_eui.toUpperCase()));
    
    // Find orphans: devices in TTN but not in FrostGuard
    const orphans = ttnDevices.filter(d => !fgDevEuis.has(d.dev_eui?.toUpperCase()));
    
    console.log(`[ttn-list-devices] Found ${orphans.length} orphaned devices`);

    return new Response(
      JSON.stringify({
        ttn_application_id: ttnAppId,
        devices: ttnDevices,
        orphans,
        frostguard_sensors: sensors?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[ttn-list-devices] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, devices: [], orphans: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
