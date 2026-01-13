import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEntityDashboardUrl } from "@/hooks/useEntityDashboardUrl";
import DashboardLayout from "@/components/DashboardLayout";
import { HierarchyBreadcrumb, BreadcrumbSibling } from "@/components/HierarchyBreadcrumb";
import { SiteComplianceSettings } from "@/components/site/SiteComplianceSettings";
import { SiteGatewaysCard } from "@/components/site/SiteGatewaysCard";
import { AlertRulesEditor } from "@/components/settings/AlertRulesEditor";
import { AlertRulesHistoryModal } from "@/components/settings/AlertRulesHistoryModal";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useSiteAlertRules, useOrgAlertRules } from "@/hooks/useAlertRules";
import { usePermissions } from "@/hooks/useUserRole";
import { softDeleteSite } from "@/hooks/useSoftDelete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  History,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";

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
  timezone: string;
  compliance_mode: string;
  manual_log_cadence_seconds: number;
  corrective_action_required: boolean;
  organization_id: string;
}

const SiteDetail = () => {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { layoutKey } = useEntityDashboardUrl(); // Read layout from route (defaults to "default")
  const { canDeleteEntities, isLoading: permissionsLoading } = usePermissions();
  const [session, setSession] = useState<Session | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [siblingSites, setSiblingSites] = useState<BreadcrumbSibling[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
  const [alertHistoryOpen, setAlertHistoryOpen] = useState(false);

  // Alert rules
  const { data: siteRules, refetch: refetchSiteRules } = useSiteAlertRules(siteId || null);
  const { data: orgRules } = useOrgAlertRules(site?.organization_id || null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  useEffect(() => {
    if (siteId) {
      loadSiteData();
    }
  }, [siteId]);

  const loadSiteData = async () => {
    setIsLoading(true);
    
    // Load site with compliance fields
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .select("id, name, address, city, state, postal_code, timezone, compliance_mode, manual_log_cadence_seconds, corrective_action_required, organization_id")
      .eq("id", siteId)
      .maybeSingle();

    if (siteError || !siteData) {
      console.error("Error loading site:", siteError);
      toast({ title: "Failed to load site", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setSite({
      ...siteData,
      organization_id: siteData.organization_id,
      timezone: siteData.timezone || "America/New_York",
      compliance_mode: siteData.compliance_mode || "fda_food_code",
      manual_log_cadence_seconds: siteData.manual_log_cadence_seconds || 14400,
      corrective_action_required: siteData.corrective_action_required ?? true,
    });
    setEditFormData({
      name: siteData.name,
      address: siteData.address || "",
      city: siteData.city || "",
      state: siteData.state || "",
      postal_code: siteData.postal_code || "",
    });

    // Load sibling sites for breadcrumb dropdown (only active)
    const { data: siblingsData } = await supabase
      .from("sites")
      .select("id, name")
      .eq("organization_id", siteData.organization_id)
      .eq("is_active", true)
      .neq("id", siteId)
      .order("name");

    if (siblingsData) {
      setSiblingSites(siblingsData.map(s => ({
        id: s.id,
        name: s.name,
        href: `/sites/${s.id}`,
      })));
    }

    // Load areas with unit counts (only active)
    const { data: areasData, error: areasError } = await supabase
      .from("areas")
      .select(`
        id,
        name,
        description,
        units (id)
      `)
      .eq("site_id", siteId)
      .eq("is_active", true)
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
      setTotalUnits(formatted.reduce((sum, area) => sum + area.unitsCount, 0));
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
      // Ensure fresh session token before invoking edge function
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast({ title: "Session expired. Please sign in again.", variant: "destructive" });
        navigate("/auth");
        return;
      }

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

  const handleDeleteSite = async () => {
    if (!session?.user?.id || !siteId || !site) return;
    const result = await softDeleteSite(siteId, session.user.id, true);
    if (result.success) {
      navigate('/sites');
    }
  };

  const formatAddress = () => {
    const parts = [site?.address, site?.city, site?.state, site?.postal_code].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "No address set";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!site) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Site not found</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <HierarchyBreadcrumb
        items={[
          { label: "All Equipment", href: "/sites" },
          { label: site.name, isCurrentPage: true, siblings: siblingSites },
        ]}
        actions={
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
                  Daily Log (7 days)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("exceptions")}>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Exceptions (7 days)
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
            {canDeleteEntities && !permissionsLoading && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        }
      />
      <div className="space-y-4">
        {/* Site Header Card - simplified since breadcrumb has the name */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl sm:text-2xl truncate">{site.name}</CardTitle>
                <CardDescription className="truncate">{formatAddress()}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{areas.length}</p>
                  <p className="text-xs text-muted-foreground">Areas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUnits}</p>
                  <p className="text-xs text-muted-foreground">Units</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium truncate">{site.timezone}</p>
                  <p className="text-xs text-muted-foreground">Timezone</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gateways Section */}
        <SiteGatewaysCard
          siteId={site.id}
          siteName={site.name}
          organizationId={site.organization_id}
        />

        {/* Compliance Settings Section */}
        <SiteComplianceSettings
          siteId={site.id}
          siteName={site.name}
          timezone={site.timezone}
          complianceMode={site.compliance_mode}
          manualLogCadenceSeconds={site.manual_log_cadence_seconds}
          correctiveActionRequired={site.corrective_action_required}
          onSettingsUpdated={loadSiteData}
        />

        {/* Areas Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Areas</CardTitle>
                <CardDescription>Organize units by location within this site</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
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
                      >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Area
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {areas.length > 0 ? (
              <div className="space-y-2">
                {areas.map((area) => (
                  <Link key={area.id} to={`/sites/${siteId}/areas/${area.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground truncate">{area.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {area.description || "No description"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Thermometer className="w-4 h-4" />
                          <span>{area.unitsCount}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No Areas Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  Create areas within this site to organize your refrigeration units.
                </p>
                <Button 
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Area
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {site && (
          <DeleteConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            entityName={site.name}
            entityType="site"
            onConfirm={handleDeleteSite}
            hasChildren={areas.length > 0}
            childrenCount={areas.length + totalUnits}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SiteDetail;
