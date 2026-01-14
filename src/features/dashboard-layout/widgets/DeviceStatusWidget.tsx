/**
 * Device Status Widget
 * 
 * Displays current device status with icon and label.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { Thermometer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DerivedStatus {
  statusLabel: string;
  statusColor: string;
  statusBgColor: string;
}

interface DeviceStatusWidgetProps {
  derivedStatus: DerivedStatus;
  unitType: string;
}

export function DeviceStatusWidget({
  derivedStatus,
  unitType,
}: DeviceStatusWidgetProps) {
  return (
    <div className="h-full p-4">
      <p className="text-sm font-medium text-muted-foreground mb-3">Device Status</p>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${derivedStatus.statusBgColor}`}>
          <Thermometer className={`w-5 h-5 ${derivedStatus.statusColor}`} />
        </div>
        <div>
          <Badge className={`${derivedStatus.statusBgColor} ${derivedStatus.statusColor} border-0`}>
            {derivedStatus.statusLabel}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            {unitType.replace(/_/g, " ")}
          </p>
        </div>
      </div>
    </div>
  );
}
