import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { ALERT_TYPE_LABELS } from "@/hooks/useNotificationPolicies";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertUnit {
  id: string;
  name: string;
  area: {
    name: string;
    site: {
      name: string;
    };
  };
}

interface AlertRow {
  id: string;
  alert_type: string;
  severity: string;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  unit: AlertUnit;
}

type Period = "7d" | "30d" | "90d";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

// Color palettes
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

const PIE_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

// ---------------------------------------------------------------------------
// Helper: compute start date from period
// ---------------------------------------------------------------------------

function getStartDate(period: Period): Date {
  const now = new Date();
  now.setDate(now.getDate() - PERIOD_DAYS[period]);
  now.setHours(0, 0, 0, 0);
  return now;
}

// ---------------------------------------------------------------------------
// Helper: minutes between two dates
// ---------------------------------------------------------------------------

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

// ---------------------------------------------------------------------------
// Helper: format duration
// ---------------------------------------------------------------------------

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.round((minutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

// ---------------------------------------------------------------------------
// Sub-component: StatsCards
// ---------------------------------------------------------------------------

function StatsCards({ alerts }: { alerts: AlertRow[] }) {
  const stats = useMemo(() => {
    const total = alerts.length;
    const activeCount = alerts.filter((a) => a.status === "active").length;
    const resolvedCount = alerts.filter((a) => a.status === "resolved").length;

    // Severity breakdown
    const criticalCount = alerts.filter((a) => a.severity === "critical").length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;
    const infoCount = alerts.filter((a) => a.severity === "info").length;

    // Average response time (triggered_at -> acknowledged_at)
    const acknowledged = alerts.filter((a) => a.acknowledged_at);
    const avgResponseMinutes =
      acknowledged.length > 0
        ? acknowledged.reduce(
            (sum, a) => sum + minutesBetween(a.triggered_at, a.acknowledged_at!),
            0
          ) / acknowledged.length
        : null;

    // Resolution rate
    const resolutionRate = total > 0 ? (resolvedCount / total) * 100 : 0;

    return {
      total,
      activeCount,
      resolvedCount,
      criticalCount,
      warningCount,
      infoCount,
      avgResponseMinutes,
      resolutionRate,
    };
  }, [alerts]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Alerts
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {stats.criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.criticalCount} critical
              </Badge>
            )}
            {stats.warningCount > 0 && (
              <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 text-xs">
                {stats.warningCount} warning
              </Badge>
            )}
            {stats.infoCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stats.infoCount} info
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Now */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Now
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Require attention
          </p>
        </CardContent>
      </Card>

      {/* Avg Response Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Avg Response Time
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.avgResponseMinutes !== null
              ? formatDuration(stats.avgResponseMinutes)
              : "--"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Time to acknowledge
          </p>
        </CardContent>
      </Card>

      {/* Resolution Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Resolution Rate
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.total > 0 ? `${stats.resolutionRate.toFixed(1)}%` : "--"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.resolvedCount} of {stats.total} resolved
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: AlertTrendChart
// ---------------------------------------------------------------------------

function AlertTrendChart({ alerts }: { alerts: AlertRow[] }) {
  const chartData = useMemo(() => {
    const grouped: Record<string, { critical: number; warning: number; info: number }> = {};

    for (const alert of alerts) {
      const day = alert.triggered_at.split("T")[0];
      if (!grouped[day]) {
        grouped[day] = { critical: 0, warning: 0, info: 0 };
      }
      const severity = alert.severity as keyof typeof grouped[typeof day];
      if (severity in grouped[day]) {
        grouped[day][severity]++;
      }
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        critical: counts.critical,
        warning: counts.warning,
        info: counts.info,
      }));
  }, [alerts]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No alert data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alert Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(val: string) => {
                const parts = val.split("-");
                return `${parts[1]}/${parts[2]}`;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(label: string) => {
                const d = new Date(label + "T00:00:00");
                return d.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <Area
              type="monotone"
              dataKey="critical"
              stackId="1"
              stroke={SEVERITY_COLORS.critical}
              fill={SEVERITY_COLORS.critical}
              fillOpacity={0.6}
              name="Critical"
            />
            <Area
              type="monotone"
              dataKey="warning"
              stackId="1"
              stroke={SEVERITY_COLORS.warning}
              fill={SEVERITY_COLORS.warning}
              fillOpacity={0.6}
              name="Warning"
            />
            <Area
              type="monotone"
              dataKey="info"
              stackId="1"
              stroke={SEVERITY_COLORS.info}
              fill={SEVERITY_COLORS.info}
              fillOpacity={0.6}
              name="Info"
            />
            <Legend />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: AlertTypeBreakdown
// ---------------------------------------------------------------------------

function AlertTypeBreakdown({ alerts }: { alerts: AlertRow[] }) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const alert of alerts) {
      counts[alert.alert_type] = (counts[alert.alert_type] || 0) + 1;
    }

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({
        name:
          (ALERT_TYPE_LABELS as Record<string, string>)[type] || type.replace(/_/g, " "),
        value: count,
        type,
      }));
  }, [alerts]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No alert data for this period
        </CardContent>
      </Card>
    );
  }

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alert Type Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value} (${((value / total) * 100).toFixed(1)}%)`,
                name,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ResponseTimeChart
// ---------------------------------------------------------------------------

interface ResponseBucket {
  label: string;
  minMinutes: number;
  maxMinutes: number;
}

const RESPONSE_BUCKETS: ResponseBucket[] = [
  { label: "<5m", minMinutes: 0, maxMinutes: 5 },
  { label: "5-15m", minMinutes: 5, maxMinutes: 15 },
  { label: "15-30m", minMinutes: 15, maxMinutes: 30 },
  { label: "30m-1h", minMinutes: 30, maxMinutes: 60 },
  { label: "1-4h", minMinutes: 60, maxMinutes: 240 },
  { label: "4-24h", minMinutes: 240, maxMinutes: 1440 },
  { label: ">24h", minMinutes: 1440, maxMinutes: Infinity },
];

function ResponseTimeChart({ alerts }: { alerts: AlertRow[] }) {
  const chartData = useMemo(() => {
    const mttaBuckets = new Array(RESPONSE_BUCKETS.length).fill(0);
    const mttrBuckets = new Array(RESPONSE_BUCKETS.length).fill(0);

    for (const alert of alerts) {
      // MTTA: triggered -> acknowledged
      if (alert.acknowledged_at) {
        const mins = minutesBetween(alert.triggered_at, alert.acknowledged_at);
        const idx = RESPONSE_BUCKETS.findIndex(
          (b) => mins >= b.minMinutes && mins < b.maxMinutes
        );
        if (idx >= 0) mttaBuckets[idx]++;
      }

      // MTTR: triggered -> resolved
      if (alert.resolved_at) {
        const mins = minutesBetween(alert.triggered_at, alert.resolved_at);
        const idx = RESPONSE_BUCKETS.findIndex(
          (b) => mins >= b.minMinutes && mins < b.maxMinutes
        );
        if (idx >= 0) mttrBuckets[idx]++;
      }
    }

    return RESPONSE_BUCKETS.map((bucket, i) => ({
      bucket: bucket.label,
      MTTA: mttaBuckets[i],
      MTTR: mttrBuckets[i],
    }));
  }, [alerts]);

  const hasData = chartData.some((d) => d.MTTA > 0 || d.MTTR > 0);

  if (!hasData) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Response Time Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          No response time data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Response Time Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="MTTA"
              fill="#3b82f6"
              name="Time to Acknowledge"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="MTTR"
              fill="#10b981"
              name="Time to Resolve"
              radius={[4, 4, 0, 0]}
            />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: TopOffendersTable
// ---------------------------------------------------------------------------

interface UnitStats {
  unitId: string;
  unitName: string;
  siteName: string;
  count: number;
  mostCommonType: string;
  lastAlert: string;
}

function TopOffendersTable({ alerts }: { alerts: AlertRow[] }) {
  const topUnits = useMemo(() => {
    const unitMap: Record<
      string,
      {
        unitName: string;
        siteName: string;
        count: number;
        typeCounts: Record<string, number>;
        lastAlert: string;
      }
    > = {};

    for (const alert of alerts) {
      const uid = alert.unit.id;
      if (!unitMap[uid]) {
        unitMap[uid] = {
          unitName: alert.unit.name,
          siteName: alert.unit.area.site.name,
          count: 0,
          typeCounts: {},
          lastAlert: alert.triggered_at,
        };
      }
      const entry = unitMap[uid];
      entry.count++;
      entry.typeCounts[alert.alert_type] =
        (entry.typeCounts[alert.alert_type] || 0) + 1;
      if (alert.triggered_at > entry.lastAlert) {
        entry.lastAlert = alert.triggered_at;
      }
    }

    const results: UnitStats[] = Object.entries(unitMap)
      .map(([unitId, data]) => {
        // Find most common alert type
        const mostCommonType = Object.entries(data.typeCounts).sort(
          ([, a], [, b]) => b - a
        )[0]?.[0] ?? "";

        return {
          unitId,
          unitName: data.unitName,
          siteName: data.siteName,
          count: data.count,
          mostCommonType:
            (ALERT_TYPE_LABELS as Record<string, string>)[mostCommonType] ||
            mostCommonType.replace(/_/g, " "),
          lastAlert: data.lastAlert,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return results;
  }, [alerts]);

  if (topUnits.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Offenders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead>Most Common Type</TableHead>
                <TableHead>Last Alert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topUnits.map((unit) => (
                <TableRow key={unit.unitId}>
                  <TableCell className="font-medium">{unit.unitName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {unit.siteName}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{unit.count}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{unit.mostCommonType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(unit.lastAlert).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const AlertAnalytics = () => {
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [period, setPeriod] = useState<Period>("30d");

  const startDate = useMemo(() => getStartDate(period), [period]);

  const {
    data: alerts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["alert-analytics", effectiveOrgId, period],
    queryFn: async (): Promise<AlertRow[]> => {
      if (!effectiveOrgId) return [];

      const { data: alertsData, error } = await supabase
        .from("alerts")
        .select(
          `id, alert_type, severity, status, triggered_at, acknowledged_at, resolved_at,
          unit:units!inner(id, name, area:areas!inner(name, site:sites!inner(name)))`
        )
        .eq("organization_id", effectiveOrgId)
        .gte("triggered_at", startDate.toISOString())
        .order("triggered_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      return (alertsData || []).map((row: any) => ({
        id: row.id,
        alert_type: row.alert_type,
        severity: row.severity,
        status: row.status,
        triggered_at: row.triggered_at,
        acknowledged_at: row.acknowledged_at,
        resolved_at: row.resolved_at,
        unit: {
          id: row.unit.id,
          name: row.unit.name,
          area: {
            name: row.unit.area.name,
            site: { name: row.unit.area.site.name },
          },
        },
      }));
    },
    enabled: !!effectiveOrgId && isInitialized,
  });

  if (!isInitialized || (isLoading && alerts.length === 0)) {
    return (
      <DashboardLayout title="Alert Analytics">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout title="Alert Analytics">
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-destructive mb-3" />
            <p className="text-destructive font-medium">Failed to load alert analytics</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Alert Analytics">
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-6">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={period === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Stats cards row */}
      <div className="mb-6">
        <StatsCards alerts={alerts} />
      </div>

      {/* Charts grid (2 columns on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AlertTrendChart alerts={alerts} />
        <AlertTypeBreakdown alerts={alerts} />
      </div>

      {/* Response time chart (full width) */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        <ResponseTimeChart alerts={alerts} />
      </div>

      {/* Top offenders table */}
      <TopOffendersTable alerts={alerts} />
    </DashboardLayout>
  );
};

export default AlertAnalytics;
