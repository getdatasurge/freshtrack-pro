/**
 * Device Readiness Widget
 * 
 * Displays sensor installation status and device health metrics.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { Badge } from "@/components/ui/badge";
import {
  Radio,
  Battery,
  Signal,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  DoorOpen,
  DoorClosed,
  Link as LinkIcon,
  Loader2,
  Timer,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { voltageToPercent } from "@/lib/devices/batteryProfiles";
import { formatMissedCheckinsMessage, formatUplinkInterval } from "@/lib/missedCheckins";
import { useSensorUplinkInterval } from "@/hooks/useSensorUplinkInterval";
import type { WidgetProps } from "../types";

export function DeviceReadinessWidget({ 
  unit,
  sensor,
  derivedStatus,
  loraSensors,
  device,
}: WidgetProps) {
  // Find the primary sensor from loraSensors array or use the passed sensor
  // Only consider temp/combo sensors as the primary — never door sensors
  const primarySensor = sensor || loraSensors?.find(s =>
    s.is_primary && s.sensor_type !== 'door' && s.sensor_type !== 'contact'
  ) || loraSensors?.find(s =>
    s.sensor_type === 'temperature' || s.sensor_type === 'temperature_humidity' || s.sensor_type === 'combo'
  ) || loraSensors?.[0];
  const loraSensor = primarySensor as any;
  
  // Extract door state from unit if available
  const doorState = unit?.door_state;
  const doorLastChangedAt = unit?.door_last_changed_at;
  
  const unitStatus = derivedStatus?.statusLabel ?? "Unknown";
  const lastReadingAt = derivedStatus?.lastReadingAt ?? null;
  const missedCheckins = derivedStatus?.missedCheckins ?? 0;
  const offlineSeverity = derivedStatus?.offlineSeverity ?? "none";

  // ⚠️ SINGLE SOURCE OF TRUTH for uplink interval ⚠️
  // Fetch from sensor_config.uplink_interval_s (the actual configured value)
  // NOT from units.checkin_interval_minutes (which may be stale/null)
  const { data: sensorUplinkInterval } = useSensorUplinkInterval(unit?.id ?? null);
  const uplinkIntervalMinutes = sensorUplinkInterval ?? unit?.checkin_interval_minutes ?? 5;

  // Determine if we have a LoRa sensor in pending/joining state
  const isLoraPending = loraSensor?.status === "pending";
  const isLoraJoining = loraSensor?.status === "joining";
  const hasLoraData = loraSensor && (loraSensor.status === "active" || loraSensor.status === "offline");

  // Use LoRa sensor data if available and active, otherwise fall back to device data
  const effectiveSignalStrength = hasLoraData ? loraSensor.signal_strength : (primarySensor?.signal_strength ?? device?.signal_strength);
  // CRITICAL: Use derivedStatus.lastSeenAt for consistency with missedCheckins calculation.
  // Both are computed from the same primaryLoraSensor in UnitDetail, ensuring they always match.
  const effectiveLastSeen = derivedStatus?.lastSeenAt || (hasLoraData ? loraSensor.last_seen_at : device?.last_seen_at);
  const deviceSerial = primarySensor?.dev_eui || device?.serial_number;

  // Check if voltage is available - determines "(Est.)" vs "(Reported)" label
  const effectiveVoltage = loraSensor?.battery_voltage_filtered ?? loraSensor?.battery_voltage ?? null;

  // Derive battery percentage from voltage + chemistry curves when voltage exists.
  // Falls back to stored battery_level (may be stale for readings before the fix).
  const storedBatteryLevel = hasLoraData ? loraSensor.battery_level : (primarySensor?.battery_level ?? device?.battery_level);
  const effectiveBatteryLevel = effectiveVoltage != null
    ? voltageToPercent(effectiveVoltage, loraSensor?.chemistry ?? "LiFeS2_AA")
    : storedBatteryLevel;

  // Compute installation status based on offline severity from alert rules
  const getSensorStatusFromSeverity = () => {
    if (isLoraPending) {
      return {
        status: "pending_registration",
        label: "Pending Registration",
        description: "Sensor created but not yet provisioned to TTN.",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      };
    }
    if (isLoraJoining) {
      return {
        status: "joining_network",
        label: "Joining Network",
        description: "Sensor is attempting to join the LoRaWAN network.",
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    }

    if (offlineSeverity === "critical") {
      const missedMessage = formatMissedCheckinsMessage(missedCheckins, uplinkIntervalMinutes);
      return {
        status: "offline_critical",
        label: "Offline (Critical)",
        description: missedMessage,
        color: "text-alarm",
        bgColor: "bg-alarm/10",
      };
    }
    if (offlineSeverity === "warning") {
      const missedMessage = formatMissedCheckinsMessage(missedCheckins, uplinkIntervalMinutes);
      return {
        status: "offline_warning",
        label: "Offline (Warning)",
        description: missedMessage,
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    }

    const hasSensorPaired = Boolean(loraSensor || device);
    if (!hasSensorPaired) {
      return {
        status: "not_paired",
        label: "Not Paired",
        description: "No sensor is paired to this unit.",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      };
    }

    const hasEverBeenSeen = Boolean(loraSensor?.last_seen_at || device?.last_seen_at || lastReadingAt);
    if (!hasEverBeenSeen) {
      return {
        status: "paired_never_seen",
        label: "Paired – Never Seen",
        description: "Sensor is paired but has never reported data.",
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    }

    return {
      status: "online",
      label: "Online",
      description: "Sensor is reporting normally.",
      color: "text-safe",
      bgColor: "bg-safe/10",
    };
  };

  const installationStatus = getSensorStatusFromSeverity();

  const getStatusIcon = () => {
    if (isLoraPending) return Radio;
    if (isLoraJoining) return Loader2;
    switch (installationStatus.status) {
      case "not_paired": return LinkIcon;
      case "paired_never_seen": return AlertTriangle;
      case "offline_warning":
      case "offline_critical": return XCircle;
      case "online": return CheckCircle;
      default: return XCircle;
    }
  };

  const StatusIcon = getStatusIcon();

  const getBatteryStatus = (level: number | null | undefined, hasVoltage: boolean) => {
    if (level === null || level === undefined) {
      return { label: "N/A", color: "text-muted-foreground", bg: "bg-muted", healthLabel: null };
    }
    // "(Est.)" when voltage exists (derived from voltage curve), "(Reported)" when just sensor-reported %
    const suffix = hasVoltage ? "(Est.)" : "(Reported)";
    const levelLabel = `${level}% ${suffix}`;
    
    if (level > 50) return { label: levelLabel, color: "text-safe", bg: "bg-safe/10", healthLabel: "OK" };
    if (level > 20) return { label: levelLabel, color: "text-warning", bg: "bg-warning/10", healthLabel: "Warning" };
    return { label: levelLabel, color: "text-alarm", bg: "bg-alarm/10", healthLabel: "Low" };
  };

  const getSignalStatus = (strength: number | null | undefined) => {
    if (strength === null || strength === undefined) return { label: "N/A", color: "text-muted-foreground" };
    if (strength > -60) return { label: "Excellent", color: "text-safe" };
    if (strength > -80) return { label: "Good", color: "text-safe" };
    if (strength > -90) return { label: "Fair", color: "text-warning" };
    return { label: "Weak", color: "text-alarm" };
  };

  const getDoorStatus = (state: string | null | undefined, changedAt: string | null | undefined) => {
    if (!state || state === "unknown") {
      return { label: "Unknown", color: "text-muted-foreground", icon: DoorClosed, since: null };
    }
    if (state === "open") {
      return { 
        label: "Open", color: "text-warning", icon: DoorOpen,
        since: changedAt ? formatDistanceToNow(new Date(changedAt), { addSuffix: false }) : null
      };
    }
    return { 
      label: "Closed", color: "text-safe", icon: DoorClosed,
      since: changedAt ? formatDistanceToNow(new Date(changedAt), { addSuffix: false }) : null
    };
  };

  const batteryStatus = getBatteryStatus(effectiveBatteryLevel, effectiveVoltage !== null);
  const signalStatus = getSignalStatus(effectiveSignalStrength);
  const doorStatus = getDoorStatus(doorState, doorLastChangedAt);
  const DoorIcon = doorStatus.icon;

  const formatHeartbeat = (fallback: string | null) => {
    const timestamp = effectiveLastSeen || device?.last_seen_at || fallback;
    if (!timestamp) return "Never";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 pb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Radio className="w-5 h-5 text-accent" />
          Device Readiness
        </h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Sensor Installation Status */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <StatusIcon className={`w-3 h-3 ${isLoraJoining ? "animate-spin" : ""}`} />
              Sensor Status
            </p>
            <Badge className={`${installationStatus.bgColor} ${installationStatus.color} border-0`}>
              {installationStatus.label}
            </Badge>
          </div>

          {/* Battery Level */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Battery className="w-3 h-3" />
              Battery Level
            </p>
            {effectiveBatteryLevel !== null && effectiveBatteryLevel !== undefined ? (
              <div className="flex flex-col gap-0.5">
                <Badge className={`${batteryStatus.bg} ${batteryStatus.color} border-0`}>
                  {batteryStatus.label}
                </Badge>
                {batteryStatus.healthLabel && (
                  <span className={`text-xs ${batteryStatus.color}`}>{batteryStatus.healthLabel}</span>
                )}
              </div>
            ) : (isLoraPending || isLoraJoining) ? (
              <span className="text-sm text-muted-foreground italic">Awaiting data</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">No sensor paired</span>
            )}
          </div>

          {/* Signal Strength */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Signal className="w-3 h-3" />
              Signal Strength
            </p>
            {effectiveSignalStrength !== null && effectiveSignalStrength !== undefined ? (
              <span className={`text-sm font-medium ${signalStatus.color}`}>
                {signalStatus.label} ({effectiveSignalStrength} dBm)
              </span>
            ) : (isLoraPending || isLoraJoining) ? (
              <span className="text-sm text-muted-foreground italic">Awaiting data</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">No sensor paired</span>
            )}
          </div>

          {/* Door State */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DoorIcon className="w-3 h-3" />
              Door State
            </p>
            <div>
              <span className={`text-sm font-medium ${doorStatus.color}`}>
                {doorStatus.label}
              </span>
              {doorStatus.since && doorState !== "unknown" && (
                <p className="text-xs text-muted-foreground">for {doorStatus.since}</p>
              )}
            </div>
          </div>

          {/* Last Heartbeat */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last Heartbeat
            </p>
            <span className="text-sm font-medium text-foreground">
              {formatHeartbeat(lastReadingAt)}
            </span>
          </div>

          {/* Uplink Interval */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="w-3 h-3" />
              Uplink Interval
            </p>
            <span className="text-sm font-medium text-foreground">
              {formatUplinkInterval(uplinkIntervalMinutes)}
            </span>
          </div>
        </div>

        {/* Device Serial (if available) */}
        {deviceSerial && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Device Serial: <span className="font-mono text-foreground">{deviceSerial}</span>
            </p>
          </div>
        )}

        {/* Installation status message */}
        {installationStatus.status !== "online" && (
          <div className={`mt-4 p-3 rounded-lg border border-dashed ${
            isLoraPending || isLoraJoining
              ? "bg-muted/50 border-accent/30"
              : installationStatus.status === "not_paired"
                ? "bg-muted/50 border-border"
                : "bg-warning/5 border-warning/30"
          }`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              {isLoraPending ? (
                <Radio className="w-4 h-4 text-accent" />
              ) : isLoraJoining ? (
                <Loader2 className="w-4 h-4 text-warning animate-spin" />
              ) : installationStatus.status === "not_paired" ? (
                <LinkIcon className="w-4 h-4" />
              ) : installationStatus.status === "paired_never_seen" ? (
                <AlertTriangle className="w-4 h-4 text-warning" />
              ) : (
                <XCircle className="w-4 h-4 text-warning" />
              )}
              <span className="text-sm">{installationStatus.description}</span>
            </div>

            {/* Debug: Show which timestamp is being used for offline calculation */}
            {process.env.NODE_ENV === 'development' && missedCheckins > 0 && (
              <div className="mt-2 pt-2 border-t border-dashed border-muted">
                <p className="text-xs text-muted-foreground font-mono">
                  Debug: Using {effectiveLastSeen ? 'sensor.last_seen_at' : lastReadingAt ? 'derivedStatus.lastReadingAt' : 'no timestamp'} for offline calc
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
