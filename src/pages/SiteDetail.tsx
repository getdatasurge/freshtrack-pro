import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  ChevronRight, 
  Building2,
  Loader2,
  Thermometer,
  MapPin,
  Pencil,
  Download,
  AlertTriangle,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Area {
  id: string;
  name: string;
  description: string | null;
  unitsCount: number;
}

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

const SiteDetail = () => {
  const { siteId } = useParams();
  const { toast } = useToast();
  const [site, setSite] = useState<SiteData | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [editFormData, setEditFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (siteId) {
      loadSiteData();
    }
  }, [siteId]);

  const loadSiteData = async () => {
    setIsLoading(true);
    
    // Load site
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .select("id, name, address, city, state, postal_code")
      .eq("id", siteId)
      .maybeSingle();

    if (siteError || !siteData) {
      console.error("Error loading site:", siteError);
      toast({ title: "Failed to load site", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setSite(siteData);
    setEditFormData({
      name: siteData.name,
      address: siteData.address || "",
      city: siteData.city || "",
      state: siteData.state || "",
      postal_code: siteData.postal_code || "",
    });

    // Load areas with unit counts
    const { data: areasData, error: areasError } = await supabase
      .from("areas")
      .select(`
        id,
        name,
        description,
        units (id)
      `)
      .eq("site_id", siteId)
      .order("sort_order");

    if (areasError) {
      console.error("Error loading areas:", areasError);
    } else {
      const formatted = (areasData || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        unitsCount: a.units?.length || 0,
      }));
      setAreas(formatted);
    }

    setIsLoading(false);
  };

  const handleCreateArea = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Area name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.rpc("create_area_for_site", {
      p_site_id: siteId!,
      p_name: formData.name,
      p_description: formData.description || null,
    });

    if (error) {
      console.error("Error creating area:", error);
      toast({ title: "Failed to create area", variant: "destructive" });
    } else {
      toast({ title: "Area created successfully" });
      setFormData({ name: "", description: "" });
      setDialogOpen(false);
      loadSiteData();
    }
    setIsSubmitting(false);
  };

  const handleUpdateSite = async () => {
    if (!editFormData.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from("sites")
      .update({
        name: editFormData.name,
        address: editFormData.address || null,
        city: editFormData.city || null,
        state: editFormData.state || null,
        postal_code: editFormData.postal_code || null,
      })
      .eq("id", siteId);

    if (error) {
      console.error("Error updating site:", error);
      toast({ title: "Failed to update site", variant: "destructive" });
    } else {
      toast({ title: "Site updated successfully" });
      setEditDialogOpen(false);
      loadSiteData();
    }
    setIsSubmitting(false);
  };

  const handleExport = async (reportType: "daily" | "exceptions") => {
    if (!siteId) return;
    setIsExporting(true);

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      const { data, error } = await supabase.functions.invoke("export-temperature-logs", {
        body: {
          site_id: siteId,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          report_type: reportType,
        },
      });

      if (error) throw error;

      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frostguard-site-${reportType}-${site?.name?.replace(/\s+/g, "_") || "export"}-${startDate.toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: `${reportType === "daily" ? "Daily" : "Exception"} report exported` });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Export failed", variant: "destructive" });
    }
    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!site) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Site not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout showBack backHref="/sites">
      <div className="space-y-6">
        {/* Site Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{site.name}</h1>
              <p className="text-muted-foreground">
                {[site.address, site.city, site.state, site.postal_code].filter(Boolean).join(", ") || "No address set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("daily")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Daily Temperature Log (7 days)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("exceptions")}>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Exception Report (7 days)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Site Name *</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-state">State</Label>
                    <Input
                      id="edit-state"
                      value={editFormData.state}
                      onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-postal">Postal Code</Label>
                  <Input
                    id="edit-postal"
                    value={editFormData.postal_code}
                    onChange={(e) => setEditFormData({ ...editFormData, postal_code: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateSite} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Areas Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Areas</h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Area
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Area</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="area-name">Area Name *</Label>
                    <Input
                      id="area-name"
                      placeholder="e.g., Main Kitchen"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area-desc">Description</Label>
                    <Textarea
                      id="area-desc"
                      placeholder="Optional description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateArea} 
                      disabled={isSubmitting}
                      className="bg-accent hover:bg-accent/90"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Area
                    </Button>
                  </div>
                </div>
            </DialogContent>
          </Dialog>
          </div>
          </div>

          {areas.length > 0 ? (
            <div className="grid gap-4">
              {areas.map((area) => (
                <Link key={area.id} to={`/sites/${siteId}/areas/${area.id}`}>
                  <Card className="card-hover cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-secondary-foreground" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">{area.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {area.description || "No description"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Thermometer className="w-4 h-4" />
                            <span>{area.unitsCount} units</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                  <Building2 className="w-7 h-7 text-secondary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Areas Yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Create areas within this site to organize your refrigeration units.
                </p>
                <Button 
                  onClick={() => setDialogOpen(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Area
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SiteDetail;
