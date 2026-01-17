import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertRulesEditor } from "./AlertRulesEditor";
import { AlertRulesHistoryModal } from "./AlertRulesHistoryModal";
import { NotificationPolicyEditor } from "./NotificationPolicyEditor";
import { 
  useOrgAlertRules, 
  useSiteAlertRules, 
  useUnitAlertRulesOverride,
  AlertRulesRow 
} from "@/hooks/useAlertRules";
import {
  useOrgNotificationPolicies,
  useSiteNotificationPolicies,
  useUnitNotificationPolicies,
  NotificationPolicy,
} from "@/hooks/useNotificationPolicies";
import { Building2, MapPin, Thermometer, History, Loader2, Bell, Settings } from "lucide-react";

interface Site {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  area_name: string;
}

interface AlertRulesScopedEditorProps {
  organizationId: string;
  canEdit: boolean;
}

import { useQueryClient } from "@tanstack/react-query";

export function AlertRulesScopedEditor({ organizationId, canEdit }: AlertRulesScopedEditorProps) {
  const queryClient = useQueryClient();
  const [scopeTab, setScopeTab] = useState<"org" | "site" | "unit">("org");
  const [editorTab, setEditorTab] = useState<"thresholds" | "notifications">("thresholds");
  const [sites, setSites] = useState<Site[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch org rules
  const { data: orgRules, refetch: refetchOrg } = useOrgAlertRules(organizationId);
  
  // Fetch site rules when site selected
  const { data: siteRules, refetch: refetchSite } = useSiteAlertRules(
    scopeTab === "site" ? selectedSiteId : null
  );
  
  // Fetch unit rules when unit selected
  const { data: unitRules, refetch: refetchUnit } = useUnitAlertRulesOverride(
    scopeTab === "unit" ? selectedUnitId : null
  );

  // Fetch notification policies for each scope
  const { data: orgNotifPolicies, refetch: refetchOrgNotif } = useOrgNotificationPolicies(
    scopeTab === "org" ? organizationId : null
  );
  const { data: siteNotifPolicies, refetch: refetchSiteNotif } = useSiteNotificationPolicies(
    scopeTab === "site" ? selectedSiteId : null
  );
  const { data: unitNotifPolicies, refetch: refetchUnitNotif } = useUnitNotificationPolicies(
    scopeTab === "unit" ? selectedUnitId : null
  );

  // Load sites
  useEffect(() => {
    const loadSites = async () => {
      setIsLoadingSites(true);
      const { data } = await supabase
        .from("sites")
        .select("id, name")
        .order("name");
      setSites(data || []);
      setIsLoadingSites(false);
    };
    loadSites();
  }, [organizationId]);

  // Load units when site selected (for unit tab)
  useEffect(() => {
    if (scopeTab === "unit" && selectedSiteId) {
      const loadUnits = async () => {
        setIsLoadingUnits(true);
        const { data } = await supabase
          .from("units")
          .select(`
            id,
            name,
            area:areas!inner(
              name,
              site_id
            )
          `)
          .eq("areas.site_id", selectedSiteId)
          .order("name");

        const formatted: Unit[] = (data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          area_name: u.area?.name || "",
        }));
        setUnits(formatted);
        setIsLoadingUnits(false);
      };
      loadUnits();
    }
  }, [scopeTab, selectedSiteId]);

  // Reset selections when changing tabs
  useEffect(() => {
    if (scopeTab === "org") {
      setSelectedSiteId("");
      setSelectedUnitId("");
    } else if (scopeTab === "site") {
      setSelectedUnitId("");
    }
  }, [scopeTab]);

  const handleSave = () => {
    if (scopeTab === "org") {
      refetchOrg();
      refetchOrgNotif();
    } else if (scopeTab === "site") {
      refetchSite();
      refetchSiteNotif();
    } else if (scopeTab === "unit") {
      refetchUnit();
      refetchUnitNotif();
    }
    queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    queryClient.invalidateQueries({ queryKey: ["notification-policies"] });
  };

  const getCurrentScope = () => {
    if (scopeTab === "org") {
      return { organization_id: organizationId };
    } else if (scopeTab === "site" && selectedSiteId) {
      return { site_id: selectedSiteId };
    } else if (scopeTab === "unit" && selectedUnitId) {
      return { unit_id: selectedUnitId };
    }
    return { organization_id: organizationId };
  };

  const getCurrentScopeLabel = () => {
    if (scopeTab === "org") {
      return "Organization Defaults";
    } else if (scopeTab === "site") {
      const site = sites.find((s) => s.id === selectedSiteId);
      return site ? `Site: ${site.name}` : "Select a Site";
    } else if (scopeTab === "unit") {
      const unit = units.find((u) => u.id === selectedUnitId);
      return unit ? `Unit: ${unit.name}` : "Select a Unit";
    }
    return "Organization Defaults";
  };

  const getCurrentRules = (): AlertRulesRow | null => {
    if (scopeTab === "org") return orgRules || null;
    if (scopeTab === "site") return siteRules || null;
    if (scopeTab === "unit") return unitRules || null;
    return null;
  };

  const getParentRules = (): Partial<AlertRulesRow> | null => {
    if (scopeTab === "site") return orgRules || null;
    if (scopeTab === "unit") return siteRules || orgRules || null;
    return null;
  };

  const getParentNotifPolicies = (): NotificationPolicy[] | undefined => {
    if (scopeTab === "site") return orgNotifPolicies;
    if (scopeTab === "unit") return siteNotifPolicies || orgNotifPolicies;
    return undefined;
  };

  const canShowEditor = () => {
    if (scopeTab === "org") return true;
    if (scopeTab === "site") return !!selectedSiteId;
    if (scopeTab === "unit") return !!selectedUnitId;
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={scopeTab} onValueChange={(v) => setScopeTab(v as "org" | "site" | "unit")}>
          <TabsList>
            <TabsTrigger value="org" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Organization
            </TabsTrigger>
            <TabsTrigger value="site" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Site
            </TabsTrigger>
            <TabsTrigger value="unit" className="flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Unit
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="w-4 h-4 mr-2" />
          View History
        </Button>
      </div>

      {/* Scope Selectors */}
      {scopeTab === "site" && (
        <div className="flex items-center gap-4">
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder={isLoadingSites ? "Loading..." : "Select a site"} />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingSites && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
      )}

      {scopeTab === "unit" && (
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={selectedSiteId} onValueChange={(v) => { setSelectedSiteId(v); setSelectedUnitId(""); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select site first" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedUnitId} 
            onValueChange={setSelectedUnitId}
            disabled={!selectedSiteId}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder={
                !selectedSiteId 
                  ? "Select site first" 
                  : isLoadingUnits 
                    ? "Loading..." 
                    : "Select a unit"
              } />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.area_name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingUnits && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
      )}

      {/* Editor Tabs: Thresholds vs Notifications */}
      {canShowEditor() && (
        <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as "thresholds" | "notifications")}>
          <TabsList className="mb-4">
            <TabsTrigger value="thresholds" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Alert Thresholds
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notification Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="thresholds">
            <AlertRulesEditor
              scope={getCurrentScope()}
              scopeLabel={getCurrentScopeLabel()}
              existingRules={getCurrentRules()}
              parentRules={getParentRules()}
              onSave={handleSave}
              canEdit={canEdit}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationPolicyEditor
              scope={getCurrentScope()}
              scopeLabel={getCurrentScopeLabel()}
              parentPolicies={getParentNotifPolicies()}
              canEdit={canEdit}
              onSave={handleSave}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Editor */}
      {!canShowEditor() && (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          Select a {scopeTab} to configure its alert rules
        </div>
      )}

      {/* History Modal */}
      <AlertRulesHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        scope={getCurrentScope()}
        scopeLabel={getCurrentScopeLabel()}
      />
    </div>
  );
}
