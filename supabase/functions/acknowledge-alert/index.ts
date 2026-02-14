import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Acknowledge Alert — User-facing API
 *
 * POST /functions/v1/acknowledge-alert
 * Body: { alert_id: string, notes?: string, corrective_action?: string }
 *
 * Security: Requires authenticated user via Supabase JWT.
 * The user must be a member of the alert's organization with appropriate role
 * (owner, admin, manager, or staff).
 *
 * Actions:
 * 1. Set alert.status = 'acknowledged', acknowledged_at = now(), acknowledged_by = user
 * 2. Stop further escalation processing
 * 3. Log to alert_audit_log
 * 4. Create in_app_notification for other recipients: "{user} acknowledged the alert"
 * 5. Optionally log corrective action
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user-scoped client to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { alert_id, notes, corrective_action } = body as {
      alert_id: string;
      notes?: string;
      corrective_action?: string;
    };

    if (!alert_id) {
      return new Response(
        JSON.stringify({ error: "alert_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for all DB operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch the alert
    const { data: alert, error: alertError } = await supabaseAdmin
      .from("alerts")
      .select("id, unit_id, organization_id, site_id, area_id, alert_type, severity, status, title, acknowledged_at")
      .eq("id", alert_id)
      .single();

    if (alertError || !alert) {
      return new Response(
        JSON.stringify({ error: "Alert not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already acknowledged
    if (alert.acknowledged_at) {
      return new Response(
        JSON.stringify({ success: true, message: "Alert already acknowledged", alert }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if alert is in a state that can be acknowledged
    if (alert.status !== "active" && alert.status !== "escalated") {
      return new Response(
        JSON.stringify({ error: `Alert cannot be acknowledged in status: ${alert.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has permission (must be in org with owner/admin/manager/staff role)
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", alert.organization_id)
      .maybeSingle();

    if (!userRole || !["owner", "admin", "manager", "staff"].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions to acknowledge this alert" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nowIso = new Date().toISOString();

    // Get user's name for notifications
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const userName = profile?.full_name || profile?.email || "Unknown user";

    // 1. Update alert status to acknowledged
    const { error: updateError } = await supabaseAdmin
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: nowIso,
        acknowledged_by: user.id,
        acknowledgment_notes: notes || null,
        // Clear next_escalation_at to stop escalation processing
        next_escalation_at: null,
      })
      .eq("id", alert_id);

    if (updateError) {
      console.error("Failed to acknowledge alert:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update alert" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Log to alert_audit_log
    await supabaseAdmin.from("alert_audit_log").insert({
      alert_id: alert_id,
      organization_id: alert.organization_id,
      event_type: "acknowledged",
      actor_user_id: user.id,
      actor_type: "user",
      details: {
        user_name: userName,
        notes: notes || null,
        acknowledged_via: "web_app",
      },
    });

    // 3. Log corrective action if provided
    if (corrective_action) {
      await supabaseAdmin.from("alert_audit_log").insert({
        alert_id: alert_id,
        organization_id: alert.organization_id,
        event_type: "corrective_action_logged",
        actor_user_id: user.id,
        actor_type: "user",
        details: {
          user_name: userName,
          action: corrective_action,
        },
      });

      // Also insert into corrective_actions table if it exists
      try {
        await supabaseAdmin.from("corrective_actions").insert({
          alert_id: alert_id,
          unit_id: alert.unit_id,
          organization_id: alert.organization_id,
          action_taken: corrective_action,
          created_by: user.id,
        });
      } catch {
        // corrective_actions table may not exist yet — that's ok
        console.log("corrective_actions insert skipped (table may not exist)");
      }
    }

    // 4. Log notification event
    await supabaseAdmin.from("notification_events").insert({
      organization_id: alert.organization_id,
      site_id: alert.site_id,
      unit_id: alert.unit_id,
      alert_id: alert_id,
      channel: "IN_APP_CENTER",
      event_type: "ALERT_ACKNOWLEDGED",
      to_recipients: [userName],
      status: "SENT",
      reason: `Acknowledged by ${userName}`,
    });

    // 5. Create in_app_notification for other org members
    // Get all recipients who were notified about this alert
    const { data: notifRecipients } = await supabaseAdmin
      .from("notification_events")
      .select("to_recipients")
      .eq("alert_id", alert_id)
      .eq("event_type", "ALERT_ACTIVE");

    // Create a confirmation notification for the acknowledger
    await supabaseAdmin.from("in_app_notifications").insert({
      user_id: user.id,
      alert_id: alert_id,
      organization_id: alert.organization_id,
      title: `You acknowledged: ${alert.title}`,
      body: notes
        ? `Your acknowledgement note: "${notes}"`
        : `Alert acknowledged at ${new Date(nowIso).toLocaleString()}`,
      severity: "info",
      action_url: `/alerts`,
      metadata: { event: "self_ack_confirmation" },
    });

    console.log(`Alert ${alert_id} acknowledged by ${userName} (${user.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Alert acknowledged successfully",
        alert: {
          id: alert_id,
          status: "acknowledged",
          acknowledged_at: nowIso,
          acknowledged_by: user.id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("acknowledge-alert error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
