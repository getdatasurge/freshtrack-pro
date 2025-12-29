import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ClipboardEdit,
  Bell,
  CheckCircle2,
  ArrowUpCircle,
  Check,
  Mail,
  MailCheck,
  MailX,
} from "lucide-react";
import { getAlertTypeConfig, getSeverityConfig } from "@/lib/alertConfig";

interface AlertRowProps {
  alert: {
    id: string;
    title: string;
    message: string | null;
    alertType: string;
    severity: "critical" | "warning" | "info";
    status: "active" | "acknowledged" | "resolved";
    unit_id: string;
    unit_name: string;
    site_name: string;
    area_name: string;
    temp_reading: number | null;
    temp_limit: number | null;
    triggered_at: string;
    acknowledged_at: string | null;
    acknowledgment_notes: string | null;
    isComputed: boolean;
    dbAlertId?: string;
    escalation_level?: number;
    last_notified_at?: string | null;
    last_notified_reason?: string | null;
  };
  onLogTemp?: () => void;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  isSubmitting?: boolean;
}

const getTimeAgo = (dateStr: string) => {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const AlertRow = ({ alert, onLogTemp, onAcknowledge, onResolve, isSubmitting }: AlertRowProps) => {
  const typeConfig = getAlertTypeConfig(alert.alertType);
  const severity = getSeverityConfig(alert.severity);
  const Icon = typeConfig?.icon || AlertTriangle;
  const showLogButton = alert.alertType === "MANUAL_REQUIRED" || alert.alertType === "missed_manual_entry";

  return (
    <Card className={alert.status === "active" ? "border-alarm/30" : ""}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-lg ${severity.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${severity.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{alert.title}</h3>
                  <Badge className={`${severity.bgColor} ${severity.color} border-0`}>
                    {alert.severity}
                  </Badge>
                  {alert.escalation_level && alert.escalation_level > 1 && (
                    <Badge variant="outline" className="text-warning border-warning">
                      <ArrowUpCircle className="w-3 h-3 mr-1" />
                      Level {alert.escalation_level}
                    </Badge>
                  )}
                  {alert.isComputed && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Live
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {alert.site_name} · {alert.area_name} · {alert.unit_name}
                </p>
              </div>
              
              <div className="text-left sm:text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">{getTimeAgo(alert.triggered_at)}</p>
                {alert.acknowledged_at && (
                  <p className="text-xs text-safe mt-1">
                    <Check className="w-3 h-3 inline mr-1" />
                    Ack'd {getTimeAgo(alert.acknowledged_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Message - fully wrapped, no truncation */}
            {alert.message && (
              <p className="text-sm text-muted-foreground break-words leading-relaxed">
                {alert.message}
              </p>
            )}

            {/* Temperature info */}
            {alert.temp_reading !== null && (
              <p className="text-sm">
                <span className="text-alarm font-semibold">{alert.temp_reading}°F</span>
                {alert.temp_limit && (
                  <span className="text-muted-foreground"> (limit: {alert.temp_limit}°F)</span>
                )}
              </p>
            )}

            {/* Email delivery status */}
            {!alert.isComputed && (
              <div className="flex items-center gap-1.5 text-xs">
                {alert.last_notified_at ? (
                  <>
                    <MailCheck className="w-3.5 h-3.5 text-safe" />
                    <span className="text-safe">Email sent {getTimeAgo(alert.last_notified_at)}</span>
                  </>
                ) : alert.last_notified_reason ? (
                  <>
                    <MailX className="w-3.5 h-3.5 text-warning" />
                    <span className="text-warning">Email: {alert.last_notified_reason}</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Email pending</span>
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {alert.status === "active" && (
              <div className="flex flex-wrap gap-2 pt-1">
                {showLogButton && onLogTemp && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-warning/50 text-warning hover:bg-warning/10"
                    onClick={onLogTemp}
                  >
                    <ClipboardEdit className="w-4 h-4 mr-1" />
                    Log Temp
                  </Button>
                )}
                {!alert.isComputed && onAcknowledge && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAcknowledge}
                    disabled={isSubmitting}
                  >
                    <Bell className="w-4 h-4 mr-1" />
                    Acknowledge
                  </Button>
                )}
                {onResolve && (
                  <Button
                    size="sm"
                    className="bg-safe hover:bg-safe/90 text-safe-foreground"
                    onClick={onResolve}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Resolve
                  </Button>
                )}
              </div>
            )}

            {/* Acknowledged state */}
            {alert.status === "acknowledged" && (
              <div className="space-y-2 pt-1">
                {alert.acknowledgment_notes && (
                  <div className="p-2 rounded bg-muted/50 text-sm break-words">
                    <span className="text-muted-foreground">Notes: </span>
                    {alert.acknowledgment_notes}
                  </div>
                )}
                {onResolve && (
                  <Button
                    size="sm"
                    className="bg-safe hover:bg-safe/90 text-safe-foreground"
                    onClick={onResolve}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Resolve with Action
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AlertRow;
