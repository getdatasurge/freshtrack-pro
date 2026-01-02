/**
 * TTN Config Context Provider
 * Application-wide state management for TTN configuration
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { 
  TTNConfigContext as TTNConfigContextType, 
  TTNConfigState, 
  TTNValidationResult,
  TTNConfigSource,
} from '@/types/ttnState';
import { INITIAL_TTN_CONFIG_CONTEXT, isValidStateTransition, hashConfigValues } from '@/types/ttnState';

interface TTNConfigProviderProps {
  children: React.ReactNode;
}

interface TTNConfigContextValue {
  context: TTNConfigContextType;
  
  // State transitions
  setValidated: (result: TTNValidationResult) => void;
  setCanonical: (hash: string) => void;
  setInvalid: (errorMessage: string) => void;
  setDrifted: () => void;
  resetToDraft: () => void;
  
  // Drift detection
  checkForDrift: (localValues: { cluster?: string; application_id?: string; api_key_last4?: string; is_enabled?: boolean }) => boolean;
  
  // Helpers
  isOperationAllowed: (requiredStates?: TTNConfigState[]) => boolean;
  updateSource: (source: TTNConfigSource) => void;
}

const TTNConfigContext = createContext<TTNConfigContextValue | null>(null);

export function TTNConfigProvider({ children }: TTNConfigProviderProps) {
  const [context, setContext] = useState<TTNConfigContextType>(INITIAL_TTN_CONFIG_CONTEXT);

  const logTransition = useCallback((from: TTNConfigState, to: TTNConfigState, reason: string) => {
    console.log(`[TTNConfig] State transition: ${from} → ${to} (${reason})`);
  }, []);

  const setValidated = useCallback((result: TTNValidationResult) => {
    setContext(prev => {
      if (!isValidStateTransition(prev.state, 'validated')) {
        console.warn(`[TTNConfig] Invalid transition: ${prev.state} → validated`);
      }
      logTransition(prev.state, 'validated', 'Validation passed');
      return {
        ...prev,
        state: 'validated',
        last_validated_at: result.validated_at,
        last_validation_result: result,
        request_id: result.request_id,
        error_message: null,
        local_hash: hashConfigValues({
          cluster: result.resolved.cluster,
          application_id: result.resolved.application_id,
        }),
      };
    });
  }, [logTransition]);

  const setCanonical = useCallback((hash: string) => {
    setContext(prev => {
      logTransition(prev.state, 'canonical', 'Saved to backend');
      return {
        ...prev,
        state: 'canonical',
        canonical_hash: hash,
        local_hash: hash,
        source: 'FROSTGUARD',
        error_message: null,
      };
    });
  }, [logTransition]);

  const setInvalid = useCallback((errorMessage: string) => {
    setContext(prev => {
      logTransition(prev.state, 'invalid', errorMessage);
      return {
        ...prev,
        state: 'invalid',
        error_message: errorMessage,
      };
    });
  }, [logTransition]);

  const setDrifted = useCallback(() => {
    setContext(prev => {
      if (prev.state === 'canonical') {
        logTransition(prev.state, 'drifted', 'Local changes detected');
        return {
          ...prev,
          state: 'drifted',
        };
      }
      return prev;
    });
  }, [logTransition]);

  const resetToDraft = useCallback(() => {
    setContext(prev => {
      logTransition(prev.state, 'local_draft', 'Reset to draft');
      return {
        ...INITIAL_TTN_CONFIG_CONTEXT,
        canonical_hash: prev.canonical_hash,
      };
    });
  }, [logTransition]);

  const checkForDrift = useCallback((localValues: { 
    cluster?: string; 
    application_id?: string; 
    api_key_last4?: string;
    is_enabled?: boolean;
  }) => {
    const localHash = hashConfigValues(localValues);
    const isDrifted = context.canonical_hash !== null && localHash !== context.canonical_hash;
    
    if (isDrifted && context.state === 'canonical') {
      setDrifted();
    }
    
    return isDrifted;
  }, [context.canonical_hash, context.state, setDrifted]);

  const isOperationAllowed = useCallback((requiredStates: TTNConfigState[] = ['validated', 'canonical']) => {
    return requiredStates.includes(context.state);
  }, [context.state]);

  const updateSource = useCallback((source: TTNConfigSource) => {
    setContext(prev => ({
      ...prev,
      source,
    }));
  }, []);

  const value = useMemo(() => ({
    context,
    setValidated,
    setCanonical,
    setInvalid,
    setDrifted,
    resetToDraft,
    checkForDrift,
    isOperationAllowed,
    updateSource,
  }), [
    context,
    setValidated,
    setCanonical,
    setInvalid,
    setDrifted,
    resetToDraft,
    checkForDrift,
    isOperationAllowed,
    updateSource,
  ]);

  return (
    <TTNConfigContext.Provider value={value}>
      {children}
    </TTNConfigContext.Provider>
  );
}

/**
 * Hook to access TTN config context
 */
export function useTTNConfig(): TTNConfigContextValue {
  const context = useContext(TTNConfigContext);
  if (!context) {
    throw new Error('useTTNConfig must be used within a TTNConfigProvider');
  }
  return context;
}

/**
 * Hook to get just the current state (for components that only need to display state)
 */
export function useTTNConfigState(): TTNConfigContextType {
  const { context } = useTTNConfig();
  return context;
}
