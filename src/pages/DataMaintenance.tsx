import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Trash2,
  AlertTriangle,
  Building2,
  MapPin,
  LayoutGrid,
  Thermometer,
  Radio,
  Bell,
  FileText,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";

interface OrphanOrg {
  org_id: string;
  org_name: string;
  org_slug: string;
  org_created_at: string;
  sites_count: number;
  areas_count: number;
  units_count: number;
  sensors_count: number;
  gateways_count: number;
  alerts_count: number;
  event_logs_count: number;
  has_subscription: boolean;
}

interface CleanupJob {
  id: string;
  organization_id: string;
  reason: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

const DataMaintenance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [orphanOrgs, setOrphanOrgs] = useState<OrphanOrg[]>([]);
  const [cleanupJobs, setCleanupJobs] = useState<CleanupJob[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrphanOrg | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has any admin/owner role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminRole = roles?.some(r => r.role === "owner" || r.role === "admin");
      
      if (!hasAdminRole) {
        toast({ title: "Access Denied", description: "Admin access required", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setIsLoading(false);
      await scanOrphans();
      await loadCleanupJobs();
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/dashboard");
    }
  };

  const scanOrphans = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.rpc("find_orphan_organizations");
      
      if (error) throw error;
      
      setOrphanOrgs(data || []);
    } catch (error: any) {
      console.error("Error scanning orphans:", error);
      toast({ title: "Scan Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const loadCleanupJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("org_cleanup_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setCleanupJobs(data || []);
    } catch (error: any) {
      console.error("Error loading cleanup jobs:", error);
    }
  };

  const handleSoftDelete = async (org: OrphanOrg) => {
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc("soft_delete_organization", {
        p_org_id: org.org_id,
        p_user_id: user?.id,
      });

      if (error) throw error;

      toast({ 
        title: "Organization Soft Deleted", 
        description: `${org.org_name} has been marked as deleted. Slug "${org.org_slug}" is now available.` 
      });
      
      // Refresh the list
      await scanOrphans();
      await loadCleanupJobs();
      setDeleteDialogOpen(false);
      setSelectedOrg(null);
    } catch (error: any) {
      console.error("Error soft deleting org:", error);
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHardDelete = async (org: OrphanOrg) => {
    if (deleteConfirmText !== "DELETE") {
      toast({ title: "Confirmation Required", description: "Type DELETE to confirm", variant: "destructive" });
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc("hard_delete_organization", {
        p_org_id: org.org_id,
      });

      if (error) throw error;

      toast({ 
        title: "Organization Permanently Deleted", 
        description: `${org.org_name} and all its data have been permanently removed.` 
      });
      
      // Refresh the list
      await scanOrphans();
      await loadCleanupJobs();
      setHardDeleteDialogOpen(false);
      setSelectedOrg(null);
      setDeleteConfirmText("");
    } catch (error: any) {
      console.error("Error hard deleting org:", error);
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getTotalDependents = (org: OrphanOrg) => {
    return org.sites_count + org.areas_count + org.units_count + 
           org.sensors_count + org.gateways_count + org.alerts_count + org.event_logs_count;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-warning" />
              Data Maintenance
            </h1>
            <p className="text-muted-foreground mt-1">
              Find and clean up orphaned organizations and data
            </p>
          </div>
          <Button onClick={() => navigate("/settings")} variant="outline">
            Back to Settings
          </Button>
        </div>

        {/* Orphan Organizations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Orphan Organizations
                </CardTitle>
                <CardDescription>
                  Organizations with no users attached. These can be safely deleted.
                </CardDescription>
              </div>
              <Button onClick={scanOrphans} disabled={isScanning} variant="outline" size="sm">
                {isScanning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Scan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {orphanOrgs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No orphan organizations found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Dependencies</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphanOrgs.map((org) => (
                    <TableRow key={org.org_id}>
                      <TableCell className="font-medium">{org.org_name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{org.org_slug}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(org.org_created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {org.sites_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="w-3 h-3 mr-1" />{org.sites_count}
                            </Badge>
                          )}
                          {org.units_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Thermometer className="w-3 h-3 mr-1" />{org.units_count}
                            </Badge>
                          )}
                          {org.sensors_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Radio className="w-3 h-3 mr-1" />{org.sensors_count}
                            </Badge>
                          )}
                          {org.alerts_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Bell className="w-3 h-3 mr-1" />{org.alerts_count}
                            </Badge>
                          )}
                          {org.event_logs_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" />{org.event_logs_count}
                            </Badge>
                          )}
                          {getTotalDependents(org) === 0 && (
                            <span className="text-muted-foreground text-xs">Empty</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {org.has_subscription ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">None</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrg(org);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            Soft Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedOrg(org);
                              setHardDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Cleanup Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Recent Cleanup Jobs
            </CardTitle>
            <CardDescription>
              History of organization cleanup operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cleanupJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No cleanup jobs yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization ID</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleanupJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {job.organization_id.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.reason}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            job.status === "SUCCEEDED" ? "default" :
                            job.status === "FAILED" ? "destructive" :
                            "secondary"
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.attempts}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(job.created_at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Soft Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft Delete Organization?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will mark <strong>{selectedOrg?.org_name}</strong> as deleted and free up the slug 
                "<code className="bg-muted px-1 py-0.5 rounded">{selectedOrg?.org_slug}</code>".
              </p>
              <p>
                The organization and its data will be hidden but can potentially be restored.
                Any TTN devices will be queued for deprovisioning.
              </p>
              {selectedOrg && getTotalDependents(selectedOrg) > 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-sm">
                  <p className="font-medium text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    This organization has {getTotalDependents(selectedOrg)} dependent records
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrg && handleSoftDelete(selectedOrg)}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Soft Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard Delete Confirmation Dialog */}
      <AlertDialog open={hardDeleteDialogOpen} onOpenChange={(open) => {
        setHardDeleteDialogOpen(open);
        if (!open) setDeleteConfirmText("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Permanently Delete Organization?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will <strong>permanently delete</strong> <strong>{selectedOrg?.org_name}</strong> 
                and ALL its data. This action cannot be undone.
              </p>
              {selectedOrg && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium">The following will be deleted:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    <li>{selectedOrg.sites_count} sites</li>
                    <li>{selectedOrg.areas_count} areas</li>
                    <li>{selectedOrg.units_count} units</li>
                    <li>{selectedOrg.sensors_count} sensors</li>
                    <li>{selectedOrg.gateways_count} gateways</li>
                    <li>{selectedOrg.alerts_count} alerts</li>
                    <li>{selectedOrg.event_logs_count} event logs</li>
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">Type DELETE to confirm:</Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => selectedOrg && handleHardDelete(selectedOrg)}
              disabled={isDeleting || deleteConfirmText !== "DELETE"}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Permanently Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default DataMaintenance;
