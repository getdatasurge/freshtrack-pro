/**
 * Readings Count Widget
 * 
 * Displays the count of sensor readings in the current time period.
 */

import { Card, CardContent } from "@/components/ui/card";

interface ReadingsCountWidgetProps {
  count: number;
}

export function ReadingsCountWidget({ count }: ReadingsCountWidgetProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-4 h-full">
        <p className="text-sm font-medium text-muted-foreground mb-2">Readings in Period</p>
        <p className="text-3xl font-bold text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">sensor readings</p>
      </CardContent>
    </Card>
  );
}
