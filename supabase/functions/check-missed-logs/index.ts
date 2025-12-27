import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UnitWithLogs {
  id: string;
  name: string;
  status: string;
  manual_log_cadence: number;
  area: any;
}

function getOrgId(unit: any): string {
  const area = unit.area;
  if (Array.isArray(area)) {
    const site = area[0]?.site;
    if (Array.isArray(site)) return site[0]?.organization_id || "";
    return site?.organization_id || "";
  }
  const site = area?.site;
  if (Array.isArray(site)) return site[0]?.organization_id || "";
  return site?.organization_id || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("Checking for missed manual logs...");

    // Get all units that require manual logging
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select(`
        id, name, status, manual_log_cadence,
        area:areas!inner(
          site:sites!inner(organization_id, timezone)
        )
      `)
      .eq("is_active", true)
      .in("status", ["manual_required", "monitoring_interrupted"]);

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      throw unitsError;
    }

    const now = Date.now();
    const alertsCreated: { unitId: string; unitName: string }[] = [];

    for (const unit of (units || []) as any[]) {
      const orgId = getOrgId(unit);
      
      // Get organization's compliance mode
      const { data: org } = await supabase
        .from("organizations")
        .select("compliance_mode")
        .eq("id", orgId)
        .maybeSingle();

      // HACCP mode requires logs every 2 hours, standard every 4 hours
      const cadenceSeconds = org?.compliance_mode === "haccp" 
        ? 2 * 60 * 60 // 2 hours
        : unit.manual_log_cadence || 4 * 60 * 60; // default 4 hours

      const cadenceMs = cadenceSeconds * 1000;

      // Get the most recent manual log for this unit
      const { data: lastLog } = await supabase
        .from("manual_temperature_logs")
        .select("logged_at")
        .eq("unit_id", unit.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastLogTime = lastLog?.logged_at ? new Date(lastLog.logged_at).getTime() : 0;
      const timeSinceLog = now - lastLogTime;

      // Check if log is overdue
      if (timeSinceLog > cadenceMs) {
        // Check if we already have an active alert for this
        const { data: existingAlert } = await supabase
          .from("alerts")
          .select("id")
          .eq("unit_id", unit.id)
          .eq("alert_type", "missed_manual_entry")
          .in("status", ["active", "acknowledged"])
          .maybeSingle();

        if (!existingAlert) {
          const hoursOverdue = Math.floor(timeSinceLog / (60 * 60 * 1000));
          const severity = hoursOverdue >= 8 ? "critical" : hoursOverdue >= 4 ? "warning" : "info";

          // Create alert
          const { error: alertError } = await supabase.from("alerts").insert({
            unit_id: unit.id,
            title: `${unit.name}: Missed Manual Log`,
            message: `No manual temperature log for ${hoursOverdue} hours. Manual logging is required when monitoring is interrupted.`,
            alert_type: "missed_manual_entry",
            severity,
          });

          if (alertError) {
            console.error(`Error creating alert for unit ${unit.id}:`, alertError);
            continue;
          }

          alertsCreated.push({ unitId: unit.id, unitName: unit.name });

          // Log the missed log event
          await supabase.from("event_logs").insert({
            organization_id: orgId,
            unit_id: unit.id,
            event_type: "missed_manual_log",
            actor_type: "system",
            event_data: {
              hours_overdue: hoursOverdue,
              last_log_at: lastLog?.logged_at || null,
              cadence_hours: cadenceSeconds / 3600,
            },
          });

          console.log(`Created missed log alert for unit ${unit.name}`);
        }
      }
    }

    console.log(`Checked ${(units || []).length} units, created ${alertsCreated.length} alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: (units || []).length,
        alerts_created: alertsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-missed-logs:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
