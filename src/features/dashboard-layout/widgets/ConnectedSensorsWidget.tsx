/**
 * Connected Sensors Widget
 * 
 * Wrapper for UnitSensorsCard component with dashboard widget props.
 */

import UnitSensorsCard from "@/components/unit/UnitSensorsCard";
import type { WidgetProps } from "../types";

export function ConnectedSensorsWidget({ 
  unit,
  entityId,
  organizationId,
  siteId,
}: WidgetProps) {
  // Can't render without required IDs
  if (!entityId || !organizationId || !siteId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Missing required data for sensors display</p>
      </div>
    );
  }

  // Extract door state from unit if available
  const doorState = unit?.door_state;
  const doorLastChangedAt = unit?.door_last_changed_at;

  return (
    <UnitSensorsCard
      unitId={entityId}
      organizationId={organizationId}
      siteId={siteId}
      doorState={doorState === "open" || doorState === "closed" ? doorState : undefined}
      doorLastChangedAt={doorLastChangedAt}
      canEdit={true}
    />
  );
}
