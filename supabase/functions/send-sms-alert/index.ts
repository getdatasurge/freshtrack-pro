import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// E.164 phone number validation
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Rate limit window in milliseconds (15 minutes)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface SmsAlertRequest {
  to: string;
  message: string;
  alertType: string;
  userId?: string;
  organizationId: string;
  alertId?: string;
}

interface TwilioResponse {
  sid?: string;
  status?: string;
  error_code?: number;
  error_message?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-sms-alert: ============ Request Start ============");
  console.log("send-sms-alert: Method:", req.method);
  console.log("send-sms-alert: Time:", new Date().toISOString());

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Twilio credentials from environment
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    // Log credential existence (not values!)
    console.log("send-sms-alert: Credentials check:", {
      hasAccountSid: !!TWILIO_ACCOUNT_SID,
      hasAuthToken: !!TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!TWILIO_PHONE_NUMBER,
      fromNumber: TWILIO_PHONE_NUMBER ? `${TWILIO_PHONE_NUMBER.slice(0, 5)}***` : "MISSING",
    });

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("send-sms-alert: Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured", status: "failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: SmsAlertRequest = await req.json();
    const { to, message, alertType, userId, organizationId, alertId } = body;

    // Log request parameters (mask phone number for privacy)
    console.log("send-sms-alert: Request params:", {
      to: to ? `${to.slice(0, 5)}***${to.slice(-2)}` : "MISSING",
      alertType,
      organizationId: organizationId ? `${organizationId.slice(0, 8)}...` : "MISSING",
      hasUserId: !!userId,
      hasAlertId: !!alertId,
      messageLength: message?.length || 0,
    });

    // Validate required fields
    if (!to || !message || !alertType || !organizationId) {
      console.error("send-sms-alert: Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message, alertType, organizationId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate E.164 phone number format
    if (!E164_REGEX.test(to)) {
      console.error(`send-sms-alert: Invalid phone number format: ${to}`);
      return new Response(
        JSON.stringify({ error: "Invalid phone number format. Must be E.164 format (e.g., +15551234567)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit if userId is provided
    if (userId) {
      const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      
      const { data: recentSms, error: rateLimitError } = await supabase
        .from("sms_alert_log")
        .select("id")
        .eq("user_id", userId)
        .eq("alert_type", alertType)
        .eq("status", "sent")
        .gte("created_at", rateLimitCutoff)
        .limit(1);

      if (rateLimitError) {
        console.error("send-sms-alert: Rate limit check error:", rateLimitError);
      } else if (recentSms && recentSms.length > 0) {
        console.log(`send-sms-alert: Rate limited - SMS already sent to user ${userId} for ${alertType} within 15 minutes`);
        
        // Log the rate-limited attempt
        await supabase.from("sms_alert_log").insert({
          organization_id: organizationId,
          user_id: userId,
          alert_id: alertId,
          phone_number: to,
          alert_type: alertType,
          message: message,
          status: "rate_limited",
          error_message: "Rate limited: SMS already sent within 15 minutes",
        });

        return new Response(
          JSON.stringify({ 
            status: "rate_limited", 
            message: "SMS already sent for this alert type within 15 minutes" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send SMS via Twilio REST API
    console.log(`send-sms-alert: Sending SMS via Twilio from ${TWILIO_PHONE_NUMBER} to ${to}`);
    
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    const twilioData: TwilioResponse = await twilioResponse.json();

    // Log full Twilio response for debugging
    console.log("send-sms-alert: Twilio response status:", twilioResponse.status);
    console.log("send-sms-alert: Twilio response data:", JSON.stringify({
      sid: twilioData.sid,
      status: twilioData.status,
      error_code: twilioData.error_code,
      error_message: twilioData.error_message,
    }));

    if (!twilioResponse.ok) {
      const errorMsg = twilioData.message || twilioData.error_message || "Unknown Twilio error";
      const errorCode = twilioData.error_code?.toString() || "";
      const fullError = errorCode ? `${errorCode}: ${errorMsg}` : errorMsg;
      
      console.error(`send-sms-alert: Twilio API error: ${fullError}`);
      
      // Log the failed attempt
      const { error: insertError } = await supabase.from("sms_alert_log").insert({
        organization_id: organizationId,
        user_id: userId,
        alert_id: alertId,
        phone_number: to,
        alert_type: alertType,
        message: message,
        status: "failed",
        error_message: fullError,
      });
      
      if (insertError) {
        console.error("send-sms-alert: Failed to log SMS error:", insertError);
      }

      return new Response(
        JSON.stringify({ error: fullError, status: "failed", code: twilioData.error_code }),
        { status: twilioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`send-sms-alert: SMS sent successfully!`);
    console.log(`send-sms-alert: Twilio SID: ${twilioData.sid}`);
    console.log(`send-sms-alert: Message status: ${twilioData.status}`);

    // Log successful SMS
    const { error: insertError } = await supabase.from("sms_alert_log").insert({
      organization_id: organizationId,
      user_id: userId,
      alert_id: alertId,
      phone_number: to,
      alert_type: alertType,
      message: message,
      status: "sent",
      twilio_sid: twilioData.sid,
    });
    
    if (insertError) {
      console.error("send-sms-alert: Failed to log successful SMS:", insertError);
    } else {
      console.log("send-sms-alert: SMS logged to database successfully");
    }

    console.log("send-sms-alert: ============ Request Complete ============");
    
    return new Response(
      JSON.stringify({ 
        status: "sent", 
        twilio_sid: twilioData.sid,
        message: "SMS sent successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("send-sms-alert: ============ Request Failed ============");
    console.error("send-sms-alert: Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage, status: "failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
