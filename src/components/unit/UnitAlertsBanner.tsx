import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  WifiOff,
  Thermometer,
  ChevronDown,
  ChevronUp,
  ClipboardEdit,
  Bell,
} from "lucide-react";

interface UnitAlert {
  id: string;
  type: "MANUAL_REQUIRED" | "OFFLINE" | "EXCURSION" | "ALARM_ACTIVE" | string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  clearCondition: string;
}

interface UnitAlertsBannerProps {
  alerts: UnitAlert[];
  onLogTemp?: () => void;
  onAcknowledge?: (alertId: string) => void;
}

const alertConfig: Record<string, { icon: typeof AlertTriangle; clearText: string }> = {
  MANUAL_REQUIRED: { icon: Clock, clearText: "Log a temperature reading" },
  OFFLINE: { icon: WifiOff, clearText: "Sensor comes back online" },
  EXCURSION: { icon: Thermometer, clearText: "Temperature returns to range" },
  ALARM_ACTIVE: { icon: Thermometer, clearText: "Temperature returns to range" },
  missed_manual_entry: { icon: Clock, clearText: "Log a temperature reading" },
  monitoring_interrupted: { icon: WifiOff, clearText: "Sensor comes back online" },
  alarm_active: { icon: Thermometer, clearText: "Temperature returns to range" },
};

const UnitAlertsBanner = ({ alerts, onLogTemp, onAcknowledge }: UnitAlertsBannerProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  // Sort alerts: critical first, then warning
  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const visibleAlerts = expanded ? sortedAlerts : sortedAlerts.slice(0, 2);
  const hasMore = sortedAlerts.length > 2;
  const hasCritical = sortedAlerts.some(a => a.severity === "critical");

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      hasCritical 
        ? "bg-alarm/5 border-alarm/30" 
        : "bg-warning/5 border-warning/30"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${hasCritical ? "text-alarm" : "text-warning"}`} />
          <span className={`text-sm font-medium ${hasCritical ? "text-alarm" : "text-warning"}`}>
            {sortedAlerts.length} Active Alert{sortedAlerts.length > 1 ? "s" : ""}
          </span>
        </div>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="w-3 h-3 ml-1" />
              </>
            ) : (
              <>
                View all ({sortedAlerts.length}) <ChevronDown className="w-3 h-3 ml-1" />
              </>
            )}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {visibleAlerts.map((alert) => {
          const config = alertConfig[alert.type] || alertConfig.OFFLINE;
          const Icon = config.icon;
          const isCritical = alert.severity === "critical";
          const showLogButton = alert.type === "MANUAL_REQUIRED" || alert.type === "missed_manual_entry";
          const showAckButton = alert.type === "OFFLINE" || alert.type === "monitoring_interrupted";

          return (
            <div
              key={alert.id}
              className={`flex flex-col gap-2 p-3 rounded-lg ${
                isCritical ? "bg-alarm/10" : "bg-warning/10"
              }`}
            >
              {/* Header: Icon + Title + Severity */}
              <div className="flex items-start gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCritical ? "bg-alarm/20" : "bg-warning/20"
                }`}>
                  <Icon className={`w-4 h-4 ${isCritical ? "text-alarm" : "text-warning"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{alert.title}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs flex-shrink-0 ${
                        isCritical 
                          ? "border-alarm/50 text-alarm bg-alarm/5" 
                          : "border-warning/50 text-warning bg-warning/5"
                      }`}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  {/* Reason text - wraps fully, no truncation */}
                  <p className="text-sm text-muted-foreground mt-1 break-words leading-relaxed" style={{ overflowWrap: "anywhere" }}>
                    {alert.message}
                  </p>
                </div>
              </div>

              {/* Footer: Clear condition + Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between pl-10">
                <p className="text-xs text-muted-foreground break-words" style={{ overflowWrap: "anywhere" }}>
                  <span className="text-foreground/60">Clears when:</span>{" "}
                  {alert.clearCondition || config.clearText}
                </p>
                <div className="flex gap-2 flex-shrink-0">
                  {showLogButton && onLogTemp && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-alarm/50 text-alarm hover:bg-alarm/10"
                      onClick={onLogTemp}
                    >
                      <ClipboardEdit className="w-3 h-3 mr-1" />
                      Log Temp
                    </Button>
                  )}
                  {showAckButton && onAcknowledge && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onAcknowledge(alert.id)}
                    >
                      <Bell className="w-3 h-3 mr-1" />
                      Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnitAlertsBanner;
