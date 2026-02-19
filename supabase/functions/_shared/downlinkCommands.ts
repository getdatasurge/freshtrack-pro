/**
 * LHT65N Downlink Command Builders (Deno shared module)
 *
 * Single source of truth for edge functions.
 * Client-side equivalent: src/lib/downlinkCommands.ts
 *
 * Rules (non-negotiable):
 *  - confirmed downlink: ALWAYS false
 *  - queue operation: ALWAYS REPLACE
 *  - one change = one downlink
 */

// ---------------------------------------------------------------------------
// Hex ↔ Base64 helpers
// ---------------------------------------------------------------------------

export function hexToBase64(hex: string): string {
  const clean = hex.replace(/\s+/g, "").replace(/0x/gi, "");
  const bytes = new Uint8Array(
    clean.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  return btoa(String.fromCharCode(...bytes));
}

function toHex(value: number, byteCount: number): string {
  return value.toString(16).toUpperCase().padStart(byteCount * 2, "0");
}

function toInt16Hex(value: number): string {
  if (value < 0) value = 0x10000 + value;
  return toHex(value & 0xffff, 2);
}

// ---------------------------------------------------------------------------
// Command builders
// ---------------------------------------------------------------------------

export function cmdSetIntervalSeconds(seconds: number): string {
  if (seconds < 1 || seconds > 0xffffff)
    throw new Error(`Interval must be 1..16777215, got ${seconds}`);
  return "01" + toHex(seconds, 3);
}

export function cmdSetExtMode(mode: string): string {
  const map: Record<string, string> = { e3_ext1: "A201", e3_ext9: "A209" };
  const hex = map[mode];
  if (!hex) throw new Error(`Unsupported ext mode: ${mode}`);
  return hex;
}

export function cmdSetTime(unixTs: number): string {
  if (unixTs < 0 || unixTs > 0xffffffff)
    throw new Error(`Unix timestamp out of range`);
  return "30" + toHex(unixTs, 4) + "00";
}

export function cmdSyncMod(enable: boolean): string {
  return enable ? "2801" : "2800";
}

export function cmdSyncTdcDays(days: number): string {
  if (days < 0 || days > 255) throw new Error(`Days must be 0..255`);
  return "29" + toHex(days, 1);
}

export function cmdClearDatalog(): string {
  return "A301";
}

export function cmdPnackmd(enable: boolean): string {
  return enable ? "3401" : "3400";
}

export function cmdAlarm(
  enable: boolean,
  checkMinutes: number,
  lowC: number,
  highC: number
): string {
  if (checkMinutes < 1 || checkMinutes > 0xffff)
    throw new Error(`check_minutes must be 1..65535`);
  const lowX100 = Math.round(lowC * 100);
  const highX100 = Math.round(highC * 100);
  if (highX100 <= lowX100) throw new Error(`high must be > low`);
  if (
    lowX100 < -32768 ||
    lowX100 > 32767 ||
    highX100 < -32768 ||
    highX100 > 32767
  )
    throw new Error("Temperature out of int16 range");
  const wmod = enable ? "01" : "00";
  return (
    "AA" +
    wmod +
    toHex(checkMinutes, 2) +
    toInt16Hex(lowX100) +
    toInt16Hex(highX100)
  );
}

// ---------------------------------------------------------------------------
// Unified builder
// ---------------------------------------------------------------------------

export interface BuiltCommand {
  hex: string;
  fport: number;
  changeType: string;
  expectedResult: string;
}

// deno-lint-ignore no-explicit-any
export function buildCommand(params: any, defaultFport: number = 2): BuiltCommand {
  switch (params.type) {
    case "uplink_interval":
      return {
        hex: cmdSetIntervalSeconds(params.seconds),
        fport: defaultFport,
        changeType: "uplink_interval",
        expectedResult: `Uplink interval → ${params.seconds}s`,
      };
    case "ext_mode":
      return {
        hex: cmdSetExtMode(params.mode),
        fport: defaultFport,
        changeType: "ext_mode",
        expectedResult: `External mode → ${params.mode}`,
      };
    case "time_sync":
      return {
        hex: cmdSyncMod(params.enable),
        fport: defaultFport,
        changeType: "time_sync",
        expectedResult: `Time sync → ${params.enable ? "on" : "off"}`,
      };
    case "time_sync_days":
      return {
        hex: cmdSyncTdcDays(params.days),
        fport: defaultFport,
        changeType: "time_sync",
        expectedResult: `Sync interval → ${params.days} days`,
      };
    case "set_time":
      return {
        hex: cmdSetTime(params.unix_ts),
        fport: defaultFport,
        changeType: "set_time",
        expectedResult: `Device time set`,
      };
    case "alarm":
      return {
        hex: cmdAlarm(
          params.enable,
          params.check_minutes,
          params.low_c,
          params.high_c
        ),
        fport: defaultFport,
        changeType: "alarm",
        expectedResult: params.enable
          ? `Alarm: ${params.low_c}°C–${params.high_c}°C every ${params.check_minutes}min`
          : "Alarm disabled",
      };
    case "clear_datalog":
      return {
        hex: cmdClearDatalog(),
        fport: defaultFport,
        changeType: "clear_datalog",
        expectedResult: "Datalog cleared",
      };
    case "pnackmd":
      return {
        hex: cmdPnackmd(params.enable),
        fport: defaultFport,
        changeType: "pnackmd",
        expectedResult: `PNACKMD → ${params.enable ? "on" : "off"}`,
      };
    case "raw":
      return {
        hex: params.hex.replace(/\s+/g, "").toUpperCase(),
        fport: params.fport ?? defaultFport,
        changeType: "raw",
        expectedResult: `Raw: ${params.hex}`,
      };
    case "catalog":
      return {
        hex: params.hex.replace(/\s+/g, "").toUpperCase(),
        fport: params.fport,
        changeType: "catalog",
        expectedResult: params.expectedResult ?? "Catalog command",
      };
    default:
      throw new Error(`Unknown command type: ${params.type}`);
  }
}
