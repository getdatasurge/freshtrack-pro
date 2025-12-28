import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SimulatorRequest {
  action: "start" | "stop" | "inject";
  unit_id: string;
  temperature?: number; // For inject action
  interval_seconds?: number; // For start action, default 60
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check - get user from Authorization header if provided
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let organizationId: string | null = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;

        // Get org and check role
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.organization_id) {
          organizationId = profile.organization_id;

          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("organization_id", profile.organization_id)
            .maybeSingle();

          if (!roleData || !["owner", "admin"].includes(roleData.role)) {
            return new Response(
              JSON.stringify({ error: "Admin access required" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    const body: SimulatorRequest = await req.json();
    const { action, unit_id, temperature, interval_seconds = 60 } = body;

    console.log(`Sensor simulator: ${action} for unit ${unit_id}${temperature !== undefined ? ` at ${temperature}°F` : ""}`);

    // Get unit details
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select(`
        id, name, unit_type, temp_limit_high, temp_limit_low,
        area:areas!inner(site:sites!inner(organization_id))
      `)
      .eq("id", unit_id)
      .maybeSingle();

    if (unitError || !unit) {
      return new Response(
        JSON.stringify({ error: "Unit not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unitData = unit as any;
    if (!organizationId) {
      organizationId = unitData.area.site.organization_id;
    }

    let result: any = {};

    switch (action) {
      case "inject": {
        // Inject a single reading
        const tempToInject = temperature ?? generateNormalTemp(unitData.temp_limit_high, unitData.temp_limit_low);
        
        const { error: insertError } = await supabase.from("sensor_readings").insert({
          unit_id,
          temperature: tempToInject,
          humidity: Math.floor(Math.random() * 30 + 40), // 40-70%
          door_open: false,
          battery_level: 85 + Math.floor(Math.random() * 15),
          signal_strength: -50 - Math.floor(Math.random() * 30),
          source: "simulator",
        });

        if (insertError) throw insertError;

        // Update unit's last reading
        await supabase.from("units").update({
          last_temp_reading: tempToInject,
          last_reading_at: new Date().toISOString(),
        }).eq("id", unit_id);

        result = { 
          message: "Reading injected", 
          temperature: tempToInject,
          timestamp: new Date().toISOString(),
        };

        // Log the simulation event
        if (organizationId) {
          await supabase.from("event_logs").insert({
            organization_id: organizationId,
            unit_id,
            event_type: "sensor_simulation",
            actor_id: userId,
            actor_type: userId ? "user" : "system",
            event_data: { action: "inject", temperature: tempToInject },
          });
        }

        // Trigger process-unit-states to evaluate alerts
        console.log("Triggering process-unit-states for alert evaluation...");
        try {
          const evalResult = await supabase.functions.invoke("process-unit-states");
          console.log("process-unit-states result:", evalResult);
          result.alertEvaluation = evalResult.data;
        } catch (evalError) {
          console.error("Error triggering process-unit-states:", evalError);
          result.alertEvaluationError = String(evalError);
        }
        break;
      }

      case "start": {
        // Inject multiple readings over time (simulated batch)
        const readings = [];
        const now = Date.now();
        
        for (let i = 0; i < 5; i++) {
          const tempToInject = generateNormalTemp(unitData.temp_limit_high, unitData.temp_limit_low);
          const timestamp = new Date(now - (4 - i) * interval_seconds * 1000);
          
          readings.push({
            unit_id,
            temperature: tempToInject,
            humidity: Math.floor(Math.random() * 30 + 40),
            door_open: false,
            battery_level: 85 + Math.floor(Math.random() * 15),
            signal_strength: -50 - Math.floor(Math.random() * 30),
            recorded_at: timestamp.toISOString(),
            received_at: timestamp.toISOString(),
            source: "simulator",
          });
        }

        const { error: insertError } = await supabase.from("sensor_readings").insert(readings);
        if (insertError) throw insertError;

        const lastTemp = readings[readings.length - 1].temperature;
        await supabase.from("units").update({
          last_temp_reading: lastTemp,
          last_reading_at: new Date().toISOString(),
          status: "ok",
        }).eq("id", unit_id);

        result = { 
          message: "Simulation started - 5 readings injected", 
          readings: readings.length,
          last_temperature: lastTemp,
        };

        if (organizationId) {
          await supabase.from("event_logs").insert({
            organization_id: organizationId,
            unit_id,
            event_type: "sensor_simulation",
            actor_id: userId,
            actor_type: userId ? "user" : "system",
            event_data: { action: "start", readings_count: readings.length },
          });
        }

        // Trigger process-unit-states
        try {
          await supabase.functions.invoke("process-unit-states");
        } catch (evalError) {
          console.error("Error triggering process-unit-states:", evalError);
        }
        break;
      }

      case "stop": {
        // Mark unit as not having recent data by setting last_reading_at to old time
        const oldTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        
        await supabase.from("units").update({
          last_reading_at: oldTime.toISOString(),
        }).eq("id", unit_id);

        result = { 
          message: "Simulation stopped - data gap will be detected",
          last_reading_at: oldTime.toISOString(),
        };

        if (organizationId) {
          await supabase.from("event_logs").insert({
            organization_id: organizationId,
            unit_id,
            event_type: "sensor_simulation",
            actor_id: userId,
            actor_type: userId ? "user" : "system",
            event_data: { action: "stop" },
          });
        }

        // Trigger process-unit-states
        try {
          await supabase.functions.invoke("process-unit-states");
        } catch (evalError) {
          console.error("Error triggering process-unit-states:", evalError);
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: start, stop, or inject" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in sensor-simulator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateNormalTemp(highLimit: number, lowLimit: number | null): number {
  // Generate a temperature that's typically in range
  // Fridges: aim for 35-38°F, Freezers: aim for -5 to 0°F
  const isFreeze = lowLimit !== null && lowLimit < 10;
  
  if (isFreeze) {
    // Freezer: target -5 to -2
    return Math.round((-5 + Math.random() * 3) * 10) / 10;
  } else {
    // Fridge: target 35-38
    return Math.round((35 + Math.random() * 3) * 10) / 10;
  }
}