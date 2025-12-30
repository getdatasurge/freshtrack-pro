import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Radio, 
  Plus, 
  Loader2,
  Thermometer,
  DoorOpen,
  Star,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLoraSensorsByUnit, useLinkSensorToUnit, useProvisionLoraSensor } from "@/hooks/useLoraSensors";
import { useSetPrimarySensor } from "@/hooks/useSetPrimarySensor";
import { LoraSensor, LoraSensorStatus } from "@/types/ttn";
import { useState } from "react";
import { AssignSensorToUnitDialog } from "./AssignSensorToUnitDialog";
import { SensorDetailsPopover } from "./SensorDetailsPopover";
import { cn } from "@/lib/utils";

interface UnitSensorsCardProps {
  unitId: string;
  organizationId: string;
  siteId: string;
  canEdit?: boolean;
}

const getStatusBadge = (status: LoraSensorStatus) => {
  switch (status) {
    case "pending":
      return { label: "Pending", className: "bg-muted text-muted-foreground" };
    case "joining":
      return { label: "Joining", className: "bg-warning/20 text-warning" };
    case "active":
      return { label: "Active", className: "bg-safe/20 text-safe" };
    case "offline":
      return { label: "Offline", className: "bg-warning/20 text-warning" };
    case "fault":
      return { label: "Fault", className: "bg-alarm/20 text-alarm" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
};

const getSensorIcon = (type: string) => {
  switch (type) {
    case "door":
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
    case "combo": return "Combo";
    default: return type;
  }
};

export function UnitSensorsCard({ 
  unitId, 
  organizationId, 
  siteId,
  canEdit = true 
}: UnitSensorsCardProps) {
  const { data: sensors, isLoading } = useLoraSensorsByUnit(unitId);
  const unlinkSensor = useLinkSensorToUnit();
  const provisionSensor = useProvisionLoraSensor();
  const setPrimarySensor = useSetPrimarySensor();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const handleUnlink = (sensorId: string) => {
    unlinkSensor.mutate({ sensorId, unitId: null });
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

  // Check if a sensor is a door sensor (door or combo)
  const isDoorSensor = (type: string) => type === 'door' || type === 'combo';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Separate door sensors from temperature sensors for display
  const doorSensors = sensors?.filter(s => isDoorSensor(s.sensor_type)) || [];
  const tempSensors = sensors?.filter(s => !isDoorSensor(s.sensor_type) || s.sensor_type === 'combo') || [];

  return (
    <>
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
          {sensors && sensors.length > 0 ? (
            <div className="space-y-2">
              {sensors.map((sensor) => {
                const statusBadge = getStatusBadge(sensor.status);
                const isDoor = isDoorSensor(sensor.sensor_type);
                const showDoorState = isDoor && sensor.status === 'active';

                return (
                  <SensorDetailsPopover
                    key={sensor.id}
                    sensor={sensor}
                    canEdit={canEdit}
                    onSetPrimary={() => handleSetPrimary(sensor)}
                    onUnlink={() => handleUnlink(sensor.id)}
                    onProvision={() => handleProvision(sensor)}
                    isProvisioning={provisionSensor.isProvisioning(sensor.id)}
                    isSettingPrimary={setPrimarySensor.isPending}
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
                        {showDoorState && (
                          <Badge 
                            className={cn(
                              "border-0 font-medium",
                              // We don't have real-time door state from sensor yet, 
                              // but we can show based on last reading
                              "bg-muted text-muted-foreground"
                            )}
                          >
                            <DoorOpen className="w-3 h-3 mr-1" />
                            Door
                          </Badge>
                        )}

                        {/* Status Badge */}
                        <Badge className={`${statusBadge.className} border-0 text-xs`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </div>
                  </SensorDetailsPopover>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-border rounded-lg">
              <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                No sensors assigned to this unit
              </p>
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
          )}
        </CardContent>
      </Card>

      <AssignSensorToUnitDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        unitId={unitId}
        organizationId={organizationId}
        siteId={siteId}
      />
    </>
  );
}

export default UnitSensorsCard;