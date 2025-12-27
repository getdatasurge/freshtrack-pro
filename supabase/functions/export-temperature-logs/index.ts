import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExportRequest {
  unit_id?: string;
  site_id?: string;
  start_date: string; // ISO date
  end_date: string; // ISO date
  report_type: "daily" | "exceptions" | "manual";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User not in organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ExportRequest = await req.json();
    const { unit_id, site_id, start_date, end_date, report_type } = body;

    console.log(`Exporting ${report_type} report: ${start_date} to ${end_date}`);

    // Get organization info
    const { data: org } = await supabase
      .from("organizations")
      .select("name, compliance_mode, timezone")
      .eq("id", profile.organization_id)
      .maybeSingle();

    // Build units query
    let unitsQuery = supabase
      .from("units")
      .select(`
        id, name, unit_type, temp_limit_high, temp_limit_low,
        area:areas!inner(name, site:sites!inner(id, name, organization_id))
      `)
      .eq("is_active", true);

    if (unit_id) {
      unitsQuery = unitsQuery.eq("id", unit_id);
    }

    const { data: units } = await unitsQuery;

    // Filter to user's org
    const orgUnits = (units || []).filter(
      (u: any) => u.area?.site?.organization_id === profile.organization_id &&
        (!site_id || u.area?.site?.id === site_id)
    );

    if (orgUnits.length === 0) {
      return new Response(
        JSON.stringify({ error: "No units found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unitIds = orgUnits.map((u: any) => u.id);

    // Get sensor readings
    const { data: sensorReadings } = await supabase
      .from("sensor_readings")
      .select("unit_id, temperature, recorded_at")
      .in("unit_id", unitIds)
      .gte("recorded_at", start_date)
      .lte("recorded_at", end_date)
      .order("recorded_at", { ascending: true });

    // Get manual logs
    const { data: manualLogs } = await supabase
      .from("manual_temperature_logs")
      .select("unit_id, temperature, logged_at, logged_by, notes, is_in_range")
      .in("unit_id", unitIds)
      .gte("logged_at", start_date)
      .lte("logged_at", end_date)
      .order("logged_at", { ascending: true });

    // Get user names for attribution
    const loggerIds = [...new Set((manualLogs || []).map((l: any) => l.logged_by))];
    const { data: loggerProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", loggerIds);

    const loggerMap: Record<string, string> = {};
    (loggerProfiles || []).forEach((p: any) => {
      loggerMap[p.user_id] = p.full_name || p.email;
    });

    // Get corrective actions
    const { data: correctiveActions } = await supabase
      .from("corrective_actions")
      .select("unit_id, action_taken, root_cause, completed_at, created_by")
      .in("unit_id", unitIds)
      .gte("completed_at", start_date)
      .lte("completed_at", end_date);

    // Get alerts with acknowledgment data
    const { data: alerts } = await supabase
      .from("alerts")
      .select("unit_id, title, alert_type, severity, status, triggered_at, acknowledged_at, acknowledged_by, acknowledgment_notes, resolved_at, resolved_by, temp_reading, temp_limit")
      .in("unit_id", unitIds)
      .gte("triggered_at", start_date)
      .lte("triggered_at", end_date);

    // Get acknowledger names
    const acknowledgerIds = [...new Set((alerts || []).filter((a: any) => a.acknowledged_by).map((a: any) => a.acknowledged_by))];
    const { data: acknowledgerProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", acknowledgerIds);

    const acknowledgerMap: Record<string, string> = {};
    (acknowledgerProfiles || []).forEach((p: any) => {
      acknowledgerMap[p.user_id] = p.full_name || p.email;
    });

    // Get event logs for gaps
    const { data: events } = await supabase
      .from("event_logs")
      .select("unit_id, event_type, event_data, recorded_at")
      .in("unit_id", unitIds)
      .gte("recorded_at", start_date)
      .lte("recorded_at", end_date)
      .in("event_type", ["unit_state_change", "missed_manual_log"]);

    // Build CSV
    let csv = "";
    const unitMap: Record<string, any> = {};
    orgUnits.forEach((u: any) => {
      unitMap[u.id] = u;
    });

    if (report_type === "daily") {
      // Daily Temperature Log
      csv = "Date,Time,Unit Name,Site,Area,Reading Type,Temperature (°F),In Range,Logged By,Notes\n";

      // Combine and sort all readings
      const allReadings: any[] = [];

      (sensorReadings || []).forEach((r: any) => {
        const unit = unitMap[r.unit_id];
        if (!unit) return;
        const inRange = r.temperature <= unit.temp_limit_high && 
          (unit.temp_limit_low === null || r.temperature >= unit.temp_limit_low);
        allReadings.push({
          datetime: new Date(r.recorded_at),
          unit_name: unit.name,
          site: unit.area.site.name,
          area: unit.area.name,
          type: "Sensor",
          temperature: r.temperature,
          in_range: inRange ? "Yes" : "No",
          logged_by: "Automated",
          notes: "",
        });
      });

      (manualLogs || []).forEach((l: any) => {
        const unit = unitMap[l.unit_id];
        if (!unit) return;
        allReadings.push({
          datetime: new Date(l.logged_at),
          unit_name: unit.name,
          site: unit.area.site.name,
          area: unit.area.name,
          type: "Manual",
          temperature: l.temperature,
          in_range: l.is_in_range ? "Yes" : "No",
          logged_by: loggerMap[l.logged_by] || l.logged_by,
          notes: (l.notes || "").replace(/"/g, '""'),
        });
      });

      allReadings.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

      allReadings.forEach((r) => {
        const date = r.datetime.toISOString().split("T")[0];
        const time = r.datetime.toISOString().split("T")[1].substring(0, 8);
        csv += `${date},${time},"${r.unit_name}","${r.site}","${r.area}",${r.type},${r.temperature},${r.in_range},"${r.logged_by}","${r.notes}"\n`;
      });

    } else if (report_type === "exceptions") {
      // Exception-Only Report with alerts and acknowledgments
      csv = "Date,Time,Unit Name,Site,Event Type,Details,Temperature (°F),Limit (°F),Severity,Status,Acknowledged By,Acknowledged At,Acknowledgment Notes,Action Taken\n";

      // Out of range readings
      (sensorReadings || []).forEach((r: any) => {
        const unit = unitMap[r.unit_id];
        if (!unit) return;
        const outOfRange = r.temperature > unit.temp_limit_high || 
          (unit.temp_limit_low !== null && r.temperature < unit.temp_limit_low);
        if (!outOfRange) return;

        const datetime = new Date(r.recorded_at);
        csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}",Temperature Excursion,Sensor reading out of range,${r.temperature},${unit.temp_limit_high},warning,,,,,\n`;
      });

      // Out of range manual logs
      (manualLogs || []).forEach((l: any) => {
        const unit = unitMap[l.unit_id];
        if (!unit) return;
        if (l.is_in_range) return;

        const datetime = new Date(l.logged_at);
        csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}",Manual Log Excursion,"${(l.notes || "").replace(/"/g, '""')}",${l.temperature},${unit.temp_limit_high},warning,,,,,\n`;
      });

      // Alerts with acknowledgment data
      (alerts || []).forEach((a: any) => {
        const unit = unitMap[a.unit_id];
        if (!unit) return;
        const datetime = new Date(a.triggered_at);
        const ackAt = a.acknowledged_at ? new Date(a.acknowledged_at).toISOString() : "";
        const ackBy = a.acknowledged_by ? (acknowledgerMap[a.acknowledged_by] || a.acknowledged_by) : "";
        const ackNotes = (a.acknowledgment_notes || "").replace(/"/g, '""');
        
        csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}",Alert: ${a.alert_type},"${a.title}",${a.temp_reading || ""},${a.temp_limit || unit.temp_limit_high},${a.severity},${a.status},"${ackBy}","${ackAt}","${ackNotes}",\n`;
      });

      // State changes
      (events || []).forEach((e: any) => {
        const unit = unitMap[e.unit_id];
        if (!unit) return;
        const datetime = new Date(e.recorded_at);
        const data = e.event_data as any;
        
        if (e.event_type === "unit_state_change") {
          csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}",State Change,"${data.from_status} -> ${data.to_status}: ${data.reason || ""}",${data.temp_reading || ""},${unit.temp_limit_high},info,,,,\n`;
        } else if (e.event_type === "missed_manual_log") {
          csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}",Missed Manual Log,"${data.hours_overdue} hours overdue",,${unit.temp_limit_high},warning,,,,\n`;
        }
      });

      // Corrective actions
      (correctiveActions || []).forEach((ca: any) => {
        const unit = unitMap[ca.unit_id];
        if (!unit) return;
        const datetime = new Date(ca.completed_at);
        csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}",Corrective Action,"${(ca.root_cause || "").replace(/"/g, '""')}",,"${unit.temp_limit_high}",info,resolved,,,"${(ca.action_taken || "").replace(/"/g, '""')}"\n`;
      });

    } else if (report_type === "manual") {
      // Manual logs only report
      csv = "Date,Time,Unit Name,Site,Area,Temperature (°F),In Range,Logged By,Notes\n";

      (manualLogs || []).forEach((l: any) => {
        const unit = unitMap[l.unit_id];
        if (!unit) return;
        const datetime = new Date(l.logged_at);
        csv += `${datetime.toISOString().split("T")[0]},${datetime.toISOString().split("T")[1].substring(0, 8)},"${unit.name}","${unit.area.site.name}","${unit.area.name}",${l.temperature},${l.is_in_range ? "Yes" : "No"},"${loggerMap[l.logged_by] || l.logged_by}","${(l.notes || "").replace(/"/g, '""')}"\n`;
      });
    }

    // Add header info
    const header = `# FrostGuard Temperature Report
# Organization: ${org?.name || "Unknown"}
# Compliance Mode: ${org?.compliance_mode?.toUpperCase() || "STANDARD"}
# Report Type: ${report_type === "daily" ? "Daily Temperature Log" : "Exception Report"}
# Date Range: ${start_date} to ${end_date}
# Generated: ${new Date().toISOString()}
# Units Included: ${orgUnits.length}
#
`;

    const fullCsv = header + csv;

    // Log the export
    await supabase.from("event_logs").insert({
      organization_id: profile.organization_id,
      event_type: "report_exported",
      actor_id: user.id,
      actor_type: "user",
      event_data: {
        report_type,
        start_date,
        end_date,
        units_count: orgUnits.length,
      },
    });

    return new Response(fullCsv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="frostguard-${report_type}-${start_date}-${end_date}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error in export-temperature-logs:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
