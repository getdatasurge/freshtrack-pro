/**
 * Client-side LoRaWAN payload decoder runner.
 *
 * Executes decoder JavaScript in the browser using `new Function()`.
 * Used by the admin Sensor Library UI for:
 *   - Testing decoders against sample payloads
 *   - Side-by-side comparison of repo vs user decoders
 *   - Running test fixtures from the TTN device repo
 *
 * This does NOT touch the production uplink pipeline — the webhook handler
 * continues using TTN's decoded_payload as the source of truth.
 */

export interface DecoderResult {
  data: Record<string, unknown>;
  warnings?: string[];
  errors?: string[];
}

export interface DecoderTestResult {
  success: boolean;
  result: DecoderResult | null;
  error: string | null;
  durationMs: number;
}

export interface DecoderComparisonResult {
  repoResult: DecoderTestResult;
  userResult: DecoderTestResult;
  fieldsMatch: boolean;
  diffKeys: string[];
}

/**
 * Convert a hex string to a byte array.
 * Handles optional spaces between bytes (e.g., "CB F6 0B 0D" or "CBF60B0D").
 */
export function hexToBytes(hex: string): number[] {
  const cleaned = hex.replace(/\s+/g, '');
  if (cleaned.length % 2 !== 0) {
    throw new Error(`Invalid hex string: odd number of characters (${cleaned.length})`);
  }
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}: "${cleaned.substring(i, i + 2)}"`);
    }
    bytes.push(byte);
  }
  return bytes;
}

/**
 * Run a decoder JavaScript string against a payload.
 *
 * The decoder JS must define a `decodeUplink(input)` function that accepts
 * `{ bytes: number[], fPort: number }` and returns `{ data: {...} }`.
 */
export function runDecoder(
  decoderJs: string,
  bytes: number[],
  fPort: number,
): DecoderTestResult {
  const start = performance.now();
  try {
    // Wrap the decoder source so the factory returns the decoded result
    const wrappedSource = `
      ${decoderJs}
      return decodeUplink(input);
    `;
    const factory = new Function('input', wrappedSource);
    const raw = factory({ bytes, fPort });

    const result: DecoderResult = {
      data: (raw?.data ?? raw) as Record<string, unknown>,
      warnings: Array.isArray(raw?.warnings) ? raw.warnings : undefined,
      errors: Array.isArray(raw?.errors) ? raw.errors : undefined,
    };

    return {
      success: true,
      result,
      error: null,
      durationMs: performance.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      result: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Run a decoder against a hex payload string.
 * Convenience wrapper that handles hex → bytes conversion.
 */
export function runDecoderFromHex(
  decoderJs: string,
  hexPayload: string,
  fPort: number,
): DecoderTestResult {
  try {
    const bytes = hexToBytes(hexPayload);
    return runDecoder(decoderJs, bytes, fPort);
  } catch (err) {
    return {
      success: false,
      result: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: 0,
    };
  }
}

/**
 * Deep compare two decoded payloads with numeric tolerance.
 * Returns which top-level keys differ.
 */
export function compareDecodedPayloads(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  tolerance = 0.01,
): { match: boolean; diffKeys: string[] } {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffKeys: string[] = [];

  for (const key of allKeys) {
    const va = a[key];
    const vb = b[key];

    if (va === undefined && vb === undefined) continue;
    if (va === undefined || vb === undefined) {
      diffKeys.push(key);
      continue;
    }

    if (typeof va === 'number' && typeof vb === 'number') {
      if (Math.abs(va - vb) > tolerance) diffKeys.push(key);
      continue;
    }

    if (typeof va === typeof vb && (typeof va === 'boolean' || typeof va === 'string')) {
      if (va !== vb) diffKeys.push(key);
      continue;
    }

    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffKeys.push(key);
    }
  }

  return { match: diffKeys.length === 0, diffKeys };
}

/**
 * Run both repo and user decoders against the same payload and compare results.
 */
export function compareDecoders(
  repoDecoderJs: string | null,
  userDecoderJs: string | null,
  hexPayload: string,
  fPort: number,
): DecoderComparisonResult {
  const repoResult = repoDecoderJs
    ? runDecoderFromHex(repoDecoderJs, hexPayload, fPort)
    : { success: false, result: null, error: 'No repo decoder available', durationMs: 0 };

  const userResult = userDecoderJs
    ? runDecoderFromHex(userDecoderJs, hexPayload, fPort)
    : { success: false, result: null, error: 'No user decoder available', durationMs: 0 };

  let fieldsMatch = false;
  let diffKeys: string[] = [];

  if (repoResult.success && userResult.success && repoResult.result && userResult.result) {
    const comparison = compareDecodedPayloads(repoResult.result.data, userResult.result.data);
    fieldsMatch = comparison.match;
    diffKeys = comparison.diffKeys;
  }

  return { repoResult, userResult, fieldsMatch, diffKeys };
}
