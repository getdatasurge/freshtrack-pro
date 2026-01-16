import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
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
  Search,
  Building2,
  Users,
  MapPin,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  compliance_mode: string;
  created_at: string;
  user_count?: number;
  site_count?: number;
}

export default function PlatformOrganizations() {
  const { logSuperAdminAction } = useSuperAdmin();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadOrganizations();
    logSuperAdminAction('VIEWED_ORGANIZATIONS_LIST');
  }, []);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      // Get organizations
      const { data: orgs, error, count } = await supabase
        .from('organizations')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get counts via RPC (bypasses RLS, Super Admin only)
      const { data: stats, error: statsError } = await supabase
        .rpc('get_platform_organization_stats');

      if (statsError) {
        console.error('Stats RPC error:', statsError);
      }

      // Merge counts into orgs
      const statsMap = new Map(
        (stats || []).map((s: { org_id: string; user_count: number; site_count: number }) => [s.org_id, s])
      );

      const orgsWithCounts = (orgs || []).map((org) => ({
        ...org,
        user_count: statsMap.get(org.id)?.user_count || 0,
        site_count: statsMap.get(org.id)?.site_count || 0,
      }));

      setOrganizations(orgsWithCounts);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading organizations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrganizations = organizations.filter((org) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(query) ||
      org.slug.toLowerCase().includes(query)
    );
  });

  return (
    <PlatformLayout title="Organizations">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.reduce((sum, org) => sum + (org.user_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.reduce((sum, org) => sum + (org.site_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={loadOrganizations} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Sites</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredOrganizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No organizations match your search' : 'No organizations found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrganizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {org.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        {org.user_count}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {org.site_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.compliance_mode === 'haccp' ? 'default' : 'secondary'}>
                        {org.compliance_mode || 'standard'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link to={`/platform/organizations/${org.id}`}>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PlatformLayout>
  );
}

export { PlatformOrganizations };
