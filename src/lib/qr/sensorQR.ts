/**
 * FrostGuard Sensor QR Provisioning
 *
 * Encodes LoRaWAN credentials into compact QR-safe format.
 * Uses Base45 encoding (same as EU COVID certs) for maximum
 * QR efficiency — all chars are in the QR alphanumeric set.
 *
 * Format: F<base45(dev_eui + app_eui + app_key)>
 * - 32 bytes packed → 48 Base45 chars + 1 prefix = 49 chars total
 * - QR Version 3 (29×29) with Error Correction L
 * - Scannable at <1cm print size
 *
 * Serial number is NOT in the QR — it's printed as human-readable
 * text on the physical label to keep the QR minimal.
 */

// --- Base45 (RFC 9285) ---
// Character set: 0-9 A-Z [space] $ % * + - . / :
// All characters are in the QR alphanumeric mode charset

const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export function bytesToBase45(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const val = bytes[i] * 256 + bytes[i + 1];
      out += B45[Math.floor(val / 2025)] + B45[Math.floor((val % 2025) / 45)] + B45[val % 45];
    } else {
      const val = bytes[i];
      out += B45[Math.floor(val / 45)] + B45[val % 45];
    }
  }
  return out;
}

export function base45ToBytes(str: string): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < str.length) {
    if (i + 2 < str.length) {
      const a = B45.indexOf(str[i]), b = B45.indexOf(str[i + 1]), c = B45.indexOf(str[i + 2]);
      if (a < 0 || b < 0 || c < 0) { i += 3; continue; }
      const val = a * 2025 + b * 45 + c;
      out.push((val >> 8) & 0xff, val & 0xff);
      i += 3;
    } else {
      const a = B45.indexOf(str[i]), b = B45.indexOf(str[i + 1]);
      if (a >= 0 && b >= 0) out.push(a * 45 + b);
      i += 2;
    }
  }
  return new Uint8Array(out);
}

// --- Hex utilities ---

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.slice(offset, offset + length))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

export function formatEUI(raw: string): string {
  const clean = raw.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  return clean.match(/.{1,2}/g)?.join(':') ?? clean;
}

export function cleanHex(value: string): string {
  return value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
}

export function isValidHex(value: string, length: number): boolean {
  return new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(value.replace(/[:\s]/g, ''));
}

// --- Credential types ---

export interface SensorCredentials {
  serial_number: string;   // NOT stored in QR — printed on label
  dev_eui: string;         // 8 bytes / 16 hex chars
  app_eui: string;         // 8 bytes / 16 hex chars
  app_key: string;         // 16 bytes / 32 hex chars
}

// --- Encode / Decode ---

export function encodeCredentials(creds: SensorCredentials): string {
  const dev = hexToBytes(creds.dev_eui);    // 8 bytes
  const app = hexToBytes(creds.app_eui);    // 8 bytes
  const key = hexToBytes(creds.app_key);    // 16 bytes
  const packed = new Uint8Array(32);
  packed.set(dev, 0);
  packed.set(app, 8);
  packed.set(key, 16);
  return `F${bytesToBase45(packed)}`;
}

export function decodeCredentials(raw: string): SensorCredentials | null {
  try {
    // Current format: F + base45(32 bytes)
    if (raw.startsWith('F') && !raw.startsWith('FG') && raw.length >= 40 && raw.length <= 55) {
      const bytes = base45ToBytes(raw.substring(1));
      if (bytes.length === 32) {
        return {
          serial_number: '',
          dev_eui: bytesToHex(bytes, 0, 8),
          app_eui: bytesToHex(bytes, 8, 8),
          app_key: bytesToHex(bytes, 16, 16),
        };
      }
    }
    // Legacy: FG1:serial:dev:app:key
    if (raw.startsWith('FG1:')) {
      const parts = raw.split(':');
      if (parts.length === 5 && parts[2] && parts[3] && parts[4]) {
        return { serial_number: parts[1], dev_eui: parts[2], app_eui: parts[3], app_key: parts[4] };
      }
    }
    // Legacy: JSON
    const parsed = JSON.parse(raw);
    if (parsed.type === 'frostguard_sensor' && parsed.dev_eui && parsed.app_eui && parsed.app_key) {
      return { serial_number: parsed.serial ?? '', dev_eui: parsed.dev_eui, app_eui: parsed.app_eui, app_key: parsed.app_key };
    }
    return null;
  } catch {
    return null;
  }
}
