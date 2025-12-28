import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface NotificationSettings {
  email_enabled: boolean;
  recipients: string[];
  notify_temp_excursion: boolean;
  notify_alarm_active: boolean;
  notify_manual_required: boolean;
  notify_offline: boolean;
  notify_low_battery: boolean;
  notify_warnings: boolean;
}

interface EscalationPolicy {
  critical_primary_delay_minutes: number;
  critical_secondary_delay_minutes: number | null;
  critical_owner_delay_minutes: number | null;
  warning_primary_delay_minutes: number;
  warning_secondary_delay_minutes: number | null;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_behavior: string | null;
  acknowledge_stops_notifications: boolean;
  repeat_notification_interval_minutes: number | null;
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

const alertTypeToSettingKey: Record<string, keyof NotificationSettings> = {
  temp_excursion: "notify_temp_excursion",
  alarm_active: "notify_alarm_active",
  missed_manual_entry: "notify_manual_required",
  monitoring_interrupted: "notify_offline",
  low_battery: "notify_low_battery",
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

  // Add metadata info if available
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
  policy: EscalationPolicy,
  timezone: string
): boolean {
  if (!policy.quiet_hours_enabled || !policy.quiet_hours_start || !policy.quiet_hours_end) {
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

    const [startHour, startMinute] = policy.quiet_hours_start.split(":").map(Number);
    const [endHour, endMinute] = policy.quiet_hours_end.split(":").map(Number);
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

async function logNotificationEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
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

async function getNotificationSettings(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string
): Promise<NotificationSettings> {
  const { data } = await supabaseAdmin
    .from("notification_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (data) {
    return {
      email_enabled: data.email_enabled,
      recipients: data.recipients || [],
      notify_temp_excursion: data.notify_temp_excursion,
      notify_alarm_active: data.notify_alarm_active,
      notify_manual_required: data.notify_manual_required,
      notify_offline: data.notify_offline,
      notify_low_battery: data.notify_low_battery,
      notify_warnings: data.notify_warnings,
    };
  }

  // Default settings if not configured
  return {
    email_enabled: true,
    recipients: [],
    notify_temp_excursion: true,
    notify_alarm_active: true,
    notify_manual_required: true,
    notify_offline: false,
    notify_low_battery: false,
    notify_warnings: false,
  };
}

async function getRecipients(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  settings: NotificationSettings
): Promise<EligibleRecipient[]> {
  const recipients: EligibleRecipient[] = [];

  // Add recipients from notification_settings
  for (const email of settings.recipients) {
    recipients.push({
      email: email.trim(),
      name: null,
      role: "configured",
      user_id: "",
    });
  }

  // If no configured recipients, fall back to org admins/owners
  if (recipients.length === 0) {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .in("role", ["owner", "admin"]);

    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", userIds);

      if (profiles) {
        for (const profile of profiles) {
          const role = roles.find(r => r.user_id === profile.user_id);
          recipients.push({
            email: profile.email,
            name: profile.full_name,
            role: role?.role || "admin",
            user_id: profile.user_id,
          });
        }
      }
    }
  }

  return recipients;
}

function shouldNotifyForAlertType(
  alertType: string,
  severity: string,
  settings: NotificationSettings
): { shouldNotify: boolean; reason?: string } {
  // Check if we should notify for warnings
  if (severity === "warning" && !settings.notify_warnings) {
    return { shouldNotify: false, reason: "Warning notifications disabled" };
  }

  // Check alert-type specific settings
  const settingKey = alertTypeToSettingKey[alertType];
  if (settingKey && !settings[settingKey]) {
    return { shouldNotify: false, reason: `${alertType} notifications disabled` };
  }

  return { shouldNotify: true };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("process-escalations: Starting...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const appUrl = Deno.env.get("APP_URL") || "https://frostguard.app";

    // Fetch active alerts that need notification (newly active or never notified)
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
        JSON.stringify({ success: true, message: "No alerts need notification", emailsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailsSent = 0;
    let emailsSkipped = 0;
    let emailsFailed = 0;

    for (const alert of alerts as Alert[]) {
      console.log(`Processing alert ${alert.id} (${alert.alert_type}, ${alert.severity})`);

      // Get unit info with area and site
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

      // Get notification settings
      const settings = await getNotificationSettings(supabaseAdmin, orgId);

      // Check if email is enabled
      if (!settings.email_enabled) {
        console.log(`Skipping alert ${alert.id}: email notifications disabled`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "email",
          event_type: "ALERT_ACTIVE",
          to_recipients: [],
          status: "SKIPPED",
          reason: "Email notifications disabled",
        });
        emailsSkipped++;
        continue;
      }

      // Check if we should notify for this alert type/severity
      const { shouldNotify, reason: skipReason } = shouldNotifyForAlertType(
        alert.alert_type,
        alert.severity,
        settings
      );

      if (!shouldNotify) {
        console.log(`Skipping alert ${alert.id}: ${skipReason}`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "email",
          event_type: "ALERT_ACTIVE",
          to_recipients: [],
          status: "SKIPPED",
          reason: skipReason,
        });
        emailsSkipped++;
        continue;
      }

      // Get recipients
      const recipients = await getRecipients(supabaseAdmin, orgId, settings);

      if (recipients.length === 0) {
        console.log(`Skipping alert ${alert.id}: no recipients configured`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "email",
          event_type: "ALERT_ACTIVE",
          to_recipients: [],
          status: "SKIPPED",
          reason: "No recipients configured",
        });
        emailsSkipped++;
        continue;
      }

      // Check quiet hours
      const { data: policy } = await supabaseAdmin
        .from("escalation_policies")
        .select("*")
        .or(`organization_id.eq.${orgId},site_id.eq.${siteId}`)
        .order("site_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (policy && isInQuietHours(policy as EscalationPolicy, unitInfo.area.site.timezone)) {
        console.log(`Skipping alert ${alert.id}: quiet hours active`);
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "email",
          event_type: "ALERT_ACTIVE",
          to_recipients: recipients.map(r => r.email),
          status: "SKIPPED",
          reason: "Quiet hours active",
        });
        emailsSkipped++;
        continue;
      }

      // Send email
      const recipientEmails = recipients.map(r => r.email);
      const alertLabel = alertTypeLabels[alert.alert_type] || alert.alert_type;
      const emailHtml = generateAlertEmailHtml(alert, unitInfo, appUrl);

      try {
        console.log(`Sending email to ${recipientEmails.join(", ")} for alert ${alert.id}`);
        
        const emailResponse = await resend.emails.send({
          from: "FrostGuard Alerts <onboarding@resend.dev>",
          to: recipientEmails,
          subject: `🚨 ${alert.severity.toUpperCase()}: ${alertLabel} - ${unitInfo.name}`,
          html: emailHtml,
        });

        console.log(`Email sent successfully:`, emailResponse);

        // Log success
        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "email",
          event_type: "ALERT_ACTIVE",
          to_recipients: recipientEmails,
          status: "SENT",
          provider_message_id: emailResponse.data?.id,
        });

        // Update alert with notification timestamp
        await supabaseAdmin
          .from("alerts")
          .update({
            last_notified_at: new Date().toISOString(),
            last_notified_reason: "ALERT_ACTIVE",
          })
          .eq("id", alert.id);

        emailsSent++;
      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        console.error(`Failed to send email for alert ${alert.id}:`, emailError);

        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId,
          site_id: siteId,
          unit_id: alert.unit_id,
          alert_id: alert.id,
          channel: "email",
          event_type: "ALERT_ACTIVE",
          to_recipients: recipientEmails,
          status: "FAILED",
          reason: errorMessage,
        });

        emailsFailed++;
      }
    }

    console.log(`process-escalations: Complete. Sent: ${emailsSent}, Skipped: ${emailsSkipped}, Failed: ${emailsFailed}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        emailsSkipped,
        emailsFailed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("process-escalations error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
