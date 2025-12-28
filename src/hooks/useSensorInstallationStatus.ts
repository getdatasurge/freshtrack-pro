import { useMemo } from "react";

export type SensorInstallationStatus = 
  | "not_paired"
  | "paired_never_seen"
  | "previously_seen_offline"
  | "online";

export interface SensorInstallationInfo {
  status: SensorInstallationStatus;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}

export interface DeviceInfo {
  id: string;
  unit_id: string | null;
  last_seen_at: string | null;
  serial_number: string;
  battery_level: number | null;
  status: string;
}

// Threshold for considering a sensor "online" (in milliseconds)
const ONLINE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export function computeSensorInstallationStatus(
  device: DeviceInfo | null,
  lastReadingAt: string | null
): SensorInstallationInfo {
  // Case 1: No device linked to unit
  if (!device) {
    return {
      status: "not_paired",
      label: "Not Paired",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      description: "No sensor paired to this unit. Pair a sensor to enable automated monitoring.",
    };
  }

  // Case 2: Device exists but has never been seen
  if (!device.last_seen_at && !lastReadingAt) {
    return {
      status: "paired_never_seen",
      label: "Paired – Never Seen",
      color: "text-warning",
      bgColor: "bg-warning/10",
      description: "Sensor is paired but has never reported data. Check sensor placement and power.",
    };
  }

  // Use the most recent timestamp between device.last_seen_at and lastReadingAt
  const lastActivity = device.last_seen_at || lastReadingAt;
  if (!lastActivity) {
    return {
      status: "paired_never_seen",
      label: "Paired – Never Seen",
      color: "text-warning",
      bgColor: "bg-warning/10",
      description: "Sensor is paired but has never reported data. Check sensor placement and power.",
    };
  }

  const now = Date.now();
  const lastActivityTime = new Date(lastActivity).getTime();
  const timeSinceActivity = now - lastActivityTime;

  // Case 3: Device was previously seen but is now offline
  if (timeSinceActivity > ONLINE_THRESHOLD_MS) {
    return {
      status: "previously_seen_offline",
      label: "Offline",
      color: "text-warning",
      bgColor: "bg-warning/10",
      description: "Sensor was previously active but is not currently reporting. Check connectivity.",
    };
  }

  // Case 4: Device is online and sending data
  return {
    status: "online",
    label: "Online",
    color: "text-safe",
    bgColor: "bg-safe/10",
    description: "Sensor is actively reporting data.",
  };
}

export function useSensorInstallationStatus(
  device: DeviceInfo | null,
  lastReadingAt: string | null
): SensorInstallationInfo {
  return useMemo(() => {
    return computeSensorInstallationStatus(device, lastReadingAt);
  }, [device, lastReadingAt]);
}
