import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  LogOut,
  MapPin,
  Settings,
  LayoutGrid,
  Building2,
  Menu,
  X,
  ChevronLeft,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import BrandedLogo from "@/components/BrandedLogo";
import NotificationDropdown from "@/components/NotificationDropdown";
import { clearOfflineStorage } from "@/lib/offlineStorage";
import { usePermissions } from "@/hooks/useUserRole";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
}

import { ClipboardList, AlertCircle, FileBarChart } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/organization", label: "Organization", icon: Building2 },
  { href: "/sites", label: "Sites", icon: MapPin },
  { href: "/manual-log", label: "Log Temps", icon: ClipboardList },
  { href: "/alerts", label: "Alerts", icon: AlertCircle },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

const DashboardLayout = ({ children, title, showBack, backHref }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canDeleteEntities, isLoading: permissionsLoading } = usePermissions();
  const [session, setSession] = useState<Session | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [alertCount, setAlertCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        // If user explicitly signed out, go to landing page
        // If session was never there (initial load), go to auth
        if (event === 'SIGNED_OUT') {
          navigate("/");
        } else {
          navigate("/auth");
        }
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
      loadOrgData();
    }
  }, [session]);

  const loadOrgData = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", session!.user.id)
      .maybeSingle();

    if (profile?.organization_id) {
      setOrgId(profile.organization_id);
      
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) setOrgName(org.name);

      // Get alert count - explicitly filter by organization_id
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "active");

      setAlertCount(count || 0);
    }
  };

  const handleSignOut = async () => {
    try {
      // Clear React Query cache BEFORE signing out for session isolation
      queryClient.clear();
      
      // Clear IndexedDB offline storage
      await clearOfflineStorage();
      
      // Reset component state
      setOrgId(null);
      setOrgName("");
      setAlertCount(0);
      
      // Sign out from Supabase - auth listener will handle navigation
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({ 
          title: "Sign out failed", 
          description: error.message,
          variant: "destructive" 
        });
        return;
      }
      
      toast({ title: "Signed out successfully" });
      // Navigation handled by onAuthStateChange listener
    } catch (err) {
      console.error('Sign out error:', err);
      toast({ 
        title: "Sign out failed", 
        description: "An unexpected error occurred",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {showBack && backHref ? (
                <Link to={backHref}>
                  <Button variant="ghost" size="icon" className="mr-2">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="lg:hidden"
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                >
                  {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              )}
              <Link to="/dashboard" className="flex items-center gap-3">
                <BrandedLogo showText={true} size="md" />
                {orgName && (
                  <span className="hidden sm:inline text-sm text-muted-foreground">
                    · {orgName}
                  </span>
                )}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationDropdown alertCount={alertCount} />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:flex">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} className="sm:hidden">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 flex-col fixed left-0 top-16 bottom-0 border-r border-border/50 bg-card/50">
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
              return (
                <Link key={item.href} to={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-accent/10 text-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {canDeleteEntities && !permissionsLoading && (
              <Link to="/admin/recently-deleted">
                <Button
                  variant={location.pathname === "/admin/recently-deleted" ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 mt-4 pt-4 border-t border-border/50",
                    location.pathname === "/admin/recently-deleted" && "bg-accent/10 text-accent"
                  )}
                >
                  <Trash2 className="w-5 h-5" />
                  Recently Deleted
                </Button>
              </Link>
            )}
          </nav>
        </aside>

        {/* Mobile Nav Overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="absolute left-0 top-16 bottom-0 w-64 bg-card border-r border-border/50 p-4">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href || 
                    (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
                  return (
                    <Link 
                      key={item.href} 
                      to={item.href}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-3",
                          isActive && "bg-accent/10 text-accent"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
                {canDeleteEntities && !permissionsLoading && (
                  <Link 
                    to="/admin/recently-deleted"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Button
                      variant={location.pathname === "/admin/recently-deleted" ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 mt-4 pt-4 border-t border-border/50",
                        location.pathname === "/admin/recently-deleted" && "bg-accent/10 text-accent"
                      )}
                    >
                      <Trash2 className="w-5 h-5" />
                      Recently Deleted
                    </Button>
                  </Link>
                )}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {title && (
              <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
