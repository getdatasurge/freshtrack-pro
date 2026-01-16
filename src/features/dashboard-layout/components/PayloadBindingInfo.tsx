/**
 * Payload Binding Info Component
 * 
 * Displays inferred payload type, confidence, and capabilities for a sensor.
 * Shows confirmation prompt when confidence is low.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown,
  Info,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceCapability } from "@/lib/registry/capabilityRegistry";
import { CAPABILITY_INFO, PAYLOAD_TYPE_CAPABILITIES } from "@/lib/registry/capabilityRegistry";

// ============================================================================
// TYPES
// ============================================================================

export interface PayloadBindingData {
  payloadType: string;
  schemaVersion?: string;
  confidence: number;
  capabilities: DeviceCapability[];
  source: 'auto' | 'manual' | 'confirmed';
  status: 'active' | 'review' | 'overridden' | 'unclassified';
}

interface PayloadBindingInfoProps {
  binding: PayloadBindingData | null;
  sensorName?: string;
  sensorType?: string;
  compact?: boolean;
  onConfirm?: () => void;
  onChangeType?: (newType: string) => void;
  className?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ConfidenceBadge({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let colorClass = '';
  
  if (percent >= 90) {
    colorClass = 'bg-safe/10 text-safe border-safe/20';
  } else if (percent >= 70) {
    colorClass = 'bg-warning/10 text-warning border-warning/20';
  } else {
    colorClass = 'bg-alarm/10 text-alarm border-alarm/20';
  }
  
  return (
    <Badge variant="outline" className={cn("font-mono text-xs", colorClass)}>
      {percent}%
    </Badge>
  );
}

function CapabilityBadge({ capability }: { capability: DeviceCapability }) {
  const info = CAPABILITY_INFO[capability];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs">
            {info?.displayName ?? capability}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{info?.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SourceBadge({ source }: { source: PayloadBindingData['source'] }) {
  const config = {
    auto: { label: 'Auto-detected', icon: Zap, className: 'text-muted-foreground' },
    manual: { label: 'Manually set', icon: CheckCircle2, className: 'text-safe' },
    confirmed: { label: 'Confirmed', icon: CheckCircle2, className: 'text-safe' },
  };
  
  const { label, icon: Icon, className } = config[source];
  
  return (
    <span className={cn("flex items-center gap-1 text-xs", className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PayloadBindingInfo({
  binding,
  sensorName,
  sensorType,
  compact = false,
  onConfirm,
  onChangeType,
  className,
}: PayloadBindingInfoProps) {
  // No binding data
  if (!binding) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/50 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Info className="w-4 h-4" />
          <span className="text-sm">
            No payload type detected. Sensor data will be processed once readings arrive.
          </span>
        </div>
      </div>
    );
  }
  
  const needsConfirmation = binding.confidence < 0.8 && binding.source === 'auto';
  const availablePayloadTypes = Object.keys(PAYLOAD_TYPE_CAPABILITIES);
  
  // Compact display mode
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)}>
        <Badge variant="outline" className="font-mono">
          {binding.payloadType}
        </Badge>
        <ConfidenceBadge value={binding.confidence} />
        {needsConfirmation && (
          <Badge variant="destructive" className="text-xs">
            Needs Review
          </Badge>
        )}
      </div>
    );
  }
  
  // Full display mode
  return (
    <div className={cn("space-y-4", className)}>
      {/* Binding Info Card */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {sensorName && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{sensorName}</span>
            <SourceBadge source={binding.source} />
          </div>
        )}
        
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Payload Type</dt>
          <dd className="font-mono font-medium">
            {binding.payloadType}
            {binding.schemaVersion && (
              <span className="text-muted-foreground ml-1">
                (v{binding.schemaVersion})
              </span>
            )}
          </dd>
          
          <dt className="text-muted-foreground">Confidence</dt>
          <dd className="flex items-center gap-2">
            <ConfidenceBadge value={binding.confidence} />
          </dd>
          
          {sensorType && (
            <>
              <dt className="text-muted-foreground">Sensor Type</dt>
              <dd className="capitalize">{sensorType}</dd>
            </>
          )}
        </dl>
        
        <div>
          <dt className="text-sm text-muted-foreground mb-2">Capabilities</dt>
          <dd className="flex flex-wrap gap-1">
            {binding.capabilities.map(cap => (
              <CapabilityBadge key={cap} capability={cap} />
            ))}
          </dd>
        </div>
      </div>
      
      {/* Low Confidence Warning */}
      {needsConfirmation && (
        <Alert variant="default" className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Low Confidence Detection</AlertTitle>
          <AlertDescription className="text-sm">
            <p className="mb-3">
              The sensor type was detected with {Math.round(binding.confidence * 100)}% confidence. 
              Please confirm this is correct or select the right type.
            </p>
            <div className="flex items-center gap-2">
              {onConfirm && (
                <Button size="sm" onClick={onConfirm}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Confirm
                </Button>
              )}
              {onChangeType && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Change Type
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {availablePayloadTypes.map(type => (
                      <DropdownMenuItem 
                        key={type} 
                        onClick={() => onChangeType(type)}
                        className="font-mono"
                      >
                        {type}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
