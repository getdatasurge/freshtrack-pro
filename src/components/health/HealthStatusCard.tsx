import { Card, CardContent } from '@/components/ui/card';
import { HealthCheckResult } from '@/lib/health/types';
import { HealthStatusBadge } from './HealthStatusBadge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface HealthStatusCardProps {
  check: HealthCheckResult;
  showDetails?: boolean;
}

export function HealthStatusCard({ check, showDetails = false }: HealthStatusCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails = check.details && Object.keys(check.details).length > 0;

  return (
    <Card 
      className={cn(
        'transition-all',
        check.status === 'unhealthy' && 'border-red-500/50',
        check.status === 'degraded' && 'border-yellow-500/50',
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <HealthStatusBadge status={check.status} showLabel={false} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm truncate">{check.name}</p>
              {check.skipped && (
                <p className="text-xs text-muted-foreground truncate">
                  {check.skipReason}
                </p>
              )}
              {check.error && !check.skipped && (
                <p className="text-xs text-destructive truncate">
                  {check.error}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {check.latencyMs !== undefined && (
              <span className={cn(
                "text-xs tabular-nums",
                check.latencyMs > 500 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {check.latencyMs}ms
              </span>
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {formatDistanceToNow(check.checkedAt, { addSuffix: true })}
            </span>
            {showDetails && hasDetails && (
              <button 
                onClick={() => setExpanded(!expanded)}
                className="p-1 hover:bg-muted rounded"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {expanded && hasDetails && (
          <div className="mt-3 pt-3 border-t">
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(check.details, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
