import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Upload Public Asset Edge Function
 * 
 * Uploads files to the public-assets bucket for compliance/verification purposes.
 * Uses service role for upload authorization.
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, filePath, fileData, contentType, metadata } = await req.json();

    if (action === "upload") {
      // Decode base64 file data
      const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));

      // Upload to public-assets bucket
      const { data, error } = await supabase.storage
        .from("public-assets")
        .upload(filePath, binaryData, {
          contentType: contentType || "application/octet-stream",
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      console.log(`[upload-public-asset] Uploaded ${filePath}`, {
        purpose: metadata?.purpose,
        relatedFeature: metadata?.related_feature,
        publicUrl: urlData.publicUrl,
      });

      return new Response(
        JSON.stringify({
          success: true,
          path: data.path,
          publicUrl: urlData.publicUrl,
          metadata,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "get-url") {
      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      return new Response(
        JSON.stringify({
          success: true,
          publicUrl: data.publicUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'upload' or 'get-url'" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[upload-public-asset] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
