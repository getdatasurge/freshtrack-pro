/**
 * Battery Health Widget
 * 
 * Production-grade battery life estimation for LoRaWAN sensors.
 * Uses voltage as source of truth with chemistry-specific curves.
 * 
 * States:
 * - NOT_CONFIGURED: No sensor assigned
 * - MISSING_PROFILE: Sensor model has no battery spec
 * - COLLECTING_DATA: < 12 uplinks OR < 6h span
 * - SENSOR_OFFLINE: No uplink in 3× expected interval
 * - ESTIMATE_LOW_CONFIDENCE: 12–50 uplinks, 6–24h span
 * - ESTIMATE_HIGH_CONFIDENCE: ≥ 50 uplinks, ≥ 48h span
 * - CRITICAL_BATTERY: SOC ≤ 10% or health state CRITICAL/REPLACE_ASAP
 */

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  AlertTriangle,
  CheckCircle,
  Clock,
  WifiOff,
  HelpCircle,
  Loader2,
  TrendingDown,
  Minus,
  Thermometer,
  DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { WidgetProps } from "../types";
import { useBatteryEstimate } from "@/hooks/useBatteryEstimate";
import {
  formatEstimate,
  formatDailyConsumption,
  formatVoltage,
  formatVoltageSlope,
  getStateMessage,
  getHealthStateInfo,
  MIN_UPLINKS_FOR_ESTIMATE,
  MIN_HOURS_FOR_ESTIMATE,
} from "@/lib/devices/batteryProfiles";

export function BatteryHealthWidget({
  sensor,
  loraSensors,
  device,
}: WidgetProps) {
  // Identify primary (temp/combo) and door sensors
  const primarySensor = useMemo(() => {
    return sensor || loraSensors?.find(s =>
      s.is_primary && s.sensor_type !== 'door' && s.sensor_type !== 'contact'
    ) || loraSensors?.find(s =>
      s.sensor_type === 'temperature' || s.sensor_type === 'temperature_humidity' || s.sensor_type === 'combo'
    ) || loraSensors?.[0] || null;
  }, [sensor?.id, loraSensors]);

  const doorSensor = useMemo(() => {
    return loraSensors?.find(s => s.sensor_type === 'door' || s.sensor_type === 'contact') || null;
  }, [loraSensors]);

  const hasBothSensors = !!primarySensor && !!doorSensor;

  const [selectedSensorKind, setSelectedSensorKind] = useState<'temp' | 'door'>('temp');

  // Memoize sensorId based on toggle selection
  const sensorId = useMemo(() => {
    const selected = selectedSensorKind === 'door' && doorSensor ? doorSensor : primarySensor;
    return selected?.id || device?.id || null;
  }, [selectedSensorKind, primarySensor?.id, doorSensor?.id, device?.id]);

  // Get battery estimate - sensorId only, hook fetches all data from DB
  // This ensures fetches only happen on page load, not on realtime re-renders
  const estimate = useBatteryEstimate(sensorId);

  // Battery icon based on level
  const BatteryIcon = useMemo(() => {
    if (estimate.currentSoc === null) return Battery;
    if (estimate.currentSoc <= 10) return BatteryLow;
    if (estimate.currentSoc <= 50) return BatteryMedium;
    return BatteryFull;
  }, [estimate.currentSoc]);

  // Battery color based on level and state
  const batteryColor = useMemo(() => {
    if (estimate.state === "CRITICAL_BATTERY") return "text-alarm";
    if (estimate.currentSoc === null) return "text-muted-foreground";
    if (estimate.currentSoc <= 20) return "text-alarm";
    if (estimate.currentSoc <= 50) return "text-warning";
    return "text-safe";
  }, [estimate.state, estimate.currentSoc]);

  // Progress bar color
  const progressColor = useMemo(() => {
    if (estimate.state === "CRITICAL_BATTERY") return "bg-alarm";
    if (estimate.currentSoc === null) return "bg-muted";
    if (estimate.currentSoc <= 20) return "bg-alarm";
    if (estimate.currentSoc <= 50) return "bg-warning";
    return "bg-safe";
  }, [estimate.state, estimate.currentSoc]);

  // Confidence badge styling
  const confidenceBadge = useMemo(() => {
    switch (estimate.confidence) {
      case "high":
        return {
          variant: "outline" as const,
          className: "bg-safe/10 text-safe border-safe/20",
          icon: CheckCircle,
          label: "High confidence",
        };
      case "low":
        return {
          variant: "outline" as const,
          className: "bg-warning/10 text-warning border-warning/20",
          icon: HelpCircle,
          label: "Low confidence",
        };
      default:
        return null;
    }
  }, [estimate.confidence]);

  // Sensor toggle (only rendered when both temp and door sensors exist)
  const sensorToggle = hasBothSensors ? (
    <div className="flex gap-1">
      <button
        onClick={() => setSelectedSensorKind('temp')}
        className={cn(
          "p-1.5 rounded transition-colors",
          selectedSensorKind === 'temp' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
        )}
        title="Temperature sensor"
      >
        <Thermometer className="h-4 w-4" />
      </button>
      <button
        onClick={() => setSelectedSensorKind('door')}
        className={cn(
          "p-1.5 rounded transition-colors",
          selectedSensorKind === 'door' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
        )}
        title="Door sensor"
      >
        <DoorOpen className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  // Render loading state
  if (estimate.loading) {
    return (
      <div className="h-full flex flex-col">
        <WidgetHeader toggle={sensorToggle} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Render non-estimate states
  if (["NOT_CONFIGURED", "MISSING_PROFILE", "NO_BATTERY_DATA", "COLLECTING_DATA", "SENSOR_OFFLINE"].includes(estimate.state)) {
    return (
      <div className="h-full flex flex-col">
        <WidgetHeader toggle={sensorToggle} />
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <StateDisplay state={estimate.state} estimate={estimate} />
        </div>
      </div>
    );
  }

  // Render critical battery state
  if (estimate.state === "CRITICAL_BATTERY") {
    return (
      <div className="h-full flex flex-col">
        <WidgetHeader
          toggle={sensorToggle}
          badge={
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              CRITICAL
            </Badge>
          }
        />
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {/* Critical Alert Banner */}
            <div className="p-3 rounded-lg bg-alarm/10 border border-alarm/20">
              <div className="flex items-center gap-2 text-alarm">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Replace Battery Now</span>
              </div>
              <p className="text-sm text-alarm/80 mt-1">
                Battery level at {estimate.currentSoc}%
              </p>
            </div>

            {/* Estimate if available */}
            {estimate.estimatedDaysRemaining !== null && estimate.estimatedDaysRemaining > 0 && (
              <div className="text-sm text-muted-foreground">
                Estimated ~{estimate.estimatedDaysRemaining} day{estimate.estimatedDaysRemaining === 1 ? "" : "s"} remaining
              </div>
            )}

            {/* Profile info */}
            {estimate.batteryProfile && (
              <ProfileInfo 
                profile={estimate.batteryProfile}
                profileSource={estimate.profileSource}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get health state styling
  const healthStateInfo = getHealthStateInfo(estimate.healthState);

  // Render estimate states (LOW/HIGH confidence)
  return (
    <div className="h-full flex flex-col">
      <WidgetHeader
        toggle={sensorToggle}
        badge={confidenceBadge && (
          <Badge
            variant={confidenceBadge.variant}
            className={confidenceBadge.className}
          >
            <confidenceBadge.icon className="w-3 h-3 mr-1" />
            {confidenceBadge.label}
          </Badge>
        )}
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        <div className="space-y-4">
          {/* Voltage & Percentage Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${batteryColor}`}>
                <BatteryIcon className="w-5 h-5" />
              </div>
              <div>
                {estimate.filteredVoltage !== null ? (
                  <>
                    <p className={`text-2xl font-bold ${batteryColor}`}>
                      {formatVoltage(estimate.filteredVoltage)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ≈ {estimate.currentSoc !== null ? `${estimate.currentSoc}%` : "—"} (Est.)
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-2xl font-bold ${batteryColor}`}>
                      {estimate.currentSoc !== null ? `${estimate.currentSoc}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Current Level (Est.)</p>
                  </>
                )}
              </div>
            </div>

            <div className="text-right">
              <Badge 
                variant="outline" 
                className={`${healthStateInfo.bgColor} ${healthStateInfo.color} border-0`}
              >
                {healthStateInfo.label}
              </Badge>
              <p className="text-sm font-medium mt-1">
                {formatEstimate(estimate.estimatedDaysRemaining, estimate.confidence)}
              </p>
              <p className="text-xs text-muted-foreground">Est. Remaining</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <Progress 
              value={estimate.currentSoc ?? 0} 
              className="h-2"
              // @ts-expect-error custom prop for indicator color
              indicatorClassName={progressColor}
            />
          </div>

          {/* Voltage Trend */}
          {estimate.voltageSlope !== null && (
            <div className="flex items-center gap-2 text-sm">
              {estimate.voltageSlope < -0.001 ? (
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Minus className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">Trend:</span>
              <span className="font-medium">{formatVoltageSlope(estimate.voltageSlope)}</span>
            </div>
          )}

          {/* Details Section */}
          <div className="pt-2 border-t border-border space-y-2">
            {/* Replace By Date */}
            {estimate.estimatedReplacementDate && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Replace by</span>
                <span className="font-medium">
                  {format(estimate.estimatedReplacementDate, "MMM yyyy")}
                </span>
              </div>
            )}

            {/* Daily Usage */}
            {estimate.dailyConsumptionMah && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Daily usage</span>
                <span className="font-medium">
                  {formatDailyConsumption(estimate.dailyConsumptionMah)}
                </span>
              </div>
            )}

            {/* Uplink Interval */}
            {(estimate.configuredIntervalSeconds || estimate.inferredIntervalSeconds) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uplink interval</span>
                <span className="font-medium">
                  {formatInterval(estimate.configuredIntervalSeconds || estimate.inferredIntervalSeconds!)}
                  {!estimate.configuredIntervalSeconds && estimate.inferredIntervalSeconds && (
                    <span className="text-muted-foreground ml-1">(inferred)</span>
                  )}
                </span>
              </div>
            )}

            {/* Profile info */}
            {estimate.batteryProfile && (
              <ProfileInfo 
                profile={estimate.batteryProfile}
                profileSource={estimate.profileSource}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function WidgetHeader({ badge, toggle }: { badge?: React.ReactNode; toggle?: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 p-4 pb-2 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Battery className="w-4 h-4" />
        Battery Health
      </h3>
      <div className="flex items-center gap-2">
        {toggle}
        {badge}
      </div>
    </div>
  );
}

function StateDisplay({ 
  state, 
  estimate 
}: { 
  state: string; 
  estimate: ReturnType<typeof useBatteryEstimate>;
}) {
  const message = getStateMessage(state as any);
  
  const icon = useMemo(() => {
    switch (state) {
      case "SENSOR_OFFLINE":
        return <WifiOff className="w-8 h-8 text-muted-foreground" />;
      case "COLLECTING_DATA":
        return <Clock className="w-8 h-8 text-muted-foreground" />;
      case "MISSING_PROFILE":
        return <HelpCircle className="w-8 h-8 text-muted-foreground" />;
      case "NO_BATTERY_DATA":
        return <Battery className="w-8 h-8 text-muted-foreground" />;
      default:
        return <Battery className="w-8 h-8 text-muted-foreground" />;
    }
  }, [state]);

  // Progress indicator for COLLECTING_DATA
  const progress = useMemo(() => {
    if (state !== "COLLECTING_DATA") return null;
    
    const uplinkProgress = Math.min(100, (estimate.uplinkCount / MIN_UPLINKS_FOR_ESTIMATE) * 100);
    const hourProgress = Math.min(100, (estimate.dataSpanHours / MIN_HOURS_FOR_ESTIMATE) * 100);
    return Math.min(uplinkProgress, hourProgress);
  }, [state, estimate.uplinkCount, estimate.dataSpanHours]);

  return (
    <div className="text-center space-y-3">
      {icon}
      <div>
        <p className="font-medium text-foreground">{message.title}</p>
        <p className="text-sm text-muted-foreground">{message.description}</p>
      </div>
      {progress !== null && (
        <div className="w-full max-w-[200px] mx-auto space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {estimate.uplinkCount} uplinks • {estimate.dataSpanHours.toFixed(1)}h of data
          </p>
        </div>
      )}
    </div>
  );
}

function ProfileInfo({
  profile,
  profileSource
}: {
  profile: { battery_type: string; nominal_capacity_mah: number };
  profileSource: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Profile</span>
      <span className="font-medium">
        {formatChemistryLabel(profile.battery_type)} ({profile.nominal_capacity_mah} mAh)
        {profileSource === "fallback" && (
          <span className="text-muted-foreground ml-1">(est.)</span>
        )}
      </span>
    </div>
  );
}

/** Map raw chemistry/battery_type strings to human-readable labels */
function formatChemistryLabel(raw: string): string {
  const key = raw.toLowerCase().trim();
  switch (key) {
    case "cr17450":
    case "li-mno2":
      return "Li-MnO\u2082 (CR17450)";
    case "lifes2_aa":
    case "lifes2":
    case "lithium":
    case "li":
    case "li-fes2":
      return "Li-FeS\u2082 (AA)";
    case "cr2032":
      return "CR2032 Coin Cell";
    case "alkaline_aa":
    case "alkaline":
      return "Alkaline (AA)";
    case "lipo":
      return "Li-Po";
    default:
      // If it already looks human-readable (contains spaces/parens), return as-is
      if (raw.includes(" ") || raw.includes("(")) return raw;
      return raw;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}
