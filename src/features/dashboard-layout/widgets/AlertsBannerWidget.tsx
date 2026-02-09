/**
 * Alerts Banner Widget
 *
 * Displays active alerts for the unit with clear conditions.
 * Shows a positive "No active alerts" state when everything is healthy.
 */

import { CheckCircle } from "lucide-react";
import UnitAlertsBanner from "@/components/unit/UnitAlertsBanner";

interface UnitAlert {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  clearCondition: string;
}

interface AlertsBannerWidgetProps {
  alerts: UnitAlert[];
  onLogTemp: () => void;
}

export function AlertsBannerWidget({ alerts, onLogTemp }: AlertsBannerWidgetProps) {
  if (alerts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-safe">
          <CheckCircle className="h-5 w-5" />
          <span className="text-sm font-medium">No active alerts</span>
          <span className="text-sm text-muted-foreground">&mdash; All sensors reporting normally</span>
        </div>
      </div>
    );
  }

  return <UnitAlertsBanner alerts={alerts} onLogTemp={onLogTemp} />;
}
