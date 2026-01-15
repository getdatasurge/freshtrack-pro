import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, telnyx-signature-ed25519, telnyx-timestamp",
};

/**
 * Telnyx Webhook Handler
 * 
 * Receives delivery status reports (DLR) from Telnyx for message tracking.
 * Features:
 * - Ed25519 signature validation for security
 * - Idempotent event processing (stores event_id to prevent duplicates)
 * - Updates sms_alert_log.status based on final delivery status
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

/**
 * Decode hex string to Uint8Array
 */
function decodeHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verify Telnyx Ed25519 signature
 * Supports both hex and base64 encoded public keys
 * @see https://developers.telnyx.com/docs/development/api-guide/webhooks#webhook-signature-validation
 */
async function verifyTelnyxSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  publicKey: string
): Promise<boolean> {
  if (!signatureHeader || !timestampHeader) {
    console.log("telnyx-webhook: Missing signature headers");
    return false;
  }

  try {
    // The signed content is timestamp|payload
    const signedPayload = `${timestampHeader}|${rawBody}`;
    const signedPayloadBytes = new TextEncoder().encode(signedPayload);
    
    // Decode the base64 signature (Telnyx always sends base64 signatures)
    const signatureBytes = new Uint8Array(decodeBase64(signatureHeader));
    
    // Detect and decode public key format (hex or base64)
    let publicKeyBytes: Uint8Array;
    const isHexKey = /^[0-9a-fA-F]+$/.test(publicKey) && publicKey.length === 64;
    
    if (isHexKey) {
      // Hex-encoded key (32 bytes = 64 hex chars for Ed25519)
      console.log("telnyx-webhook: Detected hex-encoded public key");
      publicKeyBytes = decodeHex(publicKey);
    } else {
      // Base64-encoded key
      console.log("telnyx-webhook: Detected base64-encoded public key");
      publicKeyBytes = new Uint8Array(decodeBase64(publicKey));
    }
    
    // Validate key length (Ed25519 public keys are 32 bytes)
    if (publicKeyBytes.length !== 32) {
      console.error(`telnyx-webhook: Invalid public key length: ${publicKeyBytes.length} bytes (expected 32)`);
      console.error("telnyx-webhook: Ensure TELNYX_PUBLIC_KEY is the Ed25519 public key from Telnyx API settings");
      return false;
    }
    
    // Import the public key for Ed25519 verification
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes.buffer as ArrayBuffer,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    
    // Verify the signature
    const isValid = await crypto.subtle.verify(
      "Ed25519",
      cryptoKey,
      signatureBytes.buffer as ArrayBuffer,
      signedPayloadBytes
    );
    
    return isValid;
  } catch (error) {
    console.error("telnyx-webhook: Signature verification error:", error);
    console.error("telnyx-webhook: Key format hint - ensure TELNYX_PUBLIC_KEY is the hex or base64 Ed25519 public key from Telnyx API settings");
    return false;
  }
}

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

  // Initialize Supabase client early for logging
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Get signature headers
    const signatureHeader = req.headers.get("telnyx-signature-ed25519");
    const timestampHeader = req.headers.get("telnyx-timestamp");
    
    // Get public key for signature verification
    const TELNYX_PUBLIC_KEY = Deno.env.get("TELNYX_PUBLIC_KEY");
    const ALLOW_UNSIGNED_WEBHOOKS = Deno.env.get("ALLOW_UNSIGNED_WEBHOOKS") === "true";
    
    // Verify signature if public key is configured
    if (TELNYX_PUBLIC_KEY) {
      const isValid = await verifyTelnyxSignature(
        rawBody,
        signatureHeader,
        timestampHeader,
        TELNYX_PUBLIC_KEY
      );
      
      if (!isValid) {
        if (ALLOW_UNSIGNED_WEBHOOKS) {
          console.warn("telnyx-webhook: Signature invalid but ALLOW_UNSIGNED_WEBHOOKS=true, proceeding");
        } else {
          console.error("telnyx-webhook: Invalid signature - rejecting webhook");
          console.error("telnyx-webhook: To debug, temporarily set ALLOW_UNSIGNED_WEBHOOKS=true or verify TELNYX_PUBLIC_KEY");
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.log("telnyx-webhook: Signature verified successfully");
      }
    } else {
      if (ALLOW_UNSIGNED_WEBHOOKS) {
        console.warn("telnyx-webhook: No public key configured, ALLOW_UNSIGNED_WEBHOOKS=true, proceeding");
      } else {
        console.log("telnyx-webhook: Signature verification skipped (no public key configured)");
      }
    }
    
    // Parse the webhook payload
    const payload: TelnyxWebhookPayload = JSON.parse(rawBody);
    
    const eventType = payload.data?.event_type;
    const eventId = payload.data?.id;
    const messageId = payload.data?.payload?.id;
    const messagingProfileId = (payload.data?.payload as Record<string, unknown>)?.messaging_profile_id as string | undefined;
    
    // Structured logging for debugging and monitoring
    console.log(JSON.stringify({
      event: "telnyx_webhook_received",
      event_type: eventType,
      event_id: eventId,
      message_id: messageId,
      profile_id: messagingProfileId,
      status: payload.data?.payload?.to?.[0]?.status,
      error_code: payload.data?.payload?.errors?.[0]?.code,
      timestamp: new Date().toISOString(),
    }));
    
    console.log("telnyx-webhook: Event ID:", eventId);
    console.log("telnyx-webhook: Event type:", eventType);
    console.log("telnyx-webhook: Message ID:", messageId);
    if (messagingProfileId) {
      console.log("telnyx-webhook: Messaging Profile:", messagingProfileId.slice(0, 8) + "... (frost guard)");
    }

    // Only process message status events
    if (!eventType?.startsWith("message.")) {
      console.log("telnyx-webhook: Ignoring non-message event");
      return new Response(
        JSON.stringify({ status: "ignored", reason: "not a message event" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!eventId) {
      console.error("telnyx-webhook: Missing event ID");
      return new Response(
        JSON.stringify({ error: "Missing event ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check: Have we already processed this event?
    const { data: existingEvent } = await supabase
      .from("telnyx_webhook_events")
      .select("id, processed")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log("telnyx-webhook: Event already processed:", eventId);
      return new Response(
        JSON.stringify({ status: "duplicate", event_id: eventId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store the event for audit trail
    const { error: insertEventError } = await supabase
      .from("telnyx_webhook_events")
      .insert({
        event_id: eventId,
        event_type: eventType,
        message_id: messageId,
        payload: payload,
        processed: false,
      });

    if (insertEventError) {
      // Could be a race condition - check if it's a duplicate
      if (insertEventError.code === "23505") {
        console.log("telnyx-webhook: Event already exists (race condition):", eventId);
        return new Response(
          JSON.stringify({ status: "duplicate", event_id: eventId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("telnyx-webhook: Failed to store event:", insertEventError);
    }

    // Determine the delivery status
    const toStatus = payload.data?.payload?.to?.[0]?.status;
    const mappedStatus = toStatus ? STATUS_MAP[toStatus] : null;
    
    console.log("telnyx-webhook: To status:", toStatus);
    console.log("telnyx-webhook: Mapped status:", mappedStatus);

    // If we have a final status (delivered or failed), update the log
    if (messageId && mappedStatus && (mappedStatus === "delivered" || mappedStatus === "failed")) {
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

      // Update the SMS log record with delivery timestamp
      const { data: updateData, error: updateError } = await supabase
        .from("sms_alert_log")
        .update({
          status: mappedStatus,
          delivery_updated_at: new Date().toISOString(),
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

    // Mark event as processed
    if (eventId) {
      await supabase
        .from("telnyx_webhook_events")
        .update({ processed: true })
        .eq("event_id", eventId);
    }

    // Update webhook config last_event_at
    await supabase
      .from("telnyx_webhook_config")
      .update({ last_event_at: new Date().toISOString(), status: "active" })
      .or("organization_id.is.null");

    console.log("telnyx-webhook: ============ Request Complete ============");

    return new Response(
      JSON.stringify({ status: "ok", processed: true, event_id: eventId }),
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
