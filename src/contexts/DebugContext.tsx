import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { debugLog, DebugLogEntry } from '@/lib/debugLogger';
import { useToast } from '@/hooks/use-toast';

interface DebugContextValue {
  isDebugEnabled: boolean;
  isTerminalVisible: boolean;
  isPaused: boolean;
  logs: DebugLogEntry[];
  selectedErrorForExplanation: DebugLogEntry | null;
  setDebugEnabled: (enabled: boolean) => void;
  toggleTerminal: () => void;
  showTerminal: () => void;
  hideTerminal: () => void;
  clearLogs: () => void;
  pauseLogging: () => void;
  resumeLogging: () => void;
  showExplanation: (entry: DebugLogEntry) => void;
  hideExplanation: () => void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

const STORAGE_KEY = 'frostguard_debug_enabled';
const TERMINAL_VISIBLE_KEY = 'frostguard_debug_terminal_visible';

export function DebugProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [isDebugEnabled, setIsDebugEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [isTerminalVisible, setIsTerminalVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TERMINAL_VISIBLE_KEY) === 'true';
  });
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [selectedErrorForExplanation, setSelectedErrorForExplanation] = useState<DebugLogEntry | null>(null);

  // Sync debug mode with logger
  useEffect(() => {
    if (isDebugEnabled) {
      debugLog.enable();
      setLogs(debugLog.getLogs());
    } else {
      debugLog.disable();
      setLogs([]);
      setIsTerminalVisible(false);
    }
    localStorage.setItem(STORAGE_KEY, String(isDebugEnabled));
  }, [isDebugEnabled]);

  // Persist terminal visibility
  useEffect(() => {
    localStorage.setItem(TERMINAL_VISIBLE_KEY, String(isTerminalVisible));
  }, [isTerminalVisible]);

  // Subscribe to new logs
  useEffect(() => {
    if (!isDebugEnabled) return;

    const unsubscribe = debugLog.subscribe((entry) => {
      setLogs(prev => [...prev.slice(-999), entry]);
    });

    return unsubscribe;
  }, [isDebugEnabled]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        
        if (!isDebugEnabled) {
          toast({
            title: "Debug Mode Disabled",
            description: "Enable debug mode in Settings → Developer",
          });
          return;
        }
        
        setIsTerminalVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDebugEnabled, toast]);

  const setDebugEnabled = useCallback((enabled: boolean) => {
    setIsDebugEnabled(enabled);
    if (enabled) {
      debugLog.info('ui', 'Debug mode enabled');
    }
  }, []);

  const toggleTerminal = useCallback(() => {
    if (isDebugEnabled) {
      setIsTerminalVisible(prev => !prev);
    }
  }, [isDebugEnabled]);

  const showTerminal = useCallback(() => {
    if (isDebugEnabled) {
      setIsTerminalVisible(true);
    }
  }, [isDebugEnabled]);

  const hideTerminal = useCallback(() => {
    setIsTerminalVisible(false);
  }, []);

  const clearLogs = useCallback(() => {
    debugLog.clearLogs();
    setLogs([]);
  }, []);

  const pauseLogging = useCallback(() => {
    debugLog.pause();
    setIsPaused(true);
  }, []);

  const resumeLogging = useCallback(() => {
    debugLog.resume();
    setIsPaused(false);
  }, []);

  const showExplanation = useCallback((entry: DebugLogEntry) => {
    setSelectedErrorForExplanation(entry);
  }, []);

  const hideExplanation = useCallback(() => {
    setSelectedErrorForExplanation(null);
  }, []);

  return (
    <DebugContext.Provider
      value={{
        isDebugEnabled,
        isTerminalVisible,
        isPaused,
        logs,
        selectedErrorForExplanation,
        setDebugEnabled,
        toggleTerminal,
        showTerminal,
        hideTerminal,
        clearLogs,
        pauseLogging,
        resumeLogging,
        showExplanation,
        hideExplanation,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
}

export function useDebugContext() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebugContext must be used within a DebugProvider');
  }
  return context;
}

/**
 * Safe version of useDebugContext that returns null if used outside the provider.
 * Use this for components that may render before providers are mounted.
 */
export function useDebugContextSafe(): DebugContextValue | null {
  return useContext(DebugContext);
}
