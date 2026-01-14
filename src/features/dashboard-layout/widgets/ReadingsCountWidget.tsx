/**
 * Readings Count Widget
 * 
 * Displays the count of sensor readings in the current time period.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

interface ReadingsCountWidgetProps {
  count: number;
}

export function ReadingsCountWidget({ count }: ReadingsCountWidgetProps) {
  return (
    <div className="h-full p-4">
      <p className="text-sm font-medium text-muted-foreground mb-2">Readings in Period</p>
      <p className="text-3xl font-bold text-foreground">{count}</p>
      <p className="text-xs text-muted-foreground">sensor readings</p>
    </div>
  );
}
