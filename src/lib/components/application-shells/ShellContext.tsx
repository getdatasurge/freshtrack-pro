import * as React from 'react';

export interface ShellState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
}

const ShellContext = React.createContext<ShellState | null>(null);

export function useShell() {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within a ShellProvider');
  return ctx;
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((v) => !v);
  }, []);

  const value = React.useMemo<ShellState>(
    () => ({ sidebarCollapsed, sidebarOpen, toggleSidebar, setSidebarCollapsed, setSidebarOpen }),
    [sidebarCollapsed, sidebarOpen, toggleSidebar],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
