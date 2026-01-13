/**
 * Device Readiness Widget
 * 
 * Wrapper for DeviceReadinessCard component with dashboard widget props.
 */

import DeviceReadinessCard from "@/components/unit/DeviceReadinessCard";
import type { WidgetProps } from "../types";

export function DeviceReadinessWidget({ 
  unit,
  sensor,
  derivedStatus,
  loraSensors,
  device,
}: WidgetProps) {
  // Find the primary sensor from loraSensors array or use the passed sensor
  const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
  
  // Extract door state from unit if available
  const doorState = unit?.door_state;
  const doorLastChangedAt = unit?.door_last_changed_at;

  return (
    <DeviceReadinessCard
      unitStatus={derivedStatus?.statusLabel ?? "Unknown"}
      lastReadingAt={derivedStatus?.lastReadingAt ?? null}
      device={device ? {
        id: device.id,
        unit_id: device.unit_id,
        last_seen_at: device.last_seen_at,
        serial_number: device.serial_number,
        battery_level: device.battery_level,
        signal_strength: device.signal_strength,
        status: device.status as any,
      } : undefined}
      batteryLevel={primarySensor?.battery_level ?? device?.battery_level}
      signalStrength={primarySensor?.signal_strength ?? device?.signal_strength}
      lastHeartbeat={derivedStatus?.lastSeenAt}
      deviceSerial={primarySensor?.dev_eui || device?.serial_number}
      doorState={doorState}
      doorLastChangedAt={doorLastChangedAt}
      loraSensor={primarySensor as any}
      missedCheckins={derivedStatus?.missedCheckins ?? 0}
      offlineSeverity={derivedStatus?.offlineSeverity ?? "none"}
      lastCheckinAt={derivedStatus?.lastSeenAt}
    />
  );
}
