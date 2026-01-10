/**
 * TTN Config Source Badge
 * Visual indicator of TTN configuration state and source
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pencil,
  CheckCircle2,
  Database,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import type { TTNConfigContext } from "@/types/ttnState";
import { cn } from "@/lib/utils";

interface TTNConfigSourceBadgeProps {
  context: TTNConfigContext | null;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const STATE_CONFIG = {
  local_draft: {
    label: 'Local Draft',
    variant: 'outline' as const,
    icon: Pencil,
    color: 'text-muted-foreground',
    description: 'Configuration has not been validated',
  },
  validated: {
    label: 'Validated',
    variant: 'default' as const,
    icon: CheckCircle2,
    color: 'text-green-500',
    description: 'Configuration validated successfully',
  },
  canonical: {
    label: 'Saved',
    variant: 'secondary' as const,
    icon: Database,
    color: 'text-primary',
    description: 'Configuration persisted to database',
  },
  drifted: {
    label: 'Config Drift',
    variant: 'outline' as const,
    icon: AlertTriangle,
    color: 'text-amber-500',
    description: 'Local changes differ from saved version',
  },
  invalid: {
    label: 'Invalid',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-destructive',
    description: 'Configuration failed validation',
  },
};

const SOURCE_LABELS = {
  LOCAL: 'Local',
  FROSTGUARD: 'FrostGuard',
  EMULATOR: 'Emulator',
};

export function TTNConfigSourceBadge({
  context,
  showTooltip = true,
  size = 'sm',
  className,
}: TTNConfigSourceBadgeProps) {
  if (!context) {
    return (
      <Badge variant="outline" className={cn("gap-1", size === 'sm' ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1", className)}>
        <Info className={cn("text-muted-foreground", size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
        Unknown
      </Badge>
    );
  }

  const config = STATE_CONFIG[context.state];
  const Icon = config.icon;
  
  const badge = (
    <Badge 
      variant={config.variant} 
      className={cn(
        "gap-1 font-medium",
        size === 'sm' ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1",
        className
      )}
    >
      <Icon className={cn(config.color, size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5">
          <p className="font-medium">{config.description}</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p><span className="font-medium">Source:</span> {SOURCE_LABELS[context.source]}</p>
            {context.last_validated_at && (
              <p><span className="font-medium">Validated:</span> {new Date(context.last_validated_at).toLocaleString()}</p>
            )}
            {context.request_id && (
              <p><span className="font-medium">Request ID:</span> {context.request_id}</p>
            )}
            {context.error_message && (
              <p className="text-destructive"><span className="font-medium">Error:</span> {context.error_message}</p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Compact inline indicator for tight spaces
 */
export function TTNConfigStateIndicator({
  state,
  className,
}: {
  state: TTNConfigContext['state'] | null;
  className?: string;
}) {
  if (!state) return null;
  
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon className={cn("h-4 w-4", config.color, className)} />
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
