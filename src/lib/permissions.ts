/**
 * RBAC Permissions - Single Source of Truth
 *
 * This module defines all role-based access control for the application.
 * All permission checks should use these types and helpers.
 *
 * Role Hierarchy (highest to lowest):
 * - OWNER: Full control including billing, org deletion, ownership transfer
 * - ADMIN: Full operational control, manage users/sites/settings
 * - MANAGER: Day-to-day operations, manage layouts/widgets/annotations
 * - STAFF: Operational actions like logging temps, acknowledging alerts
 * - VIEWER: Read-only access to dashboards and data
 * - INSPECTOR: Read-only access with export capability for audits
 */

import type { Database } from '@/integrations/supabase/types';

// Re-export the database role type as our canonical Role type
export type Role = Database['public']['Enums']['app_role'];

// All available roles in hierarchy order (highest to lowest)
export const ROLE_HIERARCHY: Role[] = ['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'];

// Role display configuration
export const ROLE_CONFIG: Record<Role, { label: string; description: string; color: string }> = {
  owner: {
    label: 'Owner',
    description: 'Full control including billing, organization settings, and ownership transfer',
    color: 'bg-warning/15 text-warning border-warning/30',
  },
  admin: {
    label: 'Admin',
    description: 'Manage users, sites, devices, sensors, and organization settings',
    color: 'bg-accent/15 text-accent border-accent/30',
  },
  manager: {
    label: 'Manager',
    description: 'Manage day-to-day operations, customize dashboards, and respond to alerts',
    color: 'bg-primary/15 text-primary border-primary/30',
  },
  staff: {
    label: 'Staff',
    description: 'Log temperatures, view and acknowledge alerts, basic operational tasks',
    color: 'bg-safe/15 text-safe border-safe/30',
  },
  viewer: {
    label: 'Viewer',
    description: 'View-only access to dashboards, alerts, and reports',
    color: 'bg-muted text-muted-foreground border-border',
  },
  inspector: {
    label: 'Inspector',
    description: 'Read-only access with ability to export compliance reports',
    color: 'bg-accent/15 text-accent border-accent/30',
  },
};

/**
 * Permission keys - granular actions that can be controlled
 * Grouped by functional area for clarity
 */
export type Permission =
  // Organization & Settings
  | 'org.update'
  | 'org.delete'
  | 'org.transfer_ownership'
  | 'org.manage_billing'
  | 'org.view_audit_logs'
  // User Management
  | 'users.view'
  | 'users.invite'
  | 'users.update_role'
  | 'users.remove'
  // Site & Area Management
  | 'sites.create'
  | 'sites.update'
  | 'sites.delete'
  | 'areas.create'
  | 'areas.update'
  | 'areas.delete'
  // Unit Management
  | 'units.create'
  | 'units.update'
  | 'units.delete'
  | 'units.edit_temp_limits'
  | 'units.edit_compliance_settings'
  // Device & Sensor Management
  | 'devices.manage'
  | 'sensors.manage'
  | 'gateways.manage'
  // Temperature & Logging
  | 'temps.log_manual'
  | 'temps.view'
  // Alerts
  | 'alerts.view'
  | 'alerts.acknowledge'
  | 'alerts.resolve'
  | 'alerts.configure_rules'
  // Dashboard & Layouts
  | 'dashboard.view'
  | 'dashboard.customize'
  | 'layouts.create'
  | 'layouts.update'
  | 'layouts.delete'
  // Widgets
  | 'widgets.create'
  | 'widgets.update'
  | 'widgets.delete'
  // Annotations
  | 'annotations.create'
  | 'annotations.update'
  | 'annotations.delete'
  // Reports & Export
  | 'reports.view'
  | 'reports.export'
  // Soft Delete & Restore
  | 'entities.delete'
  | 'entities.restore'
  | 'entities.permanently_delete'
  // Developer Tools
  | 'developer.view'
  | 'developer.manage_ttn';

/**
 * Permission matrix - defines which roles have which permissions
 * This is the authoritative source for all permission checks
 */
const PERMISSION_MATRIX: Record<Permission, Role[]> = {
  // Organization & Settings
  'org.update': ['owner', 'admin'],
  'org.delete': ['owner'],
  'org.transfer_ownership': ['owner'],
  'org.manage_billing': ['owner'],
  'org.view_audit_logs': ['owner', 'admin'],

  // User Management
  'users.view': ['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'],
  'users.invite': ['owner', 'admin'],
  'users.update_role': ['owner', 'admin'],
  'users.remove': ['owner', 'admin'],

  // Site & Area Management
  'sites.create': ['owner', 'admin'],
  'sites.update': ['owner', 'admin'],
  'sites.delete': ['owner', 'admin'],
  'areas.create': ['owner', 'admin'],
  'areas.update': ['owner', 'admin'],
  'areas.delete': ['owner', 'admin'],

  // Unit Management
  'units.create': ['owner', 'admin'],
  'units.update': ['owner', 'admin', 'manager'],
  'units.delete': ['owner', 'admin'],
  'units.edit_temp_limits': ['owner', 'admin', 'manager'],
  'units.edit_compliance_settings': ['owner', 'admin'],

  // Device & Sensor Management
  'devices.manage': ['owner', 'admin'],
  'sensors.manage': ['owner', 'admin'],
  'gateways.manage': ['owner', 'admin'],

  // Temperature & Logging
  'temps.log_manual': ['owner', 'admin', 'manager', 'staff'],
  'temps.view': ['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'],

  // Alerts
  'alerts.view': ['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'],
  'alerts.acknowledge': ['owner', 'admin', 'manager', 'staff'],
  'alerts.resolve': ['owner', 'admin', 'manager'],
  'alerts.configure_rules': ['owner', 'admin'],

  // Dashboard & Layouts
  'dashboard.view': ['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'],
  'dashboard.customize': ['owner', 'admin', 'manager'],
  'layouts.create': ['owner', 'admin', 'manager'],
  'layouts.update': ['owner', 'admin', 'manager'],
  'layouts.delete': ['owner', 'admin', 'manager'],

  // Widgets
  'widgets.create': ['owner', 'admin', 'manager'],
  'widgets.update': ['owner', 'admin', 'manager'],
  'widgets.delete': ['owner', 'admin', 'manager'],

  // Annotations
  'annotations.create': ['owner', 'admin', 'manager'],
  'annotations.update': ['owner', 'admin', 'manager'],
  'annotations.delete': ['owner', 'admin', 'manager'],

  // Reports & Export
  'reports.view': ['owner', 'admin', 'manager', 'staff', 'viewer', 'inspector'],
  'reports.export': ['owner', 'admin', 'manager', 'inspector'],

  // Soft Delete & Restore
  'entities.delete': ['owner', 'admin'],
  'entities.restore': ['owner', 'admin'],
  'entities.permanently_delete': ['owner', 'admin'],

  // Developer Tools
  'developer.view': ['owner', 'admin', 'manager'],
  'developer.manage_ttn': ['owner', 'admin'],
};

/**
 * Check if a role has a specific permission
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns boolean - Whether the role has the permission
 */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSION_MATRIX[permission];
  return allowedRoles?.includes(role) ?? false;
}

/**
 * Check if a role has ANY of the specified permissions
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns boolean - Whether the role has at least one permission
 */
export function canAny(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some(permission => can(role, permission));
}

/**
 * Check if a role has ALL of the specified permissions
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns boolean - Whether the role has all permissions
 */
export function canAll(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.every(permission => can(role, permission));
}

/**
 * Get all permissions for a role
 * @param role - The user's role
 * @returns Permission[] - Array of permissions the role has
 */
export function getPermissionsForRole(role: Role | null | undefined): Permission[] {
  if (!role) return [];
  return (Object.entries(PERMISSION_MATRIX) as [Permission, Role[]][])
    .filter(([_, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

/**
 * Check if one role is equal to or higher than another in the hierarchy
 * @param role - The role to check
 * @param minimumRole - The minimum required role
 * @returns boolean - Whether role >= minimumRole
 */
export function hasRoleOrHigher(role: Role | null | undefined, minimumRole: Role): boolean {
  if (!role) return false;
  const roleIndex = ROLE_HIERARCHY.indexOf(role);
  const minimumIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return roleIndex !== -1 && minimumIndex !== -1 && roleIndex <= minimumIndex;
}

/**
 * Check if a role can modify another role (can only manage equal or lower roles)
 * Owners can manage anyone, admins can manage everyone except owners
 * @param actorRole - The role of the user performing the action
 * @param targetRole - The role being modified
 * @returns boolean - Whether the actor can modify the target
 */
export function canManageRole(actorRole: Role | null | undefined, targetRole: Role): boolean {
  if (!actorRole) return false;
  // Only owners and admins can manage roles
  if (actorRole !== 'owner' && actorRole !== 'admin') return false;
  // Owners can manage anyone
  if (actorRole === 'owner') return true;
  // Admins cannot manage owners or other admins
  return targetRole !== 'owner' && targetRole !== 'admin';
}

/**
 * Get the list of roles that a given role can assign to users
 * @param role - The role of the user assigning roles
 * @returns Role[] - Array of assignable roles
 */
export function getAssignableRoles(role: Role | null | undefined): Role[] {
  if (!role) return [];
  if (role === 'owner') {
    // Owners can assign any role except owner (ownership must be transferred)
    return ['admin', 'manager', 'staff', 'viewer', 'inspector'];
  }
  if (role === 'admin') {
    // Admins can assign manager and below
    return ['manager', 'staff', 'viewer', 'inspector'];
  }
  return [];
}

/**
 * Error thrown when a permission check fails
 */
export class PermissionDeniedError extends Error {
  constructor(
    public permission: Permission,
    public role: Role | null | undefined
  ) {
    super(`Permission denied: ${permission} requires higher privileges than ${role || 'none'}`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Assert that a role has a permission, throw if not
 * Useful for server-side or critical operations
 * @param role - The user's role
 * @param permission - The required permission
 * @throws PermissionDeniedError if permission check fails
 */
export function requirePermission(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new PermissionDeniedError(permission, role);
  }
}

/**
 * Get a human-readable description of a permission
 * @param permission - The permission key
 * @returns string - Human-readable description
 */
export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    'org.update': 'Update organization settings',
    'org.delete': 'Delete organization',
    'org.transfer_ownership': 'Transfer organization ownership',
    'org.manage_billing': 'Manage billing and subscriptions',
    'org.view_audit_logs': 'View audit logs',
    'users.view': 'View team members',
    'users.invite': 'Invite new team members',
    'users.update_role': 'Change user roles',
    'users.remove': 'Remove team members',
    'sites.create': 'Create new sites',
    'sites.update': 'Update site settings',
    'sites.delete': 'Delete sites',
    'areas.create': 'Create new areas',
    'areas.update': 'Update area settings',
    'areas.delete': 'Delete areas',
    'units.create': 'Create new units',
    'units.update': 'Update unit settings',
    'units.delete': 'Delete units',
    'units.edit_temp_limits': 'Edit temperature limits',
    'units.edit_compliance_settings': 'Edit compliance settings',
    'devices.manage': 'Manage devices',
    'sensors.manage': 'Manage sensors',
    'gateways.manage': 'Manage gateways',
    'temps.log_manual': 'Log manual temperatures',
    'temps.view': 'View temperature data',
    'alerts.view': 'View alerts',
    'alerts.acknowledge': 'Acknowledge alerts',
    'alerts.resolve': 'Resolve alerts',
    'alerts.configure_rules': 'Configure alert rules',
    'dashboard.view': 'View dashboard',
    'dashboard.customize': 'Customize dashboard layout',
    'layouts.create': 'Create dashboard layouts',
    'layouts.update': 'Update dashboard layouts',
    'layouts.delete': 'Delete dashboard layouts',
    'widgets.create': 'Create widgets',
    'widgets.update': 'Update widgets',
    'widgets.delete': 'Delete widgets',
    'annotations.create': 'Create annotations',
    'annotations.update': 'Update annotations',
    'annotations.delete': 'Delete annotations',
    'reports.view': 'View reports',
    'reports.export': 'Export reports',
    'entities.delete': 'Soft delete items',
    'entities.restore': 'Restore deleted items',
    'entities.permanently_delete': 'Permanently delete items',
    'developer.view': 'View developer tools',
    'developer.manage_ttn': 'Manage TTN integration',
  };
  return descriptions[permission] || permission;
}

/**
 * Group permissions by category for display purposes
 */
export const PERMISSION_CATEGORIES = {
  organization: ['org.update', 'org.delete', 'org.transfer_ownership', 'org.manage_billing', 'org.view_audit_logs'] as Permission[],
  users: ['users.view', 'users.invite', 'users.update_role', 'users.remove'] as Permission[],
  sites: ['sites.create', 'sites.update', 'sites.delete', 'areas.create', 'areas.update', 'areas.delete'] as Permission[],
  units: ['units.create', 'units.update', 'units.delete', 'units.edit_temp_limits', 'units.edit_compliance_settings'] as Permission[],
  devices: ['devices.manage', 'sensors.manage', 'gateways.manage'] as Permission[],
  operations: ['temps.log_manual', 'temps.view', 'alerts.view', 'alerts.acknowledge', 'alerts.resolve', 'alerts.configure_rules'] as Permission[],
  dashboard: ['dashboard.view', 'dashboard.customize', 'layouts.create', 'layouts.update', 'layouts.delete', 'widgets.create', 'widgets.update', 'widgets.delete', 'annotations.create', 'annotations.update', 'annotations.delete'] as Permission[],
  reports: ['reports.view', 'reports.export'] as Permission[],
  admin: ['entities.delete', 'entities.restore', 'entities.permanently_delete', 'developer.view', 'developer.manage_ttn'] as Permission[],
};
