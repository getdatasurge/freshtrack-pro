import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  MapPin, 
  Thermometer, 
  AlertTriangle, 
  CheckCircle2,
  ChevronRight,
  TrendingUp
} from "lucide-react";
import { computeUnitAlerts, UnitAlertsSummary } from "@/hooks/useUnitAlerts";
import { UnitStatusInfo } from "@/hooks/useUnitStatus";

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  units: UnitStatusInfo[];
  alertSummary: UnitAlertsSummary;
  complianceScore: number;
}

interface OrgSummary {
  name: string;
  totalSites: number;
  totalUnits: number;
  totalAlerts: number;
  overallCompliance: number;
}

const OrganizationDashboard = () => {
  const navigate = useNavigate();
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [orgSummary, setOrgSummary] = useState<OrgSummary | null>(null);

  useEffect(() => {
    if (isInitialized && effectiveOrgId) {
      loadOrganizationData();
    } else if (isInitialized && !effectiveOrgId) {
      navigate("/onboarding");
    }
  }, [isInitialized, effectiveOrgId]);

  const loadOrganizationData = async () => {
    if (!effectiveOrgId) return;
    
    setLoading(true);
    try {
      // Get organization details using effectiveOrgId
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", effectiveOrgId)
        .maybeSingle();

      // Get all sites with their units using effectiveOrgId
      const { data: sitesData } = await supabase
        .from("sites")
        .select(`
          id, name, address, city, state,
          areas(
            id,
            units(
              id, name, status, unit_type,
              temp_limit_high, temp_limit_low,
              last_temp_reading, last_reading_at, last_manual_log_at,
              manual_log_cadence
            )
          )
        `)
        .eq("organization_id", effectiveOrgId)
        .eq("is_active", true);

      if (!sitesData) {
        setSites([]);
        setOrgSummary({
          name: org?.name || "Organization",
          totalSites: 0,
          totalUnits: 0,
          totalAlerts: 0,
          overallCompliance: 100,
        });
        setLoading(false);
        return;
      }

      // Process sites and compute compliance
      const processedSites: SiteData[] = sitesData.map((site) => {
        const units: UnitStatusInfo[] = [];
        
        (site.areas || []).forEach((area: any) => {
          (area.units || []).forEach((unit: any) => {
            units.push({
              ...unit,
              area: {
                id: area.id,
                name: area.name || "Default Area",
                site: { id: site.id, name: site.name },
              },
            });
          });
        });

        const alertSummary = computeUnitAlerts(units);
        
        // Compliance = units without CRITICAL alerts / total units
        const unitsWithCritical = alertSummary.alerts.filter(a => a.severity === "critical")
          .reduce((acc, alert) => {
            acc.add(alert.unit_id);
            return acc;
          }, new Set<string>()).size;
        
        const complianceScore = units.length > 0 
          ? Math.round(((units.length - unitsWithCritical) / units.length) * 100)
          : 100;

        return {
          id: site.id,
          name: site.name,
          address: site.address,
          city: site.city,
          state: site.state,
          units,
          alertSummary,
          complianceScore,
        };
      });

      // Sort by compliance (lowest first to highlight problem sites)
      processedSites.sort((a, b) => a.complianceScore - b.complianceScore);

      // Calculate org-wide summary
      const totalUnits = processedSites.reduce((sum, s) => sum + s.units.length, 0);
      const totalAlerts = processedSites.reduce((sum, s) => sum + s.alertSummary.criticalCount, 0);
      const overallCompliance = totalUnits > 0
        ? Math.round(processedSites.reduce((sum, s) => sum + s.complianceScore * s.units.length, 0) / totalUnits)
        : 100;

      setSites(processedSites);
      setOrgSummary({
        name: org?.name || "Organization",
        totalSites: processedSites.length,
        totalUnits,
        totalAlerts,
        overallCompliance,
      });
    } catch (error) {
      console.error("Error loading organization data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 95) return "text-safe";
    if (score >= 80) return "text-warning";
    return "text-alarm";
  };

  const getComplianceBg = (score: number) => {
    if (score >= 95) return "bg-safe";
    if (score >= 80) return "bg-warning";
    return "bg-alarm";
  };

  if (loading) {
    return (
      <DashboardLayout title="Organization Overview">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Organization Overview">
      {/* Org Summary Stats */}
      {orgSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{orgSummary.totalSites}</p>
                  <p className="text-sm text-muted-foreground">Sites</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Thermometer className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{orgSummary.totalUnits}</p>
                  <p className="text-sm text-muted-foreground">Units</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-alarm/10">
                  <AlertTriangle className="w-5 h-5 text-alarm" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{orgSummary.totalAlerts}</p>
                  <p className="text-sm text-muted-foreground">Critical Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getComplianceBg(orgSummary.overallCompliance)}/10`}>
                  <TrendingUp className={`w-5 h-5 ${getComplianceColor(orgSummary.overallCompliance)}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getComplianceColor(orgSummary.overallCompliance)}`}>
                    {orgSummary.overallCompliance}%
                  </p>
                  <p className="text-sm text-muted-foreground">Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sites Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Sites Overview
        </h2>

        {sites.length === 0 ? (
          <Card className="p-8 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No sites yet</h3>
            <p className="text-muted-foreground">
              Add your first site to start monitoring.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <Link key={site.id} to={`/sites/${site.id}`}>
                <Card className="unit-card h-full hover:border-accent/50 transition-all cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{site.name}</CardTitle>
                        {(site.city || site.state) && (
                          <p className="text-sm text-muted-foreground">
                            {[site.city, site.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats Row */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{site.units.length}</span>
                        <span className="text-muted-foreground">units</span>
                      </div>
                      {site.alertSummary.criticalCount > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {site.alertSummary.criticalCount}
                        </Badge>
                      )}
                      {site.alertSummary.warningCount > 0 && (
                        <Badge variant="outline" className="border-warning text-warning flex items-center gap-1">
                          {site.alertSummary.warningCount} warnings
                        </Badge>
                      )}
                    </div>

                    {/* Compliance Score */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Compliance</span>
                        <span className={`font-semibold ${getComplianceColor(site.complianceScore)}`}>
                          {site.complianceScore}%
                        </span>
                      </div>
                      <Progress 
                        value={site.complianceScore} 
                        className={`h-2 ${site.complianceScore >= 95 ? "[&>div]:bg-safe" : site.complianceScore >= 80 ? "[&>div]:bg-warning" : "[&>div]:bg-alarm"}`}
                      />
                    </div>

                    {/* Status Summary */}
                    <div className="flex items-center gap-2 text-xs">
                      {site.alertSummary.unitsOk > 0 && (
                        <div className="flex items-center gap-1 text-safe">
                          <CheckCircle2 className="w-3 h-3" />
                          {site.alertSummary.unitsOk} OK
                        </div>
                      )}
                      {site.alertSummary.unitsWithAlerts > 0 && (
                        <div className="flex items-center gap-1 text-alarm">
                          <AlertTriangle className="w-3 h-3" />
                          {site.alertSummary.unitsWithAlerts} need attention
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OrganizationDashboard;
