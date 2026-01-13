/**
 * Compliance Summary Widget
 * 
 * Displays HACCP compliance status and settings summary for a site.
 */

import { Link } from "react-router-dom";
import { ShieldCheck, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "../types";

export function ComplianceSummaryWidget({ 
  site,
  entityId,
}: WidgetProps) {
  // Format cadence to human-readable string
  const formatCadence = (seconds: number | undefined) => {
    if (!seconds) return "Not configured";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  };

  // Get compliance mode display name
  const getComplianceModeLabel = (mode: string | undefined) => {
    switch (mode) {
      case "fda_food_code":
        return "FDA Food Code";
      case "usda":
        return "USDA";
      case "custom":
        return "Custom";
      default:
        return "Standard";
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-safe" />
          Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Compliance Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>Mode</span>
          </div>
          <Badge variant="secondary">
            {getComplianceModeLabel(site?.compliance_mode)}
          </Badge>
        </div>

        {/* Manual Log Cadence */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Log Interval</span>
          </div>
          <span className="text-sm font-medium">
            {formatCadence(site?.manual_log_cadence_seconds)}
          </span>
        </div>

        {/* Corrective Action Required */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Corrective Actions</span>
          <Badge className={site?.corrective_action_required ? "bg-safe/10 text-safe border-0" : "bg-muted"}>
            {site?.corrective_action_required ? "Required" : "Optional"}
          </Badge>
        </div>

        <Link to={`/sites/${entityId}#compliance`}>
          <Button variant="outline" size="sm" className="w-full mt-2">
            Manage Settings
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
