import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { validateInternalApiKey, unauthorizedResponse } from "../_shared/validation.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-api-key",
};

interface Alert {
  id: string;
  title: string;
  message: string | null;
  alert_type: string;
  severity: string;
  status: string;
  temp_reading: number | null;
  temp_limit: number | null;
  triggered_at: string;
  escalation_level: number;
  next_escalation_at: string | null;
  acknowledged_at: string | null;
  unit_id: string;
  metadata: Record<string, unknown> | null;
  first_active_at: string | null;
  last_notified_at: string | null;
  last_notified_reason: string | null;
}

interface UnitInfo {
  id: string;
  name: string;
  area: {
    id: string;
    name: string;
    site: {
      id: string;
      name: string;
      organization_id: string;
      timezone: string;
    };
  };
}

interface NotificationPolicy {
  initial_channels: string[];
  requires_ack: boolean;
  ack_deadline_minutes: number | null;
  escalation_steps: unknown[];
  send_resolved_notifications: boolean;
  reminders_enabled: boolean;
  reminder_interval_minutes: number | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start_local: string | null;
  quiet_hours_end_local: string | null;
  severity_threshold: string;
  allow_warning_notifications: boolean;
  notify_roles: string[];
  notify_site_managers: boolean;
  notify_assigned_users: boolean;
  source_unit: boolean;
  source_site: boolean;
  source_org: boolean;
}

interface EligibleRecipient {
  email: string;
  name: string | null;
  role: string;
  user_id: string;
}

const alertTypeLabels: Record<string, string> = {
  alarm_active: "Temperature Alarm",
  monitoring_interrupted: "Monitoring Interrupted",
  missed_manual_entry: "Missed Manual Entry",
  low_battery: "Low Battery",
  sensor_fault: "Sensor Fault",
  door_open: "Door Left Open",
  calibration_due: "Calibration Due",
  suspected_cooling_failure: "Suspected Cooling Failure",
  temp_excursion: "Temperature Excursion",
};

function generateAlertEmailHtml(
  alert: Alert,
  unit: UnitInfo,
  appUrl: string
): string {
  const severityColors: Record<string, string> = {
    critical: "#dc2626",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  const severityColor = severityColors[alert.severity] || severityColors.info;
  const alertLabel = alertTypeLabels[alert.alert_type] || alert.alert_type;
  const triggeredDate = new Date(alert.triggered_at).toLocaleString("en-US", {
    timeZone: unit.area.site.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  let tempInfo = "";
  if (alert.temp_reading !== null) {
    tempInfo = `
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Current Temperature:</td>
        <td style="padding: 8px 0; font-weight: 600; color: ${severityColor};">${alert.temp_reading}°F</td>
      </tr>
    `;
    if (alert.temp_limit !== null) {
      tempInfo += `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Limit:</td>
          <td style="padding: 8px 0;">${alert.temp_limit}°F</td>
        </tr>
      `;
    }
  }

  const metadata = alert.metadata || {};
  let metadataInfo = "";
  if (metadata.high_limit || metadata.low_limit) {
    metadataInfo = `
      <tr>
        <td style="padding: 8px 0; color: #6b7280;">Range:</td>
        <td style="padding: 8px 0;">${metadata.low_limit || "N/A"}°F - ${metadata.high_limit || "N/A"}°F</td>
      </tr>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 40px; background-color: ${severityColor}; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                    ⚠️ ${alertLabel}
                  </h1>
                  <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                    ${alert.severity.toUpperCase()} Alert - Immediate attention required
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 32px 40px;">
                  <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px;">
                    ${unit.name}
                  </h2>
                  <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
                    ${unit.area.name} • ${unit.area.site.name}
                  </p>
                  
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    ${tempInfo}
                    ${metadataInfo}
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Triggered:</td>
                      <td style="padding: 8px 0;">${triggeredDate}</td>
                    </tr>
                  </table>
                  
                  ${alert.message ? `<p style="margin: 0 0 24px; padding: 16px; background-color: #fef3c7; border-radius: 6px; color: #92400e; font-size: 14px;">${alert.message}</p>` : ""}
                  
                  <a href="${appUrl}/unit/${unit.id}" style="display: inline-block; padding: 12px 24px; background-color: ${severityColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
                    View Unit Details
                  </a>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    This alert was sent by FrostGuard. To manage your notification preferences, visit your settings.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function isInQuietHours(
  policy: NotificationPolicy,
  timezone: string
): boolean {
  if (!policy.quiet_hours_enabled || !policy.quiet_hours_start_local || !policy.quiet_hours_end_local) {
    return false;
  }

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = policy.quiet_hours_start_local.split(":").map(Number);
    const [endHour, endMinute] = policy.quiet_hours_end_local.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logNotificationEvent(
  supabaseAdmin: any,
  params: {
    organization_id: string;
    site_id?: string;
    unit_id?: string;
    alert_id: string;
    channel: string;
    event_type: string;
    to_recipients: string[];
    status: "SENT" | "SKIPPED" | "FAILED";
    reason?: string;
    provider_message_id?: string;
  }
): Promise<void> {
  try {
    await supabaseAdmin.from("notification_events").insert({
      organization_id: params.organization_id,
      site_id: params.site_id,
      unit_id: params.unit_id,
      alert_id: params.alert_id,
      channel: params.channel,
      event_type: params.event_type,
      to_recipients: params.to_recipients,
      status: params.status,
      reason: params.reason,
      provider_message_id: params.provider_message_id,
    });
  } catch (error) {
    console.error("Failed to log notification event:", error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getEffectivePolicy(
  supabaseAdmin: any,
  unitId: string,
  alertType: string
): Promise<NotificationPolicy | null> {
  const { data, error } = await supabaseAdmin.rpc("get_effective_notification_policy", {
    p_unit_id: unitId,
    p_alert_type: alertType,
  });

  if (error) {
    console.error("Error fetching notification policy:", error);
    return null;
  }

  if (!data) return null;

  return {
    initial_channels: data.initial_channels || ["IN_APP_CENTER"],
    requires_ack: data.requires_ack || false,
    ack_deadline_minutes: data.ack_deadline_minutes,
    escalation_steps: data.escalation_steps || [],
    send_resolved_notifications: data.send_resolved_notifications || false,
    reminders_enabled: data.reminders_enabled || false,
    reminder_interval_minutes: data.reminder_interval_minutes,
    quiet_hours_enabled: data.quiet_hours_enabled || false,
    quiet_hours_start_local: data.quiet_hours_start_local,
    quiet_hours_end_local: data.quiet_hours_end_local,
    severity_threshold: data.severity_threshold || "WARNING",
    allow_warning_notifications: data.allow_warning_notifications || false,
    notify_roles: data.notify_roles || ["owner", "admin"],
    notify_site_managers: data.notify_site_managers ?? true,
    notify_assigned_users: data.notify_assigned_users || false,
    source_unit: data.source_unit || false,
    source_site: data.source_site || false,
    source_org: data.source_org || false,
  };
}

function shouldNotifyForSeverity(
  severity: string,
  policy: NotificationPolicy
): { shouldNotify: boolean; reason?: string } {
  if (severity === "critical") {
    return { shouldNotify: true };
  }

  if (severity === "warning") {
    if (policy.allow_warning_notifications || policy.severity_threshold === "WARNING" || policy.severity_threshold === "INFO") {
      return { shouldNotify: true };
    }
    return { shouldNotify: false, reason: "Warning notifications not enabled in policy" };
  }

  if (severity === "info") {
    if (policy.severity_threshold === "INFO") {
      return { shouldNotify: true };
    }
    return { shouldNotify: false, reason: "Info notifications not enabled in policy" };
  }

  return { shouldNotify: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRecipients(
  supabaseAdmin: any,
  organizationId: string,
  policy: NotificationPolicy
): Promise<EligibleRecipient[]> {
  const recipients: EligibleRecipient[] = [];

  const rolesToNotify = policy.notify_roles || ["owner", "admin"];
  
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .in("role", rolesToNotify);

  if (roles && roles.length > 0) {
    const userIds = (roles as { user_id: string; role: string }[]).map(r => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", userIds);

    if (profiles) {
      for (const profile of profiles as { user_id: string; email: string; full_name: string | null }[]) {
        const role = (roles as { user_id: string; role: string }[]).find(r => r.user_id === profile.user_id);
        recipients.push({
          email: profile.email,
          name: profile.full_name,
          role: role?.role || "admin",
          user_id: profile.user_id,
        });
      }
    }
  }

  return recipients;
}

/**
 * Process Escalations - Internal Scheduled Function
 * 
 * Security: Requires INTERNAL_API_KEY when configured
 * 
 * This function processes all active alerts and sends notifications
 * based on configured policies.
 */
const handler = async (req: Request): Promise<Response> => {
  console.log("process-escalations: Starting...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal API key
    const apiKeyResult = validateInternalApiKey(req);
    if (!apiKeyResult.valid) {
      console.warn("[process-escalations] API key validation failed:", apiKeyResult.error);
      return unauthorizedResponse(apiKeyResult.error || "Unauthorized", corsHeaders);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const appUrl = Deno.env.get("APP_URL") || "https://frostguard.app";

    // Fetch active alerts that need notification
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("alerts")
      .select("*")
      .eq("status", "active")
      .is("last_notified_at", null);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      throw alertsError;
    }

    console.log(`process-escalations: Found ${alerts?.length || 0} alerts needing notification`);

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No alerts need notification", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;
    let emailsSkipped = 0;
    let emailsFailed = 0;
    let webToastLogged = 0;
    let inAppLogged = 0;

    for (const alert of alerts as Alert[]) {
      console.log(`Processing alert ${alert.id} (${alert.alert_type}, ${alert.severity})`);

      const { data: unit, error: unitError } = await supabaseAdmin
        .from("units")
        .select(`
          id, name,
          area:areas!inner(
            id, name,
            site:sites!inner(
              id, name, organization_id, timezone
            )
          )
        `)
        .eq("id", alert.unit_id)
        .single();

      if (unitError || !unit) {
        console.error(`Failed to get unit info for alert ${alert.id}:`, unitError);
        continue;
      }

      const unitInfo = unit as unknown as UnitInfo;
      const orgId = unitInfo.area.site.organization_id;
      const siteId = unitInfo.area.site.id;

      const policy = await getEffectivePolicy(supabaseAdmin, alert.unit_id, alert.alert_type);

      if (!policy) {
        console.log(`No notification policy found for alert ${alert.id}, using defaults`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "IN_APP_CENTER",
          event_type: "ALERT_ACTIVE",
          to_recipients: [],
          status: "SENT",
          reason: "Default policy - in-app only",
        });
        inAppLogged++;

        await supabaseAdmin
          .from("alerts")
          .update({
            last_notified_at: new Date().toISOString(),
            last_notified_reason: "ALERT_ACTIVE",
          })
          .eq("id", alert.id);
        continue;
      }

      const { shouldNotify, reason: severityReason } = shouldNotifyForSeverity(alert.severity, policy);
      if (!shouldNotify) {
        console.log(`Skipping alert ${alert.id}: ${severityReason}`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "ALL",
          event_type: "ALERT_ACTIVE",
          to_recipients: [],
          status: "SKIPPED",
          reason: severityReason,
        });
        emailsSkipped++;
        continue;
      }

      const inQuietHours = isInQuietHours(policy, unitInfo.area.site.timezone);
      if (inQuietHours && alert.severity !== "critical") {
        console.log(`Skipping alert ${alert.id}: In quiet hours`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "ALL",
          event_type: "ALERT_ACTIVE",
          to_recipients: [],
          status: "SKIPPED",
          reason: "In quiet hours (non-critical)",
        });
        emailsSkipped++;
        continue;
      }

      const channelsToUse = policy.initial_channels || ["IN_APP_CENTER"];

      for (const channel of channelsToUse) {
        if (channel === "IN_APP_CENTER") {
          await logNotificationEvent(supabaseAdmin, {
            organization_id: orgId,
            site_id: siteId,
            unit_id: alert.unit_id,
            alert_id: alert.id,
            channel: "IN_APP_CENTER",
            event_type: "ALERT_ACTIVE",
            to_recipients: [],
            status: "SENT",
          });
          inAppLogged++;
        } else if (channel === "WEB_TOAST") {
          await logNotificationEvent(supabaseAdmin, {
            organization_id: orgId,
            site_id: siteId,
            unit_id: alert.unit_id,
            alert_id: alert.id,
            channel: "WEB_TOAST",
            event_type: "ALERT_ACTIVE",
            to_recipients: [],
            status: "SENT",
          });
          webToastLogged++;
        } else if (channel === "EMAIL") {
          const recipients = await getRecipients(supabaseAdmin, orgId, policy);
          
          if (recipients.length === 0) {
            console.log(`No email recipients for alert ${alert.id}`);
            await logNotificationEvent(supabaseAdmin, {
              organization_id: orgId,
              site_id: siteId,
              unit_id: alert.unit_id,
              alert_id: alert.id,
              channel: "EMAIL",
              event_type: "ALERT_ACTIVE",
              to_recipients: [],
              status: "SKIPPED",
              reason: "No recipients configured",
            });
            emailsSkipped++;
            continue;
          }

          const alertLabel = alertTypeLabels[alert.alert_type] || alert.alert_type;
          const emailHtml = generateAlertEmailHtml(alert, unitInfo, appUrl);

          try {
            const { data: emailData, error: emailError } = await resend.emails.send({
              from: "FrostGuard Alerts <alerts@frostguard.app>",
              to: recipients.map(r => r.email),
              subject: `[${alert.severity.toUpperCase()}] ${alertLabel}: ${unitInfo.name}`,
              html: emailHtml,
            });

            if (emailError) {
              console.error(`Email send error for alert ${alert.id}:`, emailError);
              await logNotificationEvent(supabaseAdmin, {
                organization_id: orgId,
                site_id: siteId,
                unit_id: alert.unit_id,
                alert_id: alert.id,
                channel: "EMAIL",
                event_type: "ALERT_ACTIVE",
                to_recipients: recipients.map(r => r.email),
                status: "FAILED",
                reason: emailError.message || "Unknown error",
              });
              emailsFailed++;
            } else {
              console.log(`Email sent for alert ${alert.id} to ${recipients.length} recipients`);
              await logNotificationEvent(supabaseAdmin, {
                organization_id: orgId,
                site_id: siteId,
                unit_id: alert.unit_id,
                alert_id: alert.id,
                channel: "EMAIL",
                event_type: "ALERT_ACTIVE",
                to_recipients: recipients.map(r => r.email),
                status: "SENT",
                provider_message_id: emailData?.id,
              });
              emailsSent++;
            }
          } catch (err) {
            console.error(`Email exception for alert ${alert.id}:`, err);
            emailsFailed++;
          }
        } else if (channel === "SMS") {
          await logNotificationEvent(supabaseAdmin, {
            organization_id: orgId,
            site_id: siteId,
            unit_id: alert.unit_id,
            alert_id: alert.id,
            channel: "SMS",
            event_type: "ALERT_ACTIVE",
            to_recipients: [],
            status: "SKIPPED",
            reason: "SMS not yet implemented",
          });
        }
      }

      await supabaseAdmin
        .from("alerts")
        .update({
          last_notified_at: new Date().toISOString(),
          last_notified_reason: "ALERT_ACTIVE",
        })
        .eq("id", alert.id);
    }

    console.log(`process-escalations: Complete. Emails sent: ${emailsSent}, skipped: ${emailsSkipped}, failed: ${emailsFailed}. WebToast: ${webToastLogged}, InApp: ${inAppLogged}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: alerts.length,
        emails: { sent: emailsSent, skipped: emailsSkipped, failed: emailsFailed },
        webToast: webToastLogged,
        inApp: inAppLogged,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("process-escalations error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
