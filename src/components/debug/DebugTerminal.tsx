import React, { useState, useMemo, useCallback } from 'react';
import { useDebugContext } from '@/contexts/DebugContext';
import { DebugLogEntry, DebugLogLevel, DebugLogCategory } from '@/lib/debugLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  Minus, 
  Maximize2, 
  Trash2, 
  Pause, 
  Play, 
  Copy, 
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { debugLog } from '@/lib/debugLogger';

const LEVEL_COLORS: Record<DebugLogLevel, string> = {
  debug: 'text-muted-foreground',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LEVEL_BG: Record<DebugLogLevel, string> = {
  debug: 'bg-muted/50',
  info: 'bg-blue-500/10',
  warn: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
};

const CATEGORY_COLORS: Record<string, string> = {
  ui: 'bg-purple-500/20 text-purple-300',
  routing: 'bg-cyan-500/20 text-cyan-300',
  db: 'bg-green-500/20 text-green-300',
  sync: 'bg-orange-500/20 text-orange-300',
  ttn: 'bg-blue-500/20 text-blue-300',
  provisioning: 'bg-pink-500/20 text-pink-300',
  edge: 'bg-indigo-500/20 text-indigo-300',
  network: 'bg-teal-500/20 text-teal-300',
  auth: 'bg-red-500/20 text-red-300',
};

function LogEntry({ entry }: { entry: DebugLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  
  const time = entry.timestamp.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  }) + '.' + entry.timestamp.getMilliseconds().toString().padStart(3, '0');

  return (
    <div 
      className={cn(
        "font-mono text-xs border-b border-border/30 hover:bg-muted/30 transition-colors",
        LEVEL_BG[entry.level]
      )}
    >
      <div 
        className="flex items-start gap-2 px-2 py-1 cursor-pointer"
        onClick={() => entry.payload && setExpanded(!expanded)}
      >
        <span className="text-muted-foreground shrink-0 w-20">{time}</span>
        <Badge 
          variant="outline" 
          className={cn("text-[10px] px-1.5 py-0 shrink-0", CATEGORY_COLORS[entry.category])}
        >
          {entry.category}
        </Badge>
        <span className={cn("font-medium shrink-0", LEVEL_COLORS[entry.level])}>
          [{entry.level.toUpperCase()}]
        </span>
        <span className="text-foreground flex-1 break-all">{entry.message}</span>
        {entry.duration !== undefined && (
          <span className="text-muted-foreground shrink-0">{entry.duration}ms</span>
        )}
        {entry.payload && (
          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 shrink-0">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>
      {expanded && entry.payload && (
        <pre className="px-2 py-2 ml-24 text-[10px] text-muted-foreground bg-background/50 overflow-x-auto">
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function DebugTerminal() {
  const { 
    isDebugEnabled, 
    isTerminalVisible, 
    isPaused,
    logs, 
    hideTerminal, 
    clearLogs,
    pauseLogging,
    resumeLogging 
  } = useDebugContext();
  const { toast } = useToast();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [height, setHeight] = useState(300);
  const [activeTab, setActiveTab] = useState('events');
  const [levelFilter, setLevelFilter] = useState<DebugLogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<DebugLogCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Fetch user info
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
    });
    
    supabase.from('profiles').select('organization_id').maybeSingle().then(({ data }) => {
      setOrgId(data?.organization_id || null);
    });
  }, []);

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Tab-based filtering
    if (activeTab === 'network') {
      filtered = filtered.filter(l => l.category === 'edge' || l.category === 'network');
    } else if (activeTab === 'sync') {
      filtered = filtered.filter(l => l.category === 'sync' || l.category === 'db');
    } else if (activeTab === 'ttn') {
      filtered = filtered.filter(l => l.category === 'ttn' || l.category === 'provisioning');
    } else if (activeTab === 'errors') {
      filtered = filtered.filter(l => l.level === 'error' || l.level === 'warn');
    }

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(l => l.level === levelFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(l => l.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        l.message.toLowerCase().includes(query) ||
        l.category.toLowerCase().includes(query) ||
        JSON.stringify(l.payload || {}).toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [logs, activeTab, levelFilter, categoryFilter, searchQuery]);

  const handleCopy = useCallback(() => {
    const text = filteredLogs
      .map(l => `[${l.timestamp.toISOString()}] [${l.level}] [${l.category}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: "Logs copied to clipboard" });
  }, [filteredLogs, toast]);

  const handleExport = useCallback(() => {
    const json = debugLog.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frostguard-debug-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Logs exported" });
  }, [toast]);

  if (!isDebugEnabled || !isTerminalVisible) return null;

  const environment = window.location.hostname.includes('localhost') ? 'dev' : 
                      window.location.hostname.includes('staging') ? 'staging' : 'prod';

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-2xl"
      style={{ height: isMinimized ? 40 : height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Bug className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Debug Terminal</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {environment}
          </Badge>
          {userEmail && (
            <span className="text-xs text-muted-foreground">{userEmail}</span>
          )}
          {orgId && (
            <span className="text-xs text-muted-foreground font-mono">
              org:{orgId.slice(0, 8)}
            </span>
          )}
          {isPaused && (
            <Badge variant="destructive" className="text-[10px]">PAUSED</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={hideTerminal}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Tabs and Controls */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/30">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="h-7 bg-transparent">
                <TabsTrigger value="events" className="text-xs h-6 px-2">Events</TabsTrigger>
                <TabsTrigger value="network" className="text-xs h-6 px-2">Network</TabsTrigger>
                <TabsTrigger value="sync" className="text-xs h-6 px-2">Sync</TabsTrigger>
                <TabsTrigger value="ttn" className="text-xs h-6 px-2">TTN</TabsTrigger>
                <TabsTrigger value="errors" className="text-xs h-6 px-2">Errors</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="h-6 w-32 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <select 
                className="h-6 text-xs bg-background border border-border rounded px-1"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as DebugLogLevel | 'all')}
              >
                <option value="all">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>

              <select 
                className="h-6 text-xs bg-background border border-border rounded px-1"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as DebugLogCategory | 'all')}
              >
                <option value="all">All Categories</option>
                <option value="ui">UI</option>
                <option value="routing">Routing</option>
                <option value="db">DB</option>
                <option value="sync">Sync</option>
                <option value="ttn">TTN</option>
                <option value="provisioning">Provisioning</option>
                <option value="edge">Edge</option>
                <option value="network">Network</option>
                <option value="auth">Auth</option>
              </select>

              <div className="flex items-center gap-0.5 border-l border-border pl-2">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={clearLogs} title="Clear">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0" 
                  onClick={isPaused ? resumeLogging : pauseLogging}
                  title={isPaused ? "Resume" : "Pause"}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy} title="Copy">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleExport} title="Export">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Log Content */}
          <ScrollArea className="flex-1" style={{ height: height - 80 }}>
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No logs to display
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredLogs.map(entry => (
                  <LogEntry key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
