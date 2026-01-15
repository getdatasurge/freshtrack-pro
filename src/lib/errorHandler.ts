/**
 * Role-Aware Error Handler
 * 
 * Provides user-friendly error messages for permission-related failures,
 * converting cryptic RLS errors into actionable feedback.
 */

import { toast } from 'sonner';

// Supabase/Postgres error codes related to permissions
const RLS_ERROR_CODES = [
  'PGRST301', // Row-level security violation
  '42501',    // Insufficient privilege
  'PGRST204', // No rows returned (could be RLS filtering)
];

interface PostgrestError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Check if an error is permission-related
 */
export function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  const pgError = error as PostgrestError;
  
  // Check error code
  if (pgError.code && RLS_ERROR_CODES.includes(pgError.code)) {
    return true;
  }
  
  // Check error message patterns
  const message = pgError.message?.toLowerCase() || '';
  return (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('insufficient privilege') ||
    message.includes('violates row-level security policy')
  );
}

/**
 * Get a user-friendly error message for permission errors
 * @param error - The error object
 * @param action - Optional action description for context
 * @returns User-friendly error message
 */
export function getPermissionErrorMessage(error: unknown, action?: string): string {
  const actionText = action ? ` to ${action}` : '';
  
  if (isPermissionError(error)) {
    return `You don't have permission${actionText}. This action requires a higher role.`;
  }
  
  // Fallback for other errors
  const pgError = error as PostgrestError;
  if (pgError.message) {
    return pgError.message;
  }
  
  return `An error occurred${actionText}. Please try again.`;
}

/**
 * Handle an error with appropriate toast notification
 * Shows permission-specific message for RLS errors
 * @param error - The error object
 * @param action - Optional action description for context
 * @param fallbackMessage - Optional fallback message for non-permission errors
 */
export function handleError(
  error: unknown,
  action?: string,
  fallbackMessage?: string
): void {
  console.error('Operation failed:', error);
  
  if (isPermissionError(error)) {
    toast.error(getPermissionErrorMessage(error, action));
    return;
  }
  
  // Use fallback or generic message
  const message = fallbackMessage || getPermissionErrorMessage(error, action);
  toast.error(message);
}

/**
 * Handle a mutation result with success/error toasts
 * @param result - The mutation result with potential error
 * @param successMessage - Message to show on success
 * @param action - Action description for error context
 */
export function handleMutationResult(
  result: { error?: unknown },
  successMessage: string,
  action?: string
): boolean {
  if (result.error) {
    handleError(result.error, action);
    return false;
  }
  
  toast.success(successMessage);
  return true;
}

/**
 * Create a permission-aware error boundary message
 * @param requiredRole - The role that would grant this permission
 * @returns User-friendly message about required permissions
 */
export function getRequiredRoleMessage(requiredRole: string): string {
  return `This action requires ${requiredRole} role or higher.`;
}
