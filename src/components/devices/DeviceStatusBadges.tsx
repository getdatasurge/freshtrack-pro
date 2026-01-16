/**
 * DeviceStatusBadges Component
 * Collection of status badges for devices
 */

import {
  PlayCircle,
  PauseCircle,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  Radio,
  Battery,
  BatteryLow,
  BatteryWarning,
  Signal,
  SignalLow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Status Badge
// ============================================================================

interface StatusBadgeProps {
  status: string;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<string, { 
  label: string; 
  icon: typeof PlayCircle; 
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
}> = {
  active: { 
    label: "Active", 
    icon: PlayCircle, 
    variant: "default",
    className: "bg-green-500/10 text-green-600 border-green-500/30"
  },
  offline: { 
    label: "Offline", 
    icon: PauseCircle, 
    variant: "secondary",
    className: "bg-muted text-muted-foreground"
  },
  pending: { 
    label: "Pending", 
    icon: Clock, 
    variant: "outline",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
  },
  joining: { 
    label: "Joining", 
    icon: Radio, 
    variant: "outline",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse"
  },
  fault: { 
    label: "Fault", 
    icon: AlertTriangle, 
    variant: "destructive",
    className: "bg-red-500/10 text-red-600 border-red-500/30"
  },
};

export function StatusBadge({ status, className, showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.offline;
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={cn(config.className, "gap-1", className)}>
      <Icon className="w-3 h-3" />
      {showLabel && config.label}
    </Badge>
  );
}

// ============================================================================
// TTN Status Badge
// ============================================================================

interface TTNStatusBadgeProps {
  provisioningState: string;
  ttnDeviceId?: string | null;
  className?: string;
}

export function TTNStatusBadge({ provisioningState, ttnDeviceId, className }: TTNStatusBadgeProps) {
  const isProvisioned = provisioningState === "exists_in_ttn" && ttnDeviceId;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1",
            isProvisioned 
              ? "bg-green-500/10 text-green-600 border-green-500/30"
              : "bg-muted text-muted-foreground",
            className
          )}
        >
          {isProvisioned ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          TTN
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {isProvisioned 
          ? `Provisioned as ${ttnDeviceId}`
          : `State: ${provisioningState}`
        }
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Last Seen Badge
// ============================================================================

interface LastSeenBadgeProps {
  lastSeenAt?: string | null;
  className?: string;
}

export function LastSeenBadge({ lastSeenAt, className }: LastSeenBadgeProps) {
  if (!lastSeenAt) {
    return (
      <Badge variant="outline" className={cn("gap-1 text-muted-foreground", className)}>
        <Clock className="w-3 h-3" />
        Never
      </Badge>
    );
  }
  
  const date = new Date(lastSeenAt);
  const isRecent = Date.now() - date.getTime() < 15 * 60 * 1000; // 15 minutes
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1",
            isRecent ? "text-green-600" : "text-muted-foreground",
            className
          )}
        >
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(date, { addSuffix: true })}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {date.toLocaleString()}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Battery Badge
// ============================================================================

interface BatteryBadgeProps {
  level?: number | null;
  className?: string;
}

export function BatteryBadge({ level, className }: BatteryBadgeProps) {
  if (level === null || level === undefined) return null;
  
  const Icon = level <= 10 ? BatteryLow : level <= 25 ? BatteryWarning : Battery;
  const color = level <= 10 ? "text-red-500" : level <= 25 ? "text-yellow-500" : "text-green-500";
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("gap-1", className)}>
          <Icon className={cn("w-3 h-3", color)} />
          {level}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Battery Level</TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Signal Badge
// ============================================================================

interface SignalBadgeProps {
  strength?: number | null;
  className?: string;
}

export function SignalBadge({ strength, className }: SignalBadgeProps) {
  if (strength === null || strength === undefined) return null;
  
  const isWeak = strength < -100;
  const Icon = isWeak ? SignalLow : Signal;
  const color = isWeak ? "text-yellow-500" : "text-green-500";
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("gap-1", className)}>
          <Icon className={cn("w-3 h-3", color)} />
          {strength} dBm
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Signal Strength (RSSI)</TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Mismatch Warning Badge
// ============================================================================

interface MismatchBadgeProps {
  reason?: string;
  className?: string;
}

export function MismatchBadge({ reason, className }: MismatchBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
            className
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          Mismatch
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">Type Mismatch</p>
        <p className="text-xs text-muted-foreground">
          {reason ?? "Device type doesn't match expected category"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Combined Status Row
// ============================================================================

interface DeviceStatusRowProps {
  status: string;
  provisioningState: string;
  ttnDeviceId?: string | null;
  lastSeenAt?: string | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  hasMismatch?: boolean;
  mismatchReason?: string;
  className?: string;
}

export function DeviceStatusRow({
  status,
  provisioningState,
  ttnDeviceId,
  lastSeenAt,
  batteryLevel,
  signalStrength,
  hasMismatch,
  mismatchReason,
  className,
}: DeviceStatusRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <StatusBadge status={status} />
      <TTNStatusBadge provisioningState={provisioningState} ttnDeviceId={ttnDeviceId} />
      <LastSeenBadge lastSeenAt={lastSeenAt} />
      <BatteryBadge level={batteryLevel} />
      <SignalBadge strength={signalStrength} />
      {hasMismatch && <MismatchBadge reason={mismatchReason} />}
    </div>
  );
}
