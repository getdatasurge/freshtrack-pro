import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Battery, BatteryWarning, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface LowBatteryUnit {
  id: string;
  name: string;
  batteryLevel: number;
  siteName: string;
  areaName: string;
}

interface LowBatteryWidgetProps {
  units: LowBatteryUnit[];
}

export default function LowBatteryWidget({ units }: LowBatteryWidgetProps) {
  if (units.length === 0) {
    return null;
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-warning">
          <BatteryWarning className="w-4 h-4" />
          Low Battery ({units.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {units.slice(0, 5).map((unit) => (
            <Link
              key={unit.id}
              to={`/units/${unit.id}`}
              className="flex items-center justify-between p-2 rounded-lg bg-background hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Battery className={`w-4 h-4 flex-shrink-0 ${
                  unit.batteryLevel < 10 ? "text-alarm" : "text-warning"
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {unit.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {unit.siteName} · {unit.areaName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    unit.batteryLevel < 10 
                      ? "bg-alarm/10 text-alarm" 
                      : "bg-warning/10 text-warning"
                  } border-0`}
                >
                  {unit.batteryLevel}%
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
          {units.length > 5 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{units.length - 5} more
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
