import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { usePermissions } from "@/hooks/useUserRole";
import { DeleteConfirmationDialog, DeleteEntityType } from "@/components/ui/delete-confirmation-dialog";
import {
  restoreUnit,
  restoreArea,
  restoreSite,
  restoreDevice,
  restoreSensor,
  permanentlyDeleteUnit,
  permanentlyDeleteArea,
  permanentlyDeleteSite,
} from "@/hooks/useSoftDelete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  RotateCcw,
  Trash2,
  MoreHorizontal,
  Building2,
  LayoutGrid,
  Thermometer,
  Wifi,
  RefreshCw,
  Radio,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface DeletedItem {
  id: string;
  name: string;
  entityType: DeleteEntityType;
  deletedAt: string;
  deletedBy: string | null;
  deletedByName: string | null;
  parentPath: string;
}

const entityTypeIcons: Record<DeleteEntityType, React.ReactNode> = {
  site: <Building2 className="h-4 w-4" />,
  area: <LayoutGrid className="h-4 w-4" />,
  unit: <Thermometer className="h-4 w-4" />,
  device: <Wifi className="h-4 w-4" />,
  sensor: <Radio className="h-4 w-4" />,
};

const entityTypeLabels: Record<DeleteEntityType, string> = {
  site: "Site",
  area: "Area",
  unit: "Unit",
  device: "Device",
  sensor: "Sensor",
};

const RecentlyDeleted = () => {
  const navigate = useNavigate();
  const { canRestoreEntities, canPermanentlyDelete, isLoading: permissionsLoading } = usePermissions();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | DeleteEntityType>("all");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DeletedItem | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadDeletedItems();
    loadUserId();
  }, []);

  useEffect(() => {
    if (!permissionsLoading && !canRestoreEntities) {
      navigate("/dashboard");
    }
  }, [permissionsLoading, canRestoreEntities, navigate]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadDeletedItems = async () => {
    setIsLoading(true);
    const allItems: DeletedItem[] = [];

    try {
      // Load deleted sites
      const { data: sites } = await supabase
        .from("sites")
        .select("id, name, deleted_at, deleted_by")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (sites) {
        for (const site of sites) {
          allItems.push({
            id: site.id,
            name: site.name,
            entityType: "site",
            deletedAt: site.deleted_at!,
            deletedBy: site.deleted_by,
            deletedByName: null, // Will be loaded separately if needed
            parentPath: "",
          });
        }
      }

      // Load deleted areas
      const { data: areas } = await supabase
        .from("areas")
        .select("id, name, deleted_at, deleted_by, site:sites(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (areas) {
        for (const area of areas) {
          allItems.push({
            id: area.id,
            name: area.name,
            entityType: "area",
            deletedAt: area.deleted_at!,
            deletedBy: area.deleted_by,
            deletedByName: null,
            parentPath: area.site?.name || "Unknown Site",
          });
        }
      }

      // Load deleted units
      const { data: units } = await supabase
        .from("units")
        .select("id, name, deleted_at, deleted_by, area:areas(name, site:sites(name))")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (units) {
        for (const unit of units) {
          const siteName = unit.area?.site?.name || "Unknown Site";
          const areaName = unit.area?.name || "Unknown Area";
          allItems.push({
            id: unit.id,
            name: unit.name,
            entityType: "unit",
            deletedAt: unit.deleted_at!,
            deletedBy: unit.deleted_by,
            deletedByName: null,
            parentPath: `${siteName} > ${areaName}`,
          });
        }
      }

      // Load deleted devices
      const { data: devices } = await supabase
        .from("devices")
        .select("id, serial_number, deleted_at, deleted_by, unit:units(name, area:areas(name, site:sites(name)))")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (devices) {
        for (const device of devices) {
          const siteName = device.unit?.area?.site?.name || "Unknown";
          const areaName = device.unit?.area?.name || "Unknown";
          const unitName = device.unit?.name || "Unassigned";
          allItems.push({
            id: device.id,
            name: device.serial_number,
            entityType: "device",
            deletedAt: device.deleted_at!,
            deletedBy: device.deleted_by,
            deletedByName: null,
            parentPath: device.unit ? `${siteName} > ${areaName} > ${unitName}` : "Unassigned",
          });
        }
      }

      // Load deleted sensors
      const { data: sensors } = await supabase
        .from("lora_sensors")
        .select("id, name, deleted_at, deleted_by, site:sites(name), unit:units(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (sensors) {
        for (const sensor of sensors) {
          const siteName = sensor.site?.name || "";
          const unitName = sensor.unit?.name || "";
          allItems.push({
            id: sensor.id,
            name: sensor.name,
            entityType: "sensor",
            deletedAt: sensor.deleted_at!,
            deletedBy: sensor.deleted_by,
            deletedByName: null,
            parentPath: unitName ? `${siteName} > ${unitName}` : siteName || "Unassigned",
          });
        }
      }

      // Sort all items by deleted_at descending
      allItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

      setItems(allItems);
    } catch (error) {
      console.error("Failed to load deleted items:", error);
    }
    setIsLoading(false);
  };

  const handleRestore = async (item: DeletedItem) => {
    if (!userId) return;
    
    setIsRestoring(item.id);
    let result;

    switch (item.entityType) {
      case "unit":
        result = await restoreUnit(item.id, userId);
        break;
      case "area":
        result = await restoreArea(item.id, userId);
        break;
      case "site":
        result = await restoreSite(item.id, userId);
        break;
      case "device":
        result = await restoreDevice(item.id, userId);
        break;
      case "sensor":
        result = await restoreSensor(item.id, userId);
        break;
    }

    if (result.success) {
      setItems(items.filter(i => i.id !== item.id));
    }
    setIsRestoring(null);
  };

  const handlePermanentDelete = async () => {
    if (!selectedItem || !userId) return;

    let result;
    switch (selectedItem.entityType) {
      case "unit":
        result = await permanentlyDeleteUnit(selectedItem.id, userId);
        break;
      case "area":
        result = await permanentlyDeleteArea(selectedItem.id, userId);
        break;
      case "site":
        result = await permanentlyDeleteSite(selectedItem.id, userId);
        break;
      default:
        return;
    }

    if (result.success) {
      setItems(items.filter(i => i.id !== selectedItem.id));
    }
    setDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  const filteredItems = activeTab === "all" 
    ? items 
    : items.filter(item => item.entityType === activeTab);

  if (permissionsLoading || isLoading) {
    return (
      <DashboardLayout title="Recently Deleted">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Recently Deleted">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Recently Deleted
            </CardTitle>
            <CardDescription>
              View and restore deleted sites, areas, units, and devices. Items can be permanently deleted if needed.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadDeletedItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({items.length})</TabsTrigger>
              <TabsTrigger value="site">Sites ({items.filter(i => i.entityType === "site").length})</TabsTrigger>
              <TabsTrigger value="area">Areas ({items.filter(i => i.entityType === "area").length})</TabsTrigger>
              <TabsTrigger value="unit">Units ({items.filter(i => i.entityType === "unit").length})</TabsTrigger>
              <TabsTrigger value="device">Devices ({items.filter(i => i.entityType === "device").length})</TabsTrigger>
              <TabsTrigger value="sensor">Sensors ({items.filter(i => i.entityType === "sensor").length})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No deleted items found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={`${item.entityType}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {entityTypeIcons[item.entityType]}
                            {entityTypeLabels[item.entityType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.parentPath || "—"}
                        </TableCell>
                        <TableCell>
                          <span 
                            className="text-sm" 
                            title={format(new Date(item.deletedAt), "PPpp")}
                          >
                            {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRestore(item)}
                                disabled={isRestoring === item.id}
                              >
                                {isRestoring === item.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                )}
                                Restore
                              </DropdownMenuItem>
                                {canPermanentlyDelete && item.entityType !== "device" && item.entityType !== "sensor" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Permanently
                                    </DropdownMenuItem>
                                  </>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedItem && (
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          entityName={selectedItem.name}
          entityType={selectedItem.entityType}
          onConfirm={handlePermanentDelete}
          isPermanent
        />
      )}
    </DashboardLayout>
  );
};

export default RecentlyDeleted;
