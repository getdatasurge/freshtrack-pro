/**
 * LHT65N Uplink Payload Parser
 *
 * Extracts device configuration values from decoded uplink payloads.
 * Used by the ttn-webhook handler to confirm pending downlink changes.
 *
 * LHT65N uplink payload fields (TTN decoded_payload):
 *  - Ext: external sensor mode (1 = E3, 9 = E3 + timestamp)
 *  - TempC_SHT / temperature: internal temperature
 *  - TempC_DS / Ext_sensor: external probe temperature
 *  - Hum_SHT / humidity: relative humidity
 *  - BatV / battery: battery voltage or percentage
 *  - ALARM_status / alarm: alarm flag
 *  - Systimestamp: device unix timestamp (only when Ext=9)
 *
 * The LHT65N does NOT report its uplink interval in the uplink payload.
 * Interval confirmation is done heuristically by measuring time between
 * consecutive uplinks (handled by the webhook, not this parser).
 */

/**
 * Parsed device state from an uplink payload.
 * All fields are optional because not every uplink contains every field.
 */
export interface ParsedUplinkState {
  /** External sensor mode: 1 (E3 temp) or 9 (E3 + timestamp) */
  ext_mode: number | null;
  /** Internal temperature (°C) */
  temperature: number | null;
  /** External probe temperature (°C) */
  ext_temperature: number | null;
  /** Humidity (%) */
  humidity: number | null;
  /** Battery voltage (V) or percentage (0-100) */
  battery: number | null;
  /** Device alarm status flag */
  alarm_active: boolean | null;
  /** Device unix timestamp (only in ext=9 mode) */
  device_timestamp: number | null;
  /** Whether the payload has enough data to attempt change confirmation */
  has_meaningful_data: boolean;
}

/**
 * Parse an LHT65N decoded_payload into a normalized device state object.
 *
 * This handles both TTN-decoded payloads (with vendor-specific keys) and
 * already-normalized payloads (after normalizeTelemetry runs).
 */
export function parseLHT65NUplink(
  decoded: Record<string, unknown>
): ParsedUplinkState {
  const state: ParsedUplinkState = {
    ext_mode: null,
    temperature: null,
    ext_temperature: null,
    humidity: null,
    battery: null,
    alarm_active: null,
    device_timestamp: null,
    has_meaningful_data: false,
  };

  if (!decoded || typeof decoded !== "object") return state;

  // External sensor mode
  const ext = decoded.Ext ?? decoded.ext ?? decoded.ext_mode;
  if (ext !== undefined && ext !== null) {
    state.ext_mode = Number(ext);
  }

  // Internal temperature (multiple possible keys)
  const temp =
    decoded.TempC_SHT ??
    decoded.temperature ??
    decoded.temp ??
    decoded.Temperature;
  if (temp !== undefined && temp !== null && !isNaN(Number(temp))) {
    const t = Number(temp);
    // Reject the 327.67 probe error value
    if (t !== 327.67 && t > -100 && t < 200) {
      state.temperature = t;
    }
  }

  // External probe temperature
  const extTemp =
    decoded.TempC_DS ??
    decoded.Ext_sensor ??
    decoded.ext_temperature ??
    decoded.external_temperature;
  if (extTemp !== undefined && extTemp !== null && !isNaN(Number(extTemp))) {
    const t = Number(extTemp);
    if (t !== 327.67 && t > -100 && t < 200) {
      state.ext_temperature = t;
    }
  }

  // Humidity
  const hum = decoded.Hum_SHT ?? decoded.humidity ?? decoded.Humidity;
  if (hum !== undefined && hum !== null && !isNaN(Number(hum))) {
    state.humidity = Number(hum);
  }

  // Battery
  const bat =
    decoded.BatV ?? decoded.battery ?? decoded.battery_level ?? decoded.Battery;
  if (bat !== undefined && bat !== null && !isNaN(Number(bat))) {
    state.battery = Number(bat);
  }

  // Alarm status
  const alarm =
    decoded.ALARM_status ??
    decoded.alarm ??
    decoded.alarm_status ??
    decoded.Alarm;
  if (alarm !== undefined && alarm !== null) {
    state.alarm_active =
      alarm === true || alarm === 1 || alarm === "true" || alarm === "ALARM";
  }

  // Device timestamp (ext=9 mode)
  const ts =
    decoded.Systimestamp ?? decoded.systimestamp ?? decoded.device_timestamp;
  if (ts !== undefined && ts !== null && !isNaN(Number(ts))) {
    state.device_timestamp = Number(ts);
  }

  // If we got any useful field, mark as meaningful
  state.has_meaningful_data =
    state.temperature !== null ||
    state.ext_mode !== null ||
    state.alarm_active !== null ||
    state.ext_temperature !== null;

  return state;
}

/**
 * Given a pending change and the parsed uplink state, determine whether
 * the uplink confirms the change was applied.
 *
 * Returns:
 *  - 'confirmed' if the uplink data matches the expected change
 *  - 'inconclusive' if the uplink doesn't contain enough data to confirm
 *  - 'mismatch' if the uplink contradicts the expected change
 *
 * Note: Some change types (set_time, clear_datalog, pnackmd, time_sync)
 * cannot be confirmed from uplink data. For these, we auto-confirm on
 * first uplink after the downlink was sent.
 */
export function matchChangeToUplink(
  changeType: string,
  commandParams: Record<string, unknown> | null,
  uplinkState: ParsedUplinkState
): "confirmed" | "inconclusive" | "mismatch" {
  if (!commandParams) return "inconclusive";

  switch (changeType) {
    case "ext_mode": {
      if (uplinkState.ext_mode === null) return "inconclusive";
      const expectedMode = commandParams.mode as string;
      const expectedExt = expectedMode === "e3_ext1" ? 1 : expectedMode === "e3_ext9" ? 9 : null;
      if (expectedExt === null) return "inconclusive";
      return uplinkState.ext_mode === expectedExt ? "confirmed" : "mismatch";
    }

    case "alarm": {
      // If we see alarm_active field, we can partially confirm
      if (uplinkState.alarm_active === null) return "inconclusive";
      const expectedEnabled = commandParams.enable as boolean;
      return uplinkState.alarm_active === expectedEnabled
        ? "confirmed"
        : "mismatch";
    }

    // These change types can't be directly verified from uplink payload.
    // Auto-confirm on first uplink after sent (the device received the
    // downlink since it sent an uplink).
    case "uplink_interval":
    case "set_time":
    case "time_sync":
    case "clear_datalog":
    case "pnackmd":
    case "raw":
      return "confirmed";

    default:
      return "inconclusive";
  }
}
