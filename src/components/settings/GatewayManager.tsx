import { useState } from "react";
import { useGateways, useDeleteGateway } from "@/hooks/useGateways";
import { Gateway } from "@/types/ttn";
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
import { Radio, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { AddGatewayDialog } from "./AddGatewayDialog";
import { EditGatewayDialog } from "./EditGatewayDialog";

interface Site {
  id: string;
  name: string;
}

interface GatewayManagerProps {
  organizationId: string;
  sites: Site[];
  canEdit: boolean;
}

export function GatewayManager({ organizationId, sites, canEdit }: GatewayManagerProps) {
  const { data: gateways, isLoading } = useGateways(organizationId);
  const deleteGateway = useDeleteGateway();
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editGateway, setEditGateway] = useState<Gateway | null>(null);
  const [deleteGateway_, setDeleteGateway] = useState<Gateway | null>(null);

  const getSiteName = (siteId: string | null): string | null => {
    if (!siteId) return null;
    const site = sites.find(s => s.id === siteId);
    return site?.name || null;
  };

  const getStatusBadge = (gateway: Gateway) => {
    const siteName = getSiteName(gateway.site_id);
    
    if (gateway.status === "online") {
      return <Badge className="bg-safe/15 text-safe border-safe/30">Online</Badge>;
    }
    if (gateway.status === "offline") {
      return <Badge className="bg-warning/15 text-warning border-warning/30">Offline</Badge>;
    }
    if (gateway.status === "maintenance") {
      return <Badge className="bg-muted text-muted-foreground border-border">Maintenance</Badge>;
    }
    // pending status
    if (siteName) {
      return <Badge className="bg-primary/15 text-primary border-primary/30">Linked to {siteName}</Badge>;
    }
    return <Badge variant="secondary">Registered</Badge>;
  };

  const handleDelete = async () => {
    if (!deleteGateway_) return;
    await deleteGateway.mutateAsync({ 
      id: deleteGateway_.id, 
      orgId: organizationId 
    });
    setDeleteGateway(null);
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
    <>
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
        <CardContent>
          {gateways && gateways.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gateway EUI</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gateways.map((gateway) => (
                  <TableRow key={gateway.id}>
                    <TableCell className="font-medium">{gateway.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatEUI(gateway.gateway_eui)}
                    </TableCell>
                    <TableCell>
                      {getSiteName(gateway.site_id) || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(gateway)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditGateway(gateway)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteGateway(gateway)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </>
  );
}
