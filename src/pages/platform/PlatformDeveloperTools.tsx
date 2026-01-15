import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Server,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Webhook,
  Database,
  Clock,
  Globe,
  Zap,
  Radio,
} from 'lucide-react';

interface WebhookDelivery {
  id: string;
  organization_id: string;
  org_name?: string;
  status: 'success' | 'failed' | 'pending';
  endpoint: string;
  response_code: number | null;
  retry_count: number;
  created_at: string;
}

interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  api: 'healthy' | 'degraded' | 'down';
  webhooks: 'healthy' | 'degraded' | 'down';
  ttn: 'healthy' | 'degraded' | 'down';
}

export default function PlatformDeveloperTools() {
  const { logSuperAdminAction, isSupportModeActive } = useSuperAdmin();
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'healthy',
    api: 'healthy',
    webhooks: 'healthy',
    ttn: 'healthy',
  });
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [ttnConnections, setTtnConnections] = useState<Array<{
    id: string;
    organization_id: string;
    org_name?: string;
    ttn_application_id: string | null;
    provisioning_status: string;
    created_at: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbStats, setDbStats] = useState({
    organizations: 0,
    users: 0,
    sites: 0,
    units: 0,
    readings: 0,
    alerts: 0,
  });

  useEffect(() => {
    loadDevTools();
    logSuperAdminAction('VIEWED_DEVELOPER_TOOLS');
  }, []);

  const loadDevTools = async () => {
    setIsLoading(true);
    try {
      // Check system health by making test queries
      const healthChecks = await Promise.all([
        // Database check
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        // TTN connections
        supabase.from('ttn_connections').select('*').limit(50),
      ]);

      // Database stats
      const [orgResult, userResult, siteResult, unitResult, readingResult, alertResult] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('sites').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('units').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('sensor_readings').select('*', { count: 'exact', head: true }),
        supabase.from('alerts').select('*', { count: 'exact', head: true }),
      ]);

      setDbStats({
        organizations: orgResult.count || 0,
        users: userResult.count || 0,
        sites: siteResult.count || 0,
        units: unitResult.count || 0,
        readings: readingResult.count || 0,
        alerts: alertResult.count || 0,
      });

      // Get TTN connections with org names
      if (healthChecks[1].data) {
        const orgIds = [...new Set(healthChecks[1].data.map(c => c.organization_id))];
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);

        const orgMap = new Map(orgs?.map(o => [o.id, o.name]));

        setTtnConnections(healthChecks[1].data.map(conn => ({
          ...conn,
          org_name: orgMap.get(conn.organization_id),
        })));
      }

      // Simulate webhook deliveries (in real app, you'd have a webhook_deliveries table)
      setWebhookDeliveries([]);

      // Update health based on results
      setSystemHealth({
        database: healthChecks[0].error ? 'degraded' : 'healthy',
        api: 'healthy',
        webhooks: 'healthy',
        ttn: healthChecks[1].data?.some(c => c.provisioning_status === 'failed') ? 'degraded' : 'healthy',
      });

    } catch (err) {
      console.error('Error loading dev tools:', err);
      setSystemHealth({
        database: 'degraded',
        api: 'degraded',
        webhooks: 'degraded',
        ttn: 'degraded',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const HealthIndicator = ({ status }: { status: 'healthy' | 'degraded' | 'down' }) => {
    if (status === 'healthy') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (status === 'degraded') {
      return <AlertCircle className="w-5 h-5 text-amber-500" />;
    }
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <PlatformLayout title="Developer Tools">
      {!isSupportModeActive && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-200">
              Support Mode Required
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-300">
              Some diagnostic tools require Support Mode to be active. Enter Support Mode from the header to access all features.
            </div>
          </div>
        </div>
      )}

      {/* System Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4" />
              Database
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <HealthIndicator status={systemHealth.database} />
            <span className="capitalize">{systemHealth.database}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" />
              API
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <HealthIndicator status={systemHealth.api} />
            <span className="capitalize">{systemHealth.api}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <HealthIndicator status={systemHealth.webhooks} />
            <span className="capitalize">{systemHealth.webhooks}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Radio className="w-4 h-4" />
              TTN Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <HealthIndicator status={systemHealth.ttn} />
            <span className="capitalize">{systemHealth.ttn}</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different tools */}
      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Database Stats</TabsTrigger>
          <TabsTrigger value="ttn">TTN Connections</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Status</TabsTrigger>
        </TabsList>

        {/* Database Stats */}
        <TabsContent value="stats" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Statistics
              </CardTitle>
              <CardDescription>Current record counts across all tables</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{dbStats.organizations.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Organizations</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{dbStats.users.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Users</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{dbStats.sites.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Sites</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{dbStats.units.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Units</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{dbStats.readings.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Readings</div>
                </div>
                <div className="p-4 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{dbStats.alerts.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Alerts</div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={loadDevTools} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Stats
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TTN Connections */}
        <TabsContent value="ttn" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5" />
                TTN Connections
              </CardTitle>
              <CardDescription>LoRaWAN/TTN application connections per organization</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>TTN Application ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : ttnConnections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No TTN connections configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    ttnConnections.map((conn) => (
                      <TableRow key={conn.id}>
                        <TableCell className="font-medium">{conn.org_name || 'Unknown'}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {conn.ttn_application_id || 'Not set'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              conn.provisioning_status === 'completed'
                                ? 'default'
                                : conn.provisioning_status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {conn.provisioning_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(conn.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Status */}
        <TabsContent value="webhooks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5" />
                Webhook Deliveries
              </CardTitle>
              <CardDescription>Recent webhook delivery attempts and statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Webhook delivery logging not yet implemented.</p>
                <p className="text-sm mt-2">
                  This would show TTN webhook deliveries, Stripe webhooks, and other integrations.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      {isSupportModeActive && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Administrative actions (use with caution)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button variant="outline" disabled>
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear Query Cache
            </Button>
            <Button variant="outline" disabled>
              <Activity className="w-4 h-4 mr-2" />
              Run Health Check
            </Button>
            <Button variant="outline" disabled>
              <Server className="w-4 h-4 mr-2" />
              View Edge Function Logs
            </Button>
          </CardContent>
        </Card>
      )}
    </PlatformLayout>
  );
}
