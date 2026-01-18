import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radio, Check } from "lucide-react";
import { useLoraSensors, useLinkSensorToUnit } from "@/hooks/useLoraSensors";
import { LoraSensor } from "@/types/ttn";

interface AssignSensorToUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  organizationId: string;
  siteId: string;
}

const formatEUI = (eui: string) => {
  return eui.match(/.{1,2}/g)?.join(":") || eui;
};

const getSensorTypeLabel = (type: string): string => {
  switch (type) {
    case "temperature": return "Temperature";
    case "temperature_humidity": return "Temp + Humidity";
    case "door": return "Door";
    case "combo": return "Combo";
    default: return type;
  }
};

export function AssignSensorToUnitDialog({
  open,
  onOpenChange,
  unitId,
  organizationId,
  siteId,
}: AssignSensorToUnitDialogProps) {
  const { data: allSensors, isLoading } = useLoraSensors(organizationId);
  const linkSensor = useLinkSensorToUnit();
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);

  // Filter to unassigned sensors (no unit_id set)
  const unassignedSensors = allSensors?.filter((s) => !s.unit_id) || [];

  const handleAssign = () => {
    if (!selectedSensorId) return;
    
    linkSensor.mutate(
      { sensorId: selectedSensorId, unitId, orgId: organizationId },
      {
        onSuccess: () => {
          setSelectedSensorId(null);
          onOpenChange(false);
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedSensorId(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Sensor to Unit</DialogTitle>
          <DialogDescription>
            Select an unassigned sensor to link to this unit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : unassignedSensors.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No unassigned sensors available
              </p>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                Sync sensors from emulator or register new sensors in Settings → Sensors
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {unassignedSensors.map((sensor) => (
                <button
                  key={sensor.id}
                  type="button"
                  onClick={() => setSelectedSensorId(sensor.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedSensorId === sensor.id
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {sensor.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getSensorTypeLabel(sensor.sensor_type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        EUI: {formatEUI(sensor.dev_eui)}
                      </p>
                      {sensor.site_id && (
                        <p className="text-xs text-muted-foreground">
                          Site assigned
                        </p>
                      )}
                    </div>
                    {selectedSensorId === sensor.id && (
                      <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-accent-foreground" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedSensorId || linkSensor.isPending}
          >
            {linkSensor.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Assign Sensor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignSensorToUnitDialog;
