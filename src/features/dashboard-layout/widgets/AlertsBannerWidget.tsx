/**
 * Alerts Banner Widget
 * 
 * Displays active alerts for the unit with clear conditions.
 */

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
    return null;
  }

  return <UnitAlertsBanner alerts={alerts} onLogTemp={onLogTemp} />;
}
