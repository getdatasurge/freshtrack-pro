import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useImpersonateAndNavigate, ImpersonationTarget } from '@/hooks/useImpersonateAndNavigate';
import { ConfirmSpoofingModal } from '@/components/platform/ConfirmSpoofingModal';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Shield,
  Eye,
  ExternalLink,
  Activity,
  Loader2,
} from 'lucide-react';

interface UserDetails {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
  is_super_admin: boolean;
  created_at: string;
  notification_preferences: Record<string, boolean> | null;
}

export default function PlatformUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { logSuperAdminAction } = useSuperAdmin();
  const { 
    requestImpersonation,
    cancelRequest,
    confirmAndNavigate,
    pendingTarget,
    isNavigating, 
    canImpersonate 
  } = useImpersonateAndNavigate();

  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<Array<{
    action: string;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    if (userId) {
      loadUserDetails();
    }
  }, [userId]);

  const loadUserDetails = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // Get profile with org
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          full_name,
          phone,
          organization_id,
          created_at,
          notification_preferences,
          organization:organizations (
            name
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      // Get role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      // Check if super admin
      const { data: platformRole } = await supabase
        .from('platform_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'SUPER_ADMIN')
        .maybeSingle();

      const userDetails: UserDetails = {
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        organization_id: profile.organization_id,
        organization_name: (profile.organization as { name: string } | null)?.name || null,
        role: roleData?.role || null,
        is_super_admin: !!platformRole,
        created_at: profile.created_at,
        notification_preferences: profile.notification_preferences as Record<string, boolean> | null,
      };

      setUser(userDetails);

      // Log this view
      logSuperAdminAction(
        'VIEWED_USER_DETAIL',
        'user',
        userId,
        profile.organization_id || undefined,
        { user_email: profile.email }
      );

      // Get some recent activity (manual temp logs as example)
      if (profile.organization_id) {
        const { data: logs } = await supabase
          .from('manual_temperature_logs')
          .select('created_at')
          .eq('logged_by', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (logs) {
          setRecentActivity(
            logs.map(log => ({
              action: 'Logged temperature',
              timestamp: log.created_at,
            }))
          );
        }
      }
    } catch (err) {
      console.error('Error loading user details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAsUser = () => {
    if (!user || !user.organization_id || !user.organization_name) return;

    requestImpersonation({
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
    });
  };

  const handleConfirmImpersonation = async (target: ImpersonationTarget, reason?: string): Promise<boolean> => {
    return confirmAndNavigate(target, reason);
  };

  const isModalOpen = pendingTarget !== null;

  if (isLoading || !user) {
    return (
      <>
        <ConfirmSpoofingModal
          target={pendingTarget}
          isOpen={isModalOpen}
          onClose={cancelRequest}
          onConfirm={handleConfirmImpersonation}
          isLoading={isNavigating}
        />
        <PlatformLayout title="User Details" showBack backHref="/platform/users">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading user details...</div>
          </div>
        </PlatformLayout>
      </>
    );
  }

  return (
    <>
      <ConfirmSpoofingModal
        target={pendingTarget}
        isOpen={isModalOpen}
        onClose={cancelRequest}
        onConfirm={handleConfirmImpersonation}
        isLoading={isNavigating}
      />
      <PlatformLayout
      title={user.full_name || user.email}
      showBack
      backHref="/platform/users"
    >
      {/* User Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              User Information
              {user.is_super_admin && (
                <Badge variant="outline" className="ml-auto border-purple-300 text-purple-700">
                  <Shield className="w-3 h-3 mr-1" />
                  Super Admin
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div>{user.email}</div>
              </div>
            </div>

            {user.full_name && (
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Full Name</div>
                  <div>{user.full_name}</div>
                </div>
              </div>
            )}

            {user.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div>{user.phone}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Joined</div>
                <div>{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono mt-4 pt-4 border-t">
              User ID: {user.user_id}
            </div>
          </CardContent>
        </Card>

        {/* Organization Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization Membership
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.organization_id ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Organization</div>
                  <Link
                    to={`/platform/organizations/${user.organization_id}`}
                    className="flex items-center gap-2 text-lg font-medium hover:underline"
                  >
                    {user.organization_name}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Role</div>
                  <Badge variant={user.role === 'owner' ? 'default' : 'secondary'}>
                    {user.role || 'No role'}
                  </Badge>
                </div>

                {canImpersonate && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={handleViewAsUser}
                      disabled={isNavigating}
                      className="w-full text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                    >
                      {isNavigating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      View App as This User
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground">
                This user is not a member of any organization.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span>{activity.action}</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No recent activity found</div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      {user.notification_preferences && Object.keys(user.notification_preferences).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(user.notification_preferences).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge variant={value ? 'default' : 'secondary'}>
                    {value ? 'On' : 'Off'}
                  </Badge>
                  <span className="text-sm">{key.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </PlatformLayout>
    </>
  );
}
