/**
 * TelemetryPanel Component
 * Registry-driven telemetry display for device readings
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getDeviceDefinition } from "@/lib/devices";
import type { TelemetryFieldDefinition } from "@/lib/devices";
import { Activity } from "lucide-react";

interface TelemetryPanelProps {
  /** Device model identifier */
  model?: string | null;
  /** Telemetry data object */
  telemetry: Record<string, unknown>;
  /** Loading state */
  isLoading?: boolean;
  /** Show card wrapper */
  showCard?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode (fewer columns) */
  compact?: boolean;
}

export function TelemetryPanel({
  model,
  telemetry,
  isLoading = false,
  showCard = true,
  className,
  compact = false,
}: TelemetryPanelProps) {
  const definition = getDeviceDefinition(model);
  const fields = definition.telemetryFields;
  
  // Sort fields by priority
  const sortedFields = [...fields].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  
  const content = (
    <>
      {isLoading ? (
        <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3")}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      ) : fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
          <Activity className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No telemetry schema defined</p>
          <p className="text-xs">Add telemetry fields to the device registry</p>
        </div>
      ) : Object.keys(telemetry).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
          <Activity className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No telemetry received yet</p>
          <p className="text-xs">Waiting for device data...</p>
        </div>
      ) : (
        <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3")}>
          {sortedFields.map((field) => (
            <TelemetryField
              key={field.key}
              field={field}
              value={telemetry[field.key]}
            />
          ))}
        </div>
      )}
    </>
  );
  
  if (!showCard) {
    return <div className={className}>{content}</div>;
  }
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Latest Readings</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

/**
 * Individual telemetry field display
 */
interface TelemetryFieldProps {
  field: TelemetryFieldDefinition;
  value: unknown;
}

function TelemetryField({ field, value }: TelemetryFieldProps) {
  const displayValue = value !== undefined && value !== null
    ? field.formatter?.(value) ?? `${value}${field.unit}`
    : field.emptyValue;
  
  const isEmpty = value === undefined || value === null;
  
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{field.label}</span>
      <span className={cn(
        "font-mono text-sm",
        isEmpty && "text-muted-foreground"
      )}>
        {displayValue}
      </span>
    </div>
  );
}

/**
 * Inline telemetry display (for table cells, etc.)
 */
interface InlineTelemetryProps {
  model?: string | null;
  telemetry: Record<string, unknown>;
  /** Maximum fields to show */
  maxFields?: number;
  className?: string;
}

export function InlineTelemetry({
  model,
  telemetry,
  maxFields = 2,
  className,
}: InlineTelemetryProps) {
  const definition = getDeviceDefinition(model);
  const fields = definition.telemetryFields
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, maxFields);
  
  if (Object.keys(telemetry).length === 0) {
    return <span className="text-muted-foreground text-xs">No data</span>;
  }
  
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      {fields.map((field) => {
        const value = telemetry[field.key];
        if (value === undefined || value === null) return null;
        
        const displayValue = field.formatter?.(value) ?? `${value}${field.unit}`;
        
        return (
          <span key={field.key} className="font-mono">
            {displayValue}
          </span>
        );
      })}
    </div>
  );
}
