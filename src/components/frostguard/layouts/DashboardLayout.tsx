import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, spacing, surface, border, status } from '@/lib/design-system/tokens';
import { PageHeading } from '@/lib/components/headings/PageHeading';
import { StatCard } from '@/lib/components/data-display/StatCard';
import { StackedList } from '@/lib/components/data-display/StackedList';
import { UnitSummaryCard } from '../cards/UnitSummaryCard';

export interface DashboardUnit {
  id: string;
  name: string;
  sensorKind?: string;
  lastReadingAt: string | null;
  uplinkIntervalS: number;
  alerts?: { severity: 'warning' | 'critical' }[];
  currentTemp?: number | null;
  tempUnit?: string;
}

export interface DashboardStats {
  totalUnits: number;
  onlineCount: number;
  alertCount: number;
  compliancePercent?: number;
}

export interface DashboardLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Header actions (e.g. filter buttons) */
  actions?: React.ReactNode;
  /** Dashboard summary stats */
  stats?: DashboardStats;
  /** Units to display in the list */
  units: DashboardUnit[];
  /** Callback when a unit is clicked */
  onUnitClick?: (unitId: string) => void;
  /** Optional content below stats (e.g. site-wide alerts widget) */
  topContent?: React.ReactNode;
}

/**
 * Customer app dashboard layout.
 * Shows overview stats, optional top content, and a list of units.
 */
export function DashboardLayout({
  className,
  title = 'Dashboard',
  description,
  actions,
  stats,
  units,
  onUnitClick,
  topContent,
  ...props
}: DashboardLayoutProps) {
  return (
    <div className={cn(spacing.page, className)} {...props}>
      <PageHeading
        title={title}
        description={description}
        actions={actions}
      />

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <StatCard
            label="Total Units"
            value={stats.totalUnits}
          />
          <StatCard
            label="Online"
            value={stats.onlineCount}
            trend={stats.totalUnits > 0
              ? { value: Math.round((stats.onlineCount / stats.totalUnits) * 100), label: '%' }
              : undefined
            }
            trendDirection="up-good"
          />
          <StatCard
            label="Active Alerts"
            value={stats.alertCount}
            trendDirection="down-good"
          />
          {stats.compliancePercent != null && (
            <StatCard
              label="Compliance"
              value={`${stats.compliancePercent}%`}
              trendDirection="up-good"
            />
          )}
        </div>
      )}

      {/* Optional top content (e.g. site-wide alert widget) */}
      {topContent && <div className="mt-6">{topContent}</div>}

      {/* Units list */}
      <div className="mt-6">
        <h2 className="text-lg font-medium text-zinc-50 mb-4">Units</h2>
        {units.length === 0 ? (
          <div className={cn('text-center py-12 rounded-lg border', surface.raised, border.default)}>
            <p className={cn('text-sm', textTokens.tertiary)}>No units found</p>
          </div>
        ) : (
          <StackedList>
            {units.map((unit) => (
              <UnitSummaryCard
                key={unit.id}
                unit={unit}
                onClick={onUnitClick ? () => onUnitClick(unit.id) : undefined}
              />
            ))}
          </StackedList>
        )}
      </div>
    </div>
  );
}
