import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Trash2
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

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

const Settings = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

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
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session!.user.id)
        .eq("organization_id", profileData.organization_id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);
      }

      // Get all users in org
      const { data: usersData } = await supabase
        .from("user_roles")
        .select("id, user_id, role, organization_id")
        .eq("organization_id", profileData.organization_id);

      if (usersData) {
        // Get profiles for these users
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
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", organization.id);

      if (error) throw error;
      
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      toast.success("User removed from organization");
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user");
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
      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="organization" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organization</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
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
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to receive alerts and updates.
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
                <div className="space-y-2 pt-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <Smartphone className="w-5 h-5 text-muted-foreground mt-2.5" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Required for SMS alerts. Standard messaging rates may apply.
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
                                <p className="text-sm text-muted-foreground">{user.email}</p>
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
      </Tabs>
    </DashboardLayout>
  );
};

export default Settings;
