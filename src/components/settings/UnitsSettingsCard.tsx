/**
 * UnitsSettingsCard
 *
 * Settings card for managing temperature units preference (Imperial/Metric).
 */

import { Thermometer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUnits, type UnitsPreference } from "@/contexts/UnitsContext";

interface UnitsSettingsCardProps {
  canEdit: boolean;
}

export function UnitsSettingsCard({ canEdit }: UnitsSettingsCardProps) {
  const { units, setUnits, isLoading } = useUnits();

  const handleUnitsChange = async (value: string) => {
    if (value === 'imperial' || value === 'metric') {
      await setUnits(value as UnitsPreference);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="h-5 w-5" />
          Temperature Units
        </CardTitle>
        <CardDescription>
          Choose how temperatures are displayed across dashboards, charts, and alerts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={units}
          onValueChange={handleUnitsChange}
          disabled={!canEdit || isLoading}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="imperial" id="units-imperial" />
            <Label
              htmlFor="units-imperial"
              className="flex flex-col cursor-pointer"
            >
              <span className="font-medium">Imperial (°F)</span>
              <span className="text-sm text-muted-foreground">
                Display temperatures in Fahrenheit
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="metric" id="units-metric" />
            <Label
              htmlFor="units-metric"
              className="flex flex-col cursor-pointer"
            >
              <span className="font-medium">Metric (°C)</span>
              <span className="text-sm text-muted-foreground">
                Display temperatures in Celsius
              </span>
            </Label>
          </div>
        </RadioGroup>
        <p className="mt-4 text-xs text-muted-foreground">
          This setting affects all temperature displays in the application. Data is always stored in a consistent format regardless of display preference.
        </p>
      </CardContent>
    </Card>
  );
}
