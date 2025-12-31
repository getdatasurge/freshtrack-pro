import { useMemo } from "react";
import { LoraSensor } from "@/types/ttn";

/**
 * Sensor Installation Status Hook
 * 
 * Determines the pairing and online status of a sensor based on:
 * 1. LoRa sensor state (preferred - new ownership model)
 * 2. Legacy device state (fallback for BLE sensors)
 * 
 * Online Threshold:
 * - A sensor is considered "online" if last_seen_at is within 5 minutes
 * - This matches the expected TTN uplink interval for most sensors
 */

export type SensorInstallationStatus = 
  | "not_paired"
  | "pending_registration"
  | "joining_network"
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
  signal_strength: number | null;
  status: string;
}

// Online threshold: 5 minutes for active monitoring
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Compute sensor installation status from LoRa sensor and/or legacy device
 * 
 * Priority:
 * 1. If loraSensor exists, use it to determine status
 * 2. Fall back to legacy device if no LoRa sensor
 * 3. Return "not_paired" if neither exists
 */
export function computeSensorInstallationStatus(
  device: DeviceInfo | null,
  lastReadingAt: string | null,
  loraSensor?: LoraSensor | null
): SensorInstallationInfo {
  // ========================================
  // PRIORITY 1: LoRa sensor (new ownership model)
  // ========================================
  if (loraSensor) {
    // Pending registration - device created but not yet provisioned to TTN
    if (loraSensor.status === 'pending') {
      return {
        status: "pending_registration",
        label: "Pending Registration",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        description: "Sensor is being registered with the network. This usually takes a few seconds.",
      };
    }

    // Joining network - device provisioned, waiting for first uplink
    if (loraSensor.status === 'joining') {
      return {
        status: "joining_network",
        label: "Joining Network",
        color: "text-warning",
        bgColor: "bg-warning/10",
        description: "Sensor is joining the LoRa network. Power cycle the sensor if this persists.",
      };
    }

    // Sensor has been seen before - check if online
    const lastActivity = loraSensor.last_seen_at || lastReadingAt;
    
    if (!lastActivity) {
      // Active status but never seen - shouldn't happen, but handle gracefully
      return {
        status: "paired_never_seen",
        label: "Paired – Never Seen",
        color: "text-warning",
        bgColor: "bg-warning/10",
        description: "Sensor is paired but has never reported data. Check sensor placement and power.",
      };
    }

    // Check if sensor is online (within threshold)
    const now = Date.now();
    const lastActivityTime = new Date(lastActivity).getTime();
    const timeSinceActivity = now - lastActivityTime;

    if (timeSinceActivity <= ONLINE_THRESHOLD_MS) {
      return {
        status: "online",
        label: "Online",
        color: "text-safe",
        bgColor: "bg-safe/10",
        description: "Sensor is actively reporting data.",
      };
    }

    // Sensor was online but is now offline
    return {
      status: "previously_seen_offline",
      label: "Offline",
      color: "text-warning",
      bgColor: "bg-warning/10",
      description: "Sensor was previously active but is not currently reporting. Check connectivity.",
    };
  }

  // ========================================
  // PRIORITY 2: Legacy device (BLE sensors)
  // ========================================
  if (device) {
    // Device exists but has never been seen
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

    // Device is online
    if (timeSinceActivity <= ONLINE_THRESHOLD_MS) {
      return {
        status: "online",
        label: "Online",
        color: "text-safe",
        bgColor: "bg-safe/10",
        description: "Sensor is actively reporting data.",
      };
    }

    // Device was previously seen but is now offline
    return {
      status: "previously_seen_offline",
      label: "Offline",
      color: "text-warning",
      bgColor: "bg-warning/10",
      description: "Sensor was previously active but is not currently reporting. Check connectivity.",
    };
  }

  // ========================================
  // PRIORITY 3: No sensor linked
  // ========================================
  return {
    status: "not_paired",
    label: "Not Paired",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    description: "No sensor paired to this unit. Pair a sensor to enable automated monitoring.",
  };
}

/**
 * React hook wrapper for computeSensorInstallationStatus
 */
export function useSensorInstallationStatus(
  device: DeviceInfo | null,
  lastReadingAt: string | null,
  loraSensor?: LoraSensor | null
): SensorInstallationInfo {
  return useMemo(() => {
    return computeSensorInstallationStatus(device, lastReadingAt, loraSensor);
  }, [device, lastReadingAt, loraSensor]);
}
