/**
 * Site Overview Widget
 * 
 * Displays summary statistics for a site including area count, unit count, and timezone.
 */

import { Building2, LayoutGrid, Thermometer, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WidgetProps } from "../types";

export function SiteOverviewWidget({ 
  site,
  areas,
  totalUnits,
}: WidgetProps) {
  const areasCount = areas?.length ?? 0;
  const unitsCount = totalUnits ?? areas?.reduce((sum, a) => sum + (a.unitsCount || 0), 0) ?? 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Site Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Areas Count */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{areasCount}</p>
              <p className="text-xs text-muted-foreground">Areas</p>
            </div>
          </div>

          {/* Units Count */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
              <Thermometer className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unitsCount}</p>
              <p className="text-xs text-muted-foreground">Units</p>
            </div>
          </div>

          {/* Timezone */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium truncate">{site?.timezone || "UTC"}</p>
              <p className="text-xs text-muted-foreground">Timezone</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
