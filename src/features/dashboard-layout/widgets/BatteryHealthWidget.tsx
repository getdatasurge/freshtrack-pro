/**
 * Battery Health Widget
 * 
 * Wrapper for BatteryHealthCard component with dashboard widget props.
 */

import BatteryHealthCard from "@/components/unit/BatteryHealthCard";
import type { WidgetProps } from "../types";

export function BatteryHealthWidget({ 
  sensor,
  loraSensors,
  device,
}: WidgetProps) {
  // Get device ID from sensor or device
  const primarySensor = sensor || loraSensors?.find(s => s.is_primary) || loraSensors?.[0];
  const deviceId = primarySensor?.id || device?.id || null;

  return <BatteryHealthCard deviceId={deviceId} />;
}
