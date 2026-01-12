import { corsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Verify Public Asset Edge Function
 * 
 * Performs a HEAD request to verify a URL is publicly accessible.
 * Returns status code, content type, and any errors.
 * This avoids CORS issues with browser-only checks.
 */

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ 
          error: "Missing or invalid 'url' parameter",
          accessible: false 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ 
          error: "Invalid URL format",
          accessible: false 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only allow HTTPS URLs for security
    if (parsedUrl.protocol !== "https:") {
      return new Response(
        JSON.stringify({ 
          error: "Only HTTPS URLs are allowed",
          accessible: false 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[verify-public-asset] Checking URL: ${url}`);

    // Perform HEAD request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "FreshTrackPro/1.0 (URL Verification)"
        }
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "unknown";
      const contentLength = response.headers.get("content-length");
      const isImage = contentType.startsWith("image/");
      const isAccessible = response.ok && response.status === 200;

      console.log(`[verify-public-asset] Result:`, {
        url,
        status: response.status,
        contentType,
        contentLength,
        isImage,
        isAccessible
      });

      return new Response(
        JSON.stringify({
          accessible: isAccessible,
          status: response.status,
          statusText: response.statusText,
          contentType,
          contentLength: contentLength ? parseInt(contentLength) : null,
          isImage,
          checkedAt: new Date().toISOString(),
          error: !isAccessible ? `HTTP ${response.status}: ${response.statusText}` : null
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
      const isTimeout = errorMessage.includes("abort") || errorMessage.includes("timeout");

      console.error(`[verify-public-asset] Fetch error:`, errorMessage);

      return new Response(
        JSON.stringify({
          accessible: false,
          status: null,
          contentType: null,
          isImage: false,
          checkedAt: new Date().toISOString(),
          error: isTimeout ? "Request timed out (10s)" : errorMessage
        }),
        {
          status: 200, // Still return 200 since the function worked, just the URL check failed
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[verify-public-asset] Error:", errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        accessible: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
