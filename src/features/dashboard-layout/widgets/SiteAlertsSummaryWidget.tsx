/**
 * Site Alerts Summary Widget
 * 
 * Displays aggregated alert counts across all units in the site.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, AlertCircle, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WidgetProps } from "../types";

interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
}

export function SiteAlertsSummaryWidget({ 
  entityId,
}: WidgetProps) {
  const [counts, setCounts] = useState<AlertCounts>({ critical: 0, warning: 0, info: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    
    const loadAlerts = async () => {
      // Fetch active alerts for this site
      const { data } = await supabase
        .from("alerts")
        .select("severity")
        .eq("site_id", entityId)
        .eq("status", "active");

      if (data) {
        const newCounts = { critical: 0, warning: 0, info: 0 };
        data.forEach(alert => {
          if (alert.severity === "critical") newCounts.critical++;
          else if (alert.severity === "warning") newCounts.warning++;
          else newCounts.info++;
        });
        setCounts(newCounts);
      }
      setIsLoading(false);
    };

    loadAlerts();
  }, [entityId]);

  const totalAlerts = counts.critical + counts.warning + counts.info;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Active Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalAlerts === 0 ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-safe/10 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-6 h-6 text-safe" />
            </div>
            <p className="text-sm text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Critical */}
            {counts.critical > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-alarm/10">
                <AlertTriangle className="w-5 h-5 text-alarm" />
                <span className="font-medium text-alarm">{counts.critical}</span>
                <span className="text-sm text-alarm">Critical</span>
              </div>
            )}

            {/* Warning */}
            {counts.warning > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-warning/10">
                <AlertCircle className="w-5 h-5 text-warning" />
                <span className="font-medium text-warning">{counts.warning}</span>
                <span className="text-sm text-warning">Warning</span>
              </div>
            )}

            {/* Info */}
            {counts.info > 0 && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted">
                <Info className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">{counts.info}</span>
                <span className="text-sm text-muted-foreground">Info</span>
              </div>
            )}

            <Link to={`/alerts?site=${entityId}`}>
              <Button variant="outline" size="sm" className="w-full mt-2">
                View All Alerts
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
