import { useState, useEffect } from "react";
import { useLoraSensors, useDeleteLoraSensor, useProvisionLoraSensor, useUpdateLoraSensor } from "@/hooks/useLoraSensors";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Thermometer, CloudUpload, Copy, Check, Info, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AddSensorDialog } from "./AddSensorDialog";
import { EditSensorDialog } from "./EditSensorDialog";
import { formatDistanceToNow } from "date-fns";
import { SENSOR_STATUS_CONFIG, SENSOR_COLUMN_TOOLTIPS } from "@/lib/entityStatusConfig";
import { cn } from "@/lib/utils";
import { debugLog } from "@/lib/debugLogger";

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

// Reusable column header tooltip component
const ColumnHeaderTooltip = ({ content }: { content: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex ml-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
        aria-label="Column information"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs">
      {content}
    </TooltipContent>
  </Tooltip>
);

// Status badge with tooltip showing meaning, system state, and user action
const StatusBadgeWithTooltip = ({ status }: { status: LoraSensorStatus }) => {
  const statusConfig = SENSOR_STATUS_CONFIG[status] || SENSOR_STATUS_CONFIG.pending;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={statusConfig.variant}
          className={cn("cursor-help", statusConfig.className)}
        >
          {statusConfig.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs p-3">
        <div className="space-y-1.5 text-sm">
          <p><span className="font-medium">Status:</span> {statusConfig.tooltip.meaning}</p>
          <p><span className="font-medium">System:</span> {statusConfig.tooltip.systemState}</p>
          {statusConfig.tooltip.userAction && (
            <p className="text-primary"><span className="font-medium">Action:</span> {statusConfig.tooltip.userAction}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Inline site selector component for assigning/changing sensor sites
const SensorSiteSelector = ({ 
  sensor, 
  sites,
  getSiteName,
  onSiteChange,
  isUpdating 
}: { 
  sensor: LoraSensor; 
  sites: { id: string; name: string }[];
  getSiteName: (siteId: string | null) => string | null;
  onSiteChange: (sensor: LoraSensor, newSiteId: string | null) => void;
  isUpdating: boolean;
}) => {
  if (isUpdating) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Updating...</span>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground cursor-help">No sites available</span>
        </TooltipTrigger>
        <TooltipContent>Create a site first to assign sensors</TooltipContent>
      </Tooltip>
    );
  }

  const currentSiteName = getSiteName(sensor.site_id);

  return (
    <Select
      value={sensor.site_id || "unassigned"}
      onValueChange={(value) => onSiteChange(sensor, value === "unassigned" ? null : value)}
    >
      <SelectTrigger className={cn(
        "h-8 w-[160px]",
        !sensor.site_id && "border-dashed text-muted-foreground"
      )}>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <SelectValue>
            {currentSiteName || "Assign Site"}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {sensor.site_id && (
          <SelectItem value="unassigned" className="text-muted-foreground">
            — Unassign —
          </SelectItem>
        )}
        {sites.map((site) => (
          <SelectItem key={site.id} value={site.id}>
            {site.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export function SensorManager({ organizationId, sites, units, canEdit, autoOpenAdd }: SensorManagerProps) {
  const { data: sensors, isLoading } = useLoraSensors(organizationId);
  const deleteSensor = useDeleteLoraSensor();
  const provisionSensor = useProvisionLoraSensor();
  const updateSensor = useUpdateLoraSensor();

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    if (autoOpenAdd) {
      setAddDialogOpen(true);
    }
  }, [autoOpenAdd]);
  const [editSensor, setEditSensor] = useState<LoraSensor | null>(null);
  const [deleteSensor_, setDeleteSensor] = useState<LoraSensor | null>(null);
  
  // Site change confirmation state
  const [confirmSiteChange, setConfirmSiteChange] = useState<{
    sensor: LoraSensor;
    newSiteId: string | null;
    currentSiteName: string | null;
    newSiteName: string | null;
  } | null>(null);
  const [updatingSensorId, setUpdatingSensorId] = useState<string | null>(null);

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

  const generateTtnDeviceId = (devEui: string) => {
    const normalized = devEui.replace(/[:\-\s]/g, '').toLowerCase();
    return `sensor-${normalized}`;
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
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

  // Handle site change - requires confirmation if already assigned
  const handleSiteChange = (sensor: LoraSensor, newSiteId: string | null) => {
    const newSiteName = newSiteId ? getSiteName(newSiteId) : null;
    const currentSiteName = getSiteName(sensor.site_id);

    // If sensor already has a site and we're changing it, require confirmation
    if (sensor.site_id && newSiteId !== sensor.site_id) {
      setConfirmSiteChange({ sensor, newSiteId, currentSiteName, newSiteName });
      return;
    }

    // Direct assignment for unassigned sensors
    executeSiteUpdate(sensor, newSiteId);
  };

  const executeSiteUpdate = async (sensor: LoraSensor, newSiteId: string | null) => {
    setUpdatingSensorId(sensor.id);

    try {
      debugLog.crud('update', 'sensor', sensor.id, { 
        action: 'site_assignment',
        previousSite: sensor.site_id,
        newSite: newSiteId 
      });

      await updateSensor.mutateAsync({
        id: sensor.id,
        updates: { site_id: newSiteId }
      });

      toast.success(newSiteId 
        ? `Sensor assigned to ${getSiteName(newSiteId)}` 
        : 'Sensor unassigned from site'
      );
    } catch (error) {
      debugLog.error('crud', `Failed to update sensor site: ${error}`);
      toast.error('Failed to update sensor site');
    } finally {
      setUpdatingSensorId(null);
      setConfirmSiteChange(null);
    }
  };

  const handleConfirmSiteChange = () => {
    if (confirmSiteChange) {
      executeSiteUpdate(confirmSiteChange.sensor, confirmSiteChange.newSiteId);
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
    <TooltipProvider>
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
                  <TableHead>
                    <span className="inline-flex items-center">
                      Name
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.name} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      DevEUI / TTN Device ID
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.devEui} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Type
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.type} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Location
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.location} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Status
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.status} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Last Uplink
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.lastUplink} />
                    </span>
                  </TableHead>
                  {canEdit && <TableHead className="w-[140px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sensors.map((sensor) => {
                  const ttnDeviceId = sensor.ttn_device_id || generateTtnDeviceId(sensor.dev_eui);
                  return (
                  <TableRow key={sensor.id}>
                    <TableCell className="font-medium">{sensor.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">{formatEUI(sensor.dev_eui)}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => handleCopy(sensor.dev_eui.toLowerCase().replace(/[:\-\s]/g, ''), "DevEUI")}
                              >
                                {copiedId === sensor.dev_eui.toLowerCase().replace(/[:\-\s]/g, '') ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy DevEUI</TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-muted-foreground">{ttnDeviceId}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => handleCopy(ttnDeviceId, "TTN Device ID")}
                              >
                                {copiedId === ttnDeviceId ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy TTN Device ID</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getSensorTypeLabel(sensor.sensor_type)}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <SensorSiteSelector
                            sensor={sensor}
                            sites={sites}
                            getSiteName={getSiteName}
                            onSiteChange={handleSiteChange}
                            isUpdating={updatingSensorId === sensor.id}
                          />
                          {sensor.unit_id && (
                            <span className="text-sm text-muted-foreground">
                              → {getUnitName(sensor.unit_id)}
                            </span>
                          )}
                        </div>
                      ) : (
                        getLocationDisplay(sensor)
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadgeWithTooltip status={sensor.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastUplink(sensor.last_seen_at, sensor.status)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {sensor.status === "pending" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleProvision(sensor)}
                                  disabled={provisionSensor.isProvisioning(sensor.id)}
                                >
                                  {provisionSensor.isProvisioning(sensor.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CloudUpload className="h-4 w-4 text-blue-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Provision to TTN</TooltipContent>
                            </Tooltip>
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
                )})}
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

        {/* Site Change Confirmation Dialog */}
        <AlertDialog 
          open={!!confirmSiteChange} 
          onOpenChange={(open) => !open && setConfirmSiteChange(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change Sensor Site?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This sensor is currently assigned to <strong>{confirmSiteChange?.currentSiteName}</strong>.
                </p>
                <p>
                  {confirmSiteChange?.newSiteId 
                    ? <>Moving it to <strong>{confirmSiteChange?.newSiteName}</strong> may affect data collection and monitoring.</>
                    : <>Unassigning it will remove it from the current site.</>
                  }
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatingSensorId !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSiteChange}
                disabled={updatingSensorId !== null}
              >
                {updatingSensorId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {confirmSiteChange?.newSiteId ? "Move Sensor" : "Unassign Sensor"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
