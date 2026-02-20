/**
 * LoRaWAN Codec Loader
 *
 * 3-tier decoder priority system:
 *   1. USER OVERRIDE — Admin-entered custom decoder JS per device model
 *   2. REPO DEFAULT  — Official TTN decoder from lib/lorawan-devices/ submodule
 *   3. NONE          — No decoder available, rely on TTN's decoded_payload as-is
 *
 * This module provides:
 *   - A registry mapping sensor models to their repo decoder file paths
 *   - getActiveDecoder() to resolve the correct decoder JS string
 *   - decodeWithSource() to execute an arbitrary decoder JS against raw bytes
 *   - decodeUplink() to decode using the registered repo decoder
 */

// ============================================================================
// Types
// ============================================================================

export interface DecodedPayload {
  data: Record<string, unknown>;
  warnings?: string[];
  errors?: string[];
}

export interface CodecRegistryEntry {
  /** Relative path from lib/lorawan-devices/vendor/ */
  vendorPath: string;
  /** Default fPort for this device */
  defaultFPort: number;
  /** TTN device repo ID (vendor/model) */
  ttnDeviceRepoId: string;
  /** Display name */
  displayName: string;
}

// ============================================================================
// Codec Registry — maps sensor model names to their TTN repo decoder paths
// ============================================================================

export const CODEC_REGISTRY: Record<string, CodecRegistryEntry> = {
  LHT65: {
    vendorPath: "dragino/lht65.js",
    defaultFPort: 2,
    ttnDeviceRepoId: "dragino/lht65",
    displayName: "Dragino LHT65",
  },
  LHT65N: {
    vendorPath: "dragino/lht65n.js",
    defaultFPort: 2,
    ttnDeviceRepoId: "dragino/lht65n",
    displayName: "Dragino LHT65N",
  },
  LDS02: {
    vendorPath: "dragino/lds02.js",
    defaultFPort: 10,
    ttnDeviceRepoId: "dragino/lds02",
    displayName: "Dragino LDS02",
  },
  R311A: {
    vendorPath: "netvox/payload/r311a_r718f_r730f.js",
    defaultFPort: 6,
    ttnDeviceRepoId: "netvox/r311a",
    displayName: "Netvox R311A",
  },
  "ERS CO2": {
    vendorPath: "elsys/elsys.js",
    defaultFPort: 5,
    ttnDeviceRepoId: "elsys/ers-co2",
    displayName: "Elsys ERS CO2",
  },
};

// ============================================================================
// 3-Tier Decoder Resolution
// ============================================================================

/**
 * Resolve the active decoder JS string using the 3-tier priority system:
 *   1. If userDecoderJs is provided and non-empty, return it (user override)
 *   2. If repoDecoderJs is provided, return it (repo default)
 *   3. Return null (no decoder available — rely on TTN decoded_payload)
 */
export function getActiveDecoder(
  userDecoderJs?: string | null,
  repoDecoderJs?: string | null
): string | null {
  // Priority 1: User override
  if (userDecoderJs && userDecoderJs.trim().length > 0) {
    return userDecoderJs;
  }

  // Priority 2: Repo default
  if (repoDecoderJs && repoDecoderJs.trim().length > 0) {
    return repoDecoderJs;
  }

  // Priority 3: No decoder
  return null;
}

// ============================================================================
// Decoder Execution
// ============================================================================

/**
 * Decode a LoRaWAN uplink using an arbitrary decoder JS string.
 *
 * The decoder JS must define a `decodeUplink(input)` function that accepts
 * `{ bytes: number[], fPort: number }` and returns `{ data: {...} }`.
 *
 * This runs the decoder using `new Function()` — suitable for browser-side
 * admin testing. NOT used in the production webhook pipeline.
 *
 * @param decoderJs - The decoder JavaScript source code
 * @param bytes - Raw payload bytes as number array
 * @param fPort - LoRaWAN fPort number
 * @returns Decoded payload with data, warnings, errors
 * @throws Error if decoder execution fails
 */
export function decodeWithSource(
  decoderJs: string,
  bytes: number[],
  fPort: number
): DecodedPayload {
  const wrappedCode = `${decoderJs}\nreturn decodeUplink(input);`;
  // eslint-disable-next-line no-new-func
  const decoderFn = new Function("input", wrappedCode);
  const result = decoderFn({ bytes, fPort });

  if (!result) {
    return { data: {}, errors: ["Decoder returned null/undefined"] };
  }

  // TTN device repo decoders return { data, warnings, errors }
  const data = (result.data ?? result) as Record<string, unknown>;
  const warnings = Array.isArray(result.warnings) ? result.warnings : undefined;
  const errors = Array.isArray(result.errors) ? result.errors : undefined;

  return { data, warnings, errors };
}

/**
 * Decode a LoRaWAN uplink using a registered repo decoder for a sensor model.
 *
 * This is a convenience wrapper that looks up the decoder JS from the registry
 * and calls decodeWithSource. It requires the actual JS content to be passed in
 * (since we can't read files in the browser).
 *
 * @param decoderJs - The decoder JS content (from repo_decoder_js or user_decoder_js)
 * @param bytes - Raw payload bytes as number array
 * @param fPort - LoRaWAN fPort number
 * @returns Decoded payload
 */
export function decodeUplink(
  decoderJs: string,
  bytes: number[],
  fPort: number
): DecodedPayload {
  return decodeWithSource(decoderJs, bytes, fPort);
}

/**
 * Convert a hex string to a byte array.
 * Handles optional spaces between bytes.
 *
 * @example hexToBytes("CBF60B0D") => [0xCB, 0xF6, 0x0B, 0x0D]
 * @example hexToBytes("CB F6 0B 0D") => [0xCB, 0xF6, 0x0B, 0x0D]
 */
export function hexToBytes(hex: string): number[] {
  const cleaned = hex.replace(/\s+/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.substring(i, i + 2), 16));
  }
  return bytes;
}

/**
 * Convert a byte array to a hex string.
 */
export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get the list of supported device models from the codec registry.
 */
export function getSupportedDevices(): Array<{
  model: string;
  entry: CodecRegistryEntry;
}> {
  return Object.entries(CODEC_REGISTRY).map(([model, entry]) => ({
    model,
    entry,
  }));
}

/**
 * Check if a sensor model has a registered codec in the registry.
 */
export function hasCodec(sensorModel: string): boolean {
  return sensorModel in CODEC_REGISTRY;
}

/**
 * Get the codec registry entry for a sensor model.
 */
export function getCodecEntry(
  sensorModel: string
): CodecRegistryEntry | undefined {
  return CODEC_REGISTRY[sensorModel];
}
