/**
 * TTN Base URL - Dual Endpoint Architecture
 * 
 * TTN Cloud uses a DUAL-ENDPOINT model:
 * - Identity Server (IS): eu1.cloud.thethings.network (global registry for auth, apps, devices, orgs)
 * - Data Planes (NS/AS/JS): nam1.cloud.thethings.network (regional for LoRaWAN data)
 * 
 * This is the CANONICAL source for TTN endpoints across all edge functions.
 * All other files MUST import from here instead of defining their own constants.
 */

// ============================================================================
// IDENTITY SERVER (IS) - GLOBAL REGISTRY (EU1)
// Used for: auth_info, applications, devices, organizations, API keys
// ============================================================================

export const IDENTITY_SERVER_URL = "https://eu1.cloud.thethings.network";
export const IDENTITY_SERVER_HOST = "eu1.cloud.thethings.network";

// ============================================================================
// DATA PLANES - REGIONAL CLUSTER (NAM1)
// Used for: Network Server (NS), Application Server (AS), Join Server (JS)
// ============================================================================

export const CLUSTER_BASE_URL = "https://nam1.cloud.thethings.network";
export const CLUSTER_HOST = "nam1.cloud.thethings.network";

// @deprecated - Use CLUSTER_BASE_URL or IDENTITY_SERVER_URL directly.
export const TTN_BASE_URL = CLUSTER_BASE_URL;

// ============================================================================
// ENDPOINT TYPE IDENTIFICATION
// ============================================================================

export type TTNPlane = "IS" | "JS" | "NS" | "AS" | "OTHER";
export type TTNEndpointType = "IS" | "DATA";

/**
 * Determine which base URL to use for a given API path.
 * 
 * Identity Server paths (EU1):
 * - /api/v3/auth_info
 * - /api/v3/applications/{app_id} (GET/PUT/DELETE - registry operations)
 * - /api/v3/applications/{app_id}/devices
 * - /api/v3/applications/{app_id}/api-keys
 * - /api/v3/organizations/*
 * - /api/v3/users/*
 * - /api/v3/gateways/* (registry operations)
 * 
 * Data Plane paths (NAM1):
 * - /api/v3/as/applications/{app_id}/* (Application Server)
 * - /api/v3/ns/applications/{app_id}/* (Network Server)
 * - /api/v3/js/applications/{app_id}/* (Join Server)
 */
export function getEndpointForPath(path: string): { url: string; type: TTNEndpointType } {
  // Data plane paths - explicitly check for server prefixes
  if (path.includes("/api/v3/as/") || 
      path.includes("/api/v3/ns/") || 
      path.includes("/api/v3/js/")) {
    return { url: CLUSTER_BASE_URL, type: "DATA" };
  }
  
  // Everything else goes to Identity Server (EU1)
  // This includes: auth_info, applications, devices, organizations, users, gateways
  return { url: IDENTITY_SERVER_URL, type: "IS" };
}

/**
 * Identify which TTN plane an endpoint targets based on path.
 * Used for structured logging.
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
// DUAL-HOST VALIDATION GUARDS
// ============================================================================

/**
 * Validate that a URL uses the correct host for its endpoint type.
 * 
 * @param url - Full URL to validate
 * @param expectedType - "IS" for Identity Server (EU1) or "DATA" for data planes (NAM1)
 * @throws Error if URL host doesn't match expected type
 */
export function assertValidTtnHost(url: string, expectedType: TTNEndpointType): void {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(
      `FATAL: Invalid TTN URL format: ${url}. ` +
      `All TTN endpoints must be valid URLs.`
    );
  }
  
  const expectedHost = expectedType === "IS" ? IDENTITY_SERVER_HOST : CLUSTER_HOST;
  
  if (host !== expectedHost) {
    throw new Error(
      `FATAL: TTN ${expectedType} endpoint host mismatch. ` +
      `Expected: ${expectedHost}, Got: ${host}. ` +
      `URL: ${url}`
    );
  }
}

/**
 * @deprecated Use assertValidTtnHost with explicit type instead.
 * Kept for backward compatibility during migration.
 * Now validates against DATA plane (NAM1) by default.
 */
export function assertClusterHost(url: string): void {
  // Determine expected type based on path
  const path = new URL(url).pathname;
  const { type } = getEndpointForPath(path);
  assertValidTtnHost(url, type);
}

/**
 * @deprecated Use assertValidTtnHost instead.
 * Fail-closed guard: Assert request is targeting NAM1.
 */
export function assertNam1Only(baseUrl: string): void {
  if (!baseUrl.startsWith(CLUSTER_BASE_URL)) {
    throw new Error(`NAM1-ONLY violation: ${baseUrl} is not ${CLUSTER_BASE_URL}`);
  }
}

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

/**
 * Log a TTN API call with structured fields for debugging.
 * Never logs sensitive data (EUIs, keys).
 * Includes plane identification and base URL for debugging.
 * 
 * @param functionName - The edge function making the call
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param endpoint - API endpoint path (e.g., /api/v3/applications/...)
 * @param step - Current provisioning step
 * @param requestId - Request correlation ID
 * @param baseUrl - Optional explicit base URL (defaults to auto-detection)
 */
export function logTtnApiCall(
  functionName: string,
  method: string,
  endpoint: string,
  step: string,
  requestId: string,
  baseUrl?: string
): void {
  const plane = identifyPlane(endpoint);
  const { url: detectedUrl, type } = getEndpointForPath(endpoint);
  const actualBaseUrl = baseUrl || detectedUrl;
  
  console.log(JSON.stringify({
    event: "ttn_api_call",
    plane,
    endpoint_type: type,
    baseUrl: actualBaseUrl,
    host: new URL(actualBaseUrl).host,
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
 * Automatically selects the correct base URL (IS vs DATA) based on path.
 * 
 * @param endpoint - API endpoint path (e.g., /api/v3/applications/...)
 * @returns Full URL string
 */
export function buildTtnUrl(endpoint: string): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const { url: baseUrl, type } = getEndpointForPath(normalizedEndpoint);
  const fullUrl = `${baseUrl}${normalizedEndpoint}`;
  
  // Validate the constructed URL (defense in depth)
  assertValidTtnHost(fullUrl, type);
  
  return fullUrl;
}

/**
 * Build a TTN URL with explicit base URL selection.
 * Use when you need to override auto-detection.
 * 
 * @param endpoint - API endpoint path
 * @param type - "IS" for Identity Server, "DATA" for data planes
 * @returns Full URL string
 */
export function buildTtnUrlExplicit(endpoint: string, type: TTNEndpointType): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = type === "IS" ? IDENTITY_SERVER_URL : CLUSTER_BASE_URL;
  const fullUrl = `${baseUrl}${normalizedEndpoint}`;
  
  // Validate
  assertValidTtnHost(fullUrl, type);
  
  return fullUrl;
}
