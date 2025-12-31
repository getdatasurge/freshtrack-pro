import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Users,
  Search,
  Building,
  MapPin,
  Box,
  Copy,
  Check,
  RefreshCw,
  Info
} from "lucide-react";
import { UserSearchDialog } from "./UserSearchDialog";
import { isProject1Configured, type Project1Profile } from "@/integrations/supabase/project1-client";

interface TestContextData {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  siteId: string;
  unitId: string;
}

export function MultiTenantTestContext() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [contextData, setContextData] = useState<TestContextData>({
    userId: "",
    email: "",
    fullName: "",
    organizationId: "",
    siteId: "",
    unitId: "",
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isConfigured = isProject1Configured();

  const handleUserSelect = (user: Project1Profile) => {
    setContextData({
      userId: user.id || "",
      email: user.email || "",
      fullName: user.full_name || "",
      organizationId: user.organization_id || "",
      siteId: user.site_id || "",
      unitId: user.unit_id || "",
    });
    toast.success("User data loaded", {
      description: `Filled form with data for ${user.full_name || user.email || "user"}`,
    });
  };

  const handleInputChange = (field: keyof TestContextData, value: string) => {
    setContextData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCopy = async (field: keyof TestContextData) => {
    const value = contextData[field];
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleClear = () => {
    setContextData({
      userId: "",
      email: "",
      fullName: "",
      organizationId: "",
      siteId: "",
      unitId: "",
    });
    toast.info("Form cleared");
  };

  const hasData = Object.values(contextData).some((v) => v.trim() !== "");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Multi-Tenant Test Context
          </CardTitle>
          <CardDescription>
            Search for users in Project 1 (FreshTrack Pro) to auto-fill context data for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Banner */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This form allows you to search users from your other FreshTrack project and use their
              organization/site/unit IDs for testing multi-tenant scenarios.
            </AlertDescription>
          </Alert>

          {/* Search Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setIsSearchOpen(true)}
              disabled={!isConfigured}
              className="flex-1"
            >
              <Search className="w-4 h-4 mr-2" />
              Search Users in Project 1
            </Button>
            {hasData && (
              <Button variant="outline" onClick={handleClear}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>

          {!isConfigured && (
            <Alert variant="destructive">
              <AlertDescription>
                <p className="font-medium">Project 1 not configured</p>
                <p className="text-sm mt-1">
                  Add <code className="bg-muted px-1 rounded">VITE_P1_URL</code> and{" "}
                  <code className="bg-muted px-1 rounded">VITE_P1_ANON_KEY</code> to your{" "}
                  <code className="bg-muted px-1 rounded">.env</code> file to enable user search.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* User Info Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              User Information
              {contextData.userId && <Badge variant="secondary">From Project 1</Badge>}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User ID */}
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="userId"
                    value={contextData.userId}
                    onChange={(e) => handleInputChange("userId", e.target.value)}
                    placeholder="UUID from profiles table"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy("userId")}
                    disabled={!contextData.userId}
                  >
                    {copiedField === "userId" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    value={contextData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="user@example.com"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy("email")}
                    disabled={!contextData.email}
                  >
                    {copiedField === "email" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={contextData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  placeholder="User's full name"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Context IDs Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Context IDs (for testing)</h3>

            <div className="grid grid-cols-1 gap-4">
              {/* Organization ID */}
              <div className="space-y-2">
                <Label htmlFor="organizationId" className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Organization ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="organizationId"
                    value={contextData.organizationId}
                    onChange={(e) => handleInputChange("organizationId", e.target.value)}
                    placeholder="Organization UUID"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy("organizationId")}
                    disabled={!contextData.organizationId}
                  >
                    {copiedField === "organizationId" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Site ID */}
              <div className="space-y-2">
                <Label htmlFor="siteId" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Site ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="siteId"
                    value={contextData.siteId}
                    onChange={(e) => handleInputChange("siteId", e.target.value)}
                    placeholder="Site UUID"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy("siteId")}
                    disabled={!contextData.siteId}
                  >
                    {copiedField === "siteId" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Unit ID */}
              <div className="space-y-2">
                <Label htmlFor="unitId" className="flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Unit ID
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="unitId"
                    value={contextData.unitId}
                    onChange={(e) => handleInputChange("unitId", e.target.value)}
                    placeholder="Unit UUID"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy("unitId")}
                    disabled={!contextData.unitId}
                  >
                    {copiedField === "unitId" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelectUser={handleUserSelect}
      />
    </>
  );
}
