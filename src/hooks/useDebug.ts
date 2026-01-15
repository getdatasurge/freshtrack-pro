import { useDebugContext } from '@/contexts/DebugContext';
import { debugLog } from '@/lib/debugLogger';

export function useDebug() {
  const context = useDebugContext();
  
  return {
    ...context,
    log: debugLog,
  };
}
