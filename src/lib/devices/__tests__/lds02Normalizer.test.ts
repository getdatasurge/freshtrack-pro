/**
 * Unit tests for LDS02 Normalizer (sensor library — sole source of truth)
 *
 * Tests use real LDS02 payload samples:
 *   OPEN:   frm_payload 8C 78 01 00 00 0F 00 00 00 00  → door_open = true
 *   CLOSED: frm_payload 0C 78 01 00 00 0F 00 00 00 00  → door_open = false
 */

import { describe, it, expect } from "vitest";
import {
  normalizeLDS02Payload,
  findMatchedAlias,
  DOOR_STATUS_ALIASES,
  OPEN_COUNT_ALIASES,
  OPEN_DURATION_ALIASES,
  BATTERY_V_ALIASES,
  ALARM_ALIASES,
  type CanonicalDoor,
} from "../lds02Normalizer";

// ---------------------------------------------------------------------------
// Real payload samples (as decoder would output)
// ---------------------------------------------------------------------------

/** Decoder output for OPEN uplink (0x8C prefix — bit 7 set) */
const OPEN_VENDOR_PAYLOAD = {
  DOOR_OPEN_STATUS: "OPEN",
  DOOR_OPEN_TIMES: 15,
  LAST_DOOR_OPEN_DURATION: 1, // 1 minute
  BAT_V: 3.192,
};

/** Decoder output for CLOSED uplink (0x0C prefix — bit 7 clear).
 *  Real Dragino TTN decoder outputs "CLOSE" (not "CLOSED"). */
const CLOSED_VENDOR_PAYLOAD = {
  DOOR_OPEN_STATUS: "CLOSE",
  DOOR_OPEN_TIMES: 15,
  LAST_DOOR_OPEN_DURATION: 0,
  BAT_V: 3.192,
};

/** Already in canonical format (e.g., from catalog decoder) */
const CANONICAL_PAYLOAD = {
  door_open: true,
  open_count: 42,
  open_duration_s: 300,
  battery_v: 3.05,
  alarm: false,
};

// ---------------------------------------------------------------------------
// normalizeLDS02Payload — vendor format
// ---------------------------------------------------------------------------

describe("normalizeLDS02Payload", () => {
  it("normalizes OPEN vendor payload", () => {
    const result = normalizeLDS02Payload(OPEN_VENDOR_PAYLOAD);
    expect(result.door_open).toBe(true);
    expect(result.open_count).toBe(15);
    expect(result.open_duration_s).toBe(60); // 1 minute = 60 seconds
    expect(result.battery_v).toBe(3.192);
    expect(result.alarm).toBeNull();
  });

  it("normalizes CLOSED vendor payload", () => {
    const result = normalizeLDS02Payload(CLOSED_VENDOR_PAYLOAD);
    expect(result.door_open).toBe(false);
    expect(result.open_count).toBe(15);
    expect(result.open_duration_s).toBe(0);
    expect(result.battery_v).toBe(3.192);
    expect(result.alarm).toBeNull();
  });

  it("passes through canonical payload without conversion", () => {
    const result = normalizeLDS02Payload(CANONICAL_PAYLOAD);
    expect(result.door_open).toBe(true);
    expect(result.open_count).toBe(42);
    expect(result.open_duration_s).toBe(300); // already seconds — no multiply
    expect(result.battery_v).toBe(3.05);
    expect(result.alarm).toBe(false);
  });

  it("returns all-null for empty payload", () => {
    const result = normalizeLDS02Payload({});
    expect(result).toEqual({
      door_open: null,
      open_count: null,
      open_duration_s: null,
      battery_v: null,
      alarm: null,
    });
  });

  it("returns all-null for unrelated payload", () => {
    const result = normalizeLDS02Payload({ temperature: 22.5, humidity: 55 });
    expect(result).toEqual({
      door_open: null,
      open_count: null,
      open_duration_s: null,
      battery_v: null,
      alarm: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Door status — alias coverage
// ---------------------------------------------------------------------------

describe("door_open normalization", () => {
  it("handles boolean door_open", () => {
    expect(normalizeLDS02Payload({ door_open: true }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ door_open: false }).door_open).toBe(false);
  });

  it("handles numeric door_open (1/0)", () => {
    expect(normalizeLDS02Payload({ door_open: 1 }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ door_open: 0 }).door_open).toBe(false);
  });

  it("handles DOOR_OPEN_STATUS string", () => {
    expect(normalizeLDS02Payload({ DOOR_OPEN_STATUS: "OPEN" }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ DOOR_OPEN_STATUS: "CLOSED" }).door_open).toBe(false);
    // Dragino TTN decoder outputs "CLOSE" (not "CLOSED")
    expect(normalizeLDS02Payload({ DOOR_OPEN_STATUS: "CLOSE" }).door_open).toBe(false);
  });

  it("handles door_status string", () => {
    expect(normalizeLDS02Payload({ door_status: "open" }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ door_status: "closed" }).door_open).toBe(false);
  });

  it("handles open_state_abs string", () => {
    expect(normalizeLDS02Payload({ open_state_abs: "open" }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ open_state_abs: "closed" }).door_open).toBe(false);
  });

  it("handles doorStatus alias", () => {
    expect(normalizeLDS02Payload({ doorStatus: "open" }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ doorStatus: false }).door_open).toBe(false);
  });

  it("handles open_close (Milesight format)", () => {
    expect(normalizeLDS02Payload({ open_close: 1 }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ open_close: 0 }).door_open).toBe(false);
  });

  it("handles contactStatus", () => {
    expect(normalizeLDS02Payload({ contactStatus: "open" }).door_open).toBe(true);
    expect(normalizeLDS02Payload({ contactStatus: "closed" }).door_open).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Open count — alias coverage
// ---------------------------------------------------------------------------

describe("open_count normalization", () => {
  it("handles open_count canonical", () => {
    expect(normalizeLDS02Payload({ open_count: 5 }).open_count).toBe(5);
  });

  it("handles DOOR_OPEN_TIMES vendor field", () => {
    expect(normalizeLDS02Payload({ DOOR_OPEN_TIMES: 99 }).open_count).toBe(99);
  });

  it("handles open_times alias", () => {
    expect(normalizeLDS02Payload({ open_times: 7 }).open_count).toBe(7);
  });

  it("handles door_open_times alias", () => {
    expect(normalizeLDS02Payload({ door_open_times: 3 }).open_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Open duration — minutes-to-seconds conversion
// ---------------------------------------------------------------------------

describe("open_duration_s normalization", () => {
  it("converts LAST_DOOR_OPEN_DURATION from minutes to seconds", () => {
    expect(normalizeLDS02Payload({ LAST_DOOR_OPEN_DURATION: 5 }).open_duration_s).toBe(300);
  });

  it("converts open_duration from minutes to seconds", () => {
    expect(normalizeLDS02Payload({ open_duration: 10 }).open_duration_s).toBe(600);
  });

  it("preserves open_duration_s as seconds (no conversion)", () => {
    expect(normalizeLDS02Payload({ open_duration_s: 180 }).open_duration_s).toBe(180);
  });

  it("handles zero minutes", () => {
    expect(normalizeLDS02Payload({ LAST_DOOR_OPEN_DURATION: 0 }).open_duration_s).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Battery voltage — alias coverage
// ---------------------------------------------------------------------------

describe("battery_v normalization", () => {
  it("handles battery_v canonical", () => {
    expect(normalizeLDS02Payload({ battery_v: 3.05 }).battery_v).toBe(3.05);
  });

  it("handles BAT_V vendor field", () => {
    expect(normalizeLDS02Payload({ BAT_V: 3.192 }).battery_v).toBe(3.192);
  });

  it("handles BatV alias", () => {
    expect(normalizeLDS02Payload({ BatV: 3.037 }).battery_v).toBe(3.037);
  });

  it("handles battery_volt_abs alias", () => {
    expect(normalizeLDS02Payload({ battery_volt_abs: 2.9 }).battery_v).toBe(2.9);
  });

  it("handles bat_v lowercase alias", () => {
    expect(normalizeLDS02Payload({ bat_v: 3.1 }).battery_v).toBe(3.1);
  });
});

// ---------------------------------------------------------------------------
// Alarm
// ---------------------------------------------------------------------------

describe("alarm normalization", () => {
  it("handles boolean alarm", () => {
    expect(normalizeLDS02Payload({ alarm: true }).alarm).toBe(true);
    expect(normalizeLDS02Payload({ alarm: false }).alarm).toBe(false);
  });

  it("handles ALARM uppercase", () => {
    expect(normalizeLDS02Payload({ ALARM: true }).alarm).toBe(true);
  });

  it("returns null when not present", () => {
    expect(normalizeLDS02Payload({ door_open: true }).alarm).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findMatchedAlias
// ---------------------------------------------------------------------------

describe("findMatchedAlias", () => {
  it("returns the first matching key", () => {
    expect(findMatchedAlias({ DOOR_OPEN_STATUS: "OPEN", door_open: true }, DOOR_STATUS_ALIASES)).toBe("door_open");
  });

  it("returns null when no key matches", () => {
    expect(findMatchedAlias({ temperature: 22 }, DOOR_STATUS_ALIASES)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Null safety
// ---------------------------------------------------------------------------

describe("null safety", () => {
  it("handles null values in payload", () => {
    const result = normalizeLDS02Payload({
      door_open: null,
      open_count: null,
      LAST_DOOR_OPEN_DURATION: null,
      BAT_V: null,
    });
    expect(result.door_open).toBeNull();
    expect(result.open_count).toBeNull();
    expect(result.open_duration_s).toBeNull();
    expect(result.battery_v).toBeNull();
  });

  it("handles undefined values in payload", () => {
    const result = normalizeLDS02Payload({
      door_open: undefined,
      open_count: undefined,
    });
    expect(result.door_open).toBeNull();
    expect(result.open_count).toBeNull();
  });
});
