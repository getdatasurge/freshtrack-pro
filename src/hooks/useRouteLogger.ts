import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { debugLog } from '@/lib/debugLogger';

export function useRouteLogger() {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    if (prevPathRef.current !== null && prevPathRef.current !== currentPath) {
      debugLog.routeChange(prevPathRef.current, currentPath);
    }
    
    prevPathRef.current = currentPath;
  }, [location]);
}
