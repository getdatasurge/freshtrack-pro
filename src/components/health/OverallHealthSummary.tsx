import { Card, CardContent } from '@/components/ui/card';
import { SystemHealth, HealthCategory } from '@/lib/health/types';
import { HealthStatusBadge } from './HealthStatusBadge';
import { Database, Cloud, Server, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OverallHealthSummaryProps {
  health: SystemHealth;
  onCategoryClick?: (category: HealthCategory | 'all') => void;
  activeCategory?: HealthCategory | 'all';
}

export function OverallHealthSummary({ 
  health, 
  onCategoryClick,
  activeCategory = 'all',
}: OverallHealthSummaryProps) {
  const categories = [
    {
      id: 'all' as const,
      label: 'Overall',
      icon: Activity,
      status: health.overall,
      count: health.checks.length,
    },
    {
      id: 'database' as HealthCategory,
      label: 'Database',
      icon: Database,
      status: getCategoryStatus(health.checks.filter(c => c.category === 'database')),
      count: health.checks.filter(c => c.category === 'database').length,
    },
    {
      id: 'edge_function' as HealthCategory,
      label: 'Edge Functions',
      icon: Server,
      status: getCategoryStatus(health.checks.filter(c => c.category === 'edge_function')),
      count: health.checks.filter(c => c.category === 'edge_function' && !c.skipped).length,
    },
    {
      id: 'ttn' as HealthCategory,
      label: 'TTN',
      icon: Cloud,
      status: getCategoryStatus(health.checks.filter(c => c.category === 'ttn')),
      count: health.checks.filter(c => c.category === 'ttn').length,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <Card 
            key={cat.id}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              isActive && 'border-primary ring-1 ring-primary/20'
            )}
            onClick={() => onCategoryClick?.(cat.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <HealthStatusBadge status={cat.status} showLabel={false} size="sm" />
              </div>
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xs text-muted-foreground">
                {cat.count} check{cat.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getCategoryStatus(checks: SystemHealth['checks']): SystemHealth['overall'] {
  if (checks.length === 0) return 'unknown';
  
  const activeChecks = checks.filter(c => !c.skipped);
  if (activeChecks.length === 0) return 'healthy';

  if (activeChecks.some(c => c.status === 'unhealthy')) return 'unhealthy';
  if (activeChecks.some(c => c.status === 'degraded')) return 'degraded';
  if (activeChecks.every(c => c.status === 'healthy')) return 'healthy';
  
  return 'unknown';
}
