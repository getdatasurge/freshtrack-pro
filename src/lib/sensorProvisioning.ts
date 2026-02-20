/**
 * Sensor Auto-Provisioning
 *
 * When a sensor is paired to a unit, automatically queue downlinks to set
 * the org/unit default operating parameters:
 *
 * - Reporting interval (set_tdc)
 * - Temperature alarm thresholds (set_temp_alarm_high, set_temp_alarm_low) for temp sensors
 * - Door alarm timeout (set_open_alarm) for door sensors
 * - Confirmed uplinks always on (set_confirmed_uplinks)
 *
 * This ensures sensors work out of the box without manual configuration.
 */

import { supabase } from "@/integrations/supabase/client";
import type { CatalogDownlinkCommand, SensorCatalogPublicEntry } from "@/types/sensorCatalog";
import { isExtendedCommand } from "@/types/sensorCatalog";
import { encodeDownlinkCommand, buildExpectedResult } from "@/lib/downlink/encoder";

interface UnitConfig {
  temp_limit_low: number | null;
  temp_limit_high: number | null;
  door_open_grace_minutes: number | null;
}

interface ProvisioningResult {
  queued: number;
  errors: string[];
}

/**
 * Queue initial configuration downlinks after a sensor is paired to a unit.
 * Silently skips if the sensor has no catalog entry or no supported commands.
 */
export async function queueInitialSensorConfig(
  sensorId: string,
  unitId: string,
  orgId: string,
): Promise<ProvisioningResult> {
  const result: ProvisioningResult = { queued: 0, errors: [] };

  // 1. Fetch the sensor to get its catalog entry
  const { data: sensor, error: sensorError } = await supabase
    .from("lora_sensors")
    .select("id, sensor_catalog_id, model, manufacturer")
    .eq("id", sensorId)
    .maybeSingle();

  if (sensorError || !sensor) {
    result.errors.push("Could not load sensor");
    return result;
  }

  // 2. Fetch the catalog entry (by ID or by model name)
  let catalogEntry: SensorCatalogPublicEntry | null = null;

  if (sensor.sensor_catalog_id) {
    const { data } = await supabase
      .from("sensor_catalog")
      .select(
        "id, manufacturer, model, model_variant, display_name, sensor_kind, " +
        "description, frequency_bands, supports_class, f_ports, decoded_fields, " +
        "uplink_info, battery_info, downlink_info, is_supported, tags, " +
        "decode_mode, temperature_unit"
      )
      .eq("id", sensor.sensor_catalog_id)
      .maybeSingle();
    catalogEntry = data as unknown as SensorCatalogPublicEntry | null;
  }

  if (!catalogEntry && sensor.model) {
    const { data } = await supabase
      .from("sensor_catalog")
      .select(
        "id, manufacturer, model, model_variant, display_name, sensor_kind, " +
        "description, frequency_bands, supports_class, f_ports, decoded_fields, " +
        "uplink_info, battery_info, downlink_info, is_supported, tags, " +
        "decode_mode, temperature_unit"
      )
      .ilike("model", sensor.model.trim())
      .limit(1)
      .maybeSingle();
    catalogEntry = data as unknown as SensorCatalogPublicEntry | null;
  }

  if (!catalogEntry?.downlink_info?.supports_remote_config) {
    return result; // Sensor doesn't support remote config — nothing to do
  }

  // 3. Fetch unit settings (alarm thresholds, door alarm, etc.)
  const { data: unit, error: unitError } = await supabase
    .from("units")
    .select("temp_limit_low, temp_limit_high, door_open_grace_minutes")
    .eq("id", unitId)
    .maybeSingle();

  if (unitError || !unit) {
    result.errors.push("Could not load unit settings");
    return result;
  }

  const unitConfig = unit as UnitConfig;
  const commands = (catalogEntry.downlink_info.commands ?? [])
    .filter(isExtendedCommand) as CatalogDownlinkCommand[];
  const configPort = catalogEntry.downlink_info.config_port;

  if (!configPort || commands.length === 0) {
    return result;
  }

  // Display temp unit for encoding (canonical storage is °F)
  const displayTempUnit: "fahrenheit" | "celsius" = "fahrenheit";

  // 4. Build initial downlinks based on available commands
  const downlinksToQueue: Array<{
    command: CatalogDownlinkCommand;
    values: Record<string, number | boolean | string>;
  }> = [];

  // Always enable confirmed uplinks
  const confirmedCmd = commands.find((c) => c.key === "set_confirmed_uplinks");
  if (confirmedCmd) {
    downlinksToQueue.push({
      command: confirmedCmd,
      values: { confirmed: true },
    });
  }

  // Set reporting interval (use catalog default or 10 min)
  const tdcCmd = commands.find((c) => c.key === "set_tdc");
  if (tdcCmd) {
    const defaultMinutes = tdcCmd.fields.find((f) => f.name === "minutes")?.default ?? 10;
    downlinksToQueue.push({
      command: tdcCmd,
      values: { minutes: defaultMinutes },
    });
  }

  // Temperature alarm high
  const highAlarmCmd = commands.find((c) => c.key === "set_temp_alarm_high");
  if (highAlarmCmd && unitConfig.temp_limit_high != null) {
    downlinksToQueue.push({
      command: highAlarmCmd,
      values: { temperature: unitConfig.temp_limit_high },
    });
  }

  // Temperature alarm low
  const lowAlarmCmd = commands.find((c) => c.key === "set_temp_alarm_low");
  if (lowAlarmCmd && unitConfig.temp_limit_low != null) {
    downlinksToQueue.push({
      command: lowAlarmCmd,
      values: { temperature: unitConfig.temp_limit_low },
    });
  }

  // Door-open alarm (TTRIG: A9 + enable + seconds)
  const openAlarmCmd = commands.find((c) => c.key === "set_open_alarm");
  if (openAlarmCmd && unitConfig.door_open_grace_minutes != null) {
    downlinksToQueue.push({
      command: openAlarmCmd,
      values: { enabled: true, minutes: unitConfig.door_open_grace_minutes },
    });
  }

  // 5. Queue each downlink via the edge function
  for (const { command, values } of downlinksToQueue) {
    try {
      const hex = encodeDownlinkCommand(command, values, displayTempUnit);
      const expectedResult = buildExpectedResult(command, values);

      const { data, error } = await supabase.functions.invoke(
        "ttn-send-downlink",
        {
          body: {
            sensor_id: sensorId,
            command_type: "catalog",
            command_params: {
              type: "catalog",
              hex,
              fport: configPort,
              commandKey: command.key,
              commandName: command.name,
              expectedResult,
              fieldValues: values,
            },
          },
        }
      );

      if (error || (data && !data.ok)) {
        result.errors.push(`${command.name}: ${error?.message || data?.error || "failed"}`);
      } else {
        result.queued++;
      }
    } catch (err) {
      result.errors.push(`${command.name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return result;
}
