import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend";
import { corsHeaders } from "../_shared/cors.ts";
import { getAlertTypeLabel } from "../_shared/alertTemplates.ts";

/**
 * Test Notification — User-facing API
 *
 * POST /functions/v1/test-notification
 * Body: { unit_id: string, alert_type: string, severity: string, channels: string[] }
 *
 * Security: Requires authenticated user with admin or owner role in the organization.
 *
 * Sends a test notification through each requested channel (EMAIL, SMS, IN_APP, WEB_TOAST)
 * and records notification_events with event_type = 'TEST' for tracking.
 */

interface TestNotificationRequest {
  unit_id: string;
  alert_type: string;
  severity: string;
  channels: string[];
}

interface ChannelResult {
  channel: string;
  status: "sent" | "failed";
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // ── Authenticate user via JWT ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user-scoped client to verify identity
    const supabaseUser = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse & validate request body ──────────────────────────────────────
    const body: TestNotificationRequest = await req.json();
    const { unit_id, alert_type, severity, channels } = body;

    if (!unit_id || !alert_type || !severity || !Array.isArray(channels) || channels.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: unit_id, alert_type, severity, channels (non-empty array)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validChannels = ["EMAIL", "SMS", "IN_APP", "IN_APP_CENTER", "WEB_TOAST"];
    const invalidChannels = channels.filter((ch) => !validChannels.includes(ch));
    if (invalidChannels.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Invalid channels: ${invalidChannels.join(", ")}. Valid: ${validChannels.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Admin client for DB operations ─────────────────────────────────────
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── Look up unit to get organization_id ────────────────────────────────
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select(`
        id, name,
        area:areas!inner(
          id, name,
          site:sites!inner(
            id, name, organization_id
          )
        )
      `)
      .eq("id", unit_id)
      .single();

    if (unitError || !unit) {
      return new Response(
        JSON.stringify({ error: "Unit not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const unitData = unit as any;
    const organizationId: string = unitData.area.site.organization_id;
    const siteId: string = unitData.area.site.id;
    const unitName: string = unitData.name;
    const siteName: string = unitData.area.site.name;
    const areaName: string = unitData.area.name;

    // ── Verify user has admin/owner role in the organization ───────────────
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!userRole || !["owner", "admin"].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Admin or owner role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch user profile (email + phone) ─────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    const userEmail = profile?.email || user.email;
    const userPhone = profile?.phone || null;
    const userName = profile?.full_name || userEmail || "Unknown user";
    const alertLabel = getAlertTypeLabel(alert_type);

    // ── Process each channel ───────────────────────────────────────────────
    const results: ChannelResult[] = [];

    for (const channel of channels) {
      switch (channel) {
        // ── EMAIL ────────────────────────────────────────────────────────
        case "EMAIL": {
          try {
            if (!userEmail) {
              results.push({ channel: "EMAIL", status: "failed", error: "No email address on profile" });
              break;
            }

            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (!resendApiKey) {
              results.push({ channel: "EMAIL", status: "failed", error: "RESEND_API_KEY not configured" });
              break;
            }

            const resend = new Resend(resendApiKey);
            const emailSubject = `[TEST] Alert: ${alertLabel}`;
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
                <table role="presentation" style="width:100%;border-collapse:collapse;">
                  <tr><td align="center" style="padding:40px 0;">
                    <table role="presentation" style="width:600px;max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
                      <tr><td style="padding:24px 40px;background:#6b7280;border-radius:8px 8px 0 0;">
                        <p style="margin:0;color:#d1d5db;font-size:13px;font-weight:600;text-transform:uppercase;">
                          TEST NOTIFICATION
                        </p>
                        <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">${alertLabel}: ${unitName}</h1>
                      </td></tr>
                      <tr><td style="padding:32px 40px;">
                        <p style="color:#6b7280;font-size:14px;">${areaName} &middot; ${siteName}</p>
                        <p style="margin:16px 0;color:#374151;">
                          This is a <strong>test notification</strong> for alert type <strong>${alertLabel}</strong>
                          with severity <strong>${severity}</strong> on unit <strong>${unitName}</strong>.
                        </p>
                        <p style="margin:16px 0;color:#6b7280;font-size:13px;">
                          No action is required. This message was sent to verify your notification configuration is working correctly.
                        </p>
                      </td></tr>
                      <tr><td style="padding:24px 40px;background:#f9fafb;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
                        <p style="margin:0;color:#9ca3af;font-size:12px;">
                          Sent by FreshTrack Pro &mdash; Test notification requested by ${userName}
                        </p>
                      </td></tr>
                    </table>
                  </td></tr>
                </table>
              </body>
              </html>
            `;

            const { error: emailError } = await resend.emails.send({
              from: "FreshTrack Alerts <alerts@freshtrackpro.com>",
              to: [userEmail],
              subject: emailSubject,
              html: emailHtml,
            });

            if (emailError) {
              console.error("Test EMAIL send failed:", emailError);
              results.push({ channel: "EMAIL", status: "failed", error: emailError.message });
            } else {
              results.push({ channel: "EMAIL", status: "sent" });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown email error";
            console.error("Test EMAIL exception:", err);
            results.push({ channel: "EMAIL", status: "failed", error: errMsg });
          }
          break;
        }

        // ── SMS ──────────────────────────────────────────────────────────
        case "SMS": {
          try {
            if (!userPhone) {
              results.push({ channel: "SMS", status: "failed", error: "No phone number on profile" });
              break;
            }

            const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
            const telnyxFromNumber = Deno.env.get("TELNYX_FROM_NUMBER");
            if (!telnyxApiKey || !telnyxFromNumber) {
              results.push({
                channel: "SMS",
                status: "failed",
                error: "TELNYX_API_KEY or TELNYX_FROM_NUMBER not configured",
              });
              break;
            }

            const smsBody =
              `[TEST] ${alertLabel} (${severity}) on ${unitName}. This is a test — no action required.`;

            const telnyxResponse = await fetch("https://api.telnyx.com/v2/messages", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${telnyxApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: telnyxFromNumber,
                to: userPhone,
                text: smsBody,
              }),
            });

            const telnyxData = await telnyxResponse.json();

            if (!telnyxResponse.ok || telnyxData.errors?.length) {
              const telnyxError =
                telnyxData.errors?.[0]?.detail ||
                telnyxData.errors?.[0]?.title ||
                "Telnyx API error";
              console.error("Test SMS send failed:", telnyxError);
              results.push({ channel: "SMS", status: "failed", error: telnyxError });
            } else {
              results.push({ channel: "SMS", status: "sent" });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown SMS error";
            console.error("Test SMS exception:", err);
            results.push({ channel: "SMS", status: "failed", error: errMsg });
          }
          break;
        }

        // ── IN_APP / IN_APP_CENTER ────────────────────────────────────────
        case "IN_APP":
        case "IN_APP_CENTER": {
          try {
            const { error: inAppError } = await supabaseAdmin
              .from("in_app_notifications")
              .insert({
                user_id: user.id,
                organization_id: organizationId,
                title: `[TEST] ${alertLabel}: ${unitName}`,
                body: `Test notification for ${alertLabel} (${severity}) on ${unitName} at ${siteName}. No action required.`,
                severity: severity,
                action_url: `/units/${unit_id}`,
                metadata: { event: "test_notification", alert_type, unit_id },
              });

            if (inAppError) {
              console.error("Test IN_APP insert failed:", inAppError);
              results.push({ channel: "IN_APP", status: "failed", error: inAppError.message });
            } else {
              results.push({ channel: "IN_APP", status: "sent" });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown in-app error";
            console.error("Test IN_APP exception:", err);
            results.push({ channel: "IN_APP", status: "failed", error: errMsg });
          }
          break;
        }

        // ── WEB_TOAST ────────────────────────────────────────────────────
        case "WEB_TOAST": {
          // WEB_TOAST is returned in the response for the frontend to display
          results.push({ channel: "WEB_TOAST", status: "sent" });
          break;
        }

        default: {
          results.push({ channel, status: "failed", error: "Unsupported channel" });
        }
      }

      // ── Record notification_event for tracking ─────────────────────────
      const channelResult = results[results.length - 1];
      try {
        await supabaseAdmin.from("notification_events").insert({
          organization_id: organizationId,
          site_id: siteId,
          unit_id: unit_id,
          channel: channel,
          event_type: "TEST",
          to_recipients: [userName],
          status: channelResult.status === "sent" ? "SENT" : "FAILED",
          reason: channelResult.error || `Test ${channel} notification sent by ${userName}`,
        });
      } catch (eventErr) {
        console.error(`Failed to log notification_event for ${channel}:`, eventErr);
      }
    }

    console.log(
      `test-notification: Completed for user ${user.id}, unit ${unit_id}. Results:`,
      JSON.stringify(results)
    );

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("test-notification error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
