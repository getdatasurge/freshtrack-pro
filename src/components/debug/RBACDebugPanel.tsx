import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin, RoleLoadStatus } from '@/contexts/SuperAdminContext';
import { Shield, Database, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [statusHistory, setStatusHistory] = useState<Array<{ status: RoleLoadStatus; time: string }>>([]);
  
  const { 
    isSuperAdmin, 
    isLoadingSuperAdmin, 
    rolesLoaded,
    roleLoadStatus,
    roleLoadError,
    refreshSuperAdminStatus 
  } = useSuperAdmin();

  // Check if debug mode is enabled
  const isDebugEnabled = typeof window !== 'undefined' && 
    window.location.search.includes('debug_rbac=1');

  // Track status transitions
  useEffect(() => {
    if (!isDebugEnabled) return;
    
    setStatusHistory(prev => {
      const lastEntry = prev[prev.length - 1];
      if (lastEntry?.status === roleLoadStatus) return prev;
      return [...prev.slice(-4), { status: roleLoadStatus, time: new Date().toISOString() }];
    });
  }, [roleLoadStatus, isDebugEnabled]);

  const fetchDebugInfo = useCallback(async () => {
    if (!isDebugEnabled) return;
    
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
  }, [isDebugEnabled]);

  useEffect(() => {
    fetchDebugInfo();
  }, [fetchDebugInfo]);

  const handleRecheckRoles = async () => {
    await refreshSuperAdminStatus();
    await fetchDebugInfo();
  };

  if (!isDebugEnabled) return null;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'unknown';
  const maskedEmail = user?.email 
    ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') 
    : 'not logged in';

  const getStatusBadge = (status: RoleLoadStatus) => {
    switch (status) {
      case 'idle':
        return <Badge variant="secondary">idle</Badge>;
      case 'loading':
        return <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30">loading</Badge>;
      case 'loaded':
        return <Badge className="bg-green-600">loaded</Badge>;
      case 'error':
        return <Badge variant="destructive">error</Badge>;
    }
  };

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

        {/* Role Resolution State Machine */}
        <div className="border-t pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">roleLoadStatus:</span>
            {getStatusBadge(roleLoadStatus)}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">rolesLoaded:</span>
            {rolesLoaded ? (
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-3 w-3 mr-1" />
                true
              </Badge>
            ) : (
              <Badge variant="secondary">false</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">isLoadingSuperAdmin:</span>
            {isLoadingSuperAdmin ? (
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                true
              </Badge>
            ) : (
              <Badge variant="outline">false</Badge>
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

          {roleLoadError && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground">roleLoadError:</span>
              <div className="text-destructive text-[10px] bg-destructive/10 p-1 rounded flex-1">
                {roleLoadError}
              </div>
            </div>
          )}

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

        {/* Status History */}
        {statusHistory.length > 1 && (
          <div className="border-t pt-2">
            <div className="text-muted-foreground mb-1">Status Transitions:</div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {statusHistory.map((entry, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  {getStatusBadge(entry.status)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recheck Button */}
        <div className="border-t pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleRecheckRoles}
            disabled={isLoadingSuperAdmin}
            className="w-full"
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isLoadingSuperAdmin && "animate-spin")} />
            Recheck Roles
          </Button>
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
