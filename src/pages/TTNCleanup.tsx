import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  useTTNDeprovisionJobs,
  useTTNJobStats,
  useScanTTNOrphans,
  useEnqueueOrphanCleanup,
  useRetryDeprovisionJob,
  TTNDevice,
} from "@/hooks/useTTNDeprovision";

export default function TTNCleanup() {
  const [selectedOrphans, setSelectedOrphans] = useState<TTNDevice[]>([]);
  const [scanResult, setScanResult] = useState<{
    ttn_application_id: string;
    devices: TTNDevice[];
    orphans: TTNDevice[];
  } | null>(null);

  // Get user's org
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const orgId = profile?.organization_id;

  const { data: jobStats, isLoading: statsLoading } = useTTNJobStats(orgId);
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useTTNDeprovisionJobs(orgId);
  const scanMutation = useScanTTNOrphans();
  const enqueueMutation = useEnqueueOrphanCleanup();
  const retryMutation = useRetryDeprovisionJob();

  const handleScan = async () => {
    if (!orgId) return;
    try {
      const result = await scanMutation.mutateAsync(orgId);
      setScanResult(result);
      setSelectedOrphans([]);
      toast.success(`Found ${result.orphans.length} orphaned devices`);
    } catch (error) {
      toast.error(`Scan failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDeleteSelected = async () => {
    if (!orgId || !scanResult || selectedOrphans.length === 0) return;
    try {
      const count = await enqueueMutation.mutateAsync({
        organizationId: orgId,
        orphans: selectedOrphans,
        ttnApplicationId: scanResult.ttn_application_id,
      });
      toast.success(`Queued ${count} devices for cleanup`);
      setSelectedOrphans([]);
      refetchJobs();
    } catch (error) {
      toast.error(`Failed to queue cleanup: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      PENDING: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      RUNNING: { variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      RETRYING: { variant: "outline", icon: <RefreshCw className="h-3 w-3" /> },
      SUCCEEDED: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
      FAILED: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      BLOCKED: { variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
    };
    const config = variants[status] || variants.PENDING;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">TTN Cleanup</h1>
          <p className="text-muted-foreground">Manage TTN device lifecycle and cleanup orphaned devices</p>
        </div>

        {/* Stats Banner */}
        {jobStats && jobStats.needs_attention > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Attention Required</AlertTitle>
            <AlertDescription>
              {jobStats.needs_attention} job(s) need attention. Review failed or blocked jobs below.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {statsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                  <CardTitle className="text-2xl">{jobStats?.pending || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Running</CardDescription>
                  <CardTitle className="text-2xl">{jobStats?.running || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Retrying</CardDescription>
                  <CardTitle className="text-2xl">{jobStats?.retrying || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Succeeded</CardDescription>
                  <CardTitle className="text-2xl text-green-600">{jobStats?.succeeded || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Failed</CardDescription>
                  <CardTitle className="text-2xl text-destructive">{jobStats?.failed || 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Blocked</CardDescription>
                  <CardTitle className="text-2xl text-destructive">{jobStats?.blocked || 0}</CardTitle>
                </CardHeader>
              </Card>
            </>
          )}
        </div>

        {/* Orphan Scanner */}
        <Card>
          <CardHeader>
            <CardTitle>Orphan Scanner</CardTitle>
            <CardDescription>Scan TTN for devices not in FrostGuard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleScan} disabled={scanMutation.isPending || !orgId}>
              {scanMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Scan TTN Application
            </Button>

            {scanResult && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Found {scanResult.devices.length} devices in TTN, {scanResult.orphans.length} orphans
                </p>
                
                {scanResult.orphans.length > 0 && (
                  <>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                        disabled={selectedOrphans.length === 0 || enqueueMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected ({selectedOrphans.length})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrphans(scanResult.orphans)}
                      >
                        Select All
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Device ID</TableHead>
                          <TableHead>DevEUI</TableHead>
                          <TableHead>Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scanResult.orphans.map((orphan) => (
                          <TableRow key={orphan.device_id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedOrphans.some(o => o.device_id === orphan.device_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrphans([...selectedOrphans, orphan]);
                                  } else {
                                    setSelectedOrphans(selectedOrphans.filter(o => o.device_id !== orphan.device_id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{orphan.device_id}</TableCell>
                            <TableCell className="font-mono text-sm">{orphan.dev_eui}</TableCell>
                            <TableCell>{orphan.name || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Deprovision Jobs</CardTitle>
              <CardDescription>Recent TTN cleanup jobs</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchJobs()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : jobs && jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sensor</TableHead>
                    <TableHead>DevEUI</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.slice(0, 20).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{job.sensor_name || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{job.dev_eui}</TableCell>
                      <TableCell><Badge variant="outline">{job.reason}</Badge></TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>{job.attempts}/{job.max_attempts}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {job.last_error_message || "-"}
                      </TableCell>
                      <TableCell>
                        {(job.status === "FAILED" || job.status === "BLOCKED") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryMutation.mutateAsync(job.id).then(() => refetchJobs())}
                            disabled={retryMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">No jobs found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
