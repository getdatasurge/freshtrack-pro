import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Building2,
  Users,
  MapPin,
  Thermometer,
  Calendar,
  Globe,
  Shield,
  ExternalLink,
  User,
  Eye,
  ChevronRight,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  compliance_mode: string;
  created_at: string;
}

interface OrgUser {
  user_id: string;
  role: string;
  profile: {
    email: string;
    full_name: string | null;
    phone: string | null;
  } | null;
}

interface Site {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  timezone: string;
  area_count?: number;
  unit_count?: number;
}

export default function PlatformOrganizationDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const { logSuperAdminAction, setViewingOrg, isSupportModeActive, startImpersonation } = useSuperAdmin();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (orgId) {
      loadOrganizationDetails();
    }
  }, [orgId]);

  const loadOrganizationDetails = async () => {
    if (!orgId) return;

    setIsLoading(true);
    try {
      // Load organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);

      // Set viewing context
      setViewingOrg(org.id, org.name);

      // Load users
      const { data: userRoles, error: usersError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          profile:profiles!user_roles_user_id_fkey (
            email,
            full_name,
            phone
          )
        `)
        .eq('organization_id', orgId);

      if (!usersError && userRoles) {
        setUsers(userRoles as unknown as OrgUser[]);
      }

      // Load sites
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('name');

      if (!sitesError && sitesData) {
        // Get counts for each site
        const sitesWithCounts = await Promise.all(
          sitesData.map(async (site) => {
            const { count: areaCount } = await supabase
              .from('areas')
              .select('*', { count: 'exact', head: true })
              .eq('site_id', site.id)
              .is('deleted_at', null);

            const { count: unitCount } = await supabase
              .from('units')
              .select('*, areas!inner(*)', { count: 'exact', head: true })
              .eq('areas.site_id', site.id)
              .is('deleted_at', null);

            return {
              ...site,
              area_count: areaCount || 0,
              unit_count: unitCount || 0,
            };
          })
        );
        setSites(sitesWithCounts);
      }

      logSuperAdminAction('VIEWED_ORGANIZATION_DETAIL', 'organization', orgId, orgId, { org_name: org.name });
    } catch (err) {
      console.error('Error loading organization details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAsUser = async (user: OrgUser) => {
    if (!isSupportModeActive || !organization) return;

    await startImpersonation(
      user.user_id,
      user.profile?.email || 'Unknown',
      user.profile?.full_name || user.profile?.email || 'Unknown',
      organization.id,
      organization.name
    );
  };

  if (isLoading || !organization) {
    return (
      <PlatformLayout title="Organization Details" showBack backHref="/platform/organizations">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading organization details...</div>
        </div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout
      title={organization.name}
      showBack
      backHref="/platform/organizations"
    >
      {/* Organization Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sites.reduce((sum, s) => sum + (s.unit_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={organization.compliance_mode === 'haccp' ? 'default' : 'secondary'}>
              {organization.compliance_mode || 'standard'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Organization Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Slug</dt>
              <dd className="font-mono text-sm">{organization.slug}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Timezone</dt>
              <dd className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {organization.timezone}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(organization.created_at).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs truncate">{organization.id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Tabs for Users and Sites */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="sites">Sites ({sites.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    {isSupportModeActive && <TableHead className="w-24">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSupportModeActive ? 5 : 4} className="text-center py-8 text-muted-foreground">
                        No users in this organization
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {user.profile?.full_name || 'No name'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{user.profile?.email || 'No email'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'owner' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.profile?.phone || '-'}
                        </TableCell>
                        {isSupportModeActive && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Link to={`/platform/users/${user.user_id}`}>
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewAsUser(user)}
                                title="View as this user"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-center">Areas</TableHead>
                    <TableHead className="text-center">Units</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No sites in this organization
                      </TableCell>
                    </TableRow>
                  ) : (
                    sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{site.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {site.address || '-'}
                        </TableCell>
                        <TableCell className="text-center">{site.area_count}</TableCell>
                        <TableCell className="text-center">{site.unit_count}</TableCell>
                        <TableCell>
                          <Badge variant={site.is_active ? 'default' : 'secondary'}>
                            {site.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" disabled>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PlatformLayout>
  );
}
