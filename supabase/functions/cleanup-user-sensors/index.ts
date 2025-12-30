import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupRequest {
  user_id: string;
  organization_id: string;
}

interface CleanupResult {
  success: boolean;
  deleted_count: number;
  ttn_deprovision_count: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[cleanup-user-sensors] Starting cleanup...");

    // Get Supabase client with service role for full access
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const { user_id, organization_id }: CleanupRequest = await req.json();

    if (!user_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "user_id and organization_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cleanup-user-sensors] Cleaning up sensors for user ${user_id} in org ${organization_id}`);

    // Find all sensors created by this user in this organization
    const { data: sensors, error: fetchError } = await supabase
      .from("lora_sensors")
      .select("id, name, ttn_device_id, ttn_application_id, dev_eui")
      .eq("created_by", user_id)
      .eq("organization_id", organization_id);

    if (fetchError) {
      console.error("[cleanup-user-sensors] Error fetching sensors:", fetchError);
      throw fetchError;
    }

    if (!sensors || sensors.length === 0) {
      console.log("[cleanup-user-sensors] No sensors found for this user");
      return new Response(
        JSON.stringify({
          success: true,
          deleted_count: 0,
          ttn_deprovision_count: 0,
          errors: [],
        } as CleanupResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cleanup-user-sensors] Found ${sensors.length} sensors to clean up`);

    const errors: string[] = [];
    let ttnDeprovisionCount = 0;

    // De-provision each provisioned sensor from TTN
    for (const sensor of sensors) {
      if (sensor.ttn_device_id) {
        console.log(`[cleanup-user-sensors] De-provisioning sensor ${sensor.id} (${sensor.name}) from TTN...`);
        
        try {
          // Call the ttn-provision-device function with delete action
          const { data: deprovisionResult, error: deprovisionError } = await supabase.functions.invoke(
            "ttn-provision-device",
            {
              body: {
                action: "delete",
                sensor_id: sensor.id,
                organization_id: organization_id,
              },
            }
          );

          if (deprovisionError) {
            console.warn(`[cleanup-user-sensors] TTN de-provision error for ${sensor.id}:`, deprovisionError);
            errors.push(`Failed to de-provision ${sensor.name} from TTN: ${deprovisionError.message}`);
          } else {
            console.log(`[cleanup-user-sensors] Successfully de-provisioned ${sensor.id} from TTN`);
            ttnDeprovisionCount++;
          }
        } catch (err) {
          console.warn(`[cleanup-user-sensors] Exception de-provisioning ${sensor.id}:`, err);
          errors.push(`Exception de-provisioning ${sensor.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // Delete all sensors from database
    const sensorIds = sensors.map(s => s.id);
    const { error: deleteError } = await supabase
      .from("lora_sensors")
      .delete()
      .in("id", sensorIds);

    if (deleteError) {
      console.error("[cleanup-user-sensors] Error deleting sensors from DB:", deleteError);
      throw deleteError;
    }

    console.log(`[cleanup-user-sensors] Deleted ${sensors.length} sensors from database`);

    const result: CleanupResult = {
      success: true,
      deleted_count: sensors.length,
      ttn_deprovision_count: ttnDeprovisionCount,
      errors,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[cleanup-user-sensors] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        deleted_count: 0,
        ttn_deprovision_count: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
