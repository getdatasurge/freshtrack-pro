import { useState, useEffect } from "react";
import { useGateways, useDeleteGateway, useUpdateGateway, useProvisionGateway } from "@/hooks/useGateways";
import { useGatewayProvisioningPreflight } from "@/hooks/useGatewayProvisioningPreflight";
import { Gateway, GatewayStatus } from "@/types/ttn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Radio, Plus, Pencil, Trash2, Loader2, Info, MapPin, CloudUpload, CheckCircle2 } from "lucide-react";
import { AddGatewayDialog } from "./AddGatewayDialog";
import { EditGatewayDialog } from "./EditGatewayDialog";
import { TTNGatewayPreflightBanner } from "./TTNGatewayPreflightBanner";
import { GATEWAY_STATUS_CONFIG, GATEWAY_COLUMN_TOOLTIPS } from "@/lib/entityStatusConfig";
import { cn } from "@/lib/utils";
import { debugLog } from "@/lib/debugLogger";
import { canProvisionGateway } from "@/lib/actions";
import { useTTNConfig } from "@/contexts/TTNConfigContext";
import { TTNConfigSourceBadge } from "@/components/ttn/TTNConfigSourceBadge";
import { checkTTNOperationAllowed } from "@/lib/ttn/guards";

interface Site {
  id: string;
  name: string;
}

interface TTNConfig {
  isEnabled: boolean;
  hasApiKey: boolean;
  applicationId: string | null;
  apiKeyLast4?: string | null;
  region?: string | null;
}

interface GatewayManagerProps {
  organizationId: string;
  sites: Site[];
  canEdit: boolean;
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
const GatewayStatusBadgeWithTooltip = ({ 
  status, 
  siteName 
}: { 
  status: GatewayStatus; 
  siteName: string | null;
}) => {
  const statusConfig = GATEWAY_STATUS_CONFIG[status] || GATEWAY_STATUS_CONFIG.pending;
  
  // Special case for pending with linked site
  if (status === "pending" && siteName) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-primary/15 text-primary border-primary/30 cursor-help max-w-[160px] truncate">
            Linked to {siteName}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <div className="space-y-1.5 text-sm">
            <p><span className="font-medium">Status:</span> Gateway is registered and linked to a site</p>
            <p><span className="font-medium">System:</span> Awaiting first connection to TTN network</p>
            <p className="text-primary"><span className="font-medium">Action:</span> Power on gateway and connect to network</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={cn("cursor-help", statusConfig.className)}>
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

// Gateway TTN Provision Button using centralized eligibility helper
interface GatewayProvisionButtonProps {
  gateway: Gateway & { ttn_gateway_id?: string | null; ttn_last_error?: string | null };
  ttnConfig?: TTNConfig | null;
  isProvisioning: boolean;
  onProvision: () => void;
}

const GatewayProvisionButton = ({
  gateway,
  ttnConfig,
  isProvisioning,
  onProvision,
}: GatewayProvisionButtonProps) => {
  // Already provisioned - show success badge
  if (gateway.ttn_gateway_id) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-safe border-safe/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Registered
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Registered in TTN as {gateway.ttn_gateway_id}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Has error from previous attempt - allow retry
  if (gateway.ttn_last_error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onProvision}
            disabled={isProvisioning}
            className="text-destructive"
          >
            {isProvisioning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium text-destructive">Previous attempt failed</p>
          <p className="text-sm">{gateway.ttn_last_error}</p>
          <p className="text-sm text-muted-foreground mt-1">Click to retry</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Use centralized eligibility helper
  const eligibility = canProvisionGateway(
    {
      gateway_eui: gateway.gateway_eui,
      ttn_gateway_id: gateway.ttn_gateway_id,
      status: gateway.status,
    },
    ttnConfig ? {
      isEnabled: ttnConfig.isEnabled,
      hasApiKey: ttnConfig.hasApiKey,
      applicationId: ttnConfig.applicationId,
    } : null
  );

  // TTN not configured - show disabled with reason
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

  // Other disabled reasons (permission denied, missing EUI, etc.)
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
      <span className="text-xs font-medium">Register</span>
    </Button>
  );
};

// Inline site selector for quick assignment
const GatewaySiteSelector = ({ 
  gateway, 
  sites,
  onSiteChange,
  isUpdating 
}: { 
  gateway: Gateway; 
  sites: Site[];
  onSiteChange: (gateway: Gateway, newSiteId: string | null, currentSiteName: string | null) => void;
  isUpdating: boolean;
}) => {
  const currentSite = sites.find(s => s.id === gateway.site_id);
  
  if (isUpdating) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Updating...</span>
      </div>
    );
  }
  
  // No sites available
  if (sites.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-sm cursor-help">
            No sites available
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Create a site first to assign gateways
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <Select
      value={gateway.site_id || "unassigned"}
      onValueChange={(value) => {
        const newSiteId = value === "unassigned" ? null : value;
        onSiteChange(gateway, newSiteId, currentSite?.name || null);
      }}
    >
      <SelectTrigger className={cn(
        "w-full min-w-[100px] max-w-[140px] h-8",
        !gateway.site_id && "text-muted-foreground border-dashed"
      )}>
        <SelectValue>
          {currentSite ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {currentSite.name}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Assign Site
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {gateway.site_id && (
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

export function GatewayManager({ organizationId, sites, canEdit, ttnConfig }: GatewayManagerProps) {
  const { data: gateways, isLoading } = useGateways(organizationId);
  const deleteGateway = useDeleteGateway();
  const updateGateway = useUpdateGateway();
  const provisionGateway = useProvisionGateway();
  
  // TTN Config Context for state awareness
  const { context: ttnContext } = useTTNConfig();
  const guardResult = checkTTNOperationAllowed('provision_gateway', ttnContext);
  
  // Gateway provisioning preflight check
  const preflight = useGatewayProvisioningPreflight(
    ttnConfig?.isEnabled && ttnConfig?.hasApiKey ? organizationId : null,
    { autoRun: true }
  );
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editGateway, setEditGateway] = useState<Gateway | null>(null);
  const [deleteGateway_, setDeleteGateway] = useState<Gateway | null>(null);
  
  // Site change confirmation state
  const [confirmSiteChange, setConfirmSiteChange] = useState<{
    gateway: Gateway;
    newSiteId: string | null;
    currentSiteName: string | null;
    newSiteName: string | null;
  } | null>(null);
  const [updatingGatewayId, setUpdatingGatewayId] = useState<string | null>(null);

  // Debug log TTN config state
  useEffect(() => {
    debugLog.info('ttn', 'TTN_CONFIG_STATE_GATEWAY_MANAGER', {
      isEnabled: ttnConfig?.isEnabled,
      hasApiKey: ttnConfig?.hasApiKey,
      applicationId: ttnConfig?.applicationId,
      apiKeyLast4: ttnConfig?.apiKeyLast4,
    });
  }, [ttnConfig]);

  const getSiteName = (siteId: string | null): string | null => {
    if (!siteId) return null;
    const site = sites.find(s => s.id === siteId);
    return site?.name || null;
  };

  const handleDelete = async () => {
    if (!deleteGateway_) return;
    await deleteGateway.mutateAsync({ 
      id: deleteGateway_.id, 
      orgId: organizationId 
    });
    setDeleteGateway(null);
  };

  const handleSiteChange = async (
    gateway: Gateway, 
    newSiteId: string | null, 
    currentSiteName: string | null
  ) => {
    const newSiteName = newSiteId ? getSiteName(newSiteId) : null;
    
    // If gateway already has a site and we're changing it, require confirmation
    if (gateway.site_id && newSiteId !== gateway.site_id) {
      setConfirmSiteChange({
        gateway,
        newSiteId,
        currentSiteName,
        newSiteName
      });
      return;
    }
    
    // Direct assignment for unassigned gateways or same site
    await executeSiteUpdate(gateway, newSiteId);
  };

  const executeSiteUpdate = async (gateway: Gateway, newSiteId: string | null) => {
    setUpdatingGatewayId(gateway.id);
    
    try {
      debugLog.crud('update', 'gateway', gateway.id, { 
        action: 'site_assignment',
        previousSite: gateway.site_id,
        newSite: newSiteId 
      });
      
      await updateGateway.mutateAsync({
        id: gateway.id,
        updates: { 
          site_id: newSiteId,
          // Reset to pending if site is being assigned/changed
          ...(newSiteId !== gateway.site_id && { status: 'pending' as const })
        }
      });
    } finally {
      setUpdatingGatewayId(null);
      setConfirmSiteChange(null);
    }
  };

  const handleConfirmSiteChange = async () => {
    if (!confirmSiteChange) return;
    await executeSiteUpdate(confirmSiteChange.gateway, confirmSiteChange.newSiteId);
  };

  const formatEUI = (eui: string): string => {
    // Format as XX:XX:XX:XX:XX:XX:XX:XX for readability
    return eui.toUpperCase().match(/.{2}/g)?.join(":") || eui.toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                LoRaWAN Gateways
              </CardTitle>
              <CardDescription>
                Manage your LoRaWAN gateways for wireless sensor connectivity
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Gateway
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gateway Provisioning Preflight Banner */}
          {ttnConfig?.isEnabled && ttnConfig?.hasApiKey && preflight.status !== "idle" && (
            <TTNGatewayPreflightBanner
              status={preflight.status}
              keyType={preflight.keyType}
              ownerScope={preflight.ownerScope}
              hasGatewayRights={preflight.hasGatewayRights}
              missingRights={preflight.missingRights}
              error={preflight.error}
              onRunPreflight={preflight.runPreflight}
              isLoading={preflight.isLoading}
              requestId={preflight.result?.request_id}
              ttnRegion={ttnConfig.region || "nam1"}
            />
          )}
          {gateways && gateways.length > 0 ? (
            <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Name
                      <ColumnHeaderTooltip content={GATEWAY_COLUMN_TOOLTIPS.name} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <span className="inline-flex items-center">
                      Gateway EUI
                      <ColumnHeaderTooltip content={GATEWAY_COLUMN_TOOLTIPS.gatewayEui} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Site
                      <ColumnHeaderTooltip content={GATEWAY_COLUMN_TOOLTIPS.site} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <span className="inline-flex items-center">
                      Status
                      <ColumnHeaderTooltip content={GATEWAY_COLUMN_TOOLTIPS.status} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center">
                      Actions
                      <ColumnHeaderTooltip content="TTN registration status and edit actions" />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gateways.map((gateway) => {
                  const siteName = getSiteName(gateway.site_id);
                  return (
                    <TableRow key={gateway.id}>
                      <TableCell className="font-medium py-3">{gateway.name}</TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-sm">
                        {formatEUI(gateway.gateway_eui)}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <GatewaySiteSelector
                            gateway={gateway}
                            sites={sites}
                            onSiteChange={handleSiteChange}
                            isUpdating={updatingGatewayId === gateway.id}
                          />
                        ) : (
                          siteName || <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <GatewayStatusBadgeWithTooltip 
                          status={gateway.status} 
                          siteName={siteName} 
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-2">
                          {/* TTN status */}
                          <GatewayProvisionButton
                            gateway={gateway as Gateway & { ttn_gateway_id?: string | null; ttn_last_error?: string | null }}
                            ttnConfig={ttnConfig}
                            isProvisioning={provisionGateway.isProvisioning(gateway.id)}
                            onProvision={() => provisionGateway.mutate({ 
                              gatewayId: gateway.id, 
                              organizationId 
                            })}
                          />
                          {/* Edit actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditGateway(gateway)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setDeleteGateway(gateway)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No gateways registered</p>
              <p className="text-sm mt-1">
                Add a LoRaWAN gateway to start receiving sensor data wirelessly
              </p>
              {canEdit && (
                <Button 
                  onClick={() => setAddDialogOpen(true)} 
                  className="mt-4 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Gateway
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddGatewayDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        organizationId={organizationId}
        sites={sites}
      />

      {editGateway && (
        <EditGatewayDialog
          open={!!editGateway}
          onOpenChange={(open) => !open && setEditGateway(null)}
          gateway={editGateway}
          sites={sites}
        />
      )}

      <AlertDialog open={!!deleteGateway_} onOpenChange={(open) => !open && setDeleteGateway(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteGateway_?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGateway.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
            <AlertDialogTitle>Change Gateway Site?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This gateway is currently assigned to <strong>{confirmSiteChange?.currentSiteName}</strong>.
              </p>
              <p>
                {confirmSiteChange?.newSiteId 
                  ? <>Moving it to <strong>{confirmSiteChange?.newSiteName}</strong> may affect sensor connectivity at the current location.</>
                  : <>Unassigning it will remove it from the current site.</>
                }
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingGatewayId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSiteChange}
              disabled={updatingGatewayId !== null}
            >
              {updatingGatewayId ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {confirmSiteChange?.newSiteId ? "Move Gateway" : "Unassign Gateway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
