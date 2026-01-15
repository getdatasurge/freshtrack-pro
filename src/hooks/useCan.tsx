/**
 * Permission-aware React hooks and components
 *
 * These utilities provide a clean, declarative way to check permissions in the UI.
 * They integrate with the canonical permissions system and the user's current role.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useUserRole } from './useUserRole';
import {
  can,
  canAny,
  canAll,
  hasRoleOrHigher,
  canManageRole,
  getAssignableRoles,
  getPermissionsForRole,
  type Role,
  type Permission,
  ROLE_CONFIG,
} from '@/lib/permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Context for permission state
interface PermissionContextValue {
  role: Role | null;
  isLoading: boolean;
  organizationId: string | null;
}

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

/**
 * Provider component that makes permission state available throughout the app
 * Wrap your app or a section with this to enable permission hooks
 */
export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { role, isLoading, organizationId } = useUserRole();

  const value = useMemo(
    () => ({ role, isLoading, organizationId }),
    [role, isLoading, organizationId]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Hook to access the permission context
 * @throws Error if used outside PermissionProvider
 */
function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    // Fall back to useUserRole directly if not in provider
    // This maintains backwards compatibility
    const roleInfo = useUserRole();
    return roleInfo;
  }
  return context;
}

/**
 * Hook to check if the current user has a specific permission
 * @param permission - The permission to check
 * @returns Object with `allowed` boolean and `isLoading` state
 *
 * @example
 * const { allowed, isLoading } = useCan('users.invite');
 * if (allowed) { ... }
 */
export function useCan(permission: Permission): { allowed: boolean; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const allowed = can(role, permission);
  return { allowed, isLoading };
}

/**
 * Hook to check if the current user has ANY of the specified permissions
 * @param permissions - Array of permissions to check
 * @returns Object with `allowed` boolean and `isLoading` state
 */
export function useCanAny(permissions: Permission[]): { allowed: boolean; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const allowed = canAny(role, permissions);
  return { allowed, isLoading };
}

/**
 * Hook to check if the current user has ALL of the specified permissions
 * @param permissions - Array of permissions to check
 * @returns Object with `allowed` boolean and `isLoading` state
 */
export function useCanAll(permissions: Permission[]): { allowed: boolean; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const allowed = canAll(role, permissions);
  return { allowed, isLoading };
}

/**
 * Hook to get the current user's role
 * @returns Object with role, isLoading, and organizationId
 */
export function useCurrentRole(): { role: Role | null; isLoading: boolean; organizationId: string | null } {
  return usePermissionContext();
}

/**
 * Hook to check if current user has a role at or above a minimum level
 * @param minimumRole - The minimum required role
 */
export function useHasRoleOrHigher(minimumRole: Role): { allowed: boolean; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const allowed = hasRoleOrHigher(role, minimumRole);
  return { allowed, isLoading };
}

/**
 * Hook to check if the current user can manage a specific role
 * @param targetRole - The role to check management capability for
 */
export function useCanManageRole(targetRole: Role): { allowed: boolean; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const allowed = canManageRole(role, targetRole);
  return { allowed, isLoading };
}

/**
 * Hook to get the list of roles the current user can assign
 */
export function useAssignableRoles(): { roles: Role[]; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const roles = getAssignableRoles(role);
  return { roles, isLoading };
}

/**
 * Hook to get all permissions for the current user
 */
export function useMyPermissions(): { permissions: Permission[]; isLoading: boolean } {
  const { role, isLoading } = usePermissionContext();
  const permissions = getPermissionsForRole(role);
  return { permissions, isLoading };
}

// ============================================
// Declarative Components
// ============================================

interface CanProps {
  /** The permission(s) required */
  permission: Permission | Permission[];
  /** How to handle multiple permissions: 'any' (default) or 'all' */
  mode?: 'any' | 'all';
  /** Content to render if permission is granted */
  children: React.ReactNode;
  /** Optional content to render if permission is denied (default: nothing) */
  fallback?: React.ReactNode;
  /** If true, show a loading indicator while checking permissions */
  showLoading?: boolean;
}

/**
 * Declarative component that renders children only if user has required permission(s)
 *
 * @example
 * // Single permission
 * <Can permission="users.invite">
 *   <InviteButton />
 * </Can>
 *
 * @example
 * // Multiple permissions (any)
 * <Can permission={['users.invite', 'users.update_role']}>
 *   <UserManagementSection />
 * </Can>
 *
 * @example
 * // Multiple permissions (all required)
 * <Can permission={['sites.create', 'sites.delete']} mode="all">
 *   <SiteManagementSection />
 * </Can>
 *
 * @example
 * // With fallback
 * <Can permission="reports.export" fallback={<UpgradePrompt />}>
 *   <ExportButton />
 * </Can>
 */
export function Can({ permission, mode = 'any', children, fallback = null, showLoading = false }: CanProps) {
  const { role, isLoading } = usePermissionContext();

  if (isLoading && showLoading) {
    return <span className="animate-pulse bg-muted rounded h-4 w-16 inline-block" />;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = mode === 'all' ? canAll(role, permissions) : canAny(role, permissions);

  if (allowed) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

interface CannotProps {
  /** The permission(s) to check (renders if user does NOT have them) */
  permission: Permission | Permission[];
  /** How to handle multiple permissions: 'any' or 'all' (default) */
  mode?: 'any' | 'all';
  /** Content to render if permission is denied */
  children: React.ReactNode;
}

/**
 * Inverse of Can - renders children only if user does NOT have permission(s)
 * Useful for showing upgrade prompts, restricted messages, etc.
 *
 * @example
 * <Cannot permission="reports.export">
 *   <p>Export is available on Pro plans</p>
 * </Cannot>
 */
export function Cannot({ permission, mode = 'all', children }: CannotProps) {
  const { role, isLoading } = usePermissionContext();

  if (isLoading) return null;

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasPermission = mode === 'all' ? canAll(role, permissions) : canAny(role, permissions);

  if (!hasPermission) {
    return <>{children}</>;
  }

  return null;
}

interface WithPermissionTooltipProps {
  /** The permission required for this action */
  permission: Permission;
  /** The element to wrap (should accept disabled prop) */
  children: React.ReactElement<{ disabled?: boolean; className?: string }>;
  /** Custom message when permission is denied */
  deniedMessage?: string;
}

/**
 * Wraps an interactive element and disables it with a tooltip if user lacks permission
 *
 * @example
 * <WithPermissionTooltip permission="users.invite">
 *   <Button onClick={handleInvite}>Invite User</Button>
 * </WithPermissionTooltip>
 */
export function WithPermissionTooltip({
  permission,
  children,
  deniedMessage,
}: WithPermissionTooltipProps) {
  const { role, isLoading } = usePermissionContext();
  const allowed = can(role, permission);

  if (isLoading) {
    return React.cloneElement(children, { disabled: true });
  }

  if (allowed) {
    return children;
  }

  // Find the minimum role required for this permission
  const requiredRole = (['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'] as Role[]).find(
    r => can(r, permission)
  );
  const message = deniedMessage || `Requires ${requiredRole ? ROLE_CONFIG[requiredRole].label : 'higher'} role`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            {React.cloneElement(children, {
              disabled: true,
              className: `${children.props.className || ''} cursor-not-allowed opacity-50`.trim(),
            })}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface RoleGateProps {
  /** Minimum role required (inclusive) */
  minimumRole: Role;
  /** Content to render if role check passes */
  children: React.ReactNode;
  /** Optional fallback content */
  fallback?: React.ReactNode;
}

/**
 * Gate content based on role hierarchy rather than specific permissions
 *
 * @example
 * <RoleGate minimumRole="manager">
 *   <AdminPanel />
 * </RoleGate>
 */
export function RoleGate({ minimumRole, children, fallback = null }: RoleGateProps) {
  const { role, isLoading } = usePermissionContext();

  if (isLoading) return null;

  if (hasRoleOrHigher(role, minimumRole)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
