import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Battery, AlertTriangle, Loader2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isBefore, isAfter } from "date-fns";
import type { WidgetProps } from "../types";

interface MaintenanceItem {
  id: string;
  type: "battery" | "low_battery_alert" | "calibration";
  title: string;
  unitName: string;
  estimatedDate: Date;
  priority: "low" | "medium" | "high";
}

export function MaintenanceCalendarWidget({ site }: WidgetProps) {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMaintenanceItems() {
      if (!site?.id) return;
      
      setIsLoading(true);
      try {
        const maintenanceItems: MaintenanceItem[] = [];
        const now = new Date();
        const thirtyDaysLater = addDays(now, 30);

        // Fetch areas for this site to get units
        const { data: areas } = await supabase
          .from("areas")
          .select("id")
          .eq("site_id", site.id)
          .is("deleted_at", null);

        if (!areas || areas.length === 0) {
          setItems([]);
          setIsLoading(false);
          return;
        }

        const areaIds = areas.map(a => a.id);

        // Fetch units for these areas
        const { data: units } = await supabase
          .from("units")
          .select("id, name")
          .in("area_id", areaIds)
          .is("deleted_at", null);

        if (!units || units.length === 0) {
          setItems([]);
          setIsLoading(false);
          return;
        }

        const unitIds = units.map(u => u.id);
        const unitMap = new Map(units.map(u => [u.id, u.name]));

        // Fetch sensors with battery levels
        const { data: sensors } = await supabase
          .from("lora_sensors")
          .select("id, name, battery_level, unit_id")
          .in("unit_id", unitIds)
          .not("battery_level", "is", null);

        if (sensors) {
          sensors.forEach(sensor => {
            const batteryLevel = sensor.battery_level ?? 100;
            // Estimate days remaining: 1% = ~10 days
            const daysRemaining = Math.max(0, batteryLevel * 10);
            const estimatedDate = addDays(now, daysRemaining);

            // Only include if within 30 days
            if (isBefore(estimatedDate, thirtyDaysLater)) {
              const priority = batteryLevel < 20 ? "high" : batteryLevel < 40 ? "medium" : "low";
              maintenanceItems.push({
                id: `battery-${sensor.id}`,
                type: "battery",
                title: "Battery Replacement",
                unitName: unitMap.get(sensor.unit_id!) || sensor.name,
                estimatedDate,
                priority,
              });
            }
          });
        }

        // Fetch active low battery alerts
        const { data: alerts } = await supabase
          .from("alerts")
          .select("id, unit_id, triggered_at")
          .in("unit_id", unitIds)
          .eq("alert_type", "low_battery")
          .eq("status", "active");

        if (alerts) {
          alerts.forEach(alert => {
            maintenanceItems.push({
              id: `alert-${alert.id}`,
              type: "low_battery_alert",
              title: "Low Battery Alert",
              unitName: unitMap.get(alert.unit_id) || "Unknown Unit",
              estimatedDate: new Date(alert.triggered_at),
              priority: "high",
            });
          });
        }

        // Sort by date (earliest first) then by priority
        maintenanceItems.sort((a, b) => {
          const dateDiff = a.estimatedDate.getTime() - b.estimatedDate.getTime();
          if (dateDiff !== 0) return dateDiff;
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        setItems(maintenanceItems);
      } catch (error) {
        console.error("Error fetching maintenance items:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMaintenanceItems();
  }, [site?.id]);

  const getIcon = (type: MaintenanceItem["type"]) => {
    switch (type) {
      case "battery":
        return <Battery className="h-4 w-4" />;
      case "low_battery_alert":
        return <AlertTriangle className="h-4 w-4" />;
      case "calibration":
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: MaintenanceItem["priority"]) => {
    switch (priority) {
      case "high":
        return "text-destructive";
      case "medium":
        return "text-amber-500";
      case "low":
        return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Maintenance Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Maintenance Calendar
        </CardTitle>
        <p className="text-xs text-muted-foreground">Next 30 days</p>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {items.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm py-8">
            No maintenance scheduled
          </div>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`mt-0.5 ${getPriorityColor(item.priority)}`}>
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.unitName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                      {item.type === "low_battery_alert" 
                        ? "Now" 
                        : format(item.estimatedDate, "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
