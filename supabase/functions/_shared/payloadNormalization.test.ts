/**
 * Unit tests for Payload Normalization
 *
 * Covers:
 * - normalizeTelemetry(): vendor-specific key aliasing (Dragino, etc.)
 * - normalizeDoorData(): door field normalization (existing)
 *
 * Run with:  deno test supabase/functions/_shared/payloadNormalization.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeTelemetry, normalizeDoorData, convertVoltageToPercent } from "./payloadNormalization.ts";

// ============================================================================
// normalizeTelemetry
// ============================================================================

Deno.test("normalizeTelemetry - Dragino HT65N payload maps all fields", () => {
  const dragino = {
    BatV: 3.05,
    Bat_status: 0,
    Ext_sensor: "Temperature Sensor",
    Hum_SHT: 62.0,
    TempC_DS: 23.37,
    TempC_SHT: 23.45,
  };

  const result = normalizeTelemetry(dragino);

  // Canonical keys should be set from aliases
  assertEquals(result.temperature, 23.45, "temperature should come from TempC_SHT");
  assertEquals(result.humidity, 62.0, "humidity should come from Hum_SHT");
  // BatV 3.05 → ((3.05 - 3.0) / 0.6) * 100 = 8.33 → rounded to 8
  assertEquals(result.battery, 8, "battery should be converted from BatV voltage to integer percent");

  // Original keys must be preserved
  assertEquals(result.TempC_SHT, 23.45);
  assertEquals(result.TempC_DS, 23.37);
  assertEquals(result.Hum_SHT, 62.0);
  assertEquals(result.BatV, 3.05);
  assertEquals(result.Bat_status, 0);
  assertEquals(result.Ext_sensor, "Temperature Sensor");
});

Deno.test("normalizeTelemetry - canonical keys already present are not overwritten", () => {
  const payload = {
    temperature: 22.0,
    humidity: 45.0,
    battery: 95,
    TempC_SHT: 99.9, // should NOT overwrite existing temperature
    Hum_SHT: 99.9,   // should NOT overwrite existing humidity
    BatV: 2.5,        // should NOT overwrite existing battery
  };

  const result = normalizeTelemetry(payload);

  assertEquals(result.temperature, 22.0, "existing temperature must not be overwritten");
  assertEquals(result.humidity, 45.0, "existing humidity must not be overwritten");
  assertEquals(result.battery, 95, "existing battery must not be overwritten");
});

Deno.test("normalizeTelemetry - battery_level is recognized as existing battery alias", () => {
  // battery_level is used by many sensors (EM300-TH, etc.)
  // The webhook extracts via: decoded.battery ?? decoded.battery_level
  // normalizeTelemetry only maps to 'battery', so battery_level should pass through
  const payload = {
    temperature: 22.0,
    humidity: 50.0,
    battery_level: 95,
    BatV: 2.5, // should NOT map because 'battery' is not present, but this is fine
  };

  const result = normalizeTelemetry(payload);

  // battery_level is not the canonical key 'battery', so BatV WILL set 'battery'
  // BatV 2.5 is below DRAGINO_BATV_MIN (3.0), so clamps to 0%
  assertEquals(result.battery, 0, "BatV 2.5V below min should clamp to 0%");
  assertEquals(result.battery_level, 95, "battery_level should be preserved as-is");
});

Deno.test("normalizeTelemetry - empty payload returns empty", () => {
  const result = normalizeTelemetry({});
  assertEquals(Object.keys(result).length, 0);
});

Deno.test("normalizeTelemetry - no aliasing needed for standard sensor", () => {
  const standard = { temperature: 5.2, humidity: 80, battery_level: 92 };
  const result = normalizeTelemetry(standard);

  assertEquals(result.temperature, 5.2);
  assertEquals(result.humidity, 80);
  assertEquals(result.battery_level, 92);
  // No extra keys should be added
  assertEquals(Object.keys(result).length, 3);
});

Deno.test("normalizeTelemetry - TempC_DS used as fallback when TempC_SHT is absent", () => {
  const payload = { TempC_DS: 18.5, Hum_SHT: 55.0 };
  const result = normalizeTelemetry(payload);

  assertEquals(result.temperature, 18.5, "temperature should fall back to TempC_DS");
  assertEquals(result.humidity, 55.0);
});

Deno.test("normalizeTelemetry - TempC_SHT preferred over TempC_DS", () => {
  const payload = { TempC_SHT: 23.45, TempC_DS: 23.37 };
  const result = normalizeTelemetry(payload);

  assertEquals(result.temperature, 23.45, "TempC_SHT should be preferred over TempC_DS");
});

Deno.test("normalizeTelemetry - non-numeric alias values are ignored", () => {
  const payload = { TempC_SHT: "invalid", Hum_SHT: null, BatV: undefined };
  const result = normalizeTelemetry(payload);

  assertEquals(result.temperature, undefined, "non-numeric TempC_SHT should not map");
  assertEquals(result.humidity, undefined, "null Hum_SHT should not map");
  assertEquals(result.battery, undefined, "undefined BatV should not map");
});

Deno.test("normalizeTelemetry - does not mutate original object", () => {
  const original = { TempC_SHT: 23.5, Hum_SHT: 62.0 };
  const frozen = { ...original };
  normalizeTelemetry(original);

  assertEquals(original.TempC_SHT, frozen.TempC_SHT);
  assertEquals(original.Hum_SHT, frozen.Hum_SHT);
  assertEquals("temperature" in original, false, "original must not gain canonical key");
});

// ============================================================================
// BatV voltage-to-percent conversion
// ============================================================================

Deno.test("normalizeTelemetry - BatV converts to integer percentage", () => {
  // 3.0V = 0%, 3.3V = 50%, 3.6V = 100%
  assertEquals(normalizeTelemetry({ BatV: 3.0 }).battery, 0, "3.0V = 0%");
  assertEquals(normalizeTelemetry({ BatV: 3.3 }).battery, 50, "3.3V = 50%");
  assertEquals(normalizeTelemetry({ BatV: 3.6 }).battery, 100, "3.6V = 100%");
  assertEquals(normalizeTelemetry({ BatV: 3.058 }).battery, 10, "3.058V ≈ 10%");

  // Clamp out-of-range values
  assertEquals(normalizeTelemetry({ BatV: 2.5 }).battery, 0, "below 3.0V clamps to 0%");
  assertEquals(normalizeTelemetry({ BatV: 4.0 }).battery, 100, "above 3.6V clamps to 100%");
});

// ============================================================================
// Integration: Dragino payload through hasTemperatureData gate
// ============================================================================

Deno.test("integration - Dragino payload passes hasTemperatureData gate", () => {
  // Simulate the webhook's extraction logic after normalization
  const dragino = {
    BatV: 3.05,
    Bat_status: 0,
    Ext_sensor: "Temperature Sensor",
    Hum_SHT: 62.0,
    TempC_DS: 23.37,
    TempC_SHT: 23.45,
  };

  const decoded = normalizeTelemetry(dragino);

  // Replicate webhook extraction (index.ts lines 345-414)
  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;
  let temperature = decoded.temperature as number | undefined;
  if (temperature !== undefined) {
    const tempScale = (decoded.temperature_scale ?? 1) as number;
    if (tempScale !== 1) {
      temperature = temperature * tempScale;
    } else if (temperature > 0 && temperature < 10) {
      const scaledTemp = temperature * 10;
      if (scaledTemp >= 10 && scaledTemp <= 100) {
        temperature = scaledTemp;
      }
    }
  }

  const hasTemperatureData = temperature !== undefined;
  const normalizedDoorOpen = normalizeDoorData(decoded);
  const hasDoorData = normalizedDoorOpen !== undefined;

  // THE CRITICAL ASSERTION: Dragino payloads must NOT early-exit
  assertEquals(hasTemperatureData, true, "Dragino payload must have temperature data after normalization");
  assertEquals(temperature, 23.45, "temperature value should be 23.45°C from TempC_SHT");
  assertEquals(decoded.humidity, 62.0, "humidity should be mapped from Hum_SHT");
  // BatV 3.05 → 8% integer
  assertEquals(battery, 8, "battery should be converted from BatV to integer percent");
  assertEquals(hasDoorData, false, "Dragino HT65N has no door data");
});

Deno.test("integration - standard EM300-TH payload still works", () => {
  const em300 = { temperature: 22.1, humidity: 45.3, battery_level: 95 };
  const decoded = normalizeTelemetry(em300);

  const battery = (decoded.battery ?? decoded.battery_level) as number | undefined;
  const temperature = decoded.temperature as number | undefined;
  const hasTemperatureData = temperature !== undefined;

  assertEquals(hasTemperatureData, true);
  assertEquals(temperature, 22.1);
  assertEquals(decoded.humidity, 45.3);
  assertEquals(battery, 95);
});

Deno.test("integration - door sensor payload still works", () => {
  const lds02 = { door_status: "closed", battery_level: 90 };
  const decoded = normalizeTelemetry(lds02);

  const temperature = decoded.temperature as number | undefined;
  const hasTemperatureData = temperature !== undefined;
  const normalizedDoorOpen = normalizeDoorData(decoded);
  const hasDoorData = normalizedDoorOpen !== undefined;

  assertEquals(hasTemperatureData, false, "LDS02 has no temperature");
  assertEquals(hasDoorData, true, "LDS02 has door data");
  assertEquals(normalizedDoorOpen, false, "door_status closed -> false");
});

// ============================================================================
// Chemistry-aware voltage-to-percent conversion
// ============================================================================

Deno.test("convertVoltageToPercent - LiFeS2_AA pack curve (2×AA lithium)", () => {
  // Pack voltage range: 1.80V (0%) to 3.60V (100%)
  assertEquals(convertVoltageToPercent(3.60, "LiFeS2_AA"), 100, "3.60V = 100%");
  assertEquals(convertVoltageToPercent(3.20, "LiFeS2_AA"), 80, "3.20V = 80%");
  assertEquals(convertVoltageToPercent(2.80, "LiFeS2_AA"), 50, "2.80V = 50%");
  assertEquals(convertVoltageToPercent(2.40, "LiFeS2_AA"), 20, "2.40V = 20%");
  assertEquals(convertVoltageToPercent(1.80, "LiFeS2_AA"), 0, "1.80V = 0%");
  // Clamp
  assertEquals(convertVoltageToPercent(4.0, "LiFeS2_AA"), 100, "above max clamps to 100%");
  assertEquals(convertVoltageToPercent(1.5, "LiFeS2_AA"), 0, "below min clamps to 0%");
});

Deno.test("convertVoltageToPercent - LiFeS2_AA interpolation for BatV=3.05", () => {
  // 3.05V is between 2.80V (50%) and 3.20V (80%)
  // ratio = (3.05 - 2.80) / (3.20 - 2.80) = 0.625
  // percent = 50 + (30 * 0.625) = 68.75 → 69
  const result = convertVoltageToPercent(3.05, "LiFeS2_AA");
  assertEquals(result, 69, "3.05V LiFeS2_AA pack should be ~69%, not 3% from old formula");
});

Deno.test("convertVoltageToPercent - sensor catalog chemistry alias 'lithium'", () => {
  // 'lithium' should map to LiFeS2_AA curve
  assertEquals(convertVoltageToPercent(3.05, "lithium"), 69, "lithium alias matches LiFeS2_AA");
});

Deno.test("convertVoltageToPercent - Alkaline_AA pack curve (2×AAA alkaline)", () => {
  assertEquals(convertVoltageToPercent(3.20, "Alkaline_AA"), 100, "3.20V = 100%");
  assertEquals(convertVoltageToPercent(2.80, "Alkaline_AA"), 70, "2.80V = 70%");
  assertEquals(convertVoltageToPercent(2.40, "Alkaline_AA"), 40, "2.40V = 40%");
  assertEquals(convertVoltageToPercent(1.60, "Alkaline_AA"), 0, "1.60V = 0%");
});

Deno.test("convertVoltageToPercent - CR17450 single cell", () => {
  assertEquals(convertVoltageToPercent(3.00, "CR17450"), 100, "3.00V = 100%");
  assertEquals(convertVoltageToPercent(2.85, "CR17450"), 50, "2.85V = 50%");
  assertEquals(convertVoltageToPercent(2.50, "CR17450"), 0, "2.50V = 0%");
});

Deno.test("convertVoltageToPercent - CR2032 coin cell", () => {
  assertEquals(convertVoltageToPercent(3.00, "CR2032"), 100, "3.00V = 100%");
  assertEquals(convertVoltageToPercent(2.70, "CR2032"), 50, "2.70V = 50%");
  assertEquals(convertVoltageToPercent(2.20, "CR2032"), 0, "2.20V = 0%");
});

Deno.test("convertVoltageToPercent - default (no chemistry) uses LiFeS2_AA", () => {
  // No chemistry = default LiFeS2_AA pack curve
  assertEquals(convertVoltageToPercent(3.05), 69, "default curve gives same as LiFeS2_AA");
  assertEquals(convertVoltageToPercent(3.05, null), 69, "null chemistry = default");
  assertEquals(convertVoltageToPercent(3.05, undefined), 69, "undefined chemistry = default");
});

Deno.test("normalizeTelemetry - chemistry option uses correct curve", () => {
  // With LiFeS2_AA chemistry: BatV 3.05 → 69% (not 8% from legacy formula)
  const result = normalizeTelemetry({ BatV: 3.05 }, { chemistry: "LiFeS2_AA" });
  assertEquals(result.battery, 69, "LiFeS2_AA chemistry gives 69% for 3.05V");
  assertEquals(result.battery_voltage, 3.05, "raw voltage preserved in battery_voltage");
});

Deno.test("normalizeTelemetry - no chemistry uses legacy Dragino formula", () => {
  // Without chemistry: BatV 3.05 → 8% (legacy formula)
  const result = normalizeTelemetry({ BatV: 3.05 });
  assertEquals(result.battery, 8, "legacy formula gives 8% for 3.05V");
});
