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
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DeviceReadinessProps {
  unitStatus: string;
  lastReadingAt: string | null;
  // Placeholders for future device data
  batteryLevel?: number | null;
  signalStrength?: number | null;
  lastHeartbeat?: string | null;
  deviceSerial?: string | null;
}

const DeviceReadinessCard = ({
  unitStatus,
  lastReadingAt,
  batteryLevel,
  signalStrength,
  lastHeartbeat,
  deviceSerial,
}: DeviceReadinessProps) => {
  const getSensorStatus = () => {
    if (unitStatus === "offline" || !lastReadingAt) {
      return { status: "offline", label: "Offline", color: "text-muted-foreground", bg: "bg-muted", icon: XCircle };
    }
    if (unitStatus === "monitoring_interrupted") {
      return { status: "interrupted", label: "Interrupted", color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle };
    }
    return { status: "active", label: "Active", color: "text-safe", bg: "bg-safe/10", icon: CheckCircle };
  };

  const getBatteryStatus = (level: number | null | undefined) => {
    if (level === null || level === undefined) {
      return { label: "No sensor", color: "text-muted-foreground", bg: "bg-muted" };
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
      return { label: "No sensor", color: "text-muted-foreground" };
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

  const sensorStatus = getSensorStatus();
  const batteryStatus = getBatteryStatus(batteryLevel);
  const signalStatus = getSignalStatus(signalStrength);
  const StatusIcon = sensorStatus.icon;

  const formatHeartbeat = (heartbeat: string | null | undefined, fallback: string | null) => {
    const timestamp = heartbeat || fallback;
    if (!timestamp) return "Never";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Radio className="w-5 h-5 text-accent" />
          Device Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Sensor Status */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              Sensor Status
            </p>
            <Badge className={`${sensorStatus.bg} ${sensorStatus.color} border-0`}>
              {sensorStatus.label}
            </Badge>
          </div>

          {/* Battery Level */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Battery className="w-3 h-3" />
              Battery Level
            </p>
            {batteryLevel !== null && batteryLevel !== undefined ? (
              <Badge className={`${batteryStatus.bg} ${batteryStatus.color} border-0`}>
                {batteryStatus.label}
              </Badge>
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

        {/* No sensor paired notice */}
        {!lastReadingAt && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-dashed border-border">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4" />
              <span className="text-sm">No sensor paired to this unit. Pair a sensor to enable automated monitoring.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceReadinessCard;
