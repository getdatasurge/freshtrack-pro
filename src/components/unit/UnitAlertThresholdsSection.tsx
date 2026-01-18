import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Settings2, History } from "lucide-react";
import { AlertRulesEditor } from "@/components/settings/AlertRulesEditor";
import { AlertRulesHistoryModal } from "@/components/settings/AlertRulesHistoryModal";
import { useUnitAlertRules, useUnitAlertRulesOverride, useSiteAlertRules, DEFAULT_ALERT_RULES, AlertRules, AlertRulesRow } from "@/hooks/useAlertRules";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAlertRules } from "@/lib/invalidation";

interface UnitAlertThresholdsSectionProps {
  unitId: string;
  siteId: string;
  onSettingsUpdated?: () => void;
}

export default function UnitAlertThresholdsSection({
  unitId,
  siteId,
  onSettingsUpdated,
}: UnitAlertThresholdsSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch effective rules for this unit (merged from org -> site -> unit)
  const { data: effectiveRules, isLoading: effectiveLoading } = useUnitAlertRules(unitId);
  
  // Fetch unit-level overrides only
  const { data: unitOverrides, isLoading: overridesLoading } = useUnitAlertRulesOverride(unitId);
  
  // Fetch site-level rules as parent for inheritance display
  const { data: siteRules, isLoading: siteLoading } = useSiteAlertRules(siteId);

  const isLoading = effectiveLoading || overridesLoading || siteLoading;

  // Convert AlertRulesRow to AlertRules format for parent rules
  const parentRules: AlertRules = siteRules 
    ? { ...DEFAULT_ALERT_RULES, ...siteRules }
    : DEFAULT_ALERT_RULES;

  const handleSave = async () => {
    // Use centralized invalidation for alert rules
    await invalidateAlertRules(queryClient, { unitId });
    onSettingsUpdated?.();
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="w-4 h-4" />
                Alert Thresholds
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHistoryModal(true);
                  }}
                >
                  <History className="w-4 h-4 mr-1" />
                  History
                </Button>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Loading thresholds...
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure alert timing thresholds for this unit. Values not set here will inherit from site or organization defaults.
                </p>
                <AlertRulesEditor
                  scope={{ unit_id: unitId }}
                  scopeLabel={`Unit`}
                  existingRules={unitOverrides || null}
                  parentRules={parentRules}
                  onSave={handleSave}
                  canEdit={true}
                />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <AlertRulesHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        scope={{ unit_id: unitId }}
        scopeLabel="Unit"
      />
    </Card>
  );
}
