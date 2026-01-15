/**
 * RBAC (Role-Based Access Control) Module
 *
 * This module provides a unified API for all permission-related functionality.
 * Import from '@/lib/rbac' for all permission needs.
 *
 * @example
 * // Import permission utilities
 * import { can, Permission, Role, ROLE_CONFIG } from '@/lib/rbac';
 *
 * // Import React hooks
 * import { useCan, Can, useCurrentRole } from '@/lib/rbac';
 *
 * // Check permission programmatically
 * if (can(userRole, 'users.invite')) { ... }
 *
 * // Use in components
 * <Can permission="users.invite">
 *   <InviteButton />
 * </Can>
 */

// Re-export all permission types and utilities from permissions.ts
export {
  // Types
  type Role,
  type Permission,
  // Constants
  ROLE_HIERARCHY,
  ROLE_CONFIG,
  PERMISSION_CATEGORIES,
  // Core permission functions
  can,
  canAny,
  canAll,
  getPermissionsForRole,
  hasRoleOrHigher,
  canManageRole,
  getAssignableRoles,
  getPermissionDescription,
  requirePermission,
  // Error class
  PermissionDeniedError,
} from '../permissions';

// Re-export React hooks and components from useCan.tsx
export {
  // Provider
  PermissionProvider,
  // Hooks
  useCan,
  useCanAny,
  useCanAll,
  useCurrentRole,
  useHasRoleOrHigher,
  useCanManageRole,
  useAssignableRoles,
  useMyPermissions,
  // Components
  Can,
  Cannot,
  WithPermissionTooltip,
  RoleGate,
} from '../../hooks/useCan';
