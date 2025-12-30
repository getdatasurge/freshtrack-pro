import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Thermometer, 
  Building2, 
  MapPin, 
  LayoutGrid, 
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  organizationNameSchema,
  organizationSlugSchema,
  siteNameSchema,
  addressSchema,
  citySchema,
  stateSchema,
  postalCodeSchema,
  areaNameSchema,
  areaDescriptionSchema,
  unitNameSchema,
  validateInput,
} from "@/lib/validation";

type Step = "organization" | "site" | "area" | "unit" | "complete";

interface OnboardingData {
  organization: {
    name: string;
    slug: string;
    timezone: string;
  };
  site: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
  };
  area: {
    name: string;
    description: string;
  };
  unit: {
    name: string;
    type: string;
  };
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

const unitTypes = [
  { value: "fridge", label: "Refrigerator", tempLimit: "41°F" },
  { value: "freezer", label: "Freezer", tempLimit: "0°F" },
  { value: "walk_in_cooler", label: "Walk-in Cooler", tempLimit: "41°F" },
  { value: "walk_in_freezer", label: "Walk-in Freezer", tempLimit: "0°F" },
  { value: "display_case", label: "Display Case", tempLimit: "41°F" },
  { value: "blast_chiller", label: "Blast Chiller", tempLimit: "-10°F" },
];

const steps: { key: Step; title: string; icon: React.ElementType }[] = [
  { key: "organization", title: "Organization", icon: Building2 },
  { key: "site", title: "Site", icon: MapPin },
  { key: "area", title: "Area", icon: LayoutGrid },
  { key: "unit", title: "Unit", icon: Thermometer },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("organization");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);
  const [hasCheckedOrg, setHasCheckedOrg] = useState(false);
  const [createdIds, setCreatedIds] = useState<{
    orgId?: string;
    siteId?: string;
    areaId?: string;
    unitId?: string;
  }>({});

  const [data, setData] = useState<OnboardingData>({
    organization: { name: "", slug: "", timezone: "America/New_York" },
    site: { name: "", address: "", city: "", state: "", postalCode: "" },
    area: { name: "", description: "" },
    unit: { name: "", type: "fridge" },
  });

  // Check if user already has an organization - only once
  useEffect(() => {
    if (hasCheckedOrg) return;
    
    const checkExistingOrg = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth", { replace: true });
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle();

        setHasCheckedOrg(true);
        setIsCheckingOrg(false);

        // Only redirect if profile has an org - don't redirect on error
        if (!error && profile?.organization_id) {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("Error checking org:", err);
        setIsCheckingOrg(false);
        setHasCheckedOrg(true);
      }
    };
    checkExistingOrg();
  }, [navigate, hasCheckedOrg]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const updateData = <K extends keyof OnboardingData>(
    section: K,
    field: keyof OnboardingData[K],
    value: string
  ) => {
    setData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));

    // Auto-generate slug when org name changes
    if (section === "organization" && field === "name") {
      setData((prev) => ({
        ...prev,
        organization: { ...prev.organization, slug: generateSlug(value) },
      }));
    }
  };

  const handleCreateOrganization = async () => {
    // If org was already created, just move to next step
    if (createdIds.orgId) {
      setCurrentStep("site");
      return;
    }

    // Validate organization name
    const nameResult = validateInput(organizationNameSchema, data.organization.name);
    if (!nameResult.success) {
      toast({ title: (nameResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Validate slug if provided
    const slugToUse = data.organization.slug || generateSlug(data.organization.name);
    const slugResult = validateInput(organizationSlugSchema, slugToUse);
    if (!slugResult.success) {
      toast({ title: (slugResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: orgId, error } = await supabase.rpc("create_organization_with_owner", {
        p_name: (nameResult as { success: true; data: string }).data,
        p_slug: (slugResult as { success: true; data: string }).data,
        p_timezone: data.organization.timezone,
      });

      if (error) throw error;

      setCreatedIds((prev) => ({ ...prev, orgId }));
      toast({ title: "Organization created!" });
      setCurrentStep("site");
    } catch (error: any) {
      const errorMessage = error.message || "";
      
      if (errorMessage.includes("organizations_slug_key") || 
          errorMessage.includes("unique constraint")) {
        toast({ 
          title: "URL Already Taken", 
          description: "This organization name or URL slug already exists. Please choose a different name.", 
          variant: "destructive" 
        });
      } else if (errorMessage.includes("already belongs to an organization")) {
        toast({ 
          title: "Already Registered", 
          description: "Your account is already associated with an organization.", 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    }
    setIsLoading(false);
  };

  const handleCreateSite = async () => {
    // If site was already created, just move to next step
    if (createdIds.siteId) {
      setCurrentStep("area");
      return;
    }

    // Validate site name
    const nameResult = validateInput(siteNameSchema, data.site.name);
    if (!nameResult.success) {
      toast({ title: (nameResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Validate optional fields
    const addressResult = validateInput(addressSchema, data.site.address);
    const cityResult = validateInput(citySchema, data.site.city);
    const stateResult = validateInput(stateSchema, data.site.state);
    const postalResult = validateInput(postalCodeSchema, data.site.postalCode);

    if (!addressResult.success) {
      toast({ title: (addressResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }
    if (!cityResult.success) {
      toast({ title: (cityResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }
    if (!stateResult.success) {
      toast({ title: (stateResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }
    if (!postalResult.success) {
      toast({ title: (postalResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: siteId, error } = await supabase.rpc("create_site_for_org", {
        p_name: nameResult.data,
        p_address: addressResult.data || null,
        p_city: cityResult.data || null,
        p_state: stateResult.data || null,
        p_postal_code: postalResult.data || null,
      });

      if (error) throw error;

      setCreatedIds((prev) => ({ ...prev, siteId }));
      toast({ title: "Site created!" });
      setCurrentStep("area");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleCreateArea = async () => {
    // If area was already created, just move to next step
    if (createdIds.areaId) {
      setCurrentStep("unit");
      return;
    }

    // Validate area name
    const nameResult = validateInput(areaNameSchema, data.area.name);
    if (!nameResult.success) {
      toast({ title: (nameResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    // Validate description
    const descResult = validateInput(areaDescriptionSchema, data.area.description);
    if (!descResult.success) {
      toast({ title: (descResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: areaId, error } = await supabase.rpc("create_area_for_site", {
        p_site_id: createdIds.siteId,
        p_name: (nameResult as { success: true; data: string }).data,
        p_description: (descResult as { success: true; data: string | undefined }).data || null,
      });

      if (error) throw error;

      setCreatedIds((prev) => ({ ...prev, areaId }));
      toast({ title: "Area created!" });
      setCurrentStep("unit");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleCreateUnit = async () => {
    // If unit was already created, just move to complete
    if (createdIds.unitId) {
      setCurrentStep("complete");
      return;
    }

    // Validate unit name
    const nameResult = validateInput(unitNameSchema, data.unit.name);
    if (!nameResult.success) {
      toast({ title: (nameResult as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: unitId, error } = await supabase.rpc("create_unit_for_area", {
        p_area_id: createdIds.areaId,
        p_name: (nameResult as { success: true; data: string }).data,
        p_unit_type: data.unit.type as "fridge" | "freezer" | "walk_in_cooler" | "walk_in_freezer" | "display_case" | "blast_chiller",
      });

      if (error) throw error;

      setCreatedIds((prev) => ({ ...prev, unitId }));
      toast({ title: "Unit created!" });
      setCurrentStep("complete");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  // Show loading while checking org
  if (isCheckingOrg) {
    return (
      <div className="min-h-screen bg-gradient-frost flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-frost py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-foreground">FrostGuard</span>
        </div>

        {/* Progress Steps */}
        {currentStep !== "complete" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              const isComplete = i < currentStepIndex;

              return (
                <div key={step.key} className="flex items-center">
                  <div
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full transition-all
                      ${isComplete ? "bg-safe text-safe-foreground" : ""}
                      ${isActive ? "bg-accent text-accent-foreground" : ""}
                      ${!isActive && !isComplete ? "bg-muted text-muted-foreground" : ""}
                    `}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-8 h-0.5 mx-1 ${
                        isComplete ? "bg-safe" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Organization Step */}
            {currentStep === "organization" && (
              <Card className="shadow-lg">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="text-2xl">Create Your Organization</CardTitle>
                  <CardDescription>
                    Set up your company or business to get started with FrostGuard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name *</Label>
                    <Input
                      id="org-name"
                      placeholder="Acme Restaurants"
                      value={data.organization.name}
                      onChange={(e) => updateData("organization", "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">URL Slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">frostguard.app/</span>
                      <Input
                        id="org-slug"
                        placeholder="acme-restaurants"
                        value={data.organization.slug}
                        onChange={(e) => updateData("organization", "slug", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-timezone">Timezone</Label>
                    <Select
                      value={data.organization.timezone}
                      onValueChange={(v) => updateData("organization", "timezone", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreateOrganization}
                    className="w-full bg-accent hover:bg-accent/90"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Site Step */}
            {currentStep === "site" && (
              <Card className="shadow-lg">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="text-2xl">Add Your First Site</CardTitle>
                  <CardDescription>
                    A site represents a physical location like a restaurant or store.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site-name">Site Name *</Label>
                    <Input
                      id="site-name"
                      placeholder="Downtown Location"
                      value={data.site.name}
                      onChange={(e) => updateData("site", "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-address">Address</Label>
                    <Input
                      id="site-address"
                      placeholder="123 Main Street"
                      value={data.site.address}
                      onChange={(e) => updateData("site", "address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="site-city">City</Label>
                      <Input
                        id="site-city"
                        placeholder="New York"
                        value={data.site.city}
                        onChange={(e) => updateData("site", "city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site-state">State</Label>
                      <Input
                        id="site-state"
                        placeholder="NY"
                        value={data.site.state}
                        onChange={(e) => updateData("site", "state", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-zip">Postal Code</Label>
                    <Input
                      id="site-zip"
                      placeholder="10001"
                      value={data.site.postalCode}
                      onChange={(e) => updateData("site", "postalCode", e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("organization")}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleCreateSite}
                      className="flex-1 bg-accent hover:bg-accent/90"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Area Step */}
            {currentStep === "area" && (
              <Card className="shadow-lg">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <LayoutGrid className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="text-2xl">Create an Area</CardTitle>
                  <CardDescription>
                    Areas help organize your refrigeration units (e.g., Kitchen, Bar, Storage).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="area-name">Area Name *</Label>
                    <Input
                      id="area-name"
                      placeholder="Main Kitchen"
                      value={data.area.name}
                      onChange={(e) => updateData("area", "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area-desc">Description (Optional)</Label>
                    <Input
                      id="area-desc"
                      placeholder="Primary food prep area"
                      value={data.area.description}
                      onChange={(e) => updateData("area", "description", e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("site")}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleCreateArea}
                      className="flex-1 bg-accent hover:bg-accent/90"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Unit Step */}
            {currentStep === "unit" && (
              <Card className="shadow-lg">
                <CardHeader className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Thermometer className="w-8 h-8 text-accent" />
                  </div>
                  <CardTitle className="text-2xl">Add Your First Unit</CardTitle>
                  <CardDescription>
                    A unit is a refrigerator, freezer, or cooler you want to monitor.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit-name">Unit Name *</Label>
                    <Input
                      id="unit-name"
                      placeholder="Walk-in Cooler #1"
                      value={data.unit.name}
                      onChange={(e) => updateData("unit", "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit-type">Unit Type</Label>
                    <Select
                      value={data.unit.type}
                      onValueChange={(v) => updateData("unit", "type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">
                                Max: {type.tempLimit}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Temperature limits are set automatically based on unit type.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("area")}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleCreateUnit}
                      className="flex-1 bg-accent hover:bg-accent/90"
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Complete Setup
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Complete Step */}
            {currentStep === "complete" && (
              <Card className="shadow-lg">
                <CardContent className="py-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-safe/10 flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle2 className="w-10 h-10 text-safe" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    You're All Set!
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Your organization, site, area, and first unit have been created. 
                    You can now start monitoring temperatures.
                  </p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => navigate("/dashboard")}
                      className="w-full max-w-xs bg-accent hover:bg-accent/90"
                    >
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="link"
                      onClick={() => navigate("/settings")}
                      className="text-sm text-muted-foreground hover:text-accent p-0 h-auto"
                    >
                      Next: Pair your first sensor device
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
