import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserRoleInfo {
  role: AppRole | null;
  isLoading: boolean;
  organizationId: string | null;
}

export interface RolePermissions {
  canLogTemps: boolean;
  canViewAlerts: boolean;
  canAcknowledgeAlerts: boolean;
  canEditTempLimits: boolean;
  canManageSites: boolean;
  canManageSensors: boolean;
  canManageUsers: boolean;
  canEditComplianceSettings: boolean;
  canExportReports: boolean;
  canViewAuditLogs: boolean;
  canDeleteEntities: boolean;
  canRestoreEntities: boolean;
  canPermanentlyDelete: boolean;
  canCustomizeDashboard: boolean;
}

// Define permissions for each role
const rolePermissions: Record<AppRole, RolePermissions> = {
  owner: {
    canLogTemps: true,
    canViewAlerts: true,
    canAcknowledgeAlerts: true,
    canEditTempLimits: true,
    canManageSites: true,
    canManageSensors: true,
    canManageUsers: true,
    canEditComplianceSettings: true,
    canExportReports: true,
    canViewAuditLogs: true,
    canDeleteEntities: true,
    canRestoreEntities: true,
    canPermanentlyDelete: true,
    canCustomizeDashboard: true,
  },
  admin: {
    canLogTemps: true,
    canViewAlerts: true,
    canAcknowledgeAlerts: true,
    canEditTempLimits: true,
    canManageSites: true,
    canManageSensors: true,
    canManageUsers: true,
    canEditComplianceSettings: true,
    canExportReports: true,
    canViewAuditLogs: true,
    canDeleteEntities: true,
    canRestoreEntities: true,
    canPermanentlyDelete: true,
    canCustomizeDashboard: true,
  },
  manager: {
    canLogTemps: true,
    canViewAlerts: true,
    canAcknowledgeAlerts: true,
    canEditTempLimits: true,
    canManageSites: false,
    canManageSensors: false,
    canManageUsers: false,
    canEditComplianceSettings: false,
    canExportReports: true,
    canViewAuditLogs: false,
    canDeleteEntities: false,
    canRestoreEntities: false,
    canPermanentlyDelete: false,
    canCustomizeDashboard: true,
  },
  staff: {
    canLogTemps: true,
    canViewAlerts: true,
    canAcknowledgeAlerts: false,
    canEditTempLimits: false,
    canManageSites: false,
    canManageSensors: false,
    canManageUsers: false,
    canEditComplianceSettings: false,
    canExportReports: false,
    canViewAuditLogs: false,
    canDeleteEntities: false,
    canRestoreEntities: false,
    canPermanentlyDelete: false,
    canCustomizeDashboard: false,
  },
  viewer: {
    canLogTemps: false,
    canViewAlerts: true,
    canAcknowledgeAlerts: false,
    canEditTempLimits: false,
    canManageSites: false,
    canManageSensors: false,
    canManageUsers: false,
    canEditComplianceSettings: false,
    canExportReports: false,
    canViewAuditLogs: false,
    canDeleteEntities: false,
    canRestoreEntities: false,
    canPermanentlyDelete: false,
    canCustomizeDashboard: false,
  },
  inspector: {
    canLogTemps: false,
    canViewAlerts: true,
    canAcknowledgeAlerts: false,
    canEditTempLimits: false,
    canManageSites: false,
    canManageSensors: false,
    canManageUsers: false,
    canEditComplianceSettings: false,
    canExportReports: true,
    canViewAuditLogs: false,
    canDeleteEntities: false,
    canRestoreEntities: false,
    canPermanentlyDelete: false,
    canCustomizeDashboard: false,
  },
};

export function useUserRole(): UserRoleInfo {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    loadRole();
  }, []);

  const loadRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get profile with org
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setIsLoading(false);
        return;
      }

      setOrganizationId(profile.organization_id);

      // Get role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
    setIsLoading(false);
  };

  return { role, isLoading, organizationId };
}

export function getPermissions(role: AppRole | null): RolePermissions {
  if (!role) {
    return {
      canLogTemps: false,
      canViewAlerts: false,
      canAcknowledgeAlerts: false,
      canEditTempLimits: false,
      canManageSites: false,
      canManageSensors: false,
      canManageUsers: false,
      canEditComplianceSettings: false,
      canExportReports: false,
      canViewAuditLogs: false,
      canDeleteEntities: false,
      canRestoreEntities: false,
      canPermanentlyDelete: false,
      canCustomizeDashboard: false,
    };
  }
  return rolePermissions[role];
}

export function usePermissions(): RolePermissions & { isLoading: boolean; role: AppRole | null } {
  const { role, isLoading } = useUserRole();
  const permissions = getPermissions(role);
  return { ...permissions, isLoading, role };
}
