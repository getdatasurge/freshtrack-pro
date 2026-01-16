import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2 } from 'lucide-react';

interface PlatformGuardProps {
  children: ReactNode;
}

/**
 * PlatformGuard - Protects platform routes with Super Admin check
 * 
 * Flow:
 * 1. While roleLoadStatus === 'loading': Show loading spinner
 * 2. When rolesLoaded && !isSuperAdmin: Redirect to /dashboard with toast
 * 3. When rolesLoaded && isSuperAdmin: Render children
 */
export function PlatformGuard({ children }: PlatformGuardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, isLoadingSuperAdmin, rolesLoaded, roleLoadStatus } = useSuperAdmin();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only redirect once, when roles are loaded and user is not super admin
    if (rolesLoaded && !isSuperAdmin && !hasRedirected) {
      setHasRedirected(true);
      
      console.log('[PlatformGuard] Access denied - redirecting to dashboard', {
        roleLoadStatus,
        isSuperAdmin,
        rolesLoaded,
      });
      
      toast({
        title: "Access Denied",
        description: "Platform Admin access requires Super Admin privileges.",
        variant: "destructive",
      });
      
      navigate("/dashboard", { replace: true });
    }
  }, [rolesLoaded, isSuperAdmin, hasRedirected, navigate, toast, roleLoadStatus]);

  // Show loading state while checking roles
  if (isLoadingSuperAdmin || roleLoadStatus === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="relative">
            <Shield className="h-12 w-12 text-primary/20" />
            <Loader2 className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary" />
          </div>
          <p className="text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not super admin (redirect will happen via useEffect)
  if (!isSuperAdmin) {
    return null;
  }

  // Authorized - render platform content
  return <>{children}</>;
}
