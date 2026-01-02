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
import { Plus, Pencil, Trash2, Loader2, Thermometer, CloudUpload, Copy, Check, Info, MapPin, Box, RefreshCw, Code, AlertTriangle, DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { AddSensorDialog } from "./AddSensorDialog";
import { EditSensorDialog } from "./EditSensorDialog";
import { formatDistanceToNow } from "date-fns";
import { SENSOR_STATUS_CONFIG, SENSOR_COLUMN_TOOLTIPS } from "@/lib/entityStatusConfig";
import { cn } from "@/lib/utils";
import { debugLog } from "@/lib/debugLogger";
import { canProvisionSensor } from "@/lib/actions";
import { useTTNConfig } from "@/contexts/TTNConfigContext";
import { checkTTNOperationAllowed } from "@/lib/ttn/guards";

interface Site {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  site_id: string;
}

interface TTNConfig {
  isEnabled: boolean;
  hasApiKey: boolean;
  applicationId: string | null;
  apiKeyLast4: string | null;
}

interface SensorManagerProps {
  organizationId: string;
  sites: Site[];
  units: Unit[];
  canEdit: boolean;
  autoOpenAdd?: boolean;
  ttnConfig?: TTNConfig | null;
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

// Inline unit selector component for assigning/changing sensor units
const SensorUnitSelector = ({ 
  sensor, 
  units,
  getUnitName,
  onUnitChange,
  isUpdating 
}: { 
  sensor: LoraSensor; 
  units: { id: string; name: string; site_id: string }[];
  getUnitName: (unitId: string | null) => string | null;
  onUnitChange: (sensor: LoraSensor, newUnitId: string | null) => void;
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

  // If no site selected, show disabled state with guidance
  if (!sensor.site_id) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground cursor-help italic">
            Select a Site first
          </span>
        </TooltipTrigger>
        <TooltipContent>Assign this sensor to a Site before selecting a Unit</TooltipContent>
      </Tooltip>
    );
  }

  // Filter units to only those belonging to this sensor's site
  const siteUnits = units.filter(u => u.site_id === sensor.site_id);

  if (siteUnits.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm text-muted-foreground cursor-help">No units in this site</span>
        </TooltipTrigger>
        <TooltipContent>Create a unit in this site first</TooltipContent>
      </Tooltip>
    );
  }

  const currentUnitName = getUnitName(sensor.unit_id);

  return (
    <Select
      value={sensor.unit_id || "unassigned"}
      onValueChange={(value) => onUnitChange(sensor, value === "unassigned" ? null : value)}
    >
      <SelectTrigger className={cn(
        "h-8 w-[160px]",
        !sensor.unit_id && "border-dashed text-muted-foreground"
      )}>
        <div className="flex items-center gap-1.5">
          <Box className="h-3.5 w-3.5 shrink-0" />
          <SelectValue>
            {currentUnitName || "Assign Unit"}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {sensor.unit_id && (
          <SelectItem value="unassigned" className="text-muted-foreground">
            — Unassign —
          </SelectItem>
        )}
        {siteUnits.map((unit) => (
          <SelectItem key={unit.id} value={unit.id}>
            {unit.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Provision button component using centralized eligibility helper
const ProvisionButton = ({
  sensor,
  ttnConfig,
  isProvisioning,
  onProvision,
}: {
  sensor: LoraSensor;
  ttnConfig?: TTNConfig | null;
  isProvisioning: boolean;
  onProvision: () => void;
}) => {
  // Already provisioned - show success badge
  if (sensor.ttn_device_id) {
    return (
      <Badge variant="outline" className="text-safe border-safe/30 bg-safe/10">
        Provisioned
      </Badge>
    );
  }

  // Use centralized eligibility helper
  const eligibility = canProvisionSensor(
    {
      dev_eui: sensor.dev_eui,
      app_key: sensor.app_key,
      ttn_device_id: sensor.ttn_device_id,
      status: sensor.status,
    },
    ttnConfig ? {
      isEnabled: ttnConfig.isEnabled,
      hasApiKey: ttnConfig.hasApiKey,
      applicationId: ttnConfig.applicationId,
    } : null
  );

  // TTN not configured - show inline action hint
  if (eligibility.code === "TTN_NOT_CONFIGURED" || 
      eligibility.code === "TTN_MISSING_API_KEY" || 
      eligibility.code === "TTN_MISSING_APPLICATION") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-help">
            <CloudUpload className="h-3.5 w-3.5" />
            <span>Configure TTN</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">TTN not configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            {eligibility.reason}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Sensor missing OTAA keys - show inline action hint
  if (eligibility.code === "MISSING_DEV_EUI" || eligibility.code === "MISSING_APP_KEY") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 cursor-help">
            Add Keys
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium">Missing OTAA credentials</p>
          <p className="text-xs text-muted-foreground mt-1">
            {eligibility.reason}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Other disabled reasons (permission denied, etc.)
  if (!eligibility.allowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-help">
            <CloudUpload className="h-3.5 w-3.5" />
            <span>Unavailable</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{eligibility.reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Ready to provision - show prominent button
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onProvision}
      disabled={isProvisioning}
      className="gap-1.5 h-7 px-2.5 text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50"
    >
      {isProvisioning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudUpload className="h-3.5 w-3.5" />
      )}
      <span className="text-xs font-medium">Provision</span>
    </Button>
  );
};

export function SensorManager({ organizationId, sites, units, canEdit, autoOpenAdd, ttnConfig }: SensorManagerProps) {
  const queryClient = useQueryClient();
  const { data: sensors, isLoading, dataUpdatedAt } = useLoraSensors(organizationId);
  const deleteSensor = useDeleteLoraSensor();
  const provisionSensor = useProvisionLoraSensor();
  const updateSensor = useUpdateLoraSensor();

  // TTN Config Context for state awareness
  const { context: ttnContext } = useTTNConfig();
  const guardResult = checkTTNOperationAllowed('provision_sensor', ttnContext);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewRawSensor, setViewRawSensor] = useState<LoraSensor | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (autoOpenAdd) {
      setAddDialogOpen(true);
    }
  }, [autoOpenAdd]);
  const [editSensor, setEditSensor] = useState<LoraSensor | null>(null);
  const [deleteSensor_, setDeleteSensor] = useState<LoraSensor | null>(null);
  
  // Force refresh handler
  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    debugLog.info('crud', 'SENSORS_FORCE_REFRESH', { org_id: organizationId });
    await queryClient.invalidateQueries({ queryKey: ["lora-sensors", organizationId] });
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
  // Site change confirmation state
  const [confirmSiteChange, setConfirmSiteChange] = useState<{
    sensor: LoraSensor;
    newSiteId: string | null;
    currentSiteName: string | null;
    newSiteName: string | null;
  } | null>(null);
  const [updatingSensorId, setUpdatingSensorId] = useState<string | null>(null);
  
  // Unit change confirmation state
  const [confirmUnitChange, setConfirmUnitChange] = useState<{
    sensor: LoraSensor;
    newUnitId: string | null;
    currentUnitName: string | null;
    newUnitName: string | null;
  } | null>(null);
  const [updatingUnitSensorId, setUpdatingUnitSensorId] = useState<string | null>(null);

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
      case "contact":
        return "Door";
      case "combo":
        return "Combo";
      default:
        return type;
    }
  };

  const getSensorTypeIcon = (type: LoraSensorType) => {
    switch (type) {
      case "door":
      case "contact":
        return <DoorOpen className="h-4 w-4 text-muted-foreground" />;
      case "temperature":
      case "temperature_humidity":
      case "combo":
      default:
        return <Thermometer className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Compute effective status based on last_seen_at staleness
  const getEffectiveStatus = (sensor: LoraSensor): LoraSensorStatus => {
    // If status is 'active' but last_seen_at is stale (>5 min), show 'offline'
    if (sensor.status === 'active' && sensor.last_seen_at) {
      const staleThresholdMs = 5 * 60 * 1000; // 5 minutes
      const lastSeen = new Date(sensor.last_seen_at).getTime();
      if (Date.now() - lastSeen > staleThresholdMs) {
        return 'offline';
      }
    }
    return sensor.status;
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

    // Check if current unit belongs to new site - if not, clear it
    const currentUnit = sensor.unit_id ? units.find(u => u.id === sensor.unit_id) : null;
    const shouldClearUnit = currentUnit && currentUnit.site_id !== newSiteId;

    try {
      debugLog.crud('update', 'sensor', sensor.id, { 
        action: 'site_assignment',
        previousSite: sensor.site_id,
        newSite: newSiteId,
        clearingUnit: shouldClearUnit ? sensor.unit_id : null
      });

      const updates: { site_id: string | null; unit_id?: string | null } = { 
        site_id: newSiteId 
      };
      
      if (shouldClearUnit) {
        updates.unit_id = null;
      }

      await updateSensor.mutateAsync({
        id: sensor.id,
        updates
      });

      if (shouldClearUnit) {
        toast.info('Unit cleared because it belongs to another site');
      }

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

  // Handle unit change - requires confirmation if already assigned
  const handleUnitChange = (sensor: LoraSensor, newUnitId: string | null) => {
    const newUnitName = newUnitId ? getUnitName(newUnitId) : null;
    const currentUnitName = getUnitName(sensor.unit_id);

    debugLog.info('crud', 'UNIT_ASSIGNMENT_SELECT', {
      sensor_id: sensor.id,
      current_unit_id: sensor.unit_id,
      new_unit_id: newUnitId
    });

    // If sensor already has a unit and we're changing it, require confirmation
    if (sensor.unit_id && newUnitId !== sensor.unit_id) {
      setConfirmUnitChange({ sensor, newUnitId, currentUnitName, newUnitName });
      return;
    }

    // Direct assignment for unassigned sensors
    executeUnitUpdate(sensor, newUnitId);
  };

  const executeUnitUpdate = async (sensor: LoraSensor, newUnitId: string | null) => {
    setUpdatingUnitSensorId(sensor.id);

    try {
      debugLog.info('crud', 'UNIT_ASSIGNMENT_SAVE_REQUEST', {
        sensor_id: sensor.id,
        old_unit_id: sensor.unit_id,
        new_unit_id: newUnitId,
        site_id: sensor.site_id
      });

      await updateSensor.mutateAsync({
        id: sensor.id,
        updates: { unit_id: newUnitId }
      });

      debugLog.info('crud', 'UNIT_ASSIGNMENT_SAVE_SUCCESS', {
        sensor_id: sensor.id,
        new_unit_id: newUnitId
      });

      toast.success(newUnitId 
        ? `Sensor assigned to ${getUnitName(newUnitId)}`
        : 'Sensor unassigned from unit'
      );
    } catch (error) {
      debugLog.error('crud', 'UNIT_ASSIGNMENT_SAVE_ERROR', {
        sensor_id: sensor.id,
        error: String(error)
      });
      toast.error('Failed to update sensor unit');
    } finally {
      setUpdatingUnitSensorId(null);
      setConfirmUnitChange(null);
    }
  };

  const handleConfirmUnitChange = () => {
    if (confirmUnitChange) {
      executeUnitUpdate(confirmUnitChange.sensor, confirmUnitChange.newUnitId);
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
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleForceRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Force Refresh</p>
                {dataUpdatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last: {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
            {canEdit && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sensor
              </Button>
            )}
          </div>
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
                      Unit
                      <ColumnHeaderTooltip content={SENSOR_COLUMN_TOOLTIPS.unit} />
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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{sensor.name}</span>
                        {!sensor.app_key && !sensor.ttn_device_id && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                No Keys
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium">Missing OTAA Credentials</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This sensor needs AppKey for TTN provisioning. Edit the sensor to add credentials.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!sensor.site_id && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-xs">
                                Unassigned
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Sensor not assigned to a site. Assign it to start monitoring.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSensorTypeIcon(sensor.sensor_type)}
                        <span>{getSensorTypeLabel(sensor.sensor_type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <SensorSiteSelector
                          sensor={sensor}
                          sites={sites}
                          getSiteName={getSiteName}
                          onSiteChange={handleSiteChange}
                          isUpdating={updatingSensorId === sensor.id}
                        />
                      ) : (
                        getSiteName(sensor.site_id) || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <SensorUnitSelector
                          sensor={sensor}
                          units={units}
                          getUnitName={getUnitName}
                          onUnitChange={handleUnitChange}
                          isUpdating={updatingUnitSensorId === sensor.id}
                        />
                      ) : (
                        getUnitName(sensor.unit_id) || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadgeWithTooltip status={getEffectiveStatus(sensor)} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastUplink(sensor.last_seen_at, sensor.status)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ProvisionButton
                            sensor={sensor}
                            ttnConfig={ttnConfig}
                            isProvisioning={provisionSensor.isProvisioning(sensor.id)}
                            onProvision={() => handleProvision(sensor)}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewRawSensor(sensor)}
                              >
                                <Code className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Raw JSON</TooltipContent>
                          </Tooltip>
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
              Add your first LoRa sensor to start monitoring.
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

        {/* Unit Change Confirmation Dialog */}
        <AlertDialog 
          open={!!confirmUnitChange} 
          onOpenChange={(open) => !open && setConfirmUnitChange(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change Sensor Unit?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This sensor is currently monitoring <strong>{confirmUnitChange?.currentUnitName}</strong>.
                </p>
                <p>
                  {confirmUnitChange?.newUnitId 
                    ? <>Moving it to <strong>{confirmUnitChange?.newUnitName}</strong> will change what equipment it monitors.</>
                    : <>Unassigning it will stop temperature tracking for this unit.</>
                  }
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updatingUnitSensorId !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmUnitChange}
                disabled={updatingUnitSensorId !== null}
              >
                {updatingUnitSensorId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {confirmUnitChange?.newUnitId ? "Move Sensor" : "Unassign Sensor"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Raw Sensor JSON Dialog */}
        <Dialog open={!!viewRawSensor} onOpenChange={(open) => !open && setViewRawSensor(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Raw Sensor Data: {viewRawSensor?.name}</DialogTitle>
              <DialogDescription>
                Full sensor record from database. Useful for debugging sync issues.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[60vh] rounded-md bg-muted p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {viewRawSensor && JSON.stringify(viewRawSensor, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (viewRawSensor) {
                    navigator.clipboard.writeText(JSON.stringify(viewRawSensor, null, 2));
                    toast.success("Sensor JSON copied to clipboard");
                  }
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy JSON
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
