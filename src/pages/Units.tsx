import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";
import { useSuperAdmin } from "@/contexts/SuperAdminContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Thermometer,
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronRight,
  Boxes,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UnitWithHierarchy {
  id: string;
  name: string;
  unit_type: string;
  status: string;
  last_temp_reading: number | null;
  last_reading_at: string | null;
  temp_limit_high: number;
  temp_limit_low: number | null;
  area: {
    id: string;
    name: string;
    site: {
      id: string;
      name: string;
    };
  };
}

const Units = () => {
  const { effectiveOrgId, isInitialized, isImpersonating } = useEffectiveIdentity();
  const { isSupportModeActive } = useSuperAdmin();
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<UnitWithHierarchy[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastViewedUnitId, setLastViewedUnitId] = useState<string | null>(null);

  useEffect(() => {
    // Check for last viewed unit
    const stored = localStorage.getItem("lastViewedUnitId");
    if (stored) setLastViewedUnitId(stored);
  }, []);

  // Debug logging for impersonation context
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Units] Context state:', {
        isInitialized,
        effectiveOrgId,
        isSupportModeActive,
        isImpersonating,
      });
    }
  }, [isInitialized, effectiveOrgId, isSupportModeActive, isImpersonating]);

  useEffect(() => {
    // Guard: In support mode, wait until we have a valid effectiveOrgId
    if (isSupportModeActive && !effectiveOrgId && isInitialized) {
      // Still waiting for impersonation context - stay in loading state
      return;
    }
    
    if (isInitialized && effectiveOrgId) {
      loadUnits();
    } else if (isInitialized && !effectiveOrgId && !isSupportModeActive) {
      // Only show empty state for non-support mode with no org
      setUnits([]);
      setIsLoading(false);
    }
  }, [isInitialized, effectiveOrgId, isSupportModeActive]);

  const loadUnits = async () => {
    if (!effectiveOrgId) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      if (import.meta.env.DEV) {
        console.log('[Units] Loading units for org:', effectiveOrgId, 'isImpersonating:', isImpersonating);
      }

      // Step 1: Get area IDs for this organization
      // PostgREST can't filter through multiple nested relationships (units->areas->sites->org)
      // so we need to first get area IDs, then filter units by those
      const { data: areasData, error: areasError } = await supabase
        .from("areas")
        .select("id, site:sites!inner(organization_id)")
        .eq("is_active", true)
        .eq("sites.organization_id", effectiveOrgId);

      if (areasError) {
        console.error("[Units] Areas query error:", areasError);
        setLoadError(isImpersonating
          ? "Unable to load areas while impersonating. This may be a permissions issue."
          : `Failed to load areas: ${areasError.message}`
        );
        setUnits([]);
        return;
      }

      const areaIds = (areasData || []).map(a => a.id);

      if (import.meta.env.DEV) {
        console.log('[Units] Areas found:', areaIds.length, 'areaIds:', areaIds);
      }

      if (areaIds.length === 0) {
        if (import.meta.env.DEV) {
          console.log('[Units] No areas found for org, showing empty state');
        }
        setUnits([]);
        return;
      }

      // Step 2: Fetch all units with hierarchy filtered by those area IDs
      const { data: unitsData, error } = await supabase
        .from("units")
        .select(`
          id, name, unit_type, status, last_temp_reading, last_reading_at,
          temp_limit_high, temp_limit_low,
          area:areas!inner(
            id, name,
            site:sites!inner(id, name, organization_id)
          )
        `)
        .eq("is_active", true)
        .in("area_id", areaIds)
        .order("name");

      if (error) {
        console.error("[Units] Units query error:", error);
        setLoadError(isImpersonating
          ? "Unable to load units while impersonating. This may be a permissions issue."
          : `Failed to load units: ${error.message}`
        );
        setUnits([]);
      } else {
        if (import.meta.env.DEV) {
          console.log('[Units] Units loaded:', unitsData?.length, 'units');
        }
        setUnits(unitsData || []);
      }
    } catch (err) {
      console.error("[Units] Failed to load units:", err);
      setLoadError(isImpersonating
        ? "An error occurred while loading units during impersonation."
        : "An unexpected error occurred while loading units."
      );
      setUnits([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter units by search query
  const filteredUnits = units.filter((unit) => {
    const query = searchQuery.toLowerCase();
    return (
      unit.name.toLowerCase().includes(query) ||
      unit.area.name.toLowerCase().includes(query) ||
      unit.area.site.name.toLowerCase().includes(query) ||
      unit.unit_type.toLowerCase().includes(query)
    );
  });

  // Group units by site
  const groupedBySite = filteredUnits.reduce((acc, unit) => {
    const siteId = unit.area.site.id;
    if (!acc[siteId]) {
      acc[siteId] = {
        siteName: unit.area.site.name,
        units: [],
      };
    }
    acc[siteId].units.push(unit);
    return acc;
  }, {} as Record<string, { siteName: string; units: UnitWithHierarchy[] }>);

  const getStatusBadge = (unit: UnitWithHierarchy) => {
    const isOnline = unit.status === "online" || unit.status === "normal";
    const isAlerting = unit.status === "alarm" || unit.status === "critical";
    const isWarning = unit.status === "warning";

    if (isAlerting) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Alert
        </Badge>
      );
    }
    if (isWarning) {
      return (
        <Badge variant="outline" className="gap-1 border-warning text-warning">
          <AlertTriangle className="w-3 h-3" />
          Warning
        </Badge>
      );
    }
    if (isOnline) {
      return (
        <Badge variant="outline" className="gap-1 border-safe text-safe">
          <Wifi className="w-3 h-3" />
          Online
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <WifiOff className="w-3 h-3" />
        Offline
      </Badge>
    );
  };

  const lastViewedUnit = lastViewedUnitId
    ? units.find((u) => u.id === lastViewedUnitId)
    : null;

  return (
    <DashboardLayout title="Units">
      {/* Search and Continue Card */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search units by name, area, site, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {lastViewedUnit && (
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="py-3">
              <Link to={`/units/${lastViewedUnit.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Thermometer className="w-5 h-5 text-accent" />
                    <div>
                      <p className="font-medium text-sm">Continue where you left off</p>
                      <p className="text-xs text-muted-foreground">
                        {lastViewedUnit.name} • {lastViewedUnit.area.site.name}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && loadError && (
        <Card className="border-destructive/50">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Unable to Load Units</h3>
            <p className="text-muted-foreground mb-4">{loadError}</p>
            <Button variant="outline" onClick={() => loadUnits()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !loadError && units.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Boxes className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Units Found</h3>
            <p className="text-muted-foreground mb-4">
              Units are created within Areas. Add units to your sites to start monitoring.
            </p>
            <Button asChild>
              <Link to="/sites">Go to Sites</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No Search Results */}
      {!isLoading && units.length > 0 && filteredUnits.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Search className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No units match "{searchQuery}"
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Units Grouped by Site */}
      {!isLoading && Object.keys(groupedBySite).length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedBySite).map(([siteId, { siteName, units: siteUnits }]) => (
            <Card key={siteId}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {siteName}
                  <Badge variant="secondary" className="ml-auto">
                    {siteUnits.length} unit{siteUnits.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {siteUnits.map((unit) => (
                  <Link key={unit.id} to={`/units/${unit.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <Thermometer className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{unit.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {unit.area.name} • {unit.unit_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {unit.last_temp_reading !== null && (
                          <div className="text-right">
                            <p className="font-mono text-sm font-medium">
                              {unit.last_temp_reading.toFixed(1)}°
                            </p>
                            {unit.last_reading_at && (
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(unit.last_reading_at), {
                                  addSuffix: true,
                                })}
                              </p>
                            )}
                          </div>
                        )}
                        {getStatusBadge(unit)}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Units;
