/**
 * Shared Response Utilities for Edge Functions
 * 
 * Provides consistent response formatting across all FrostGuard edge functions.
 * Ensures every response includes:
 * - ok: boolean (success indicator)
 * - request_id: string (for debugging/tracing)
 * - error: { code, message, hint? } (for error responses)
 */

import { corsHeaders } from "./cors.ts";

export interface ErrorDetails {
  code: string;
  message: string;
  hint?: string;
}

export interface SuccessResponse<T = unknown> {
  ok: true;
  request_id: string;
  data?: T;
  [key: string]: unknown;
}

export interface ErrorResponse {
  ok: false;
  request_id: string;
  error: ErrorDetails;
}

/**
 * Generate a short request ID for tracing
 */
export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Create a successful response with consistent structure
 * 
 * @param data - Response data (will be spread into response object)
 * @param requestId - Request ID for tracing
 * @param status - HTTP status code (default: 200)
 */
export function ok<T extends Record<string, unknown>>(
  data: T,
  requestId: string,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      request_id: requestId,
      ...data,
    }),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create a 400 Bad Request response
 */
export function badRequest(
  code: string,
  message: string,
  hint?: string,
  requestId?: string
): Response {
  const id = requestId || generateRequestId();
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message, hint },
      request_id: id,
    }),
    { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorized(
  code: string = "UNAUTHORIZED",
  message: string = "Authentication required",
  hint?: string,
  requestId?: string
): Response {
  const id = requestId || generateRequestId();
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message, hint },
      request_id: id,
    }),
    { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create a 403 Forbidden response
 */
export function forbidden(
  code: string,
  message: string,
  hint?: string,
  requestId?: string
): Response {
  const id = requestId || generateRequestId();
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message, hint },
      request_id: id,
    }),
    { 
      status: 403, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create a 404 Not Found response
 */
export function notFound(
  code: string,
  message: string,
  hint?: string,
  requestId?: string
): Response {
  const id = requestId || generateRequestId();
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message, hint },
      request_id: id,
    }),
    { 
      status: 404, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

/**
 * Create a 500 Internal Server Error response
 */
export function serverError(
  error: Error | string,
  requestId?: string,
  code: string = "INTERNAL_ERROR"
): Response {
  const id = requestId || generateRequestId();
  const message = error instanceof Error ? error.message : error;
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message },
      request_id: id,
    }),
    { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}
