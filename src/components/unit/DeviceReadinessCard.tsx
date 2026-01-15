import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
// Only import types - status is computed from parent's offlineSeverity
import { DeviceInfo } from "@/hooks/useSensorInstallationStatus";
import { LoraSensor } from "@/types/ttn";

interface DeviceReadinessProps {
  unitStatus: string;
  lastReadingAt: string | null;
  // Device data for installation status
  device?: DeviceInfo | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  lastHeartbeat?: string | null;
  deviceSerial?: string | null;
  // Door state
  doorState?: "open" | "closed" | "unknown" | null;
  doorLastChangedAt?: string | null;
  // Battery forecast
  batteryEstimatedDays?: number | null;
  // Missed check-ins tracking
  missedCheckins?: number;
  lastCheckinAt?: string | null;
  offlineSeverity?: "none" | "warning" | "critical";
  // LoRa sensor data (if available)
  loraSensor?: LoraSensor | null;
}

const DeviceReadinessCard = ({
  unitStatus,
  lastReadingAt,
  device,
  batteryLevel,
  signalStrength,
  lastHeartbeat,
  deviceSerial,
  doorState,
  doorLastChangedAt,
  batteryEstimatedDays,
  missedCheckins = 0,
  lastCheckinAt,
  offlineSeverity = "none",
  loraSensor,
}: DeviceReadinessProps) => {
  // Determine if we have a LoRa sensor in pending/joining state
  const isLoraPending = loraSensor?.status === "pending";
  const isLoraJoining = loraSensor?.status === "joining";
  const hasLoraData = loraSensor && (loraSensor.status === "active" || loraSensor.status === "offline");

  // Use LoRa sensor data if available and active, otherwise fall back to device data
  const effectiveBatteryLevel = hasLoraData ? loraSensor.battery_level : (batteryLevel ?? device?.battery_level);
  const effectiveSignalStrength = hasLoraData ? loraSensor.signal_strength : signalStrength;
  const effectiveLastSeen = hasLoraData ? loraSensor.last_seen_at : (lastHeartbeat || device?.last_seen_at);

  // Compute installation status based on offline severity from alert rules (not hardcoded threshold)
  // This respects user-configured "Sensor Offline Thresholds"
  const getSensorStatusFromSeverity = (): {
    status: string;
    label: string;
    description: string;
    color: string;
    bgColor: string;
  } => {
    // Handle LoRa pending/joining states first
    if (isLoraPending) {
      return {
        status: "pending_registration",
        label: "Pending Registration",
        description: "Sensor created but not yet provisioned to TTN. Configure TTN connection in Settings → Developer.",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      };
    }
    if (isLoraJoining) {
      return {
        status: "joining_network",
        label: "Joining Network",
        description: loraSensor?.ttn_device_id 
          ? "Sensor is provisioned and attempting to join the LoRaWAN network. Ensure a gateway is online nearby."
          : "Sensor is awaiting TTN device registration. Check TTN configuration.",
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    }

    // Use offlineSeverity from computed status (respects alert rules thresholds)
    if (offlineSeverity === "critical") {
      return {
        status: "offline_critical",
        label: "Offline (Critical)",
        description: `Sensor has missed ${missedCheckins} check-ins. Immediate attention required.`,
        color: "text-alarm",
        bgColor: "bg-alarm/10",
      };
    }
    if (offlineSeverity === "warning") {
      return {
        status: "offline_warning",
        label: "Offline (Warning)",
        description: `Sensor has missed ${missedCheckins} check-ins. Check device connectivity.`,
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    }

    // Check if we have a sensor paired (simple check without threshold logic)
    const hasSensorPaired = Boolean(loraSensor || device);
    if (!hasSensorPaired) {
      return {
        status: "not_paired",
        label: "Not Paired",
        description: "No sensor is paired to this unit. Go to Settings to add a sensor.",
        color: "text-muted-foreground",
        bgColor: "bg-muted",
      };
    }

    // Check if paired but never seen
    const hasEverBeenSeen = Boolean(
      loraSensor?.last_seen_at || 
      device?.last_seen_at || 
      lastReadingAt
    );
    if (!hasEverBeenSeen) {
      return {
        status: "paired_never_seen",
        label: "Paired – Never Seen",
        description: "Sensor is paired but has never reported data. Check device power and connectivity.",
        color: "text-warning",
        bgColor: "bg-warning/10",
      };
    }

    // Online - sensor is reporting within configured thresholds (offlineSeverity === "none")
    return {
      status: "online",
      label: "Online",
      description: "Sensor is reporting normally within configured thresholds.",
      color: "text-safe",
      bgColor: "bg-safe/10",
    };
  };

  const installationStatus = getSensorStatusFromSeverity();

  const getStatusIcon = () => {
    if (isLoraPending) return Radio;
    if (isLoraJoining) return Loader2;
    switch (installationStatus.status) {
      case "not_paired":
        return LinkIcon;
      case "paired_never_seen":
        return AlertTriangle;
      case "previously_seen_offline":
      case "offline_warning":
      case "offline_critical":
        return XCircle;
      case "online":
        return CheckCircle;
      default:
        return XCircle;
    }
  };

  const StatusIcon = getStatusIcon();

  const getBatteryStatus = (level: number | null | undefined) => {
    if (level === null || level === undefined) {
      return { label: "N/A", color: "text-muted-foreground", bg: "bg-muted" };
    }
    if (level > 50) {
      return { label: `${level}%`, color: "text-safe", bg: "bg-safe/10" };
    }
    if (level > 20) {
      return { label: `${level}%`, color: "text-warning", bg: "bg-warning/10" };
    }
    return { label: `${level}%`, color: "text-alarm", bg: "bg-alarm/10" };
  };

  const getSignalStatus = (strength: number | null | undefined) => {
    if (strength === null || strength === undefined) {
      return { label: "N/A", color: "text-muted-foreground" };
    }
    if (strength > -60) {
      return { label: "Excellent", color: "text-safe" };
    }
    if (strength > -80) {
      return { label: "Good", color: "text-safe" };
    }
    if (strength > -90) {
      return { label: "Fair", color: "text-warning" };
    }
    return { label: "Weak", color: "text-alarm" };
  };

  const getDoorStatus = (state: string | null | undefined, changedAt: string | null | undefined) => {
    if (!state || state === "unknown") {
      return { label: "Unknown", color: "text-muted-foreground", icon: DoorClosed, since: null };
    }
    if (state === "open") {
      return { 
        label: "Open", 
        color: "text-warning", 
        icon: DoorOpen,
        since: changedAt ? formatDistanceToNow(new Date(changedAt), { addSuffix: false }) : null
      };
    }
    return { 
      label: "Closed", 
      color: "text-safe", 
      icon: DoorClosed,
      since: changedAt ? formatDistanceToNow(new Date(changedAt), { addSuffix: false }) : null
    };
  };

  const batteryStatus = getBatteryStatus(effectiveBatteryLevel);
  const signalStatus = getSignalStatus(effectiveSignalStrength);
  const doorStatus = getDoorStatus(doorState, doorLastChangedAt);
  const DoorIcon = doorStatus.icon;

  const formatHeartbeat = (heartbeat: string | null | undefined, fallback: string | null) => {
    const timestamp = effectiveLastSeen || heartbeat || device?.last_seen_at || fallback;
    if (!timestamp) return "Never";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const formatEstimatedDays = (days: number | null | undefined) => {
    if (days === null || days === undefined) return null;
    if (days <= 7) return { text: `~${days}d remaining`, color: "text-alarm" };
    if (days <= 30) return { text: `~${days}d remaining`, color: "text-warning" };
    return { text: `~${days}d remaining`, color: "text-muted-foreground" };
  };

  const estimatedDaysDisplay = formatEstimatedDays(batteryEstimatedDays);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Radio className="w-5 h-5 text-accent" />
          Device Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
              <div>
                <Badge className={`${batteryStatus.bg} ${batteryStatus.color} border-0`}>
                  {batteryStatus.label}
                </Badge>
                {estimatedDaysDisplay && (
                  <p className={`text-xs mt-1 ${estimatedDaysDisplay.color}`}>
                    {estimatedDaysDisplay.text}
                  </p>
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
                <p className="text-xs text-muted-foreground">
                  for {doorStatus.since}
                </p>
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
              {formatHeartbeat(lastHeartbeat, lastReadingAt)}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceReadinessCard;
