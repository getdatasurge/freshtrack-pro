import { readFileSync } from 'fs';
import { resolve } from 'path';

// --- Types ---

export interface DecodedPayload {
  data?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

export interface EncodedDownlink {
  fPort: number;
  bytes: number[];
}

interface CodecModule {
  decodeUplink: (input: { bytes: number[]; fPort: number }) => DecodedPayload;
  encodeDownlink?: (input: { data: Record<string, unknown> }) => EncodedDownlink;
  decodeDownlink?: (input: { bytes: number[]; fPort: number }) => DecodedPayload;
}

// --- Sensor Model Registry ---

const CODEC_REGISTRY: Record<string, string> = {
  DRAGINO_LHT65: 'vendor/dragino/lht65.js',
  DRAGINO_LHT65N: 'vendor/dragino/lht65n.js',
  DRAGINO_LDS02: 'vendor/dragino/lds02.js',
  NETVOX_R311A: 'vendor/netvox/payload/r311a_r718f_r730f.js',
  ELSYS_ERS_CO2: 'vendor/elsys/elsys.js',
};

// --- Codec Cache ---

const codecCache = new Map<string, CodecModule>();

// --- Helpers ---

function getSubmodulePath(): string {
  return resolve(__dirname, '../../lib/lorawan-devices');
}

function loadCodecModule(codecPath: string): CodecModule {
  const fullPath = resolve(getSubmodulePath(), codecPath);
  const source = readFileSync(fullPath, 'utf-8');

  // Use new Function() to sandbox the JS execution (same pattern TTN uses).
  // The codec files define functions like decodeUplink, encodeDownlink, etc.
  // We wrap the source in a function that returns the exports.
  const wrappedSource = `
    ${source}
    return {
      decodeUplink: typeof decodeUplink !== 'undefined' ? decodeUplink : undefined,
      encodeDownlink: typeof encodeDownlink !== 'undefined' ? encodeDownlink : undefined,
      decodeDownlink: typeof decodeDownlink !== 'undefined' ? decodeDownlink : undefined,
    };
  `;

  const factory = new Function(wrappedSource);
  const mod = factory() as CodecModule;

  if (typeof mod.decodeUplink !== 'function') {
    throw new Error(`Codec at ${codecPath} does not export a decodeUplink function`);
  }

  return mod;
}

function getCodec(sensorModel: string): CodecModule {
  const codecPath = CODEC_REGISTRY[sensorModel];
  if (!codecPath) {
    throw new Error(
      `Unknown sensor model: "${sensorModel}". Supported models: ${Object.keys(CODEC_REGISTRY).join(', ')}`
    );
  }

  const cached = codecCache.get(sensorModel);
  if (cached) {
    return cached;
  }

  const mod = loadCodecModule(codecPath);
  codecCache.set(sensorModel, mod);
  return mod;
}

// --- Public API ---

/**
 * Decode an uplink payload from a LoRaWAN sensor.
 */
export function decodeUplink(
  sensorModel: string,
  bytes: number[],
  fPort: number
): DecodedPayload {
  const codec = getCodec(sensorModel);
  return codec.decodeUplink({ bytes, fPort });
}

/**
 * Encode a downlink command for a LoRaWAN sensor.
 * Returns null if the codec does not support downlink encoding.
 */
export function encodeDownlink(
  sensorModel: string,
  data: Record<string, unknown>
): EncodedDownlink | null {
  const codec = getCodec(sensorModel);
  if (typeof codec.encodeDownlink !== 'function') {
    return null;
  }
  return codec.encodeDownlink({ data });
}

/**
 * Get the list of supported sensor model identifiers.
 */
export function getSupportedDevices(): string[] {
  return Object.keys(CODEC_REGISTRY);
}

/**
 * Clear the codec cache (useful for testing).
 */
export function clearCodecCache(): void {
  codecCache.clear();
}
