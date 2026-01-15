/**
 * Shared CORS headers for all edge functions
 * 
 * Provides consistent cross-origin request handling across the FrostGuard platform.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

/**
 * Handle CORS preflight request
 * Returns a proper 200 response with CORS headers
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, { status: 200, headers: corsHeaders });
}
