import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Thermometer, 
  Bell, 
  LogOut,
  MapPin,
  Settings,
  LayoutGrid,
  Building2,
  Menu,
  X,
  ChevronLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
}

import { ClipboardList, AlertCircle } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/sites", label: "Sites", icon: MapPin },
  { href: "/manual-log", label: "Log Temps", icon: ClipboardList },
  { href: "/alerts", label: "Alerts", icon: AlertCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const DashboardLayout = ({ children, title, showBack, backHref }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [orgName, setOrgName] = useState("");
  const [alertCount, setAlertCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) setOrgName(org.name);

      // Get alert count
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      setAlertCount(count || 0);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/");
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
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                  <Thermometer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-foreground">FrostGuard</span>
                  {orgName && (
                    <span className="hidden sm:inline text-sm text-muted-foreground ml-2">
                      · {orgName}
                    </span>
                  )}
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/alerts">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-alarm text-alarm-foreground text-xs rounded-full flex items-center justify-center">
                      {alertCount}
                    </span>
                  )}
                </Button>
              </Link>
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
