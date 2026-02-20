/**
 * Client-Side Codec Runner
 *
 * Runs LoRaWAN decoder JavaScript in the browser for admin testing.
 * Used by the SensorLibrary "Test Decoder" feature.
 *
 * Option B from the spec: client-side decoding using new Function().
 * Avoids Edge Function cold starts and keeps things simple.
 */

import {
  decodeWithSource,
  hexToBytes,
  type DecodedPayload,
} from "./lorawan-codec-loader";

// ============================================================================
// Types
// ============================================================================

export interface DecoderTestResult {
  success: boolean;
  decoded: DecodedPayload | null;
  error: string | null;
  executionTimeMs: number;
  decoderSource: "repo" | "user";
}

export interface DecoderComparisonResult {
  repo: DecoderTestResult | null;
  user: DecoderTestResult | null;
  isMatch: boolean | null;
  mismatchedFields: string[];
}

// ============================================================================
// Single Decoder Execution
// ============================================================================

/**
 * Run a decoder against a hex payload in the browser.
 *
 * @param decoderJs - The decoder JavaScript source code
 * @param hexPayload - Hex string of the raw payload (spaces allowed)
 * @param fPort - LoRaWAN fPort number
 * @param source - Whether this is a 'repo' or 'user' decoder
 * @returns Test result with decoded data or error
 */
export function runDecoder(
  decoderJs: string,
  hexPayload: string,
  fPort: number,
  source: "repo" | "user" = "repo"
): DecoderTestResult {
  const start = performance.now();

  try {
    if (!decoderJs || decoderJs.trim().length === 0) {
      return {
        success: false,
        decoded: null,
        error: "No decoder code provided",
        executionTimeMs: 0,
        decoderSource: source,
      };
    }

    const bytes = hexToBytes(hexPayload);
    if (bytes.length === 0) {
      return {
        success: false,
        decoded: null,
        error: "Empty or invalid hex payload",
        executionTimeMs: 0,
        decoderSource: source,
      };
    }

    const result = decodeWithSource(decoderJs, bytes, fPort);
    const elapsed = performance.now() - start;

    // Check if the decoder returned errors
    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        decoded: result,
        error: `Decoder errors: ${result.errors.join(", ")}`,
        executionTimeMs: elapsed,
        decoderSource: source,
      };
    }

    return {
      success: true,
      decoded: result,
      error: null,
      executionTimeMs: elapsed,
      decoderSource: source,
    };
  } catch (err) {
    const elapsed = performance.now() - start;
    return {
      success: false,
      decoded: null,
      error: err instanceof Error ? err.message : String(err),
      executionTimeMs: elapsed,
      decoderSource: source,
    };
  }
}

// ============================================================================
// Side-by-Side Comparison
// ============================================================================

/**
 * Run both repo and user decoders and compare results.
 *
 * @param repoDecoderJs - Official TTN decoder JS (nullable)
 * @param userDecoderJs - Admin custom decoder JS (nullable)
 * @param hexPayload - Hex payload string
 * @param fPort - LoRaWAN fPort number
 * @returns Comparison result with both outputs and diff
 */
export function compareDecoders(
  repoDecoderJs: string | null,
  userDecoderJs: string | null,
  hexPayload: string,
  fPort: number
): DecoderComparisonResult {
  const repo = repoDecoderJs
    ? runDecoder(repoDecoderJs, hexPayload, fPort, "repo")
    : null;

  const user = userDecoderJs
    ? runDecoder(userDecoderJs, hexPayload, fPort, "user")
    : null;

  // Compare if both succeeded
  let isMatch: boolean | null = null;
  let mismatchedFields: string[] = [];

  if (repo?.success && user?.success && repo.decoded && user.decoded) {
    const repoData = repo.decoded.data;
    const userData = user.decoded.data;
    const allKeys = new Set([
      ...Object.keys(repoData),
      ...Object.keys(userData),
    ]);

    for (const key of allKeys) {
      const rv = repoData[key];
      const uv = userData[key];

      if (rv === undefined || uv === undefined) {
        mismatchedFields.push(key);
        continue;
      }

      if (typeof rv === "number" && typeof uv === "number") {
        if (Math.abs(rv - uv) > 0.01) {
          mismatchedFields.push(key);
        }
        continue;
      }

      if (JSON.stringify(rv) !== JSON.stringify(uv)) {
        mismatchedFields.push(key);
      }
    }

    isMatch = mismatchedFields.length === 0;
  }

  return { repo, user, isMatch, mismatchedFields };
}

// ============================================================================
// Test Fixture Runner
// ============================================================================

export interface FixtureTestResult {
  description: string;
  passed: boolean;
  actual: Record<string, unknown> | null;
  expected: Record<string, unknown>;
  error: string | null;
  mismatchedFields: string[];
}

/**
 * Run a decoder against a set of test fixtures.
 *
 * @param decoderJs - Decoder JavaScript source code
 * @param fixtures - Array of test fixtures from repo_test_fixtures
 * @returns Array of test results
 */
export function runFixtures(
  decoderJs: string,
  fixtures: Array<{
    description: string;
    fPort: number;
    bytes: string;
    expectedOutput: Record<string, unknown>;
  }>
): FixtureTestResult[] {
  return fixtures.map((fixture) => {
    try {
      const bytes = hexToBytes(fixture.bytes);
      const result = decodeWithSource(decoderJs, bytes, fixture.fPort);

      if (result.errors && result.errors.length > 0) {
        return {
          description: fixture.description,
          passed: false,
          actual: result.data,
          expected: fixture.expectedOutput,
          error: `Decoder errors: ${result.errors.join(", ")}`,
          mismatchedFields: [],
        };
      }

      // Compare actual vs expected
      const mismatchedFields: string[] = [];
      const allKeys = new Set([
        ...Object.keys(result.data),
        ...Object.keys(fixture.expectedOutput),
      ]);

      for (const key of allKeys) {
        const av = result.data[key];
        const ev = fixture.expectedOutput[key];

        if (av === undefined || ev === undefined) {
          mismatchedFields.push(key);
          continue;
        }

        if (typeof av === "number" && typeof ev === "number") {
          if (Math.abs(av - ev) > 0.01) {
            mismatchedFields.push(key);
          }
          continue;
        }

        if (JSON.stringify(av) !== JSON.stringify(ev)) {
          mismatchedFields.push(key);
        }
      }

      return {
        description: fixture.description,
        passed: mismatchedFields.length === 0,
        actual: result.data,
        expected: fixture.expectedOutput,
        error: null,
        mismatchedFields,
      };
    } catch (err) {
      return {
        description: fixture.description,
        passed: false,
        actual: null,
        expected: fixture.expectedOutput,
        error: err instanceof Error ? err.message : String(err),
        mismatchedFields: [],
      };
    }
  });
}
