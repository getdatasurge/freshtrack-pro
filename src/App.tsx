import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SuperAdminProvider } from "@/contexts/SuperAdminContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import OrganizationDashboard from "./pages/OrganizationDashboard";
import Onboarding from "./pages/Onboarding";
import Sites from "./pages/Sites";
import SiteDetail from "./pages/SiteDetail";
import AreaDetail from "./pages/AreaDetail";
import ManualLog from "./pages/ManualLog";
import Alerts from "./pages/Alerts";
import UnitDetail from "./pages/UnitDetail";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Inspector from "./pages/Inspector";
import PilotSetup from "./pages/PilotSetup";
import EventHistory from "./pages/EventHistory";
import RecentlyDeleted from "./pages/RecentlyDeleted";
import TTNCleanup from "./pages/TTNCleanup";
import DataMaintenance from "./pages/DataMaintenance";
import NotFound from "./pages/NotFound";
// Platform Admin pages (Super Admin only)
import PlatformOrganizations from "./pages/platform/PlatformOrganizations";
import PlatformOrganizationDetail from "./pages/platform/PlatformOrganizationDetail";
import PlatformUsers from "./pages/platform/PlatformUsers";
import PlatformUserDetail from "./pages/platform/PlatformUserDetail";
import PlatformAuditLog from "./pages/platform/PlatformAuditLog";
import PlatformDeveloperTools from "./pages/platform/PlatformDeveloperTools";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SuperAdminProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/organization" element={<OrganizationDashboard />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/sites" element={<Sites />} />
          <Route path="/sites/:siteId" element={<SiteDetail />} />
          <Route path="/sites/:siteId/areas/:areaId" element={<AreaDetail />} />
          <Route path="/units/:unitId" element={<UnitDetail />} />
          <Route path="/manual-log" element={<ManualLog />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/inspector" element={<Inspector />} />
          <Route path="/pilot-setup" element={<PilotSetup />} />
          <Route path="/events" element={<EventHistory />} />
          <Route path="/admin/recently-deleted" element={<RecentlyDeleted />} />
          <Route path="/admin/ttn-cleanup" element={<TTNCleanup />} />
          <Route path="/admin/data-maintenance" element={<DataMaintenance />} />
          {/* Platform Admin routes (Super Admin only) */}
          <Route path="/platform" element={<PlatformOrganizations />} />
          <Route path="/platform/organizations" element={<PlatformOrganizations />} />
          <Route path="/platform/organizations/:orgId" element={<PlatformOrganizationDetail />} />
          <Route path="/platform/users" element={<PlatformUsers />} />
          <Route path="/platform/users/:userId" element={<PlatformUserDetail />} />
          <Route path="/platform/audit" element={<PlatformAuditLog />} />
          <Route path="/platform/developer-tools" element={<PlatformDeveloperTools />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SuperAdminProvider>
  </QueryClientProvider>
);

export default App;
