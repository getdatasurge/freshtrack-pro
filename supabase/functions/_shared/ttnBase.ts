/**
 * TTN Base URL - Single Source of Truth
 * 
 * NAM1-ONLY MODE: All TTN operations MUST use this URL.
 * No region selection, no cluster switching, no fallbacks.
 * 
 * This is the CANONICAL source for the TTN base URL across all edge functions.
 * All other files MUST import from here instead of defining their own constants.
 */

export const TTN_BASE_URL = "https://nam1.cloud.thethings.network";

/**
 * Fail-closed guard: Assert request is targeting NAM1
 * Call this before ANY TTN API request to ensure compliance.
 * 
 * @throws Error if baseUrl is not the NAM1 cluster
 */
export function assertNam1Only(baseUrl: string): void {
  if (!baseUrl.startsWith(TTN_BASE_URL)) {
    throw new Error(`NAM1-ONLY violation: ${baseUrl} is not ${TTN_BASE_URL}`);
  }
}

/**
 * Log a TTN API call with structured fields for debugging.
 * Never logs sensitive data (EUIs, keys).
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
  console.log(JSON.stringify({
    event: "ttn_api_call",
    baseUrl: TTN_BASE_URL,
    endpoint,
    method,
    function_name: functionName,
    step,
    request_id: requestId,
    timestamp: new Date().toISOString(),
  }));
}
