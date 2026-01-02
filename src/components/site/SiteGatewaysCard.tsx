import { useState } from "react";
import { useGateways, useUpdateGateway, useDeleteGateway } from "@/hooks/useGateways";
import { AddGatewayDialog } from "@/components/settings/AddGatewayDialog";
import { AssignGatewayDialog } from "@/components/settings/AssignGatewayDialog";
import { EditGatewayDialog } from "@/components/settings/EditGatewayDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, Radio, MoreHorizontal, Pencil, Unlink, Trash2, Loader2, Info } from "lucide-react";
import { Gateway } from "@/types/ttn";

interface SiteGatewaysCardProps {
  siteId: string;
  siteName: string;
  organizationId: string;
}

export function SiteGatewaysCard({ siteId, siteName, organizationId }: SiteGatewaysCardProps) {
  const { data: allGateways = [], isLoading } = useGateways(organizationId);
  const updateGateway = useUpdateGateway();
  const deleteGateway = useDeleteGateway();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editGateway, setEditGateway] = useState<Gateway | null>(null);
  const [deleteGatewayData, setDeleteGatewayData] = useState<Gateway | null>(null);
  const [unassignGateway, setUnassignGateway] = useState<Gateway | null>(null);

  // Filter gateways assigned to this site
  const siteGateways = allGateways.filter(g => g.site_id === siteId);
  // Gateways available for assignment (not assigned to any site)
  const unassignedGateways = allGateways.filter(g => !g.site_id);

  const formatEUI = (eui: string) => {
    return eui.match(/.{1,2}/g)?.join(":") || eui;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">Online</Badge>;
      case "offline":
        return <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20">Offline</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleUnassign = async () => {
    if (!unassignGateway) return;
    await updateGateway.mutateAsync({
      id: unassignGateway.id,
      updates: { site_id: null, status: "pending" },
    });
    setUnassignGateway(null);
  };

  const handleDelete = async () => {
    if (!deleteGatewayData) return;
    await deleteGateway.mutateAsync({
      id: deleteGatewayData.id,
      orgId: organizationId,
    });
    setDeleteGatewayData(null);
  };

  // Sites list for dialogs (just this site for add dialog)
  const sites = [{ id: siteId, name: siteName }];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gateways</CardTitle>
        </CardHeader>
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
            <div>
              <CardTitle className="text-lg">Gateways</CardTitle>
              <CardDescription>LoRaWAN gateways assigned to this site</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Gateway
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Register new gateway
                </DropdownMenuItem>
                {unassignedGateways.length > 0 && (
                  <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                    <Radio className="w-4 h-4 mr-2" />
                    Assign existing gateway
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Unassigned gateways banner */}
          {unassignedGateways.length > 0 && siteGateways.length === 0 && (
            <div className="flex items-center gap-3 p-3 mb-4 rounded-lg border border-primary/20 bg-primary/5">
              <Info className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm text-foreground flex-1">
                <span className="font-medium">{unassignedGateways.length}</span> unassigned gateway{unassignedGateways.length > 1 ? 's' : ''} available from sync
              </p>
              <Button size="sm" variant="outline" onClick={() => setAssignDialogOpen(true)}>
                Assign Now
              </Button>
            </div>
          )}
          
          {siteGateways.length > 0 ? (
            <>
              {/* Show banner above gateways if there are more unassigned ones */}
              {unassignedGateways.length > 0 && (
                <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  <span>{unassignedGateways.length} more unassigned gateway{unassignedGateways.length > 1 ? 's' : ''} available</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto" onClick={() => setAssignDialogOpen(true)}>
                    Assign
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {siteGateways.map((gateway) => (
                  <div
                    key={gateway.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                        <Radio className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground truncate">{gateway.name}</h3>
                          {getStatusBadge(gateway.status)}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono truncate">
                          {formatEUI(gateway.gateway_eui)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditGateway(gateway)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUnassignGateway(gateway)}>
                          <Unlink className="w-4 h-4 mr-2" />
                          Unassign from site
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteGatewayData(gateway)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </>
          ) : !unassignedGateways.length && (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg">
              <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                <Radio className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No Gateways</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Add LoRaWAN gateways to receive sensor data at this site.
              </p>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Gateway
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Gateway Dialog */}
      <AddGatewayDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        organizationId={organizationId}
        sites={sites}
        defaultSiteId={siteId}
      />

      {/* Assign Gateway Dialog */}
      <AssignGatewayDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        siteId={siteId}
        siteName={siteName}
        unassignedGateways={unassignedGateways}
      />

      {/* Edit Gateway Dialog */}
      {editGateway && (
        <EditGatewayDialog
          open={!!editGateway}
          onOpenChange={(open) => !open && setEditGateway(null)}
          gateway={editGateway}
          sites={sites}
        />
      )}

      {/* Unassign Confirmation */}
      <AlertDialog open={!!unassignGateway} onOpenChange={(open) => !open && setUnassignGateway(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{unassignGateway?.name}" from {siteName}. The gateway will still be available to assign to other sites.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnassign}>Unassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteGatewayData} onOpenChange={(open) => !open && setDeleteGatewayData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteGatewayData?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
