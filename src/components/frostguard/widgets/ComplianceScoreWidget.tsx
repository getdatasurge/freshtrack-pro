import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens } from '@/lib/design-system/tokens';
import { ShieldCheck } from 'lucide-react';
import { WidgetContainer } from './WidgetContainer';
import { ProgressRing } from '@/lib/components/feedback/ProgressRing';
import { EmptyState } from '@/lib/components/feedback/EmptyState';

export interface ComplianceBreakdown {
  label: string;
  percentage: number;
  color: string;
}

export interface ComplianceScoreWidgetProps {
  unitId?: string;
  siteId?: string;
  period?: '24h' | '7d' | '30d';
  score?: number | null;
  breakdown?: ComplianceBreakdown[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

function scoreToVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 95) return 'success';
  if (score >= 80) return 'warning';
  return 'danger';
}

export function ComplianceScoreWidget({
  unitId,
  siteId,
  period = '24h',
  score,
  breakdown = [],
  loading,
  error,
  onRetry,
}: ComplianceScoreWidgetProps) {
  return (
    <WidgetContainer
      title="Compliance Score"
      icon={<ShieldCheck />}
      loading={loading}
      error={error}
      onRetry={onRetry}
      actions={
        <span className={cn('text-xs', textTokens.tertiary)}>{period}</span>
      }
    >
      {score == null ? (
        <EmptyState
          icon={<ShieldCheck />}
          title="No compliance data"
          description="Compliance metrics not available"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <ProgressRing
              value={score}
              variant={scoreToVariant(score)}
              size={80}
              strokeWidth={6}
            />
          </div>
          <p className={cn('text-center text-sm', textTokens.tertiary)}>
            Time in range
          </p>

          {breakdown.length > 0 && (
            <div className="space-y-2">
              {breakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className={cn('text-xs', textTokens.tertiary)}>{item.label}</span>
                  </div>
                  <span className={cn('text-xs font-medium tabular-nums', textTokens.secondary)}>
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetContainer>
  );
}
