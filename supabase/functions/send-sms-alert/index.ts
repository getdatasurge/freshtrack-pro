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

// Toll-free verification ID for checking status
const TOLL_FREE_VERIFICATION_ID = "99ac127c-6dae-57ee-afc4-32949ac9124e";

// Telnyx Phone Number ID (verified toll-free)
const TELNYX_PHONE_NUMBER_ID = "99ac127c-6dae-57ee-afc4-32949ac9124e";

// Telnyx error code mappings for user-friendly messages
const TELNYX_ERROR_CODES: Record<string, string> = {
  "10001": "Invalid API key format",
  "10009": "Authentication failed - invalid API key",
  "10014": "API key does not have required permissions",
  "20100": "Insufficient funds in Telnyx account",
  "40001": "Number not routable - landline or invalid destination",
  "40002": "Message blocked as spam by carrier",
  "40003": "Message blocked by carrier filter",
  "40004": "Destination country not enabled",
  "40005": "Message rejected - content policy violation",
  "40013": "Invalid messaging source number - phone number may not be associated with messaging profile",
  "40300": "Number opted out of SMS (STOP received)",
  "40301": "Number on do-not-contact list",
  "40310": "Invalid destination phone number",
  "40311": "Destination number not SMS-capable",
  "40312": "Invalid source phone number",
  "40313": "Source number not SMS-capable",
  "40400": "Number temporarily unreachable",
  "40401": "Message delivery failed - carrier error",
  "40402": "Message expired before delivery",
  "50000": "Internal Telnyx error",
  "50001": "Service temporarily unavailable",
};

interface SmsAlertRequest {
  to: string;
  message: string;
  alertType: string;
  userId?: string;
  organizationId: string;
  alertId?: string;
}

interface TelnyxResponse {
  data?: {
    id?: string;
    record_type?: string;
    to?: Array<{ phone_number: string; status: string }>;
  };
  errors?: Array<{
    code: string;
    title: string;
    detail?: string;
  }>;
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
    // Get Telnyx credentials from environment
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");
    const TELNYX_MESSAGING_PROFILE_ID = Deno.env.get("TELNYX_MESSAGING_PROFILE_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    // Canonical toll-free number and old long code for validation
    const TOLL_FREE_NUMBER = "+18889890560";
    const OLD_LONG_CODE = "+14079920647";

    // Log credential existence (not values!)
    console.log("send-sms-alert: Credentials check:", {
      hasApiKey: !!TELNYX_API_KEY,
      hasPhoneNumber: !!TELNYX_PHONE_NUMBER,
      hasMessagingProfileId: !!TELNYX_MESSAGING_PROFILE_ID,
      messagingProfileId: TELNYX_MESSAGING_PROFILE_ID ? `${TELNYX_MESSAGING_PROFILE_ID.slice(0, 8)}...` : "MISSING",
      fromNumber: TELNYX_PHONE_NUMBER ? `${TELNYX_PHONE_NUMBER.slice(0, 5)}***` : "MISSING",
    });

    // CRITICAL GUARD: Block old long code number
    if (TELNYX_PHONE_NUMBER === OLD_LONG_CODE) {
      console.error(JSON.stringify({
        event: "sms_blocked_old_number",
        severity: "critical",
        configured: OLD_LONG_CODE,
        required: TOLL_FREE_NUMBER,
        action: "Update TELNYX_PHONE_NUMBER secret to toll-free number +18889890560",
        timestamp: new Date().toISOString(),
      }));
      return new Response(
        JSON.stringify({ 
          error: "SMS configuration error: Old long code detected. Update TELNYX_PHONE_NUMBER to toll-free number.", 
          status: "failed",
          configured: OLD_LONG_CODE.slice(0, 5) + "***",
          required: TOLL_FREE_NUMBER.slice(0, 5) + "***",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate toll-free sender
    console.log("send-sms-alert: Sender validation:", {
      configured: TELNYX_PHONE_NUMBER?.slice(0, 5) + "***",
      isTollFree: TELNYX_PHONE_NUMBER === TOLL_FREE_NUMBER,
      expected: TOLL_FREE_NUMBER.slice(0, 5) + "***",
    });

    if (!TELNYX_API_KEY || !TELNYX_PHONE_NUMBER) {
      console.error("send-sms-alert: Missing Telnyx credentials");
      return new Response(
        JSON.stringify({ error: "Telnyx credentials not configured", status: "failed" }),
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

    // Check toll-free verification status (live check as per requirements)
    let verificationWarning: string | null = null;
    try {
      const verificationUrl = `https://api.telnyx.com/v2/toll_free_verifications/${TOLL_FREE_VERIFICATION_ID}`;
      const verificationResponse = await fetch(verificationUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (verificationResponse.ok) {
        const verificationData = await verificationResponse.json();
        const status = verificationData.data?.status?.toLowerCase();
        console.log(`send-sms-alert: Toll-free verification status: ${status}`);
        
        if (status !== "verified" && status !== "approved") {
          // Allow with warning (as per user requirements)
          verificationWarning = `Toll-free verification is ${status}. Delivery may be affected.`;
          console.warn(`send-sms-alert: ${verificationWarning}`);
        }
      } else {
        console.warn(`send-sms-alert: Could not check verification status: ${verificationResponse.status}`);
        verificationWarning = "Could not verify toll-free status. Proceeding with send.";
      }
    } catch (verifyError) {
      console.warn("send-sms-alert: Error checking verification status:", verifyError);
      verificationWarning = "Could not check toll-free verification status.";
    }

    // Send SMS via Telnyx Messaging API
    console.log(`send-sms-alert: Sending SMS via Telnyx from ${TELNYX_PHONE_NUMBER} to ${to}`);
    if (TELNYX_MESSAGING_PROFILE_ID) {
      console.log(`send-sms-alert: Using messaging profile: ${TELNYX_MESSAGING_PROFILE_ID.slice(0, 8)}... (frost guard)`);
    }
    
    const telnyxUrl = "https://api.telnyx.com/v2/messages";
    
    // Build webhook URL for delivery status callbacks
    const webhookUrl = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/telnyx-webhook` : undefined;
    
    const telnyxPayload: Record<string, unknown> = {
      from: TELNYX_PHONE_NUMBER,
      to: to,
      text: message,
    };
    
    // Add messaging profile ID if configured (frost guard profile)
    if (TELNYX_MESSAGING_PROFILE_ID) {
      telnyxPayload.messaging_profile_id = TELNYX_MESSAGING_PROFILE_ID;
    }
    
    // Add webhook URLs for delivery status callbacks
    if (webhookUrl) {
      telnyxPayload.webhook_url = webhookUrl;
      telnyxPayload.webhook_failover_url = webhookUrl;
    }
    
    const telnyxResponse = await fetch(telnyxUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(telnyxPayload),
    });

    const telnyxData: TelnyxResponse = await telnyxResponse.json();

    // Log Telnyx response for debugging
    console.log("send-sms-alert: Telnyx response status:", telnyxResponse.status);
    console.log("send-sms-alert: Telnyx response data:", JSON.stringify({
      messageId: telnyxData.data?.id,
      toStatus: telnyxData.data?.to?.[0]?.status,
      errors: telnyxData.errors,
    }));

    if (!telnyxResponse.ok || telnyxData.errors?.length) {
      const error = telnyxData.errors?.[0];
      const errorCode = error?.code || "";
      const errorTitle = error?.title || "Unknown Telnyx error";
      const errorDetail = error?.detail || "";
      const friendlyError = TELNYX_ERROR_CODES[errorCode] || errorTitle;
      const fullError = errorCode ? `${errorCode}: ${friendlyError}${errorDetail ? ` - ${errorDetail}` : ""}` : friendlyError;
      
      console.error(`send-sms-alert: Telnyx API error: ${fullError}`);
      
      // Provide actionable guidance for error 40013 (source number not associated with profile)
      if (errorCode === "40013") {
        console.error(JSON.stringify({
          event: "sms_config_error_40013",
          severity: "critical",
          configured_number: TELNYX_PHONE_NUMBER?.slice(0, 5) + "***",
          expected_number_id: TELNYX_PHONE_NUMBER_ID,
          messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID,
          action: "Verify TELNYX_PHONE_NUMBER matches toll-free number +18889890560 and is associated with messaging profile in Telnyx portal",
          timestamp: new Date().toISOString(),
        }));
      }
      
      // Log the failed attempt with from_number for debugging
      const { error: insertError } = await supabase.from("sms_alert_log").insert({
        organization_id: organizationId,
        user_id: userId,
        alert_id: alertId,
        phone_number: to,
        from_number: TELNYX_PHONE_NUMBER,
        alert_type: alertType,
        message: message,
        status: "failed",
        error_message: fullError,
      });
      
      if (insertError) {
        console.error("send-sms-alert: Failed to log SMS error:", insertError);
      }

      return new Response(
        JSON.stringify({ error: fullError, status: "failed", code: errorCode }),
        { status: telnyxResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = telnyxData.data?.id;
    const messageStatus = telnyxData.data?.to?.[0]?.status || "queued";

    // Structured success logging
    console.log(JSON.stringify({
      event: "sms_send_success",
      message_id: messageId,
      profile_id: TELNYX_MESSAGING_PROFILE_ID?.slice(0, 8),
      profile_name: "frost guard",
      from: TELNYX_PHONE_NUMBER,
      to: to.replace(/\d(?=\d{4})/g, "*"),
      is_toll_free: TELNYX_PHONE_NUMBER === TOLL_FREE_NUMBER,
      status: messageStatus,
      org_id: organizationId?.slice(0, 8),
      alert_type: alertType,
      timestamp: new Date().toISOString(),
    }));

    console.log(`send-sms-alert: SMS sent successfully!`);
    console.log(`send-sms-alert: Telnyx Message ID: ${messageId}`);
    console.log(`send-sms-alert: Message status: ${messageStatus}`);

    // Log successful SMS with from_number
    const { error: insertError } = await supabase.from("sms_alert_log").insert({
      organization_id: organizationId,
      user_id: userId,
      alert_id: alertId,
      phone_number: to,
      from_number: TELNYX_PHONE_NUMBER,
      alert_type: alertType,
      message: message,
      status: "sent",
      provider_message_id: messageId,
    });
    
    if (insertError) {
      console.error("send-sms-alert: Failed to log successful SMS:", insertError);
    } else {
      console.log("send-sms-alert: SMS logged to database successfully");
    }

    console.log("send-sms-alert: ============ Request Complete ============");
    
    // Build response with optional verification warning
    const responseData: Record<string, unknown> = { 
      status: "sent", 
      provider_message_id: messageId,
      message: "SMS sent successfully",
      from_number: TELNYX_PHONE_NUMBER,
    };
    
    if (verificationWarning) {
      responseData.warning = verificationWarning;
    }
    
    return new Response(
      JSON.stringify(responseData),
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
