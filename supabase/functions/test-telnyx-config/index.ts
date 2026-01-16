import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Telnyx Configuration Diagnostic Endpoint
 * 
 * Tests and validates:
 * 1. API key validity
 * 2. Phone number lookup (by ID)
 * 3. Messaging profile association
 * 4. Webhook configuration
 * 
 * Super Admin only - validates JWT and checks platform role
 */

const TELNYX_PHONE_NUMBER_ID = "99ac127c-6dae-57ee-afc4-32949ac9124e";
const EXPECTED_TOLL_FREE_NUMBER = "+18889890560";

interface DiagnosticResult {
  step: string;
  status: "pass" | "fail" | "warn";
  message: string;
  details?: Record<string, unknown>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("test-telnyx-config: ============ Diagnostic Start ============");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify super admin authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check super admin role
  const { data: platformRole } = await supabase
    .from("platform_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (!platformRole) {
    return new Response(
      JSON.stringify({ error: "Super Admin access required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: DiagnosticResult[] = [];
  
  // Get Telnyx credentials
  const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
  const TELNYX_PHONE_NUMBER = Deno.env.get("TELNYX_PHONE_NUMBER");
  const TELNYX_MESSAGING_PROFILE_ID = Deno.env.get("TELNYX_MESSAGING_PROFILE_ID");
  const TELNYX_PUBLIC_KEY = Deno.env.get("TELNYX_PUBLIC_KEY");

  // Step 1: Check environment variables
  results.push({
    step: "Environment Variables",
    status: TELNYX_API_KEY && TELNYX_PHONE_NUMBER && TELNYX_MESSAGING_PROFILE_ID ? "pass" : "fail",
    message: TELNYX_API_KEY && TELNYX_PHONE_NUMBER && TELNYX_MESSAGING_PROFILE_ID 
      ? "All required environment variables are set" 
      : "Missing environment variables",
    details: {
      TELNYX_API_KEY: !!TELNYX_API_KEY,
      TELNYX_PHONE_NUMBER: !!TELNYX_PHONE_NUMBER,
      TELNYX_MESSAGING_PROFILE_ID: !!TELNYX_MESSAGING_PROFILE_ID,
      TELNYX_PUBLIC_KEY: !!TELNYX_PUBLIC_KEY,
    },
  });

  // Step 2: Validate phone number matches expected toll-free
  results.push({
    step: "Phone Number Validation",
    status: TELNYX_PHONE_NUMBER === EXPECTED_TOLL_FREE_NUMBER ? "pass" : "fail",
    message: TELNYX_PHONE_NUMBER === EXPECTED_TOLL_FREE_NUMBER 
      ? `Phone number matches expected toll-free: ${EXPECTED_TOLL_FREE_NUMBER.slice(0, 5)}***`
      : `Phone number mismatch! Configured: ${TELNYX_PHONE_NUMBER?.slice(0, 5)}***, Expected: ${EXPECTED_TOLL_FREE_NUMBER.slice(0, 5)}***`,
    details: {
      configured: TELNYX_PHONE_NUMBER?.slice(0, 5) + "***",
      expected: EXPECTED_TOLL_FREE_NUMBER.slice(0, 5) + "***",
      expectedNumberId: TELNYX_PHONE_NUMBER_ID,
    },
  });

  // Step 3: Test API key by fetching account info
  if (TELNYX_API_KEY) {
    try {
      const accountResponse = await fetch("https://api.telnyx.com/v2/balance", {
        headers: {
          "Authorization": `Bearer ${TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        results.push({
          step: "API Key Validation",
          status: "pass",
          message: "API key is valid and has balance access",
          details: {
            currency: accountData.data?.currency,
            hasBalance: accountData.data?.balance !== undefined,
          },
        });
      } else {
        const errorData = await accountResponse.json();
        results.push({
          step: "API Key Validation",
          status: "fail",
          message: `API key validation failed: ${accountResponse.status}`,
          details: { error: errorData.errors?.[0]?.title || "Unknown error" },
        });
      }
    } catch (error) {
      results.push({
        step: "API Key Validation",
        status: "fail",
        message: `API request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // Step 4: Verify phone number exists and is associated with messaging profile
  if (TELNYX_API_KEY) {
    try {
      // First, look up the phone number by ID
      const phoneResponse = await fetch(
        `https://api.telnyx.com/v2/phone_numbers/${TELNYX_PHONE_NUMBER_ID}`,
        {
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json();
        const phoneNumber = phoneData.data?.phone_number;
        const phoneProfileId = phoneData.data?.messaging_profile_id;
        
        const profileMatch = phoneProfileId === TELNYX_MESSAGING_PROFILE_ID;
        const numberMatch = phoneNumber === EXPECTED_TOLL_FREE_NUMBER;
        
        results.push({
          step: "Phone Number Lookup (by ID)",
          status: profileMatch && numberMatch ? "pass" : "fail",
          message: profileMatch && numberMatch 
            ? "Phone number is correctly configured"
            : "Phone number configuration issue",
          details: {
            phoneNumberId: TELNYX_PHONE_NUMBER_ID,
            phoneNumber: phoneNumber?.slice(0, 5) + "***",
            messagingProfileId: phoneProfileId?.slice(0, 8) + "...",
            expectedProfileId: TELNYX_MESSAGING_PROFILE_ID?.slice(0, 8) + "...",
            profileMatch,
            numberMatch,
          },
        });
      } else {
        const errorData = await phoneResponse.json();
        results.push({
          step: "Phone Number Lookup (by ID)",
          status: "fail",
          message: `Phone number lookup failed: ${phoneResponse.status}`,
          details: { 
            phoneNumberId: TELNYX_PHONE_NUMBER_ID,
            error: errorData.errors?.[0]?.title || "Unknown error" 
          },
        });
      }
    } catch (error) {
      results.push({
        step: "Phone Number Lookup (by ID)",
        status: "fail",
        message: `Phone lookup request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // Step 5: Verify messaging profile exists
  if (TELNYX_API_KEY && TELNYX_MESSAGING_PROFILE_ID) {
    try {
      const profileResponse = await fetch(
        `https://api.telnyx.com/v2/messaging_profiles/${TELNYX_MESSAGING_PROFILE_ID}`,
        {
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        results.push({
          step: "Messaging Profile",
          status: "pass",
          message: `Messaging profile found: ${profileData.data?.name || "unnamed"}`,
          details: {
            profileId: TELNYX_MESSAGING_PROFILE_ID.slice(0, 8) + "...",
            name: profileData.data?.name,
            webhookUrl: profileData.data?.webhook_url,
            webhookApiVersion: profileData.data?.webhook_api_version,
          },
        });
      } else {
        const errorData = await profileResponse.json();
        results.push({
          step: "Messaging Profile",
          status: "fail",
          message: `Messaging profile lookup failed: ${profileResponse.status}`,
          details: { error: errorData.errors?.[0]?.title || "Unknown error" },
        });
      }
    } catch (error) {
      results.push({
        step: "Messaging Profile",
        status: "fail",
        message: `Profile request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // Step 6: Check toll-free verification status
  if (TELNYX_API_KEY) {
    try {
      const verificationResponse = await fetch(
        `https://api.telnyx.com/v2/toll_free_verifications/${TELNYX_PHONE_NUMBER_ID}`,
        {
          headers: {
            "Authorization": `Bearer ${TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (verificationResponse.ok) {
        const verificationData = await verificationResponse.json();
        const status = verificationData.data?.status?.toLowerCase();
        
        results.push({
          step: "Toll-Free Verification",
          status: status === "verified" || status === "approved" ? "pass" : "warn",
          message: `Toll-free verification status: ${status}`,
          details: {
            verificationId: TELNYX_PHONE_NUMBER_ID,
            status: status,
            useCase: verificationData.data?.use_case_categories,
          },
        });
      } else {
        results.push({
          step: "Toll-Free Verification",
          status: "warn",
          message: "Could not fetch toll-free verification status",
        });
      }
    } catch (error) {
      results.push({
        step: "Toll-Free Verification",
        status: "warn",
        message: `Verification check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  // Step 7: Check recent SMS logs for errors
  const { data: recentFailures } = await supabase
    .from("sms_alert_log")
    .select("status, error_message, from_number, created_at")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentFailures && recentFailures.length > 0) {
    results.push({
      step: "Recent SMS Failures",
      status: "warn",
      message: `Found ${recentFailures.length} recent failed SMS attempts`,
      details: {
        failures: recentFailures.map(f => ({
          error: f.error_message,
          from: f.from_number?.slice(0, 5) + "***" || "null",
          at: f.created_at,
        })),
      },
    });
  } else {
    results.push({
      step: "Recent SMS Failures",
      status: "pass",
      message: "No recent SMS failures found",
    });
  }

  // Step 8: Check webhook events
  const { data: webhookEvents, count } = await supabase
    .from("telnyx_webhook_events")
    .select("id", { count: "exact" })
    .limit(1);

  results.push({
    step: "Webhook Events",
    status: count && count > 0 ? "pass" : "warn",
    message: count && count > 0 
      ? `${count} webhook events received` 
      : "No webhook events received - check Telnyx webhook configuration",
    details: { eventCount: count || 0 },
  });

  // Calculate overall status
  const hasFailures = results.some(r => r.status === "fail");
  const hasWarnings = results.some(r => r.status === "warn");

  console.log("test-telnyx-config: ============ Diagnostic Complete ============");
  console.log("test-telnyx-config: Results:", JSON.stringify(results, null, 2));

  return new Response(
    JSON.stringify({
      overallStatus: hasFailures ? "fail" : hasWarnings ? "warn" : "pass",
      timestamp: new Date().toISOString(),
      results,
      recommendations: hasFailures ? [
        "Verify TELNYX_PHONE_NUMBER secret is set to +18889890560",
        "Check phone number is associated with messaging profile in Telnyx portal",
        "Verify API key has messaging permissions",
      ] : [],
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
};

serve(handler);
