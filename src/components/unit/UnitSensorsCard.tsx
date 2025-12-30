import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Radio, 
  MoreHorizontal, 
  Plus, 
  Unlink,
  Loader2,
  Battery,
  Signal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLoraSensorsByUnit, useLinkSensorToUnit } from "@/hooks/useLoraSensors";
import { LoraSensor, LoraSensorStatus } from "@/types/ttn";
import { useState } from "react";
import { AssignSensorToUnitDialog } from "./AssignSensorToUnitDialog";

interface UnitSensorsCardProps {
  unitId: string;
  organizationId: string;
  siteId: string;
  canEdit?: boolean;
}

const formatEUI = (eui: string) => {
  return eui.match(/.{1,2}/g)?.join(":") || eui;
};

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

const getSensorTypeLabel = (type: string): string => {
  switch (type) {
    case "temperature": return "Temperature";
    case "temperature_humidity": return "Temp + Humidity";
    case "door": return "Door";
    case "combo": return "Combo (Temp + Door)";
    default: return type;
  }
};

const getStatusMessage = (sensor: LoraSensor): string => {
  switch (sensor.status) {
    case "pending":
      return "Registered - Awaiting network join";
    case "joining":
      return "Joining network...";
    case "active":
      if (sensor.last_seen_at) {
        return `Last seen ${formatDistanceToNow(new Date(sensor.last_seen_at), { addSuffix: true })}`;
      }
      return "Active";
    case "offline":
      if (sensor.last_seen_at) {
        return `Last seen ${formatDistanceToNow(new Date(sensor.last_seen_at), { addSuffix: true })}`;
      }
      return "Offline - No recent data";
    case "fault":
      return "Sensor fault detected";
    default:
      return "";
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
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const handleUnlink = (sensorId: string) => {
    unlinkSensor.mutate({ sensorId, unitId: null });
  };

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
            <div className="space-y-3">
              {sensors.map((sensor) => {
                const statusBadge = getStatusBadge(sensor.status);
                const statusMessage = getStatusMessage(sensor);

                return (
                  <div
                    key={sensor.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {sensor.name}
                        </span>
                        <Badge className={`${statusBadge.className} border-0 text-xs`}>
                          {statusBadge.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {getSensorTypeLabel(sensor.sensor_type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        EUI: {formatEUI(sensor.dev_eui)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {statusMessage}
                      </p>
                      {/* Show battery/signal for active sensors */}
                      {sensor.status === "active" && (sensor.battery_level || sensor.signal_strength) && (
                        <div className="flex items-center gap-3 mt-1">
                          {sensor.battery_level !== null && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Battery className="w-3 h-3" />
                              {sensor.battery_level}%
                            </span>
                          )}
                          {sensor.signal_strength !== null && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Signal className="w-3 h-3" />
                              {sensor.signal_strength} dBm
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleUnlink(sensor.id)}
                            className="text-warning"
                          >
                            <Unlink className="w-4 h-4 mr-2" />
                            Unlink from Unit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
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
