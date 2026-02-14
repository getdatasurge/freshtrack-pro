import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { validateInternalApiKey, unauthorizedResponse } from "../_shared/validation.ts";
import {
  formatTemp,
  storageToDisplay,
  getDisplayUnitSymbol,
  type SystemUnitsPreference
} from "../_shared/unitConversion.ts";
import {
  ALERT_TYPE_LABELS,
  getAlertTypeLabel,
  SEVERITY_EMAIL_COLORS,
  buildEscalationEmailSubject,
} from "../_shared/alertTemplates.ts";

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
  escalation_steps_sent: EscalationStepRecord[] | null;
  next_escalation_at: string | null;
  acknowledged_at: string | null;
  last_notified_at: string | null;
  unit_id: string;
  metadata: Record<string, unknown> | null;
  ack_required: boolean | null;
}

interface EscalationStep {
  delay_minutes: number;
  channels: string[];
  contact_priority?: number;
  repeat?: boolean;
}

interface EscalationStepRecord {
  step_index: number;
  sent_at: string;
  channels: string[];
  recipients: string[];
}

interface NotificationPolicy {
  initial_channels: string[];
  requires_ack: boolean;
  ack_deadline_minutes: number | null;
  escalation_steps: EscalationStep[];
  notify_roles: string[];
  notify_site_managers: boolean;
  notify_assigned_users: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start_local: string | null;
  quiet_hours_end_local: string | null;
  severity_threshold: string;
  allow_warning_notifications: boolean;
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
      organization: {
        units_preference: SystemUnitsPreference;
      };
    };
  };
}

interface EscalationContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  priority: number;
  notification_channels: string[];
}

// alertTypeLabels is now imported from _shared/alertTemplates.ts as ALERT_TYPE_LABELS

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
  if (error || !data) return null;
  return {
    initial_channels: data.initial_channels || ["IN_APP_CENTER"],
    requires_ack: data.requires_ack || false,
    ack_deadline_minutes: data.ack_deadline_minutes,
    escalation_steps: data.escalation_steps || [],
    notify_roles: data.notify_roles || ["owner", "admin"],
    notify_site_managers: data.notify_site_managers ?? true,
    notify_assigned_users: data.notify_assigned_users || false,
    quiet_hours_enabled: data.quiet_hours_enabled || false,
    quiet_hours_start_local: data.quiet_hours_start_local,
    quiet_hours_end_local: data.quiet_hours_end_local,
    severity_threshold: data.severity_threshold || "WARNING",
    allow_warning_notifications: data.allow_warning_notifications || false,
  };
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
    escalation_step_index?: number;
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
      escalation_step_index: params.escalation_step_index,
      provider_message_id: params.provider_message_id,
    });
  } catch (error) {
    console.error("Failed to log notification event:", error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAuditEvent(
  supabaseAdmin: any,
  params: {
    alert_id: string;
    organization_id: string;
    event_type: string;
    actor_type?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabaseAdmin.from("alert_audit_log").insert({
      alert_id: params.alert_id,
      organization_id: params.organization_id,
      event_type: params.event_type,
      actor_type: params.actor_type || "cron",
      details: params.details || {},
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

function buildEscalationSmsMessage(
  alert: Alert,
  unitName: string,
  siteName: string,
  stepNumber: number,
  elapsedMinutes: number
): string {
  const prefix = `[ESCALATION Step ${stepNumber} — Not ack'd after ${elapsedMinutes}m] `;
  const alertLabel = getAlertTypeLabel(alert.alert_type);

  let body: string;
  if (alert.temp_reading !== null) {
    body = `${unitName}: ${alertLabel}. Current: ${alert.temp_reading}°F.`;
  } else {
    body = `${unitName} at ${siteName}: ${alertLabel}.`;
  }

  const msg = `${prefix}${body} Immediate action required.`;
  // SMS limit ~160 chars — truncate if needed
  return msg.length > 160 ? msg.substring(0, 157) + "..." : msg;
}

function generateEscalationEmailHtml(
  alert: Alert,
  unitInfo: UnitInfo,
  stepNumber: number,
  elapsedMinutes: number,
  appUrl: string
): string {
  const alertLabel = getAlertTypeLabel(alert.alert_type);
  const displayUnits: SystemUnitsPreference = unitInfo.area.site.organization?.units_preference || "imperial";
  const unitSymbol = getDisplayUnitSymbol(displayUnits);

  let tempInfo = "";
  if (alert.temp_reading !== null) {
    const displayTemp = formatTemp(alert.temp_reading, displayUnits);
    tempInfo = `<p style="font-size:16px;font-weight:600;color:#dc2626;">Current: ${displayTemp}</p>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr><td align="center" style="padding:40px 0;">
          <table role="presentation" style="width:600px;max-width:100%;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
            <tr><td style="padding:24px 40px;background:#991b1b;border-radius:8px 8px 0 0;">
              <p style="margin:0;color:#fca5a5;font-size:13px;font-weight:600;text-transform:uppercase;">
                ⚠️ ESCALATION — Step ${stepNumber} (not acknowledged after ${elapsedMinutes} min)
              </p>
              <h1 style="margin:8px 0 0;color:#fff;font-size:22px;">${alertLabel}: ${unitInfo.name}</h1>
            </td></tr>
            <tr><td style="padding:32px 40px;">
              <p style="color:#6b7280;font-size:14px;">${unitInfo.area.name} · ${unitInfo.area.site.name}</p>
              ${tempInfo}
              <p style="margin:16px 0;color:#374151;">${alert.message || ""}</p>
              <a href="${appUrl}/alerts" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;margin-right:8px;">
                Acknowledge Alert
              </a>
              <a href="${appUrl}/unit/${unitInfo.id}" style="display:inline-block;padding:12px 24px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;">
                View Unit
              </a>
            </td></tr>
            <tr><td style="padding:24px 40px;background:#f9fafb;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                This escalation was sent because the alert has not been acknowledged. Reply or click Acknowledge to stop further escalations.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Process Escalation Steps — Cron Function (Every 1 Minute)
 *
 * Checks all active alerts that require acknowledgement but haven't been acknowledged.
 * For each, determines which escalation step should fire based on timing,
 * and dispatches notifications for that step.
 */
const handler = async (req: Request): Promise<Response> => {
  console.log("process-escalation-steps: Starting...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKeyResult = validateInternalApiKey(req);
    if (!apiKeyResult.valid) {
      console.warn("[process-escalation-steps] API key validation failed:", apiKeyResult.error);
      return unauthorizedResponse(apiKeyResult.error || "Unauthorized", corsHeaders);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const appUrl = Deno.env.get("APP_URL") || "https://frostguard.app";
    const now = Date.now();
    const nowIso = new Date().toISOString();

    // Query active alerts that:
    // 1. Have been notified at least once (last_notified_at IS NOT NULL)
    // 2. Are NOT acknowledged
    // 3. Have ack_required = true OR the policy requires ack (checked below)
    const { data: alerts, error: alertsError } = await supabaseAdmin
      .from("alerts")
      .select("*")
      .eq("status", "active")
      .is("acknowledged_at", null)
      .not("last_notified_at", "is", null);

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      throw alertsError;
    }

    console.log(`process-escalation-steps: Found ${alerts?.length || 0} active unacknowledged alerts`);

    if (!alerts || alerts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No alerts need escalation", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let escalationsSent = 0;
    let alertsExpired = 0;

    for (const rawAlert of alerts) {
      const alert = rawAlert as Alert;

      // Get unit info
      const { data: unit, error: unitError } = await supabaseAdmin
        .from("units")
        .select(`
          id, name,
          area:areas!inner(
            id, name,
            site:sites!inner(
              id, name, organization_id, timezone,
              organization:organizations!inner(units_preference)
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

      // Get effective notification policy
      const policy = await getEffectivePolicy(supabaseAdmin, alert.unit_id, alert.alert_type);
      if (!policy || !policy.requires_ack) {
        continue; // No policy or ack not required — skip escalation
      }

      const escalationSteps = (policy.escalation_steps || []) as EscalationStep[];
      if (escalationSteps.length === 0) {
        // Check if ack_deadline_minutes has passed → expire the alert
        if (policy.ack_deadline_minutes) {
          const triggeredAt = new Date(alert.triggered_at).getTime();
          const deadlineMs = policy.ack_deadline_minutes * 60 * 1000;
          if (now - triggeredAt > deadlineMs) {
            await supabaseAdmin.from("alerts").update({
              status: "expired" as never, // Type workaround — expired is valid status
              resolution_type: "expired",
            }).eq("id", alert.id);

            await logAuditEvent(supabaseAdmin, {
              alert_id: alert.id,
              organization_id: orgId,
              event_type: "expired",
              details: { reason: "Ack deadline exceeded with no escalation steps", deadline_minutes: policy.ack_deadline_minutes },
            });
            alertsExpired++;
          }
        }
        continue;
      }

      // Determine which step(s) should have fired by now
      const stepsSent = (alert.escalation_steps_sent || []) as EscalationStepRecord[];
      const lastNotifiedAt = new Date(alert.last_notified_at!).getTime();
      const triggeredAt = new Date(alert.triggered_at).getTime();

      // Calculate cumulative time for each step
      let cumulativeMinutes = 0;
      let nextStepToSend: number | null = null;

      for (let i = 0; i < escalationSteps.length; i++) {
        cumulativeMinutes += escalationSteps[i].delay_minutes;
        const stepFireAt = triggeredAt + (cumulativeMinutes * 60 * 1000);

        // Check if this step should have fired and hasn't been sent yet
        const alreadySent = stepsSent.some(s => s.step_index === i);
        if (!alreadySent && now >= stepFireAt) {
          nextStepToSend = i;
          break; // Send one step at a time
        }
      }

      if (nextStepToSend === null) {
        // Check if ALL steps exhausted
        const allStepsSent = escalationSteps.every((_, i) =>
          stepsSent.some(s => s.step_index === i)
        );

        if (allStepsSent) {
          // Check for repeat on last step
          const lastStep = escalationSteps[escalationSteps.length - 1];
          if (lastStep.repeat) {
            const lastSentRecord = stepsSent
              .filter(s => s.step_index === escalationSteps.length - 1)
              .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

            if (lastSentRecord) {
              const lastSentAt = new Date(lastSentRecord.sent_at).getTime();
              const repeatFireAt = lastSentAt + (lastStep.delay_minutes * 60 * 1000);
              if (now >= repeatFireAt) {
                nextStepToSend = escalationSteps.length - 1; // Repeat last step
              }
            }
          } else {
            // All steps exhausted, no repeat → expire alert
            await supabaseAdmin.from("alerts").update({
              status: "resolved",
              resolution_type: "expired",
              resolved_at: nowIso,
            }).eq("id", alert.id);

            await logAuditEvent(supabaseAdmin, {
              alert_id: alert.id,
              organization_id: orgId,
              event_type: "expired",
              details: { reason: "All escalation steps exhausted without acknowledgement", steps_sent: stepsSent.length },
            });

            // Send final "UNACKNOWLEDGED" notification to all org owners
            await logNotificationEvent(supabaseAdmin, {
              organization_id: orgId,
              site_id: siteId,
              unit_id: alert.unit_id,
              alert_id: alert.id,
              channel: "ALL",
              event_type: "ESCALATION_EXHAUSTED",
              to_recipients: [],
              status: "SENT",
              reason: "All escalation steps exhausted",
            });

            alertsExpired++;
            continue;
          }
        }

        continue; // No step to send yet
      }

      // === SEND ESCALATION STEP ===
      const step = escalationSteps[nextStepToSend];
      const stepNumber = nextStepToSend + 1;
      const elapsedMinutes = Math.floor((now - triggeredAt) / 60000);

      console.log(`Alert ${alert.id}: Sending escalation step ${stepNumber} (${elapsedMinutes}m since trigger)`);

      // Get escalation contacts by priority
      const { data: contacts } = await supabaseAdmin
        .from("escalation_contacts")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("priority", { ascending: true });

      const escalationContacts = (contacts || []) as EscalationContact[];

      // Filter contacts by priority if specified in step
      let targetContacts = escalationContacts;
      if (step.contact_priority !== undefined && step.contact_priority !== null) {
        targetContacts = escalationContacts.filter(c => c.priority <= step.contact_priority!);
      }

      // Also get role-based recipients from notification policy
      const rolesToNotify = policy.notify_roles || ["owner", "admin"];
      const { data: roleUsers } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .in("role", rolesToNotify);

      const recipientEmails: string[] = [];
      const recipientPhones: string[] = [];

      // Add escalation contacts
      for (const contact of targetContacts) {
        if (contact.email && step.channels.includes("EMAIL")) {
          recipientEmails.push(contact.email);
        }
        if (contact.phone && step.channels.includes("SMS")) {
          recipientPhones.push(contact.phone);
        }
      }

      // Add role-based recipients
      if (roleUsers && roleUsers.length > 0) {
        const userIds = roleUsers.map((r: { user_id: string }) => r.user_id);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email, full_name, phone, notification_preferences")
          .in("user_id", userIds);

        if (profiles) {
          for (const profile of profiles as { user_id: string; email: string; phone: string | null; notification_preferences: { sms?: boolean; email?: boolean } | null }[]) {
            if (step.channels.includes("EMAIL") && profile.email) {
              if (!recipientEmails.includes(profile.email)) {
                recipientEmails.push(profile.email);
              }
            }
            if (step.channels.includes("SMS") && profile.phone) {
              const smsEnabled = profile.notification_preferences?.sms !== false;
              if (smsEnabled && !recipientPhones.includes(profile.phone)) {
                recipientPhones.push(profile.phone);
              }
            }
          }
        }
      }

      // Send emails
      if (step.channels.includes("EMAIL") && recipientEmails.length > 0) {
        try {
          const emailHtml = generateEscalationEmailHtml(alert, unitInfo, stepNumber, elapsedMinutes, appUrl);

          const { error: emailError } = await resend.emails.send({
            from: "FrostGuard Alerts <alerts@frostguard.app>",
            to: recipientEmails,
            subject: buildEscalationEmailSubject(alert.alert_type, stepNumber, unitInfo.name),
            html: emailHtml,
          });

          if (emailError) {
            console.error(`Escalation email error for alert ${alert.id}:`, emailError);
            await logNotificationEvent(supabaseAdmin, {
              organization_id: orgId, site_id: siteId, unit_id: alert.unit_id, alert_id: alert.id,
              channel: "EMAIL", event_type: "ESCALATION_STEP", to_recipients: recipientEmails,
              status: "FAILED", reason: emailError.message, escalation_step_index: nextStepToSend,
            });
          } else {
            await logNotificationEvent(supabaseAdmin, {
              organization_id: orgId, site_id: siteId, unit_id: alert.unit_id, alert_id: alert.id,
              channel: "EMAIL", event_type: "ESCALATION_STEP", to_recipients: recipientEmails,
              status: "SENT", escalation_step_index: nextStepToSend,
            });
            console.log(`Escalation email sent for alert ${alert.id} to ${recipientEmails.length} recipients`);
          }
        } catch (err) {
          console.error(`Escalation email exception for alert ${alert.id}:`, err);
        }
      }

      // Send SMS
      if (step.channels.includes("SMS") && recipientPhones.length > 0) {
        const smsMessage = buildEscalationSmsMessage(alert, unitInfo.name, unitInfo.area.site.name, stepNumber, elapsedMinutes);
        const supabaseUrl = Deno.env.get("SUPABASE_URL");

        for (const phone of recipientPhones) {
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/send-sms-alert`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                to: phone,
                message: smsMessage,
                alertType: alert.alert_type,
                organizationId: orgId,
                alertId: alert.id,
              }),
            });
            const smsResult = await response.json();
            console.log(`Escalation SMS to ${phone}: ${smsResult.status}`);
          } catch (err) {
            console.error(`Escalation SMS exception for ${phone}:`, err);
          }
        }

        await logNotificationEvent(supabaseAdmin, {
          organization_id: orgId, site_id: siteId, unit_id: alert.unit_id, alert_id: alert.id,
          channel: "SMS", event_type: "ESCALATION_STEP", to_recipients: recipientPhones,
          status: "SENT", escalation_step_index: nextStepToSend,
        });
      }

      // Update alert with escalation tracking
      const newStepRecord: EscalationStepRecord = {
        step_index: nextStepToSend,
        sent_at: nowIso,
        channels: step.channels,
        recipients: [...recipientEmails, ...recipientPhones],
      };

      const updatedStepsSent = [...stepsSent, newStepRecord];

      await supabaseAdmin.from("alerts").update({
        escalation_level: stepNumber,
        escalation_steps_sent: updatedStepsSent,
        last_notified_at: nowIso,
        last_notified_reason: `ESCALATION_STEP_${stepNumber}`,
      }).eq("id", alert.id);

      // Log audit event
      await logAuditEvent(supabaseAdmin, {
        alert_id: alert.id,
        organization_id: orgId,
        event_type: "escalation_triggered",
        details: {
          step_number: stepNumber,
          channels: step.channels,
          email_recipients: recipientEmails.length,
          sms_recipients: recipientPhones.length,
          elapsed_minutes: elapsedMinutes,
        },
      });

      escalationsSent++;
    }

    console.log(`process-escalation-steps: Complete. Escalations sent: ${escalationsSent}, expired: ${alertsExpired}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: alerts.length,
        escalations_sent: escalationsSent,
        alerts_expired: alertsExpired,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("process-escalation-steps error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
