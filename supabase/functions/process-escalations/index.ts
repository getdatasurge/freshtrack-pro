import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Roles that should receive escalation emails
const ESCALATION_ROLES = ['owner', 'admin', 'manager'] as const;

interface EscalationPolicy {
  id: string;
  organization_id: string | null;
  site_id: string | null;
  critical_primary_delay_minutes: number;
  critical_secondary_delay_minutes: number | null;
  warning_primary_delay_minutes: number;
  warning_secondary_delay_minutes: number | null;
  acknowledge_stops_notifications: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  repeat_notification_interval_minutes: number | null;
}

interface Alert {
  id: string;
  title: string;
  message: string | null;
  alert_type: string;
  severity: string;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  escalation_level: number;
  next_escalation_at: string | null;
  unit_id: string;
  temp_reading: number | null;
  temp_limit: number | null;
}

interface UnitInfo {
  id: string;
  name: string;
  unit_type: string;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  temp_limit_high: number;
  temp_limit_low: number | null;
  areaId: string;
  areaName: string;
  siteId: string;
  siteName: string;
  organizationId: string;
  timezone: string;
}

interface EligibleRecipient {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

// Push notification structure (for future implementation)
interface PushNotification {
  title: string;
  body: string;
  data: {
    alertId: string;
    unitId: string;
    action: string;
    deepLink?: string;
  };
}

// SMS message structure (Twilio-compatible, for future implementation)
interface SMSMessage {
  to: string; // E.164 format
  body: string;
  alertId: string;
  unitId: string;
}

function generateAlertEmailHtml(
  alert: Alert,
  unit: UnitInfo,
  escalationLevel: number
): string {
  const siteName = unit.siteName;
  const areaName = unit.areaName;
  const unitName = unit.name;
  
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
  
  const alertTypeLabels: Record<string, string> = {
    missed_manual_entry: 'Manual Logging Overdue',
    monitoring_interrupted: 'Sensor Offline',
    alarm_active: 'Temperature Alarm',
    low_battery: 'Low Battery Warning',
    sensor_fault: 'Sensor Fault',
    door_open: 'Door Open Alert',
    calibration_due: 'Calibration Due',
  };
  
  const alertLabel = alertTypeLabels[alert.alert_type] || alert.alert_type;
  const severityColor = severityColors[alert.severity] || '#6b7280';
  const triggeredAt = new Date(alert.triggered_at).toLocaleString();
  
  const escalationBadge = escalationLevel > 1 
    ? `<span style="background: #fbbf24; color: #78350f; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">Escalation Level ${escalationLevel}</span>` 
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">❄️ FrostGuard</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Alert Banner -->
          <tr>
            <td style="background-color: ${severityColor}; padding: 16px 32px;">
              <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">
                ${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alertLabel}${escalationBadge}
              </h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- Unit Info -->
                <tr>
                  <td style="padding-bottom: 24px;">
                    <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600;">${unitName}</h3>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      ${areaName} · ${siteName}
                    </p>
                  </td>
                </tr>
                
                <!-- Alert Details -->
                <tr>
                  <td style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Alert Type</span>
                          <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${alertLabel}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Severity</span>
                          <p style="margin: 4px 0 0 0; color: ${severityColor}; font-size: 16px; font-weight: 500; text-transform: capitalize;">${alert.severity}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Triggered At</span>
                          <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${triggeredAt}</p>
                        </td>
                      </tr>
                      ${alert.temp_reading !== null ? `
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Temperature Reading</span>
                          <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 500;">${alert.temp_reading}°F</p>
                        </td>
                      </tr>
                      ` : ''}
                      ${alert.message ? `
                      <tr>
                        <td>
                          <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</span>
                          <p style="margin: 4px 0 0 0; color: #111827; font-size: 14px;">${alert.message}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
                
                <!-- CTA Button -->
                <tr>
                  <td style="padding-top: 24px;" align="center">
                    <a href="${Deno.env.get('SITE_URL') || 'https://frostguard.app'}/units/${unit.id}" 
                       style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                      View Unit Details
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated alert from FrostGuard Temperature Monitoring.<br>
                To manage your notification preferences, visit your account settings.
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

function generateSummaryEmailHtml(
  alerts: Array<{ alert: Alert; unit: UnitInfo }>,
  orgName: string
): string {
  const alertRows = alerts.map(({ alert, unit }) => {
    const severityColors: Record<string, string> = {
      critical: '#dc2626',
      warning: '#f59e0b',
      info: '#3b82f6',
    };
    const color = severityColors[alert.severity] || '#6b7280';
    
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="color: ${color}; font-weight: 600;">${alert.severity.toUpperCase()}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${unit.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${unit.siteName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${alert.title}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Level ${alert.escalation_level}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">❄️ FrostGuard - Escalation Summary</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 20px; font-weight: 600;">${orgName}</h2>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">
                ${alerts.length} alert${alerts.length !== 1 ? 's' : ''} requiring attention
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Severity</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Unit</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Site</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Alert</th>
                  <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Escalation</th>
                </tr>
                ${alertRows}
              </table>
              
              <div style="padding-top: 24px; text-align: center;">
                <a href="${Deno.env.get('SITE_URL') || 'https://frostguard.app'}/alerts" 
                   style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  View All Alerts
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated escalation summary from FrostGuard Temperature Monitoring.
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

function isInQuietHours(policy: EscalationPolicy, timezone: string): boolean {
  if (!policy.quiet_hours_enabled || !policy.quiet_hours_start || !policy.quiet_hours_end) {
    return false;
  }
  
  // Get current time in the site's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const timeStr = formatter.format(now);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;
  
  const [startH, startM] = policy.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = policy.quiet_hours_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Handle overnight quiet hours (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function calculateNextEscalation(
  alert: Alert,
  policy: EscalationPolicy,
  newLevel: number
): Date {
  const now = new Date();
  let delayMinutes: number;
  
  if (alert.severity === 'critical') {
    if (newLevel === 1) {
      delayMinutes = policy.critical_primary_delay_minutes;
    } else if (newLevel === 2 && policy.critical_secondary_delay_minutes) {
      delayMinutes = policy.critical_secondary_delay_minutes;
    } else {
      delayMinutes = policy.repeat_notification_interval_minutes || 30;
    }
  } else {
    if (newLevel === 1) {
      delayMinutes = policy.warning_primary_delay_minutes;
    } else if (newLevel === 2 && policy.warning_secondary_delay_minutes) {
      delayMinutes = policy.warning_secondary_delay_minutes;
    } else {
      delayMinutes = policy.repeat_notification_interval_minutes || 60;
    }
  }
  
  return new Date(now.getTime() + delayMinutes * 60 * 1000);
}

// Prepare push notification payload (for future implementation)
function preparePushNotification(alert: Alert, unit: UnitInfo): PushNotification {
  const alertTypeLabels: Record<string, string> = {
    missed_manual_entry: 'Manual Logging Overdue',
    monitoring_interrupted: 'Sensor Offline',
    alarm_active: 'Temperature Alarm',
  };
  
  return {
    title: `${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alertTypeLabels[alert.alert_type] || alert.title}`,
    body: `${unit.name} at ${unit.siteName} requires attention`,
    data: {
      alertId: alert.id,
      unitId: unit.id,
      action: alert.alert_type === 'missed_manual_entry' ? 'log_temperature' : 'view_unit',
      deepLink: `/units/${unit.id}`,
    },
  };
}

// Prepare SMS message (Twilio-compatible, for future implementation)
function prepareSMSMessage(alert: Alert, unit: UnitInfo, recipientPhone: string): SMSMessage {
  const alertTypeLabels: Record<string, string> = {
    missed_manual_entry: 'Manual log overdue',
    monitoring_interrupted: 'Sensor offline',
    alarm_active: 'Temp alarm',
  };
  
  const label = alertTypeLabels[alert.alert_type] || alert.title;
  const severity = alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ Warning';
  
  return {
    to: recipientPhone,
    body: `FrostGuard ${severity}: ${label} for ${unit.name} at ${unit.siteName}. Check app for details.`,
    alertId: alert.id,
    unitId: unit.id,
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Process escalations function invoked");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Find alerts that need escalation
    const now = new Date().toISOString();
    
    const { data: alertsToEscalate, error: alertsError } = await supabase
      .from('alerts')
      .select(`
        id,
        title,
        message,
        alert_type,
        severity,
        status,
        triggered_at,
        acknowledged_at,
        escalation_level,
        next_escalation_at,
        unit_id,
        temp_reading,
        temp_limit
      `)
      .in('status', ['active', 'acknowledged'])
      .or(`next_escalation_at.is.null,next_escalation_at.lte.${now}`)
      .order('severity', { ascending: false });
    
    if (alertsError) {
      console.error("Error fetching alerts:", alertsError);
      throw alertsError;
    }
    
    console.log(`Found ${alertsToEscalate?.length || 0} alerts to process`);
    
    if (!alertsToEscalate || alertsToEscalate.length === 0) {
      return new Response(
        JSON.stringify({ message: "No alerts to escalate", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const emailsSent: string[] = [];
    const errors: string[] = [];
    const orgAlertGroups: Map<string, Array<{ alert: Alert; unit: UnitInfo }>> = new Map();
    
    for (const alert of alertsToEscalate) {
      try {
        // Get unit info with area and site using separate queries to avoid type issues
        const { data: unitData, error: unitError } = await supabase
          .from('units')
          .select('id, name, unit_type, last_temp_reading, last_reading_at, temp_limit_high, temp_limit_low, area_id')
          .eq('id', alert.unit_id)
          .single();
        
        if (unitError || !unitData) {
          console.error(`Error fetching unit ${alert.unit_id}:`, unitError);
          continue;
        }
        
        // Get area info
        const { data: areaData, error: areaError } = await supabase
          .from('areas')
          .select('id, name, site_id')
          .eq('id', unitData.area_id)
          .single();
        
        if (areaError || !areaData) {
          console.error(`Error fetching area ${unitData.area_id}:`, areaError);
          continue;
        }
        
        // Get site info
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('id, name, organization_id, timezone')
          .eq('id', areaData.site_id)
          .single();
        
        if (siteError || !siteData) {
          console.error(`Error fetching site ${areaData.site_id}:`, siteError);
          continue;
        }
        
        const unit: UnitInfo = {
          id: unitData.id,
          name: unitData.name,
          unit_type: unitData.unit_type,
          last_temp_reading: unitData.last_temp_reading,
          last_reading_at: unitData.last_reading_at,
          temp_limit_high: unitData.temp_limit_high,
          temp_limit_low: unitData.temp_limit_low,
          areaId: areaData.id,
          areaName: areaData.name,
          siteId: siteData.id,
          siteName: siteData.name,
          organizationId: siteData.organization_id,
          timezone: siteData.timezone || 'America/New_York',
        };
        
        const orgId = unit.organizationId;
        const siteId = unit.siteId;
        const timezone = unit.timezone;
        
        // Get escalation policy (site-level first, then org-level fallback)
        let policy: EscalationPolicy | null = null;
        
        const { data: sitePolicy } = await supabase
          .from('escalation_policies')
          .select('*')
          .eq('site_id', siteId)
          .maybeSingle();
        
        if (sitePolicy) {
          policy = sitePolicy;
        } else {
          const { data: orgPolicy } = await supabase
            .from('escalation_policies')
            .select('*')
            .eq('organization_id', orgId)
            .maybeSingle();
          
          if (orgPolicy) {
            policy = orgPolicy;
          }
        }
        
        if (!policy) {
          // Use default policy
          policy = {
            id: 'default',
            organization_id: orgId,
            site_id: null,
            critical_primary_delay_minutes: 0,
            critical_secondary_delay_minutes: 15,
            warning_primary_delay_minutes: 0,
            warning_secondary_delay_minutes: 30,
            acknowledge_stops_notifications: true,
            quiet_hours_enabled: false,
            quiet_hours_start: null,
            quiet_hours_end: null,
            repeat_notification_interval_minutes: 30,
          };
        }
        
        // Check if alert is acknowledged and policy stops notifications
        if (alert.status === 'acknowledged' && policy.acknowledge_stops_notifications) {
          console.log(`Alert ${alert.id} acknowledged, skipping escalation`);
          continue;
        }
        
        // Check quiet hours
        if (isInQuietHours(policy, timezone)) {
          console.log(`Alert ${alert.id} in quiet hours, skipping`);
          continue;
        }
        
        // Determine new escalation level
        const newLevel = alert.escalation_level + 1;
        
        // Get eligible recipients (managers, admins, owners only - not staff)
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('organization_id', orgId)
          .in('role', ESCALATION_ROLES);
        
        if (rolesError) {
          console.error(`Error fetching roles for org ${orgId}:`, rolesError);
          continue;
        }
        
        // Get profiles for these users
        const userIds = (rolesData || []).map(r => r.user_id);
        
        if (userIds.length === 0) {
          console.log(`No eligible recipients for org ${orgId}`);
          continue;
        }
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email, full_name, notification_preferences')
          .in('user_id', userIds);
        
        if (profilesError) {
          console.error(`Error fetching profiles:`, profilesError);
          continue;
        }
        
        // Build eligible recipients list
        const eligibleRecipients: EligibleRecipient[] = [];
        for (const roleRecord of rolesData || []) {
          const profile = (profilesData || []).find(p => p.user_id === roleRecord.user_id);
          if (!profile) continue;
          
          // Check email preference
          const prefs = profile.notification_preferences as { email?: boolean } | null;
          if (prefs?.email === false) continue;
          
          eligibleRecipients.push({
            user_id: roleRecord.user_id,
            email: profile.email,
            full_name: profile.full_name,
            role: roleRecord.role,
          });
        }
        
        console.log(`Found ${eligibleRecipients.length} eligible recipients for alert ${alert.id}`);
        
        // Send individual alert emails
        for (const recipient of eligibleRecipients) {
          const emailHtml = generateAlertEmailHtml(alert as Alert, unit, newLevel);
          
          const { error: emailError } = await resend.emails.send({
            from: "FrostGuard <alerts@frostguard.app>",
            to: [recipient.email],
            subject: `${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.title} - ${unit.name}`,
            html: emailHtml,
          });
          
          if (emailError) {
            console.error(`Failed to send email to ${recipient.email}:`, emailError);
            errors.push(`Failed: ${recipient.email}`);
            
            // Record failed delivery
            await supabase.from('notification_deliveries').insert({
              alert_id: alert.id,
              user_id: recipient.user_id,
              channel: 'email',
              status: 'failed',
              error_message: JSON.stringify(emailError),
            });
          } else {
            console.log(`Sent escalation email to ${recipient.email}`);
            emailsSent.push(recipient.email);
            
            // Record successful delivery
            await supabase.from('notification_deliveries').insert({
              alert_id: alert.id,
              user_id: recipient.user_id,
              channel: 'email',
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          }
        }
        
        // Group alerts by org for admin summary
        if (!orgAlertGroups.has(orgId)) {
          orgAlertGroups.set(orgId, []);
        }
        orgAlertGroups.get(orgId)!.push({ alert: alert as Alert, unit });
        
        // Update alert escalation level and next_escalation_at
        const nextEscalation = calculateNextEscalation(alert as Alert, policy, newLevel);
        
        await supabase
          .from('alerts')
          .update({
            escalation_level: newLevel,
            next_escalation_at: nextEscalation.toISOString(),
          })
          .eq('id', alert.id);
        
        // Log escalation event
        await supabase.from('event_logs').insert({
          organization_id: orgId,
          site_id: siteId,
          unit_id: unit.id,
          event_type: 'alert_escalated',
          actor_type: 'system',
          event_data: {
            alert_id: alert.id,
            alert_type: alert.alert_type,
            severity: alert.severity,
            escalation_level: newLevel,
            recipients_notified: emailsSent.length,
          },
        });
        
      } catch (alertError) {
        console.error(`Error processing alert ${alert.id}:`, alertError);
        errors.push(`Alert ${alert.id}: ${alertError}`);
      }
    }
    
    // Send admin summary emails for each org with escalated alerts
    for (const [orgId, orgAlerts] of orgAlertGroups) {
      if (orgAlerts.length === 0) continue;
      
      // Get org name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      
      const orgName = org?.name || 'Your Organization';
      
      // Get admin/owner roles
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .in('role', ['admin', 'owner']);
      
      const adminUserIds = (adminRoles || []).map(r => r.user_id);
      
      if (adminUserIds.length > 0) {
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('user_id, email, notification_preferences')
          .in('user_id', adminUserIds);
        
        const adminRecipients = (adminProfiles || [])
          .filter(p => {
            const prefs = p.notification_preferences as { email?: boolean } | null;
            return prefs?.email !== false;
          })
          .map(p => p.email);
        
        if (adminRecipients.length > 0) {
          const summaryHtml = generateSummaryEmailHtml(orgAlerts, orgName);
          
          const { error: summaryError } = await resend.emails.send({
            from: "FrostGuard <alerts@frostguard.app>",
            to: adminRecipients,
            subject: `📊 FrostGuard Escalation Summary - ${orgAlerts.length} Alert${orgAlerts.length !== 1 ? 's' : ''}`,
            html: summaryHtml,
          });
          
          if (summaryError) {
            console.error(`Failed to send summary to admins:`, summaryError);
          } else {
            console.log(`Sent escalation summary to ${adminRecipients.length} admins`);
          }
        }
      }
    }
    
    const result = {
      message: "Escalation processing complete",
      processed: alertsToEscalate.length,
      emailsSent: emailsSent.length,
      errors: errors.length > 0 ? errors : undefined,
    };
    
    console.log("Escalation result:", result);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
    
  } catch (error: unknown) {
    console.error("Error in process-escalations:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
