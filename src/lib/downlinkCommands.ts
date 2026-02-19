/**
 * LHT65N Downlink Command Builders
 *
 * Ported from Python downlink config tool.
 * Builds hex payload strings for TTN Class A downlinks.
 *
 * Rules (non-negotiable):
 *  - confirmed downlink: ALWAYS false
 *  - queue operation: ALWAYS REPLACE
 *  - one change = one downlink
 */

import type { ExtMode, DownlinkCommandParams } from "@/types/sensorConfig";

// ---------------------------------------------------------------------------
// Hex ↔ Base64 helpers
// ---------------------------------------------------------------------------

/** Convert hex string (e.g. "01000258") to base64 */
export function hexToBase64(hex: string): string {
  const clean = hex.replace(/\s+/g, '').replace(/0x/gi, '');
  const bytes = new Uint8Array(clean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  return btoa(String.fromCharCode(...bytes));
}

/** Convert a number to a zero-padded hex string of `byteCount` bytes (big-endian) */
function toHex(value: number, byteCount: number): string {
  const hex = value.toString(16).toUpperCase();
  return hex.padStart(byteCount * 2, '0');
}

/** Convert a signed int16 to a 2-byte hex string */
function toInt16Hex(value: number): string {
  if (value < 0) {
    value = 0x10000 + value; // two's complement
  }
  return toHex(value & 0xFFFF, 2);
}

// ---------------------------------------------------------------------------
// Command builders
// ---------------------------------------------------------------------------

/**
 * Set uplink interval: 0x01 + 3-byte seconds
 * Range: 1 .. 16,777,215 (0xFFFFFF)
 */
export function cmdSetIntervalSeconds(seconds: number): string {
  if (seconds < 1 || seconds > 0xFFFFFF) {
    throw new Error(`Interval must be 1..16777215 seconds, got ${seconds}`);
  }
  return '01' + toHex(seconds, 3);
}

/**
 * Set external sensor mode (LHT65N)
 *  - e3_ext1 → A201 (E3 temp probe)
 *  - e3_ext9 → A209 (E3 temp probe + unix timestamp in uplink)
 */
export function cmdSetExtMode(mode: ExtMode): string {
  const map: Record<string, string> = {
    e3_ext1: 'A201',
    e3_ext9: 'A209',
  };
  const hex = map[mode];
  if (!hex) throw new Error(`Unsupported ext mode: ${mode}`);
  return hex;
}

/**
 * Set device time: 0x30 + 4-byte unix timestamp + 00
 */
export function cmdSetTime(unixTs: number): string {
  if (unixTs < 0 || unixTs > 0xFFFFFFFF) {
    throw new Error(`Unix timestamp must be 0..4294967295, got ${unixTs}`);
  }
  return '30' + toHex(unixTs, 4) + '00';
}

/**
 * Enable/disable time sync: 0x28 + 01/00
 */
export function cmdSyncMod(enable: boolean): string {
  return enable ? '2801' : '2800';
}

/**
 * Set time sync interval days: 0x29 + 1-byte days (0..255)
 */
export function cmdSyncTdcDays(days: number): string {
  if (days < 0 || days > 255) {
    throw new Error(`Sync days must be 0..255, got ${days}`);
  }
  return '29' + toHex(days, 1);
}

/**
 * Clear datalog: 0xA3 01
 */
export function cmdClearDatalog(): string {
  return 'A301';
}

/**
 * Enable/disable PNACKMD: 0x34 + 01/00
 */
export function cmdPnackmd(enable: boolean): string {
  return enable ? '3401' : '3400';
}

/**
 * Configure alarm:
 *  0xAA + WMOD(1B) + CITEMP(2B) + TEMPlow(2B) + TEMPhigh(2B)
 *  Temperatures encoded as °C * 100 (signed int16)
 */
export function cmdAlarm(
  enable: boolean,
  checkMinutes: number,
  lowC: number,
  highC: number,
): string {
  if (checkMinutes < 1 || checkMinutes > 0xFFFF) {
    throw new Error(`check_minutes must be 1..65535, got ${checkMinutes}`);
  }
  const lowX100 = Math.round(lowC * 100);
  const highX100 = Math.round(highC * 100);
  if (highX100 <= lowX100) {
    throw new Error(`high_c (${highC}) must be > low_c (${lowC})`);
  }
  if (lowX100 < -32768 || lowX100 > 32767 || highX100 < -32768 || highX100 > 32767) {
    throw new Error('Temperature out of int16 range');
  }

  const wmod = enable ? '01' : '00';
  return 'AA' + wmod + toHex(checkMinutes, 2) + toInt16Hex(lowX100) + toInt16Hex(highX100);
}

// ---------------------------------------------------------------------------
// Unified builder (maps command_params → hex payload + fport)
// ---------------------------------------------------------------------------

export interface BuiltCommand {
  hex: string;
  fport: number;
  changeType: string;
  expectedResult: string;
}

/** @deprecated Use DownlinkCommandParams from @/types/sensorConfig */
export type CommandParams = DownlinkCommandParams;

export function buildCommand(params: DownlinkCommandParams, defaultFport: number = 2): BuiltCommand {
  switch (params.type) {
    case 'uplink_interval':
      return {
        hex: cmdSetIntervalSeconds(params.seconds),
        fport: defaultFport,
        changeType: 'uplink_interval',
        expectedResult: `Uplink interval → ${params.seconds}s (${Math.round(params.seconds / 60)}min)`,
      };

    case 'ext_mode':
      return {
        hex: cmdSetExtMode(params.mode),
        fport: defaultFport,
        changeType: 'ext_mode',
        expectedResult: `External mode → ${params.mode === 'e3_ext1' ? 'E3 (ext=1)' : 'E3 + timestamp (ext=9)'}`,
      };

    case 'time_sync':
      return {
        hex: cmdSyncMod(params.enable),
        fport: defaultFport,
        changeType: 'time_sync',
        expectedResult: `Time sync → ${params.enable ? 'enabled' : 'disabled'}`,
      };

    case 'time_sync_days':
      return {
        hex: cmdSyncTdcDays(params.days),
        fport: defaultFport,
        changeType: 'time_sync',
        expectedResult: `Time sync interval → ${params.days} days`,
      };

    case 'set_time':
      return {
        hex: cmdSetTime(params.unix_ts),
        fport: defaultFport,
        changeType: 'set_time',
        expectedResult: `Device time set to ${new Date(params.unix_ts * 1000).toISOString()}`,
      };

    case 'alarm': {
      return {
        hex: cmdAlarm(params.enable, params.check_minutes, params.low_c, params.high_c),
        fport: defaultFport,
        changeType: 'alarm',
        expectedResult: params.enable
          ? `Alarm on: check every ${params.check_minutes}min, range ${params.low_c}°C – ${params.high_c}°C`
          : 'Alarm disabled',
      };
    }

    case 'clear_datalog':
      return {
        hex: cmdClearDatalog(),
        fport: defaultFport,
        changeType: 'clear_datalog',
        expectedResult: 'Datalog cleared',
      };

    case 'pnackmd':
      return {
        hex: cmdPnackmd(params.enable),
        fport: defaultFport,
        changeType: 'pnackmd',
        expectedResult: `PNACKMD → ${params.enable ? 'enabled' : 'disabled'}`,
      };

    case 'raw':
      return {
        hex: params.hex.replace(/\s+/g, '').toUpperCase(),
        fport: params.fport ?? defaultFport,
        changeType: 'raw',
        expectedResult: `Raw command: ${params.hex}`,
      };

    case 'catalog':
      return {
        hex: params.hex.replace(/\s+/g, '').toUpperCase(),
        fport: params.fport,
        changeType: 'catalog',
        expectedResult: params.expectedResult,
      };

    default:
      throw new Error(`Unknown command type: ${(params as any).type}`);
  }
}
