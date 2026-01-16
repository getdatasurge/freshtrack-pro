import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useImpersonateAndNavigate, ImpersonationTarget } from '@/hooks/useImpersonateAndNavigate';
import { ConfirmSpoofingModal } from '@/components/platform/ConfirmSpoofingModal';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  User,
  Building2,
  ChevronRight,
  RefreshCw,
  Eye,
  Shield,
  Loader2,
} from 'lucide-react';

interface PlatformUser {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
  is_super_admin: boolean;
  created_at: string;
}

export default function PlatformUsers() {
  const { logSuperAdminAction, isSuperAdmin } = useSuperAdmin();
  const { 
    requestImpersonation, 
    cancelRequest,
    confirmAndNavigate,
    pendingTarget,
    isNavigating, 
    canImpersonate 
  } = useImpersonateAndNavigate();

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
    logSuperAdminAction('VIEWED_USERS_LIST');
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Get all profiles with their org info and roles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          full_name,
          phone,
          organization_id,
          created_at,
          organization:organizations (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Get roles for all users
      const userIds = profiles?.map(p => p.user_id) || [];

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Get platform roles (super admins)
      const { data: platformRoles } = await supabase
        .from('platform_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]));
      const superAdminSet = new Set(
        platformRoles?.filter(r => r.role === 'SUPER_ADMIN').map(r => r.user_id)
      );

      const usersWithDetails: PlatformUser[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        organization_id: profile.organization_id,
        organization_name: (profile.organization as { name: string } | null)?.name || null,
        role: rolesMap.get(profile.user_id) || null,
        is_super_admin: superAdminSet.has(profile.user_id),
        created_at: profile.created_at,
      }));

      setUsers(usersWithDetails);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.email.toLowerCase().includes(query) ||
      (user.full_name && user.full_name.toLowerCase().includes(query)) ||
      (user.organization_name && user.organization_name.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  const handleViewAsUser = (user: PlatformUser) => {
    if (!user.organization_id || !user.organization_name) return;

    // This opens the confirmation modal
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

  const superAdminCount = users.filter(u => u.is_super_admin).length;

  // Check if modal should be open
  const isModalOpen = pendingTarget !== null;

  return (
    <>
      {/* Confirmation Modal */}
      <ConfirmSpoofingModal
        target={pendingTarget}
        isOpen={isModalOpen}
        onClose={cancelRequest}
        onConfirm={handleConfirmImpersonation}
        isLoading={isNavigating}
      />

      <PlatformLayout title="Users">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Super Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{superAdminCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              No Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {users.filter(u => !u.organization_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name, email, or organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={loadUsers} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {user.full_name || 'No name'}
                        </span>
                        {user.is_super_admin && (
                          <Badge variant="outline" className="ml-1 border-purple-300 text-purple-700">
                            <Shield className="w-3 h-3 mr-1" />
                            Super Admin
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.organization_name ? (
                        <Link
                          to={`/platform/organizations/${user.organization_id}`}
                          className="flex items-center gap-1 text-sm hover:underline"
                        >
                          <Building2 className="w-3 h-3" />
                          {user.organization_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">No organization</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant={user.role === 'owner' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link to={`/platform/users/${user.user_id}`}>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                        {canImpersonate && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleViewAsUser(user)}
                                    disabled={!user.organization_id || isNavigating}
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                                  >
                                    {isNavigating ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.organization_id 
                                  ? 'View app as this user' 
                                  : 'No organization membership'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </PlatformLayout>
    </>
  );
}
