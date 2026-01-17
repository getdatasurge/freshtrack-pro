/**
 * useAuditedWrite Hook
 * 
 * Wraps write operations with automatic impersonation auditing.
 * When a Super Admin is impersonating a user, all writes are logged
 * with full audit trail including acting_user_id and impersonation_session_id.
 * 
 * @example
 * ```tsx
 * const { auditedWrite, isImpersonating } = useAuditedWrite();
 * 
 * const handleSave = async () => {
 *   await auditedWrite(
 *     async () => {
 *       await supabase.from('alerts').update({ status: 'resolved' }).eq('id', alertId);
 *     },
 *     {
 *       eventType: 'alert_resolved',
 *       title: 'Alert Resolved',
 *       unitId: alert.unit_id,
 *       siteId: alert.site_id,
 *     }
 *   );
 * };
 * ```
 */

import { useCallback } from 'react';
import { useOrgScope } from './useOrgScope';
import { useEffectiveIdentity } from './useEffectiveIdentity';
import { supabase } from '@/integrations/supabase/client';

export interface AuditContext {
  /** The type of event being logged (e.g., 'alert_resolved', 'manual_temp_logged') */
  eventType: string;
  /** Human-readable title for the event */
  title: string;
  /** Optional: The unit ID associated with this action */
  unitId?: string | null;
  /** Optional: The site ID associated with this action */
  siteId?: string | null;
  /** Optional: The area ID associated with this action */
  areaId?: string | null;
  /** Optional: Category of the event (defaults to 'user_action') */
  category?: 'alert' | 'compliance' | 'settings' | 'user_action' | 'system';
  /** Optional: Severity of the event (defaults to 'info') */
  severity?: 'info' | 'success' | 'warning' | 'critical';
  /** Optional: Additional data to include in the event log */
  additionalData?: Record<string, unknown>;
}

export interface AuditedWriteResult {
  /** 
   * Execute a write operation with automatic audit logging when impersonating.
   * The write is executed first, then audit logging occurs.
   */
  auditedWrite: <T>(
    writeOperation: () => Promise<T>,
    auditContext: AuditContext
  ) => Promise<T>;
  
  /** Whether currently impersonating a user */
  isImpersonating: boolean;
  
  /** The impersonation session ID if impersonating, null otherwise */
  impersonationSessionId: string | null;
  
  /** The real user ID (acting admin) when impersonating */
  realUserId: string | null;
  
  /** The effective organization ID for scoping */
  orgId: string | null;
}

/**
 * Hook that provides audited write capabilities.
 * Automatically logs all write operations to the audit trail when impersonating.
 */
export function useAuditedWrite(): AuditedWriteResult {
  const { orgId, isImpersonating } = useOrgScope();
  const { impersonationSessionId, realUserId } = useEffectiveIdentity();
  
  const auditedWrite = useCallback(async <T>(
    writeOperation: () => Promise<T>,
    auditContext: AuditContext
  ): Promise<T> => {
    // Execute the write operation first
    const result = await writeOperation();
    
    // Log audit trail if impersonating
    if (isImpersonating && orgId) {
      try {
        const { error } = await supabase.rpc('log_impersonated_action', {
          p_event_type: auditContext.eventType,
          p_category: auditContext.category || 'user_action',
          p_severity: auditContext.severity || 'info',
          p_title: auditContext.title,
          p_organization_id: orgId,
          p_site_id: auditContext.siteId || null,
          p_area_id: auditContext.areaId || null,
          p_unit_id: auditContext.unitId || null,
          p_event_data: {
            ...auditContext.additionalData,
            impersonation_session_id: impersonationSessionId,
            acting_admin_id: realUserId,
          },
        });
        
        if (error) {
          console.error('[useAuditedWrite] Failed to log impersonated action:', error);
        }
      } catch (err) {
        // Don't fail the write if audit logging fails
        console.error('[useAuditedWrite] Error logging impersonated action:', err);
      }
    }
    
    return result;
  }, [orgId, isImpersonating, impersonationSessionId, realUserId]);
  
  return {
    auditedWrite,
    isImpersonating,
    impersonationSessionId,
    realUserId,
    orgId,
  };
}
