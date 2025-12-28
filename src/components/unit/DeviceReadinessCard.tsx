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
  Link as LinkIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { 
  computeSensorInstallationStatus, 
  DeviceInfo 
} from "@/hooks/useSensorInstallationStatus";

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
}: DeviceReadinessProps) => {
  // Use the unified sensor installation status
  const installationStatus = computeSensorInstallationStatus(device || null, lastReadingAt);

  const getStatusIcon = () => {
    switch (installationStatus.status) {
      case "not_paired":
        return LinkIcon;
      case "paired_never_seen":
        return AlertTriangle;
      case "previously_seen_offline":
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

  const batteryStatus = getBatteryStatus(batteryLevel ?? device?.battery_level);
  const signalStatus = getSignalStatus(signalStrength);
  const doorStatus = getDoorStatus(doorState, doorLastChangedAt);
  const DoorIcon = doorStatus.icon;

  const formatHeartbeat = (heartbeat: string | null | undefined, fallback: string | null) => {
    const timestamp = heartbeat || device?.last_seen_at || fallback;
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
              <StatusIcon className="w-3 h-3" />
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
            {batteryLevel !== null && batteryLevel !== undefined ? (
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
            {signalStrength !== null && signalStrength !== undefined ? (
              <span className={`text-sm font-medium ${signalStatus.color}`}>
                {signalStatus.label} ({signalStrength} dBm)
              </span>
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
            installationStatus.status === "not_paired" 
              ? "bg-muted/50 border-border" 
              : "bg-warning/5 border-warning/30"
          }`}>
            <div className="flex items-center gap-2 text-muted-foreground">
              {installationStatus.status === "not_paired" ? (
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
