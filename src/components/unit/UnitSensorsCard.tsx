import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Radio, 
  Plus, 
  Loader2,
  Thermometer,
  DoorOpen,
  DoorClosed,
  Star,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { useLoraSensorsByUnit, useLinkSensorToUnit, useProvisionLoraSensor, useLoraSensors } from "@/hooks/useLoraSensors";
import { useSetPrimarySensor } from "@/hooks/useSetPrimarySensor";
import { LoraSensor, LoraSensorStatus } from "@/types/ttn";
import { useState } from "react";
import { AssignSensorToUnitDialog } from "./AssignSensorToUnitDialog";
import { SensorDetailsPopover } from "./SensorDetailsPopover";
import { cn } from "@/lib/utils";
import { UNIT_SENSOR_STATUS_CONFIG } from "@/lib/entityStatusConfig";

interface UnitSensorsCardProps {
  unitId: string;
  organizationId: string;
  siteId: string;
  canEdit?: boolean;
  doorState?: 'open' | 'closed' | null;
  doorLastChangedAt?: string | null;
}

const getStatusBadge = (status: LoraSensorStatus) => {
  const config = UNIT_SENSOR_STATUS_CONFIG[status] || UNIT_SENSOR_STATUS_CONFIG.pending;
  return { 
    label: config.label, 
    className: config.className,
    tooltip: config.tooltip
  };
};

const getSensorIcon = (type: string) => {
  switch (type) {
    case "door":
    case "contact":
      return <DoorOpen className="w-4 h-4 text-blue-500" />;
    case "temperature":
    case "temperature_humidity":
      return <Thermometer className="w-4 h-4 text-orange-500" />;
    case "combo":
      return <Radio className="w-4 h-4 text-purple-500" />;
    default:
      return <Radio className="w-4 h-4 text-muted-foreground" />;
  }
};

const getSensorTypeLabel = (type: string): string => {
  switch (type) {
    case "temperature": return "Temp";
    case "temperature_humidity": return "Temp+Humidity";
    case "door": return "Door";
    case "contact": return "Door";
    case "combo": return "Combo";
    default: return type;
  }
};

// Status badge with tooltip for unit sensors card
const StatusBadgeWithTooltip = ({ status }: { status: LoraSensorStatus }) => {
  const statusBadge = getStatusBadge(status);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${statusBadge.className} border-0 text-xs cursor-help`}>
          {statusBadge.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="space-y-1.5 text-sm">
          <p><span className="font-medium">Status:</span> {statusBadge.tooltip.meaning}</p>
          <p><span className="font-medium">System:</span> {statusBadge.tooltip.systemState}</p>
          {statusBadge.tooltip.userAction && (
            <p className="text-primary"><span className="font-medium">Action:</span> {statusBadge.tooltip.userAction}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export function UnitSensorsCard({ 
  unitId, 
  organizationId, 
  siteId,
  canEdit = true,
  doorState,
  doorLastChangedAt,
}: UnitSensorsCardProps) {
  const { data: sensors, isLoading } = useLoraSensorsByUnit(unitId);
  const { data: allSensors } = useLoraSensors(organizationId);
  const unlinkSensor = useLinkSensorToUnit();
  const provisionSensor = useProvisionLoraSensor();
  const setPrimarySensor = useSetPrimarySensor();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Count unassigned sensors (no unit_id)
  const unassignedSensorsCount = allSensors?.filter(s => !s.unit_id).length || 0;

  const handleUnlink = (sensorId: string, sensor: LoraSensor) => {
    unlinkSensor.mutate({ sensorId, unitId: null, previousUnitId: unitId, orgId: sensor.organization_id });
  };

  const handleProvision = (sensor: LoraSensor) => {
    provisionSensor.mutate({
      sensorId: sensor.id,
      organizationId: sensor.organization_id,
    });
  };

  const handleSetPrimary = (sensor: LoraSensor) => {
    setPrimarySensor.mutate({
      sensorId: sensor.id,
      unitId: unitId,
      sensorType: sensor.sensor_type,
    });
  };

  // Check if a sensor is a door sensor (door, contact, or combo)
  const isDoorSensor = (type: string) => type === 'door' || type === 'contact' || type === 'combo';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="w-5 h-5 text-accent" />
              Connected Sensors
            </CardTitle>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Assign Sensor
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            LoRaWAN sensors monitoring this unit
          </p>
        </CardHeader>
        <CardContent>
          {/* Unassigned sensors banner */}
          {unassignedSensorsCount > 0 && (!sensors || sensors.length === 0) && (
            <div className="flex items-center gap-3 p-3 mb-4 rounded-lg border border-primary/20 bg-primary/5">
              <Info className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm text-foreground flex-1">
                <span className="font-medium">{unassignedSensorsCount}</span> unassigned sensor{unassignedSensorsCount > 1 ? 's' : ''} available
              </p>
              <Button size="sm" variant="outline" onClick={() => setAssignDialogOpen(true)}>
                Assign Now
              </Button>
            </div>
          )}
          
          {sensors && sensors.length > 0 ? (
            <>
              {/* Show banner above sensors if there are more unassigned ones */}
              {unassignedSensorsCount > 0 && (
                <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  <span>{unassignedSensorsCount} more unassigned sensor{unassignedSensorsCount > 1 ? 's' : ''} available</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto" onClick={() => setAssignDialogOpen(true)}>
                    Assign
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {sensors.map((sensor) => {
                  const isDoor = isDoorSensor(sensor.sensor_type);
                  const showDoorState = isDoor && sensor.status === 'active';

                  return (
                    <SensorDetailsPopover
                      key={sensor.id}
                      sensor={sensor}
                      canEdit={canEdit}
                      onSetPrimary={() => handleSetPrimary(sensor)}
                      onUnlink={() => handleUnlink(sensor.id, sensor)}
                      onProvision={() => handleProvision(sensor)}
                      isProvisioning={provisionSensor.isProvisioning(sensor.id)}
                      isSettingPrimary={setPrimarySensor.isPending}
                      doorState={isDoor ? doorState : undefined}
                      doorLastChangedAt={isDoor ? doorLastChangedAt : undefined}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors",
                          sensor.is_primary && "border-accent/50"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Sensor Type Icon */}
                          <div className="flex-shrink-0">
                            {getSensorIcon(sensor.sensor_type)}
                          </div>

                          {/* Sensor Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground text-sm truncate">
                                {sensor.name}
                              </span>
                              {sensor.is_primary && (
                                <Star className="w-3 h-3 text-accent fill-accent flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {getSensorTypeLabel(sensor.sensor_type)}
                              {sensor.last_seen_at && sensor.status === 'active' && (
                                <> · {formatDistanceToNow(new Date(sensor.last_seen_at), { addSuffix: true })}</>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right Side: Status & Door State */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Door State Badge - Always visible for door sensors */}
                          {showDoorState && doorState && (
                            <Badge 
                              className={cn(
                                "border-0 font-medium",
                                doorState === 'open' 
                                  ? "bg-alarm/20 text-alarm" 
                                  : "bg-safe/20 text-safe"
                              )}
                            >
                              {doorState === 'open' ? (
                                <>
                                  <DoorOpen className="w-3 h-3 mr-1" />
                                  Open
                                  {doorLastChangedAt && (
                                    <span className="ml-1 text-[10px] opacity-75">
                                      {formatDistanceToNow(new Date(doorLastChangedAt))}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <DoorClosed className="w-3 h-3 mr-1" />
                                  Closed
                                </>
                              )}
                            </Badge>
                          )}

                          {/* Status Badge with Tooltip */}
                          <StatusBadgeWithTooltip status={sensor.status} />
                        </div>
                      </div>
                    </SensorDetailsPopover>
                  );
                })}
              </div>
            </>
          ) : !unassignedSensorsCount ? (
            <div className="text-center py-6 border border-dashed border-border rounded-lg">
              <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">
                No sensors assigned to this unit
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Register sensors in Settings → Sensors or sync from emulator
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sensor
                </Button>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AssignSensorToUnitDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        unitId={unitId}
        organizationId={organizationId}
        siteId={siteId}
      />
    </TooltipProvider>
  );
}

export default UnitSensorsCard;
