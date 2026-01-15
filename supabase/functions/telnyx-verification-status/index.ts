import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Toll-free verification ID from Telnyx
const TOLL_FREE_VERIFICATION_ID = "99ac127c-6dae-57ee-afc4-32949ac9124e";
const TOLL_FREE_NUMBER = "+18889890560";

interface VerificationStatus {
  status: "approved" | "pending" | "rejected" | "unknown";
  verificationId: string;
  phoneNumber: string;
  details?: string;
  lastChecked: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("telnyx-verification-status: ============ Request Start ============");
  console.log("telnyx-verification-status: Method:", req.method);
  console.log("telnyx-verification-status: Time:", new Date().toISOString());

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client to verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("telnyx-verification-status: Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Telnyx API key
    const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
    
    if (!TELNYX_API_KEY) {
      console.error("telnyx-verification-status: Missing Telnyx API key");
      return new Response(
        JSON.stringify({
          status: "unknown",
          verificationId: TOLL_FREE_VERIFICATION_ID,
          phoneNumber: TOLL_FREE_NUMBER,
          details: "Telnyx API key not configured",
          lastChecked: new Date().toISOString(),
        } as VerificationStatus),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query Telnyx API for toll-free verification status
    console.log(`telnyx-verification-status: Checking verification ${TOLL_FREE_VERIFICATION_ID}`);
    
    const telnyxUrl = `https://api.telnyx.com/v2/toll_free_verifications/${TOLL_FREE_VERIFICATION_ID}`;
    
    const telnyxResponse = await fetch(telnyxUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("telnyx-verification-status: Telnyx response status:", telnyxResponse.status);

    if (!telnyxResponse.ok) {
      // Handle specific error cases
      if (telnyxResponse.status === 404) {
        console.log("telnyx-verification-status: Verification not found, treating as pending");
        return new Response(
          JSON.stringify({
            status: "pending",
            verificationId: TOLL_FREE_VERIFICATION_ID,
            phoneNumber: TOLL_FREE_NUMBER,
            details: "Verification request not found or still processing",
            lastChecked: new Date().toISOString(),
          } as VerificationStatus),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await telnyxResponse.text();
      console.error("telnyx-verification-status: Telnyx API error:", errorText);
      
      return new Response(
        JSON.stringify({
          status: "unknown",
          verificationId: TOLL_FREE_VERIFICATION_ID,
          phoneNumber: TOLL_FREE_NUMBER,
          details: `Failed to check verification status: ${telnyxResponse.status}`,
          lastChecked: new Date().toISOString(),
        } as VerificationStatus),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telnyxData = await telnyxResponse.json();
    console.log("telnyx-verification-status: Verification data:", JSON.stringify(telnyxData, null, 2));

    // Extract status from response
    // Telnyx toll-free verification statuses: pending, approved, rejected
    const verificationData = telnyxData.data;
    let status: VerificationStatus["status"] = "unknown";
    let details = "";

    if (verificationData) {
      const rawStatus = verificationData.status?.toLowerCase();
      
      if (rawStatus === "verified" || rawStatus === "approved") {
        status = "approved";
        details = "Toll-free number is verified and ready for messaging";
      } else if (rawStatus === "pending" || rawStatus === "submitted" || rawStatus === "in_progress") {
        status = "pending";
        details = verificationData.rejection_reason || "Verification is in progress";
      } else if (rawStatus === "rejected" || rawStatus === "failed") {
        status = "rejected";
        details = verificationData.rejection_reason || "Verification was rejected";
      } else {
        // For any other status, log it and treat as pending
        console.log(`telnyx-verification-status: Unexpected status: ${rawStatus}`);
        status = "pending";
        details = `Status: ${rawStatus}`;
      }
    }

    console.log(`telnyx-verification-status: Final status: ${status}`);
    console.log("telnyx-verification-status: ============ Request Complete ============");

    return new Response(
      JSON.stringify({
        status,
        verificationId: TOLL_FREE_VERIFICATION_ID,
        phoneNumber: TOLL_FREE_NUMBER,
        details,
        lastChecked: new Date().toISOString(),
      } as VerificationStatus),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("telnyx-verification-status: ============ Request Failed ============");
    console.error("telnyx-verification-status: Unexpected error:", error);
    
    return new Response(
      JSON.stringify({
        status: "unknown",
        verificationId: TOLL_FREE_VERIFICATION_ID,
        phoneNumber: TOLL_FREE_NUMBER,
        details: errorMessage,
        lastChecked: new Date().toISOString(),
      } as VerificationStatus),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
