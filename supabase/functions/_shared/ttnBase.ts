/**
 * TTN Base URL - Single Source of Truth
 * 
 * CLUSTER_BASE_URL is the ONLY allowed TTN endpoint.
 * All TTN operations (IS, JS, NS, AS) MUST use this URL.
 * No region selection, no cluster switching, no fallbacks.
 * 
 * This is the CANONICAL source for the TTN cluster URL across all edge functions.
 * All other files MUST import from here instead of defining their own constants.
 */

// ============================================================================
// SINGLE CLUSTER BASE URL - THE ONLY ALLOWED TTN ENDPOINT
// ============================================================================

export const CLUSTER_BASE_URL = "https://nam1.cloud.thethings.network";

// Extract host for comparison guards
export const CLUSTER_HOST = "nam1.cloud.thethings.network";

// @deprecated - Use CLUSTER_BASE_URL directly. Alias kept for backward compatibility during migration.
export const TTN_BASE_URL = CLUSTER_BASE_URL;

// ============================================================================
// HARD GUARD: FAIL-CLOSED HOST VERIFICATION
// ============================================================================

/**
 * HARD GUARD: Verify any computed URL uses CLUSTER_BASE_URL host.
 * Throws FATAL error if ANY TTN call would target a different host.
 * Call this before EVERY fetch() to TTN.
 * 
 * @throws Error if URL host does not match CLUSTER_HOST
 */
export function assertClusterHost(url: string): void {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(
      `FATAL: Invalid TTN URL format: ${url}. ` +
      `All TTN endpoints must be valid URLs starting with ${CLUSTER_BASE_URL}`
    );
  }
  
  if (host !== CLUSTER_HOST) {
    throw new Error(
      `FATAL: TTN endpoint host mismatch. ` +
      `Expected: ${CLUSTER_HOST}, Got: ${host}. ` +
      `Provisioning blocked to prevent split-brain. URL: ${url}`
    );
  }
}

/**
 * @deprecated Use assertClusterHost instead.
 * Fail-closed guard: Assert request is targeting NAM1.
 * 
 * @throws Error if baseUrl is not the NAM1 cluster
 */
export function assertNam1Only(baseUrl: string): void {
  if (!baseUrl.startsWith(CLUSTER_BASE_URL)) {
    throw new Error(`NAM1-ONLY violation: ${baseUrl} is not ${CLUSTER_BASE_URL}`);
  }
}

// ============================================================================
// PLANE IDENTIFICATION (for structured logging)
// ============================================================================

export type TTNPlane = "IS" | "JS" | "NS" | "AS" | "OTHER";

/**
 * Identify which TTN plane an endpoint targets based on path.
 * Used for structured logging to prove all planes use same host.
 * 
 * - IS (Identity Server): /api/v3/applications/, /api/v3/devices/, /api/v3/organizations/, /api/v3/auth_info
 * - JS (Join Server): /api/v3/js/
 * - NS (Network Server): /api/v3/ns/
 * - AS (Application Server): /api/v3/as/
 */
export function identifyPlane(endpoint: string): TTNPlane {
  if (endpoint.includes("/api/v3/js/")) return "JS";
  if (endpoint.includes("/api/v3/ns/")) return "NS";
  if (endpoint.includes("/api/v3/as/")) return "AS";
  if (
    endpoint.includes("/api/v3/applications/") ||
    endpoint.includes("/api/v3/devices/") ||
    endpoint.includes("/api/v3/organizations/") ||
    endpoint.includes("/api/v3/users/") ||
    endpoint.includes("/api/v3/gateways/") ||
    endpoint.includes("/api/v3/auth_info")
  ) {
    return "IS";
  }
  return "OTHER";
}

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

/**
 * Log a TTN API call with structured fields for debugging.
 * Never logs sensitive data (EUIs, keys).
 * Includes plane identification to prove all planes use same host.
 * 
 * @param functionName - The edge function making the call
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param endpoint - API endpoint path (e.g., /api/v3/applications/...)
 * @param step - Current provisioning step
 * @param requestId - Request correlation ID
 */
export function logTtnApiCall(
  functionName: string,
  method: string,
  endpoint: string,
  step: string,
  requestId: string
): void {
  const plane = identifyPlane(endpoint);
  console.log(JSON.stringify({
    event: "ttn_api_call",
    plane,
    baseUrl: CLUSTER_BASE_URL,
    host: CLUSTER_HOST,
    endpoint,
    method,
    function_name: functionName,
    step,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Build a full TTN URL from an endpoint path.
 * Automatically uses CLUSTER_BASE_URL and validates host.
 * 
 * @param endpoint - API endpoint path (e.g., /api/v3/applications/...)
 * @returns Full URL string
 * @throws Error if resulting URL host doesn't match CLUSTER_HOST
 */
export function buildTtnUrl(endpoint: string): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${CLUSTER_BASE_URL}${normalizedEndpoint}`;
  
  // Validate the constructed URL (defense in depth)
  assertClusterHost(url);
  
  return url;
}
