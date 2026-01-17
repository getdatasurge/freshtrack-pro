import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { HealthStatusBadge } from '@/components/health/HealthStatusBadge';
import { OverallHealthSummary } from '@/components/health/OverallHealthSummary';
import { HealthCheckList } from '@/components/health/HealthCheckList';
import { HealthCategory } from '@/lib/health/types';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity';
import { formatDistanceToNow } from 'date-fns';

export default function HealthDashboard() {
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [activeCategory, setActiveCategory] = useState<HealthCategory | 'all'>('all');

  const {
    systemHealth,
    isChecking,
    lastError,
    runCheck,
    toggleAutoRefresh,
    autoRefreshEnabled,
  } = useHealthCheck(effectiveOrgId);

  // Run initial check when org is loaded
  useEffect(() => {
    if (isInitialized && effectiveOrgId && !systemHealth) {
      runCheck();
    }
  }, [isInitialized, effectiveOrgId]);

  return (
    <DashboardLayout title="System Health">
      <div className="space-y-6">
        {/* Header Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {systemHealth && (
                  <HealthStatusBadge 
                    status={systemHealth.overall} 
                    isChecking={isChecking}
                    size="lg"
                  />
                )}
                {systemHealth?.lastCheckedAt && (
                  <span className="text-sm text-muted-foreground">
                    Last checked {formatDistanceToNow(systemHealth.lastCheckedAt, { addSuffix: true })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-refresh"
                    checked={autoRefreshEnabled}
                    onCheckedChange={toggleAutoRefresh}
                  />
                  <Label htmlFor="auto-refresh" className="text-sm">
                    Auto-refresh
                  </Label>
                </div>

                <Button 
                  onClick={runCheck} 
                  disabled={isChecking}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                  {isChecking ? 'Checking...' : 'Run All Checks'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {lastError && (
          <Card className="border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Health check failed</p>
                  <p className="text-sm">{lastError.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {systemHealth && (
          <OverallHealthSummary 
            health={systemHealth}
            onCategoryClick={setActiveCategory}
            activeCategory={activeCategory}
          />
        )}

        {/* Check List */}
        {systemHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {activeCategory === 'all' ? 'All Checks' : `${activeCategory.replace('_', ' ')} Checks`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HealthCheckList 
                checks={systemHealth.checks}
                categoryFilter={activeCategory}
              />
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!systemHealth && !isChecking && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                No health check data yet. Run a check to see system status.
              </p>
              <Button onClick={runCheck}>
                Run Health Check
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Footer */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>
            Health checks verify Edge Function availability, database connectivity, and TTN configuration.
          </p>
          <p>
            Some functions are skipped because they require authentication or would trigger side effects.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
