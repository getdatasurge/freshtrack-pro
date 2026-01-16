import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  MapPin, 
  ChevronRight, 
  Building2,
  Loader2,
  Thermometer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Site {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  areasCount: number;
  unitsCount: number;
}

const Sites = () => {
  const { toast } = useToast();
  const { effectiveOrgId, isInitialized, isImpersonating } = useEffectiveIdentity();
  const { isSupportModeActive } = useSuperAdmin();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug logging for impersonation context
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Sites] Context state:', {
        isInitialized,
        effectiveOrgId,
        isSupportModeActive,
        isImpersonating,
      });
    }
  }, [isInitialized, effectiveOrgId, isSupportModeActive, isImpersonating]);

  useEffect(() => {
    // Guard: In support mode, wait until we have a valid effectiveOrgId
    // This prevents showing "No sites" before impersonation context loads
    if (isSupportModeActive && !effectiveOrgId && isInitialized) {
      // Still waiting for impersonation context - stay in loading state
      return;
    }
    
    if (isInitialized && effectiveOrgId) {
      loadSites();
    } else if (isInitialized && !effectiveOrgId && !isSupportModeActive) {
      // Only show empty state for non-support mode with no org
      setSites([]);
      setIsLoading(false);
    }
  }, [isInitialized, effectiveOrgId, isSupportModeActive]);

  const loadSites = async () => {
    if (!effectiveOrgId) return;
    
    setIsLoading(true);
    const { data: sitesData, error } = await supabase
      .from("sites")
      .select(`
        id,
        name,
        address,
        city,
        state,
        is_active,
        areas (
          id,
          units (id)
        )
      `)
      .eq("organization_id", effectiveOrgId)
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error loading sites:", error);
      toast({ title: "Failed to load sites", variant: "destructive" });
    } else {
      const formatted = (sitesData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        is_active: s.is_active,
        areasCount: s.areas?.length || 0,
        unitsCount: s.areas?.reduce((acc: number, a: any) => acc + (a.units?.length || 0), 0) || 0,
      }));
      setSites(formatted);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Site name is required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase.rpc("create_site_for_org", {
      p_name: formData.name,
      p_address: formData.address || null,
      p_city: formData.city || null,
      p_state: formData.state || null,
      p_postal_code: formData.postal_code || null,
    });

    if (error) {
      console.error("Error creating site:", error);
      toast({ title: "Failed to create site", variant: "destructive" });
    } else {
      toast({ title: "Site created successfully" });
      setFormData({ name: "", address: "", city: "", state: "", postal_code: "" });
      setDialogOpen(false);
      loadSites();
    }
    setIsSubmitting(false);
  };

  return (
    <DashboardLayout title="Sites">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Manage your locations and their refrigeration units</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Site Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Downtown Restaurant"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="123 Main Street"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      placeholder="State"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input
                    id="postal"
                    placeholder="12345"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={isSubmitting}
                    className="bg-accent hover:bg-accent/90"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Site
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sites List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : sites.length > 0 ? (
          <div className="grid gap-4">
            {sites.map((site) => (
              <Link key={site.id} to={`/sites/${site.id}`}>
                <Card className="card-hover cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <MapPin className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{site.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {[site.city, site.state].filter(Boolean).join(", ") || "No address set"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            <span>{site.areasCount} areas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Thermometer className="w-4 h-4" />
                            <span>{site.unitsCount} units</span>
                          </div>
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
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Sites Yet</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Create your first site to start organizing your refrigeration monitoring.
              </p>
              <Button 
                onClick={() => setDialogOpen(true)}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Site
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Sites;
