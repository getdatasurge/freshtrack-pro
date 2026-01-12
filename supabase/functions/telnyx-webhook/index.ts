import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, telnyx-signature-ed25519, telnyx-timestamp",
};

/**
 * Telnyx Webhook Handler
 * 
 * Receives delivery status reports (DLR) from Telnyx for message tracking.
 * Updates sms_alert_log.status based on final delivery status.
 * 
 * Webhook events: https://developers.telnyx.com/docs/messaging/receiving-webhooks
 */

interface TelnyxWebhookPayload {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      id: string;
      record_type: string;
      to: Array<{
        phone_number: string;
        status: string;
        carrier?: string;
      }>;
      from: {
        phone_number: string;
      };
      errors?: Array<{
        code: string;
        title: string;
        detail?: string;
      }>;
      completed_at?: string;
      sent_at?: string;
    };
  };
  meta: {
    attempt: number;
    delivered_to: string;
  };
}

// Map Telnyx delivery statuses to our status values
const STATUS_MAP: Record<string, string> = {
  // Success states
  delivered: "delivered",
  sent: "sent",
  
  // Failure states
  sending_failed: "failed",
  delivery_failed: "failed",
  delivery_unconfirmed: "failed",
  
  // Intermediate states (keep as sent until final status)
  queued: "sent",
  sending: "sent",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("telnyx-webhook: ============ Request Start ============");
  console.log("telnyx-webhook: Method:", req.method);
  console.log("telnyx-webhook: Time:", new Date().toISOString());

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse webhook payload
    const payload: TelnyxWebhookPayload = await req.json();
    
    const eventType = payload.data?.event_type;
    const messageId = payload.data?.payload?.id;
    
    console.log("telnyx-webhook: Event type:", eventType);
    console.log("telnyx-webhook: Message ID:", messageId);

    // Only process message status events
    if (!eventType?.startsWith("message.")) {
      console.log("telnyx-webhook: Ignoring non-message event");
      return new Response(
        JSON.stringify({ status: "ignored", reason: "not a message event" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messageId) {
      console.error("telnyx-webhook: Missing message ID");
      return new Response(
        JSON.stringify({ error: "Missing message ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine the delivery status
    const toStatus = payload.data?.payload?.to?.[0]?.status;
    const mappedStatus = toStatus ? STATUS_MAP[toStatus] : null;
    
    console.log("telnyx-webhook: To status:", toStatus);
    console.log("telnyx-webhook: Mapped status:", mappedStatus);

    // If we have a final status (delivered or failed), update the log
    if (mappedStatus && (mappedStatus === "delivered" || mappedStatus === "failed")) {
      // Build error message if failed
      let errorMessage: string | null = null;
      if (mappedStatus === "failed") {
        const errors = payload.data?.payload?.errors;
        if (errors?.length) {
          errorMessage = errors.map(e => `${e.code}: ${e.title}${e.detail ? ` - ${e.detail}` : ""}`).join("; ");
        } else {
          errorMessage = `Delivery failed: ${toStatus}`;
        }
      }

      // Update the SMS log record
      const { data: updateData, error: updateError } = await supabase
        .from("sms_alert_log")
        .update({
          status: mappedStatus,
          ...(errorMessage && { error_message: errorMessage }),
        })
        .eq("provider_message_id", messageId)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("telnyx-webhook: Failed to update SMS log:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update SMS log", detail: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!updateData) {
        console.log("telnyx-webhook: No matching SMS log found for message ID:", messageId);
      } else {
        console.log("telnyx-webhook: Updated SMS log:", updateData.id, "to status:", mappedStatus);
      }
    } else {
      console.log("telnyx-webhook: Status not actionable:", toStatus);
    }

    console.log("telnyx-webhook: ============ Request Complete ============");

    return new Response(
      JSON.stringify({ status: "ok", processed: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("telnyx-webhook: ============ Request Failed ============");
    console.error("telnyx-webhook: Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
