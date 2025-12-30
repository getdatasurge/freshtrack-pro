import { useState, useEffect } from "react";
import { useLoraSensors, useDeleteLoraSensor, useProvisionLoraSensor } from "@/hooks/useLoraSensors";
import { LoraSensor, LoraSensorStatus, LoraSensorType } from "@/types/ttn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Thermometer, CloudUpload } from "lucide-react";
import { AddSensorDialog } from "./AddSensorDialog";
import { EditSensorDialog } from "./EditSensorDialog";
import { formatDistanceToNow } from "date-fns";

interface Site {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  site_id: string;
}

interface SensorManagerProps {
  organizationId: string;
  sites: Site[];
  units: Unit[];
  canEdit: boolean;
  autoOpenAdd?: boolean;
}

export function SensorManager({ organizationId, sites, units, canEdit, autoOpenAdd }: SensorManagerProps) {
  const { data: sensors, isLoading } = useLoraSensors(organizationId);
  const deleteSensor = useDeleteLoraSensor();
  const provisionSensor = useProvisionLoraSensor();

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    if (autoOpenAdd) {
      setAddDialogOpen(true);
    }
  }, [autoOpenAdd]);
  const [editSensor, setEditSensor] = useState<LoraSensor | null>(null);
  const [deleteSensor_, setDeleteSensor] = useState<LoraSensor | null>(null);

  const getSiteName = (siteId: string | null) => {
    if (!siteId) return null;
    const site = sites.find((s) => s.id === siteId);
    return site?.name || "Unknown Site";
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return null;
    const unit = units.find((u) => u.id === unitId);
    return unit?.name || "Unknown Unit";
  };

  const getLocationDisplay = (sensor: LoraSensor) => {
    const siteName = getSiteName(sensor.site_id);
    const unitName = getUnitName(sensor.unit_id);
    
    if (unitName && siteName) {
      return `${siteName} → ${unitName}`;
    } else if (siteName) {
      return siteName;
    } else if (unitName) {
      return unitName;
    }
    return "—";
  };

  const getStatusBadge = (status: LoraSensorStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending Provisioning</Badge>;
      case "joining":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Joining...</Badge>;
      case "active":
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case "offline":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Offline</Badge>;
      case "fault":
        return <Badge variant="destructive">Fault</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSensorTypeLabel = (type: LoraSensorType) => {
    switch (type) {
      case "temperature":
        return "Temperature";
      case "temperature_humidity":
        return "Temp + Humidity";
      case "door":
        return "Door";
      case "combo":
        return "Combo";
      default:
        return type;
    }
  };

  const formatEUI = (eui: string) => {
    // Format as XX:XX:XX:XX:XX:XX:XX:XX
    return eui.toUpperCase().match(/.{1,2}/g)?.join(":") || eui.toUpperCase();
  };

  const formatLastUplink = (lastSeenAt: string | null, status: LoraSensorStatus) => {
    if (status === "pending" || status === "joining") {
      return <span className="text-muted-foreground">—</span>;
    }
    if (!lastSeenAt) {
      return <span className="text-muted-foreground">Never</span>;
    }
    try {
      return formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true });
    } catch {
      return <span className="text-muted-foreground">—</span>;
    }
  };

  const handleProvision = (sensor: LoraSensor) => {
    provisionSensor.mutate({
      sensorId: sensor.id,
      organizationId: sensor.organization_id,
    });
  };

  const handleDelete = () => {
    if (deleteSensor_) {
      deleteSensor.mutate(
        { id: deleteSensor_.id, orgId: organizationId },
        {
          onSuccess: () => setDeleteSensor(null),
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">LoRa Sensors</h3>
          <p className="text-sm text-muted-foreground">
            Register and manage your LoRaWAN temperature sensors
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Sensor
          </Button>
        )}
      </div>

      {sensors && sensors.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>DevEUI</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Uplink</TableHead>
                {canEdit && <TableHead className="w-[140px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sensors.map((sensor) => (
                <TableRow key={sensor.id}>
                  <TableCell className="font-medium">{sensor.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatEUI(sensor.dev_eui)}
                  </TableCell>
                  <TableCell>{getSensorTypeLabel(sensor.sensor_type)}</TableCell>
                  <TableCell>{getLocationDisplay(sensor)}</TableCell>
                  <TableCell>{getStatusBadge(sensor.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastUplink(sensor.last_seen_at, sensor.status)}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {sensor.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleProvision(sensor)}
                            disabled={provisionSensor.isProvisioning(sensor.id)}
                            title="Provision to TTN"
                          >
                            {provisionSensor.isProvisioning(sensor.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CloudUpload className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditSensor(sensor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteSensor(sensor)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <Thermometer className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No sensors registered</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first LoRa sensor to start monitoring temperatures.
          </p>
          {canEdit && (
            <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Sensor
            </Button>
          )}
        </div>
      )}

      <AddSensorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        organizationId={organizationId}
        sites={sites}
        units={units}
      />

      {editSensor && (
        <EditSensorDialog
          open={!!editSensor}
          onOpenChange={(open) => !open && setEditSensor(null)}
          sensor={editSensor}
          sites={sites}
          units={units}
        />
      )}

      <AlertDialog open={!!deleteSensor_} onOpenChange={(open) => !open && setDeleteSensor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sensor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSensor_?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSensor.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
