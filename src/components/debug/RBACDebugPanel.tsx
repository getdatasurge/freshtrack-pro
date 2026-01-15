import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { Shield, Database, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

/**
 * RBAC Debug Panel - Only visible when URL includes ?debug_rbac=1
 * 
 * Shows role resolution state for debugging Super Admin visibility issues.
 * NEVER logs tokens, headers, or sensitive data.
 */
export function RBACDebugPanel() {
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [directRpcResult, setDirectRpcResult] = useState<boolean | null>(null);
  const [directRpcError, setDirectRpcError] = useState<string | null>(null);
  const [platformRolesCount, setPlatformRolesCount] = useState<number | null>(null);
  const [fetchTimestamp, setFetchTimestamp] = useState<string | null>(null);
  
  const { isSuperAdmin, isLoadingSuperAdmin: rolesLoading } = useSuperAdmin();

  // Check if debug mode is enabled
  const isDebugEnabled = typeof window !== 'undefined' && 
    window.location.search.includes('debug_rbac=1');

  useEffect(() => {
    if (!isDebugEnabled) return;

    const fetchDebugInfo = async () => {
      setFetchTimestamp(new Date().toISOString());

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({ email: authUser.email || 'unknown', id: authUser.id });
      }

      // Direct RPC call to test the function
      try {
        const { data, error } = await supabase.rpc('is_current_user_super_admin');
        if (error) {
          setDirectRpcError(error.message);
          setDirectRpcResult(null);
        } else {
          setDirectRpcResult(data);
          setDirectRpcError(null);
        }
      } catch (err) {
        setDirectRpcError(err instanceof Error ? err.message : 'Unknown error');
      }

      // Count platform_roles (will fail if RLS blocks, which is expected for non-admins)
      try {
        const { count, error } = await supabase
          .from('platform_roles')
          .select('*', { count: 'exact', head: true });
        if (!error) {
          setPlatformRolesCount(count);
        }
      } catch {
        setPlatformRolesCount(null);
      }
    };

    fetchDebugInfo();
  }, [isDebugEnabled]);

  if (!isDebugEnabled) return null;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'unknown';
  const maskedEmail = user?.email 
    ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') 
    : 'not logged in';

  return (
    <Card className="border-dashed border-2 border-yellow-500/50 bg-yellow-50/10 dark:bg-yellow-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-mono">
          <Shield className="h-4 w-4 text-yellow-600" />
          RBAC Debug Panel
          <Badge variant="outline" className="ml-auto text-xs">
            dev-only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs font-mono">
        {/* Environment */}
        <div className="flex items-center gap-2">
          <Database className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Project:</span>
          <code className="bg-muted px-1 rounded">{projectId}</code>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">User:</span>
          <code className="bg-muted px-1 rounded">{maskedEmail}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">User ID:</span>
          <code className="bg-muted px-1 rounded text-[10px]">
            {user?.id || 'not authenticated'}
          </code>
        </div>

        {/* Role Resolution */}
        <div className="border-t pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">rolesLoaded:</span>
            {rolesLoading ? (
              <Badge variant="secondary">loading...</Badge>
            ) : (
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                true
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">isSuperAdmin:</span>
            {isSuperAdmin ? (
              <Badge className="bg-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                true
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                false
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">RPC Direct Result:</span>
            {directRpcError ? (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            ) : directRpcResult === null ? (
              <Badge variant="secondary">pending</Badge>
            ) : directRpcResult ? (
              <Badge className="bg-green-600">true</Badge>
            ) : (
              <Badge variant="destructive">false</Badge>
            )}
          </div>

          {directRpcError && (
            <div className="text-destructive text-[10px] bg-destructive/10 p-1 rounded">
              {directRpcError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">sourceUsed:</span>
            <code className="bg-muted px-1 rounded">rpc:is_current_user_super_admin</code>
          </div>

          {platformRolesCount !== null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">platform_roles rows visible:</span>
              <code className="bg-muted px-1 rounded">{platformRolesCount}</code>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="border-t pt-2 flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Fetched: {fetchTimestamp || 'never'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
