import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";
import {
  Building2,
  Bell,
  Users,
  Save,
  Loader2,
  Mail,
  Smartphone,
  MessageSquare,
  UserPlus,
  Shield,
  Crown,
  User,
  Eye,
  Trash2,
  CreditCard,
  AlertTriangle,
  Code2,
  CheckCircle,
  Radio,
  Thermometer
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { BillingTab } from "@/components/billing/BillingTab";
import { AlertRulesScopedEditor } from "@/components/settings/AlertRulesScopedEditor";
import { SensorSimulatorPanel } from "@/components/admin/SensorSimulatorPanel";
import { EdgeFunctionDiagnostics, DebugModeToggle } from "@/components/debug";
import { NotificationSettingsCard } from "@/components/settings/NotificationSettingsCard";
import { SmsAlertHistory } from "@/components/settings/SmsAlertHistory";
import { WebhookStatusCard } from "@/components/settings/WebhookStatusCard";
import { GatewayManager } from "@/components/settings/GatewayManager";
import { SensorManager } from "@/components/settings/SensorManager";
import { TTNConnectionSettings } from "@/components/settings/TTNConnectionSettings";
import { TTNCredentialsPanel } from "@/components/settings/TTNCredentialsPanel";
import { TTNProvisioningLogs } from "@/components/settings/TTNProvisioningLogs";
import { EmulatorSyncHistory } from "@/components/settings/EmulatorSyncHistory";
import { EmulatorResyncCard } from "@/components/settings/EmulatorResyncCard";
import { AccountDeletionModal } from "@/components/settings/AccountDeletionModal";

// E.164 phone number validation regex
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Helper to format phone number for display as user types
const formatPhoneForInput = (value: string): string => {
  // Remove all non-digit characters except +
  const cleaned = value.replace(/[^\d+]/g, '');
  // Ensure it starts with +
  if (cleaned && !cleaned.startsWith('+')) {
    return '+' + cleaned;
  }
  return cleaned;
};

// Helper to validate E.164 format
const isValidE164 = (phone: string): boolean => {
  return E164_REGEX.test(phone);
};

type AppRole = Database["public"]["Enums"]["app_role"];
type ComplianceMode = Database["public"]["Enums"]["compliance_mode"];

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  compliance_mode: ComplianceMode;
}

interface NotificationPrefs {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  notification_preferences: NotificationPrefs | null;
}

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
}

const roleConfig: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: "Owner", icon: Crown, color: "bg-warning/15 text-warning border-warning/30" },
  admin: { label: "Admin", icon: Shield, color: "bg-accent/15 text-accent border-accent/30" },
  manager: { label: "Manager", icon: Users, color: "bg-primary/15 text-primary border-primary/30" },
  staff: { label: "Staff", icon: User, color: "bg-safe/15 text-safe border-safe/30" },
  viewer: { label: "Viewer", icon: Eye, color: "bg-muted text-muted-foreground border-border" },
  inspector: { label: "Inspector", icon: Eye, color: "bg-accent/15 text-accent border-accent/30" },
};

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

// Alert Rules Tab Component now uses the scoped editor directly

const Settings = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string; site_id: string }[]>([]);
  
  // Account deletion state
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [sensorCount, setSensorCount] = useState(0);
  const [gatewayCount, setGatewayCount] = useState(0);
  const [hasOtherUsers, setHasOtherUsers] = useState(false);
  
  // TTN config state for SensorManager
  const [ttnConfig, setTtnConfig] = useState<{
    isEnabled: boolean;
    hasApiKey: boolean;
    applicationId: string | null;
    apiKeyLast4: string | null;
  } | null>(null);

  // Form states
  const [orgName, setOrgName] = useState("");
  const [orgTimezone, setOrgTimezone] = useState("");
  const [orgCompliance, setOrgCompliance] = useState<ComplianceMode>("standard");
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);
  const [userPhone, setUserPhone] = useState("");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("staff");

  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "organization";
  const action = searchParams.get("action");

  useEffect(() => {
    // Check for success/canceled params from Stripe
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast.success("Subscription activated successfully!");
    } else if (canceled === "true") {
      toast.info("Checkout canceled");
    }
  }, [searchParams]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadSettings();
    }
  }, [session]);

  const loadSettings = async () => {
    try {
      // Get profile with org
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session!.user.id)
        .maybeSingle();

      if (!profileData?.organization_id) {
        navigate("/onboarding");
        return;
      }

      setProfile({
        id: profileData.id,
        user_id: profileData.user_id,
        email: profileData.email,
        full_name: profileData.full_name,
        phone: profileData.phone,
        notification_preferences: profileData.notification_preferences as NotificationPrefs | null,
      });
      setUserPhone(profileData.phone || "");
      
      const prefs = profileData.notification_preferences as NotificationPrefs | null;
      setNotifPush(prefs?.push ?? true);
      setNotifEmail(prefs?.email ?? true);
      setNotifSms(prefs?.sms ?? false);

      // Get organization
      const { data: orgData } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profileData.organization_id)
        .maybeSingle();

      if (orgData) {
        setOrganization(orgData as Organization);
        setOrgName(orgData.name);
        setOrgTimezone(orgData.timezone);
        setOrgCompliance(orgData.compliance_mode);
      }

      // Get current user's role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session!.user.id)
        .eq("organization_id", profileData.organization_id)
        .maybeSingle();

      if (roleError) {
        console.error("[Settings] Failed to load user role:", roleError);
        toast.error("Failed to load user permissions. Some features may be hidden.");
      }

      if (roleData) {
        setUserRole(roleData.role);
      }

      // Get all users in org
      const { data: usersData } = await supabase
        .from("user_roles")
        .select("id, user_id, role, organization_id")
        .eq("organization_id", profileData.organization_id);

      if (usersData) {
        // Get profiles for these users using the profiles table with proper RLS
        const userIds = usersData.map(u => u.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);

        const usersWithRoles: UserWithRole[] = usersData.map(ur => {
          const userProfile = profilesData?.find(p => p.user_id === ur.user_id);
          return {
            id: ur.id,
            user_id: ur.user_id,
            email: userProfile?.email || "",
            full_name: userProfile?.full_name || null,
            role: ur.role,
          };
        });

        setUsers(usersWithRoles);
      }

      // Load sites for gateway management
      const { data: sitesData } = await supabase
        .from("sites")
        .select("id, name")
        .eq("organization_id", profileData.organization_id)
        .is("deleted_at", null)
        .order("name");
      
      if (sitesData) {
        setSites(sitesData);
      }

      // Load units for sensor management (through areas → sites)
      const { data: unitsData } = await supabase
        .from("units")
        .select("id, name, area_id, areas!inner(site_id, sites!inner(organization_id))")
        .eq("areas.sites.organization_id", profileData.organization_id)
        .is("deleted_at", null)
        .order("name");
      
      if (unitsData) {
        // Extract site_id from nested join
        const formattedUnits = unitsData.map((u: any) => ({
          id: u.id,
          name: u.name,
          site_id: u.areas?.site_id || "",
        }));
        setUnits(formattedUnits);
      }

      // Load sensor count for deletion modal
      const { count: sensorCountResult } = await supabase
        .from("lora_sensors")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profileData.organization_id);
      setSensorCount(sensorCountResult || 0);

      // Load gateway count for deletion modal
      const { count: gatewayCountResult } = await supabase
        .from("gateways")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profileData.organization_id);
      setGatewayCount(gatewayCountResult || 0);

      // Check if there are other users in the org
      setHasOtherUsers((usersData?.length || 0) > 1);

      // Load TTN config for SensorManager provisioning buttons
      try {
        const { data: ttnData } = await supabase.functions.invoke("manage-ttn-settings", {
          body: { action: "get", organization_id: profileData.organization_id }
        });
        
        if (ttnData) {
          setTtnConfig({
            isEnabled: ttnData.is_enabled ?? false,
            hasApiKey: !!(ttnData.ttn_api_key_last4 || ttnData.has_api_key),
            applicationId: ttnData.ttn_application_id ?? null,
            apiKeyLast4: ttnData.ttn_api_key_last4 ?? null,
          });
        }
      } catch (ttnError) {
        console.error("[Settings] Failed to load TTN config:", ttnError);
        // Don't block settings load if TTN config fails
      }

    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    }
    setIsLoading(false);
  };

  const saveOrganization = async () => {
    if (!organization) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgName,
          timezone: orgTimezone,
          compliance_mode: orgCompliance,
        })
        .eq("id", organization.id);

      if (error) throw error;
      toast.success("Organization updated");
    } catch (error) {
      console.error("Error saving organization:", error);
      toast.error("Failed to save organization");
    }
    setIsSaving(false);
  };

  const saveNotifications = async () => {
    if (!profile) return;
    
    // Validate phone number if SMS is enabled
    if (notifSms && userPhone) {
      if (!isValidE164(userPhone)) {
        toast.error("Invalid phone number format. Please use E.164 format (e.g., +15551234567)");
        return;
      }
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: userPhone || null,
          notification_preferences: {
            push: notifPush,
            email: notifEmail,
            sms: notifSms,
          },
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("Notification preferences saved");
    } catch (error) {
      console.error("Error saving notifications:", error);
      toast.error("Failed to save preferences");
    }
    setIsSaving(false);
  };

  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsVerified, setSmsVerified] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  // Helper to parse Telnyx-specific errors into user-friendly messages
  const getTelnyxErrorMessage = (error: string): string => {
    if (error.includes("10009") || error.includes("Authentication")) {
      return "SMS authentication failed. Please contact support.";
    }
    if (error.includes("40310") || error.includes("40311") || error.includes("invalid")) {
      return "Invalid phone number format or number not SMS-capable.";
    }
    if (error.includes("40300") || error.includes("opted out")) {
      return "This number has opted out of SMS. Reply START to re-enable.";
    }
    if (error.includes("40001") || error.includes("landline")) {
      return "Cannot send SMS to landline numbers.";
    }
    if (error.includes("40002") || error.includes("40003") || error.includes("blocked")) {
      return "Message blocked by carrier. Try a different message.";
    }
    if (error.includes("20100") || error.includes("funds")) {
      return "SMS service temporarily unavailable. Contact support.";
    }
    if (error.includes("rate") || error.includes("limit")) {
      return "Rate limited. Please wait a few minutes before trying again.";
    }
    return error;
  };

  const sendTestSms = async () => {
    if (!profile || !userPhone || !organization) return;
    
    if (!isValidE164(userPhone)) {
      toast.error("Invalid phone number. Please save a valid E.164 format number first.");
      return;
    }
    
    setIsSendingSms(true);
    try {
      toast.loading("Sending test SMS...", { id: "test-sms" });
      
      const { data, error } = await supabase.functions.invoke("send-sms-alert", {
        body: {
          to: userPhone,
          message: "✅ FreshTrack Test: Your SMS alerts are configured correctly! You will receive critical alerts at this number.",
          alertType: "test",
          organizationId: organization.id,
        },
      });

      if (error) throw error;
      
      if (data?.status === "sent") {
        toast.success(`Test SMS sent! (ID: ${data.provider_message_id?.slice(-8) || 'confirmed'})`, { id: "test-sms" });
        setSmsVerified(true);
        // Refresh SMS history
        queryClient.invalidateQueries({ queryKey: ["sms-alert-history", organization.id] });
      } else if (data?.status === "rate_limited") {
        toast.info("SMS rate limited. Please wait 15 minutes before trying again.", { id: "test-sms" });
      } else {
        const friendlyError = getTelnyxErrorMessage(data?.error || "Unknown error");
        toast.error(friendlyError, { id: "test-sms", duration: 8000 });
        setSmsVerified(false);
      }
    } catch (error) {
      console.error("Error sending test SMS:", error);
      const message = error instanceof Error ? error.message : "Failed to send test SMS";
      toast.error(getTelnyxErrorMessage(message), { id: "test-sms" });
      setSmsVerified(false);
    } finally {
      setIsSendingSms(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    if (!organization) return;
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("organization_id", organization.id);

      if (error) throw error;
      
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
      toast.success("Role updated");
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const removeUser = async (userId: string) => {
    if (!organization) return;
    try {
      // First, clean up any sensors created by this user
      toast.loading("Cleaning up user's sensors...", { id: "remove-user" });
      
      const { data: cleanupResult, error: cleanupError } = await supabase.functions.invoke(
        "cleanup-user-sensors",
        { body: { user_id: userId, organization_id: organization.id } }
      );

      if (cleanupError) {
        console.error("Sensor cleanup error:", cleanupError);
        // Continue with user removal even if cleanup fails
        toast.warning("Some sensors may not have been cleaned up", { id: "remove-user" });
      } else if (cleanupResult?.deleted_count > 0) {
        console.log(`Cleaned up ${cleanupResult.deleted_count} sensors (${cleanupResult.ttn_deprovision_count} from TTN)`);
      }

      // Remove user role
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", organization.id);

      if (error) throw error;
      
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      
      // Show success with cleanup summary
      if (cleanupResult?.deleted_count > 0) {
        toast.success(`User removed. Cleaned up ${cleanupResult.deleted_count} sensor(s).`, { id: "remove-user" });
      } else {
        toast.success("User removed from organization", { id: "remove-user" });
      }
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user", { id: "remove-user" });
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !organization) return;
    
    // For now, just show a message - actual invite would require email functionality
    toast.info(`Invite functionality coming soon. Would invite ${inviteEmail} as ${inviteRole}`);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("staff");
  };

  const canManageUsers = userRole === "owner" || userRole === "admin";
  const canEditOrg = userRole === "owner" || userRole === "admin";
  const canManageBilling = userRole === "owner";
  const canViewDeveloperTools = ["owner", "admin", "manager"].includes(userRole || "");
  const canManageTTN = userRole === "owner" || userRole === "admin";

  if (isLoading) {
    return (
      <DashboardLayout title="Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings">
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className={`grid w-full max-w-4xl ${canManageUsers ? 'grid-cols-8' : 'grid-cols-7'}`}>
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Alert Rules</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          {canManageUsers && (
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Gateways</span>
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="sensors" className="flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              <span className="hidden sm:inline">Sensors</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="developer" className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Developer</span>
          </TabsTrigger>
        </TabsList>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>
                Manage your organization's settings and compliance preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!canEditOrg}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">URL Slug</Label>
                  <Input
                    id="orgSlug"
                    value={organization?.slug || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={orgTimezone} onValueChange={setOrgTimezone} disabled={!canEditOrg}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compliance">Compliance Mode</Label>
                  <Select 
                    value={orgCompliance} 
                    onValueChange={(v) => setOrgCompliance(v as ComplianceMode)}
                    disabled={!canEditOrg}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="haccp">HACCP</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    HACCP mode enables stricter logging and audit requirements.
                  </p>
                </div>
              </div>

              {canEditOrg && (
                <div className="flex justify-end pt-4">
                  <Button onClick={saveOrganization} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Separator before Danger Zone */}
          <Separator className="my-8" />

          {/* Danger Zone - Account Deletion */}
          <Card id="danger-zone" className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : (
                  <Button 
                    variant="destructive" 
                    onClick={() => setDeleteAccountOpen(true)}
                    disabled={!session?.user || !profile}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Deletion Modal - Always render, controls internally */}
          <AccountDeletionModal
            open={deleteAccountOpen}
            onOpenChange={setDeleteAccountOpen}
            userId={session?.user?.id || ''}
            userEmail={profile?.email || ''}
            isOwner={userRole === "owner"}
            hasOtherUsers={hasOtherUsers}
            sensorCount={sensorCount}
            gatewayCount={gatewayCount}
          />
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="alerts">
          {organization && (
            <AlertRulesScopedEditor organizationId={organization.id} canEdit={canEditOrg} />
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          {organization && (
            <BillingTab 
              organizationId={organization.id} 
              canManageBilling={canManageBilling} 
            />
          )}
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          {/* Org-level notification settings */}
          {organization && (
            <NotificationSettingsCard 
              organizationId={organization.id} 
              canEdit={canEditOrg} 
            />
          )}

          {/* Personal notification preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to receive alerts and updates for your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive alerts in your browser or mobile app
                      </p>
                    </div>
                  </div>
                  <Switch checked={notifPush} onCheckedChange={setNotifPush} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Get alerts sent to {profile?.email}
                      </p>
                    </div>
                  </div>
                  <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-safe/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-safe" />
                    </div>
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Critical alerts via text message
                      </p>
                    </div>
                  </div>
                  <Switch checked={notifSms} onCheckedChange={setNotifSms} />
                </div>
              </div>

              {notifSms && (
                <div className="space-y-3 pt-2">
                  <Label htmlFor="phone">Phone Number (E.164 Format)</Label>
                  <div className="flex gap-2 items-start">
                    <Smartphone className="w-5 h-5 text-muted-foreground mt-2.5" />
                    <div className="flex-1 max-w-xs space-y-1">
                      <div className="relative">
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+15551234567"
                          value={userPhone}
                          onChange={(e) => {
                            setUserPhone(formatPhoneForInput(e.target.value));
                            setSmsVerified(null); // Reset verification status on change
                          }}
                          className={`${userPhone && !isValidE164(userPhone) ? "border-destructive" : ""} ${smsVerified === true ? "border-safe pr-8" : ""}`}
                        />
                        {smsVerified === true && (
                          <CheckCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-safe" />
                        )}
                      </div>
                      {userPhone && !isValidE164(userPhone) && (
                        <p className="text-xs text-destructive">
                          Please enter a valid E.164 format (e.g., +15551234567)
                        </p>
                      )}
                      {smsVerified === true && (
                        <p className="text-xs text-safe flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          SMS verified - alerts will be sent to this number
                        </p>
                      )}
                      {smsVerified === false && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          SMS verification failed. Check the error message and try again.
                        </p>
                      )}
                    </div>
                    {canManageUsers && userPhone && isValidE164(userPhone) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={sendTestSms}
                        disabled={isSendingSms}
                        className="shrink-0"
                      >
                        {isSendingSms ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Test SMS"
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required for SMS alerts. Use international format starting with + and country code. Standard messaging rates may apply.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={saveNotifications} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Status + SMS Alert History */}
          {canManageUsers && organization && (
            <div className="mt-6 space-y-6">
              <WebhookStatusCard organizationId={organization.id} canEdit={canEditOrg} />
              <SmsAlertHistory organizationId={organization.id} />
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    Manage users and their roles in your organization.
                  </CardDescription>
                </div>
                {canManageUsers && (
                  <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to join your organization.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="inviteEmail">Email Address</Label>
                          <Input
                            id="inviteEmail"
                            type="email"
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="inviteRole">Role</Label>
                          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleInvite}>
                          Send Invitation
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      {canManageUsers && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const role = roleConfig[user.role];
                      const RoleIcon = role.icon;
                      const isCurrentUser = user.user_id === session?.user.id;
                      const isOwner = user.role === "owner";

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                                <User className="w-4 h-4 text-accent" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {user.full_name || "Unnamed User"}
                                  {isCurrentUser && (
                                    <span className="text-xs text-muted-foreground ml-2">(You)</span>
                                  )}
                                </p>
                                {/* Only show email to admins/owners or if it's the current user */}
                                {(canManageUsers || isCurrentUser) ? (
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                ) : (
                                  <p className="text-sm text-muted-foreground italic">Contact info hidden</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {canManageUsers && !isOwner && !isCurrentUser ? (
                              <Select
                                value={user.role}
                                onValueChange={(v) => updateUserRole(user.user_id, v as AppRole)}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="outline" className={role.color}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {role.label}
                              </Badge>
                            )}
                          </TableCell>
                          {canManageUsers && (
                            <TableCell>
                              {!isOwner && !isCurrentUser && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => removeUser(user.user_id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed">
                <h4 className="font-medium mb-2">Role Permissions</h4>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-warning" />
                    <span><strong>Owner:</strong> Full access, billing, can transfer ownership</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent" />
                    <span><strong>Admin:</strong> Manage users, sites, devices, and settings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span><strong>Manager:</strong> Manage sites and respond to alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-safe" />
                    <span><strong>Staff:</strong> Log temperatures and acknowledge alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span><strong>Viewer:</strong> View-only access to dashboard and reports</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gateways Tab (Admin Only) */}
        {canManageUsers && organization && (
          <TabsContent value="gateways">
            <GatewayManager
              organizationId={organization.id}
              sites={sites}
              canEdit={canManageUsers}
              ttnConfig={ttnConfig}
            />
          </TabsContent>
        )}

        {/* Sensors Tab (Admin Only) */}
        {canManageUsers && organization && (
          <TabsContent value="sensors">
            <SensorManager
              organizationId={organization.id}
              sites={sites}
              units={units}
              canEdit={canManageUsers}
              autoOpenAdd={action === "add" && defaultTab === "sensors"}
              ttnConfig={ttnConfig}
            />
          </TabsContent>
        )}

        {/* Developer Tab - always render content, show permission message if no access */}
        <TabsContent value="developer" className="space-y-6">
          {canViewDeveloperTools ? (
            <>
              {canManageTTN && <DebugModeToggle />}
              <TTNCredentialsPanel key={organization?.id || 'no-org'} organizationId={organization?.id || null} readOnly={!canManageTTN} />
              <TTNConnectionSettings organizationId={organization?.id || null} readOnly={!canManageTTN} />
              {canManageTTN && (
                <>
                  <TTNProvisioningLogs organizationId={organization?.id || null} />
                  <EmulatorResyncCard organizationId={organization?.id || null} />
                  <EmulatorSyncHistory organizationId={organization?.id || null} />
                  <EdgeFunctionDiagnostics />
                  <SensorSimulatorPanel organizationId={organization?.id || null} />
                </>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-warning mb-4" />
                <h3 className="font-medium">Developer Tools Unavailable</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  This section requires Owner, Admin, or Manager role. Current role: {userRole || "Not loaded"}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Debug: Org ID {organization?.id?.slice(0, 8) || "none"}...
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
