import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Printer, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useOrgScope } from "@/hooks/useOrgScope";
import { ALERT_TYPE_LABELS } from "@/hooks/useNotificationPolicies";
import { getAlertTypeConfig } from "@/lib/alertConfig";
import { toast } from "sonner";

interface ComplianceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Site {
  id: string;
  name: string;
}

interface AlertRecord {
  id: string;
  title: string;
  alert_type: string;
  severity: string;
  status: string;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  unit: {
    name: string;
    area: {
      name: string;
      site: {
        name: string;
      };
    };
  } | null;
}

interface ReportStats {
  total: number;
  bySeverity: { critical: number; warning: number; info: number };
  byStatus: { active: number; acknowledged: number; resolved: number };
  mtta: number | null;
  mttr: number | null;
  resolutionRate: number;
}

function formatDuration(ms: number | null): string {
  if (ms === null || isNaN(ms)) return "N/A";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeStats(alerts: AlertRecord[]): ReportStats {
  const total = alerts.length;

  const bySeverity = { critical: 0, warning: 0, info: 0 };
  const byStatus = { active: 0, acknowledged: 0, resolved: 0 };

  const ackDeltas: number[] = [];
  const resolveDeltas: number[] = [];

  for (const alert of alerts) {
    if (alert.severity in bySeverity) {
      bySeverity[alert.severity as keyof typeof bySeverity]++;
    }
    if (alert.status in byStatus) {
      byStatus[alert.status as keyof typeof byStatus]++;
    }

    if (alert.acknowledged_at && alert.triggered_at) {
      const delta =
        new Date(alert.acknowledged_at).getTime() -
        new Date(alert.triggered_at).getTime();
      if (delta >= 0) ackDeltas.push(delta);
    }

    if (alert.resolved_at && alert.triggered_at) {
      const delta =
        new Date(alert.resolved_at).getTime() -
        new Date(alert.triggered_at).getTime();
      if (delta >= 0) resolveDeltas.push(delta);
    }
  }

  const mtta =
    ackDeltas.length > 0
      ? ackDeltas.reduce((a, b) => a + b, 0) / ackDeltas.length
      : null;

  const mttr =
    resolveDeltas.length > 0
      ? resolveDeltas.reduce((a, b) => a + b, 0) / resolveDeltas.length
      : null;

  const resolutionRate = total > 0 ? byStatus.resolved / total : 0;

  return { total, bySeverity, byStatus, mtta, mttr, resolutionRate };
}

export function ComplianceReportDialog({
  open,
  onOpenChange,
}: ComplianceReportDialogProps) {
  const { orgId } = useOrgScope();

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(toISODateString(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toISODateString(now));
  const [siteId, setSiteId] = useState<string>("");
  const [selectedAlertTypes, setSelectedAlertTypes] = useState<string[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoaded, setSitesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[] | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);

  async function loadSites() {
    if (sitesLoaded || !orgId) return;
    const { data, error } = await supabase
      .from("sites")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");
    if (!error && data) {
      setSites(data);
    }
    setSitesLoaded(true);
  }

  function handleOpenChange(value: boolean) {
    if (value) {
      loadSites();
    }
    if (!value) {
      setAlerts(null);
      setStats(null);
    }
    onOpenChange(value);
  }

  function toggleAlertType(alertType: string) {
    setSelectedAlertTypes((prev) =>
      prev.includes(alertType)
        ? prev.filter((t) => t !== alertType)
        : [...prev, alertType]
    );
  }

  async function generateReport() {
    if (!orgId) {
      toast.error("Organization not available");
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("alerts")
        .select(
          "id, title, alert_type, severity, status, triggered_at, acknowledged_at, resolved_at, unit:units(name, area:areas(name, site:sites(name)))"
        )
        .eq("organization_id", orgId)
        .gte("triggered_at", `${startDate}T00:00:00.000Z`)
        .lte("triggered_at", `${endDate}T23:59:59.999Z`)
        .order("triggered_at", { ascending: false })
        .limit(500);

      if (siteId) {
        query = query.eq("site_id", siteId);
      }

      if (selectedAlertTypes.length > 0) {
        query = query.in("alert_type", selectedAlertTypes as Database["public"]["Enums"]["alert_type"][]);
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Failed to generate report: " + error.message);
        return;
      }

      const alertData = (data ?? []) as unknown as AlertRecord[];
      setAlerts(alertData);
      setStats(computeStats(alertData));
    } catch (err) {
      toast.error("An unexpected error occurred while generating the report");
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const severityVariant = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "outline";
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "destructive";
      case "acknowledged":
        return "secondary";
      case "resolved":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compliance Report
          </DialogTitle>
        </DialogHeader>

        {/* Filter Controls */}
        {!alerts && (
          <div className="space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Site Filter */}
            <div className="space-y-2">
              <Label>Site (optional)</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alert Types */}
            <div className="space-y-2">
              <Label>Alert Types (optional)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(ALERT_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`alert-type-${type}`}
                      checked={selectedAlertTypes.includes(type)}
                      onCheckedChange={() => toggleAlertType(type)}
                    />
                    <Label
                      htmlFor={`alert-type-${type}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <Button onClick={generateReport} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        )}

        {/* Report View */}
        {alerts && stats && (
          <div className="print:p-8">
            {/* Report Header */}
            <div className="text-center mb-6 print:break-inside-avoid">
              <h2 className="text-xl font-bold">
                FreshTrack Pro — Compliance Report
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(startDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                —{" "}
                {new Date(endDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Generated on {new Date().toLocaleString()}
              </p>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card className="print:break-inside-avoid">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <div className="flex justify-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{stats.bySeverity.critical} critical</span>
                    <span>{stats.bySeverity.warning} warning</span>
                    <span>{stats.bySeverity.info} info</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="print:break-inside-avoid">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">MTTA</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(stats.mtta)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mean Time to Acknowledge
                  </p>
                </CardContent>
              </Card>

              <Card className="print:break-inside-avoid">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">MTTR</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(stats.mttr)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mean Time to Resolve
                  </p>
                </CardContent>
              </Card>

              <Card className="print:break-inside-avoid">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Resolution Rate
                  </p>
                  <p className="text-2xl font-bold">
                    {(stats.resolutionRate * 100).toFixed(1)}%
                  </p>
                  <div className="flex justify-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{stats.byStatus.resolved} resolved</span>
                    <span>{stats.byStatus.active} active</span>
                    <span>{stats.byStatus.acknowledged} ack'd</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert Table */}
            <div className="print:break-inside-avoid">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Triggered</TableHead>
                    <TableHead>Acknowledged</TableHead>
                    <TableHead>Resolved</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        No alerts found for the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {alerts.map((alert) => {
                    const typeConfig = getAlertTypeConfig(alert.alert_type);
                    return (
                      <TableRow key={alert.id}>
                        <TableCell className="whitespace-nowrap">
                          {typeConfig.label}
                        </TableCell>
                        <TableCell>
                          <Badge variant={severityVariant(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {alert.unit?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {alert.unit?.area?.site?.name ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(alert.triggered_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {alert.acknowledged_at
                            ? formatDate(alert.acknowledged_at)
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {alert.resolved_at
                            ? formatDate(alert.resolved_at)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(alert.status)}>
                            {alert.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center mt-6 print:hidden">
              <Button
                variant="outline"
                onClick={() => {
                  setAlerts(null);
                  setStats(null);
                }}
              >
                Back to Filters
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print Report
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
