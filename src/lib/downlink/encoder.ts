/**
 * Generic Downlink Encoder
 *
 * Encodes a downlink command from its catalog definition + user-provided field
 * values. Returns the hex string ready to send to TTS.
 *
 * This replaces per-sensor encoding logic — every command in every catalog
 * entry is encodable through this single function.
 */

import type {
  CatalogDownlinkCommand,
  CatalogDownlinkField,
  DownlinkFieldEncoding,
} from "@/types/sensorCatalog";

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function encodeU8(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0");
}

function encodeU16BE(value: number): string {
  return (
    encodeU8((value >> 8) & 0xff) +
    encodeU8(value & 0xff)
  );
}

function encodeU24BE(value: number): string {
  return (
    encodeU8((value >> 16) & 0xff) +
    encodeU8((value >> 8) & 0xff) +
    encodeU8(value & 0xff)
  );
}

function encodeU32BE(value: number): string {
  return (
    encodeU8((value >> 24) & 0xff) +
    encodeU8((value >> 16) & 0xff) +
    encodeU8((value >> 8) & 0xff) +
    encodeU8(value & 0xff)
  );
}

function encodeSigned16BE(value: number): string {
  if (value < 0) value += 65536;
  return encodeU16BE(value & 0xffff);
}

// ---------------------------------------------------------------------------
// Field encoder
// ---------------------------------------------------------------------------

function encodeField(
  field: CatalogDownlinkField,
  rawValue: number | boolean | string,
  displayTempUnit?: "fahrenheit" | "celsius",
): string {
  let value = rawValue;

  // Apply input transforms
  if (field.inputTransform === "minutes_to_seconds") {
    value = Number(value) * 60;
  }

  const encoding: DownlinkFieldEncoding = field.encoding;

  switch (encoding) {
    case "u8":
      return encodeU8(Number(value));
    case "u16be":
      return encodeU16BE(Number(value));
    case "u24be":
      return encodeU24BE(Number(value));
    case "u32be":
      return encodeU32BE(Number(value));
    case "bool01":
      return value ? "01" : "00";
    case "invertBool01":
      // Dragino DISALARM: enabled → 0x00, disabled → 0x01
      return value ? "00" : "01";
    case "temp_celsius_x100": {
      // UI value is in user's display unit → convert to Celsius → × 100 → signed int16
      let celsius = Number(value);
      if (displayTempUnit === "fahrenheit") {
        celsius = (celsius - 32) * 5 / 9;
      }
      const encoded = Math.round(celsius * 100);
      return encodeSigned16BE(encoded);
    }
    case "unix_timestamp_now": {
      // Auto-compute current unix timestamp (ignores passed value)
      const ts = Math.floor(Date.now() / 1000);
      return encodeU32BE(ts);
    }
    default: {
      // Exhaustive check
      const _never: never = encoding;
      throw new Error(`Unknown encoding: ${_never}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Command encoder (public API)
// ---------------------------------------------------------------------------

/**
 * Encode a downlink command from its catalog definition + user-provided field values.
 * Returns the uppercase hex string ready to send to TTS.
 */
export function encodeDownlinkCommand(
  command: CatalogDownlinkCommand,
  fieldValues: Record<string, number | boolean | string>,
  displayTempUnit?: "fahrenheit" | "celsius",
): string {
  // If command has no fields, hex_template is the complete payload
  if (command.fields.length === 0) {
    return command.hex_template.toUpperCase();
  }

  // Parse hex_template into alternating literal and placeholder segments.
  // Example: "30{ts}00" → literals=["30","00"], placeholders=["ts"]
  // Example: "AA{a}{b}{c}{d}" → literals=["AA","","","",""], placeholders=["a","b","c","d"]
  const literals: string[] = [];
  const placeholders: string[] = [];
  let remaining = command.hex_template;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("{");
    if (openIdx < 0) {
      // No more placeholders — rest is a trailing literal
      literals.push(remaining);
      break;
    }
    literals.push(remaining.substring(0, openIdx));
    const closeIdx = remaining.indexOf("}", openIdx);
    if (closeIdx < 0) {
      throw new Error(`Unclosed '{' in hex_template for command "${command.key}"`);
    }
    placeholders.push(remaining.substring(openIdx + 1, closeIdx));
    remaining = remaining.substring(closeIdx + 1);
  }

  // Encode each field in order (one field per placeholder)
  let result = "";
  for (let i = 0; i < literals.length; i++) {
    result += literals[i];
    if (i < command.fields.length) {
      const field = command.fields[i];
      const value = fieldValues[field.name] ?? field.default;
      if (value === undefined) {
        throw new Error(`Missing value for field "${field.name}" in command "${command.key}"`);
      }
      result += encodeField(field, value, displayTempUnit);
    }
  }

  return result.toUpperCase();
}

/**
 * Build a human-readable expected result string for a catalog command.
 */
export function buildExpectedResult(
  command: CatalogDownlinkCommand,
  fieldValues: Record<string, number | boolean | string>,
): string {
  const visibleFields = command.fields.filter((f) => !f.hidden);
  if (visibleFields.length === 0) {
    return command.name;
  }

  const parts: string[] = [command.name + " →"];
  for (const field of visibleFields) {
    const value = fieldValues[field.name] ?? field.default;
    if (field.type === "boolean") {
      const label = value ? (field.trueLabel || "Enabled") : (field.falseLabel || "Disabled");
      parts.push(label);
    } else {
      parts.push(`${value}${field.unit ? " " + field.unit : ""}`);
    }
  }

  return parts.join(" ");
}
