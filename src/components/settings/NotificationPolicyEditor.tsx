import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTypePolicyCard } from "./AlertTypePolicyCard";
import {
  ALERT_TYPES,
  ALERT_TYPE_LABELS,
  AlertType,
  NotificationPolicy,
  useOrgNotificationPolicies,
  useSiteNotificationPolicies,
  useUnitNotificationPolicies,
  getPolicyForAlertType,
} from "@/hooks/useNotificationPolicies";
import { Bell, AlertTriangle, Thermometer, Wifi, Clock, DoorOpen, Battery, Wrench, Flame } from "lucide-react";

interface NotificationPolicyEditorProps {
  scope: { organization_id?: string; site_id?: string; unit_id?: string };
  scopeLabel: string;
  parentPolicies?: NotificationPolicy[];
  canEdit: boolean;
  onSave?: () => void;
}

const ALERT_TYPE_ICONS: Record<AlertType, React.ReactNode> = {
  temp_excursion: <Thermometer className="w-4 h-4" />,
  monitoring_interrupted: <Wifi className="w-4 h-4" />,
  missed_manual_entry: <Clock className="w-4 h-4" />,
  low_battery: <Battery className="w-4 h-4" />,
  sensor_fault: <Wrench className="w-4 h-4" />,
  door_open: <DoorOpen className="w-4 h-4" />,
  alarm_active: <AlertTriangle className="w-4 h-4" />,
  suspected_cooling_failure: <Flame className="w-4 h-4" />,
};

export function NotificationPolicyEditor({
  scope,
  scopeLabel,
  parentPolicies,
  canEdit,
  onSave,
}: NotificationPolicyEditorProps) {
  const [selectedAlertType, setSelectedAlertType] = useState<AlertType>("temp_excursion");
  
  const isOrgScope = !!scope.organization_id && !scope.site_id && !scope.unit_id;
  const isSiteScope = !!scope.site_id;
  const isUnitScope = !!scope.unit_id;

  // Fetch policies for current scope
  const { data: orgPolicies, refetch: refetchOrg } = useOrgNotificationPolicies(
    isOrgScope ? scope.organization_id || null : null
  );
  const { data: sitePolicies, refetch: refetchSite } = useSiteNotificationPolicies(
    isSiteScope ? scope.site_id || null : null
  );
  const { data: unitPolicies, refetch: refetchUnit } = useUnitNotificationPolicies(
    isUnitScope ? scope.unit_id || null : null
  );

  const currentPolicies = isOrgScope ? orgPolicies : isSiteScope ? sitePolicies : unitPolicies;

  const handleSavePolicy = () => {
    if (isOrgScope) refetchOrg();
    else if (isSiteScope) refetchSite();
    else if (isUnitScope) refetchUnit();
    onSave?.();
  };

  const getCurrentPolicy = (alertType: AlertType): NotificationPolicy | undefined => {
    return getPolicyForAlertType(currentPolicies, alertType);
  };

  const getParentPolicy = (alertType: AlertType): NotificationPolicy | undefined => {
    return getPolicyForAlertType(parentPolicies, alertType);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Policy - {scopeLabel}
        </CardTitle>
        <CardDescription>
          Configure how and when notifications are sent for each alert type.
          {!isOrgScope && " Leave settings empty to inherit from parent level."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={selectedAlertType}
          onValueChange={(v) => setSelectedAlertType(v as AlertType)}
          className="w-full"
        >
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {ALERT_TYPES.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                className="flex items-center gap-1.5 text-xs px-2 py-1.5"
              >
                {ALERT_TYPE_ICONS[type]}
                <span className="hidden sm:inline">{ALERT_TYPE_LABELS[type]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {ALERT_TYPES.map((type) => (
            <TabsContent key={type} value={type} className="mt-0">
              <AlertTypePolicyCard
                alertType={type}
                alertTypeLabel={ALERT_TYPE_LABELS[type]}
                scope={scope}
                existingPolicy={getCurrentPolicy(type)}
                parentPolicy={getParentPolicy(type)}
                canEdit={canEdit}
                onSave={handleSavePolicy}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
