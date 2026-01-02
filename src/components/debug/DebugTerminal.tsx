import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDebugContext } from '@/contexts/DebugContext';
import { DebugLogEntry, DebugLogLevel, DebugLogCategory, EntityType } from '@/lib/debugLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
  Bug,
  HelpCircle,
  FileJson,
  Link2,
  ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { debugLog } from '@/lib/debugLogger';
import { ErrorExplanationModal } from './ErrorExplanationModal';
import { buildSupportSnapshot, downloadSnapshot } from '@/lib/snapshotBuilder';

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
  crud: 'bg-amber-500/20 text-amber-300',
  realtime: 'bg-violet-500/20 text-violet-300',
  mutation: 'bg-emerald-500/20 text-emerald-300',
  query: 'bg-slate-500/20 text-slate-300',
};

const ENTITY_COLORS: Record<EntityType, string> = {
  sensor: 'bg-blue-500/30 text-blue-200',
  gateway: 'bg-green-500/30 text-green-200',
  unit: 'bg-purple-500/30 text-purple-200',
  area: 'bg-cyan-500/30 text-cyan-200',
  site: 'bg-orange-500/30 text-orange-200',
  alert: 'bg-red-500/30 text-red-200',
  device: 'bg-pink-500/30 text-pink-200',
};

interface LogEntryProps {
  entry: DebugLogEntry;
  onExplain?: (entry: DebugLogEntry) => void;
  onFilterByCorrelation?: (correlationId: string) => void;
  onCopyEntry?: (entry: DebugLogEntry) => void;
}

function LogEntry({ entry, onExplain, onFilterByCorrelation, onCopyEntry }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  
  const time = entry.timestamp.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  }) + '.' + entry.timestamp.getMilliseconds().toString().padStart(3, '0');

  const showExplainButton = (entry.level === 'error' || entry.level === 'warn') && onExplain;

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
        {entry.entityType && (
          <Badge 
            variant="outline" 
            className={cn("text-[10px] px-1.5 py-0 shrink-0", ENTITY_COLORS[entry.entityType])}
          >
            {entry.entityType}
          </Badge>
        )}
        <span className={cn("font-medium shrink-0", LEVEL_COLORS[entry.level])}>
          [{entry.level.toUpperCase()}]
        </span>
        <span className="text-foreground flex-1 break-all">{entry.message}</span>
        {entry.duration !== undefined && (
          <span className="text-muted-foreground shrink-0">{entry.duration}ms</span>
        )}
        {entry.correlationId && onFilterByCorrelation && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 px-1 text-xs shrink-0 hover:bg-primary/20"
            onClick={(e) => { 
              e.stopPropagation(); 
              onFilterByCorrelation(entry.correlationId!); 
            }}
            title="Filter by correlation ID"
          >
            <Link2 className="h-3 w-3" />
          </Button>
        )}
        {onCopyEntry && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 px-1 text-xs shrink-0 hover:bg-primary/20"
            onClick={(e) => { 
              e.stopPropagation(); 
              onCopyEntry(entry); 
            }}
            title="Copy event"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
        {showExplainButton && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 px-2 text-xs shrink-0 hover:bg-primary/20"
            onClick={(e) => { 
              e.stopPropagation(); 
              onExplain(entry); 
            }}
          >
            <HelpCircle className="h-3 w-3 mr-1" />
            Explain
          </Button>
        )}
        {entry.payload && (
          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 shrink-0">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>
      {expanded && entry.payload && (
        <div className="px-2 py-2 ml-24 bg-background/50 overflow-x-auto">
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
            {JSON.stringify(entry.payload, null, 2)}
          </pre>
          {entry.correlationId && (
            <div className="mt-1 text-[9px] text-muted-foreground/70">
              Correlation ID: {entry.correlationId}
            </div>
          )}
        </div>
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
    resumeLogging,
    selectedErrorForExplanation,
    showExplanation,
    hideExplanation
  } = useDebugContext();
  const { toast } = useToast();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [height, setHeight] = useState(300);
  const [activeTab, setActiveTab] = useState('events');
  const [levelFilter, setLevelFilter] = useState<DebugLogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<DebugLogCategory | 'all'>('all');
  const [entityFilter, setEntityFilter] = useState<EntityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [correlationFilter, setCorrelationFilter] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user info
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || null);
    });
    
    supabase.from('profiles').select('organization_id').maybeSingle().then(({ data }) => {
      setOrgId(data?.organization_id || null);
    });
  }, []);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Count by category for tab badges
  const categoryCounts = useMemo(() => {
    return {
      all: logs.length,
      network: logs.filter(l => l.category === 'edge' || l.category === 'network').length,
      crud: logs.filter(l => l.category === 'crud' || l.category === 'db' || l.category === 'mutation').length,
      sync: logs.filter(l => l.category === 'sync' || l.category === 'realtime').length,
      ttn: logs.filter(l => l.category === 'ttn' || l.category === 'provisioning').length,
      errors: logs.filter(l => l.level === 'error' || l.level === 'warn').length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Correlation filter takes precedence
    if (correlationFilter) {
      return filtered.filter(l => l.correlationId === correlationFilter);
    }

    // Tab-based filtering
    if (activeTab === 'network') {
      filtered = filtered.filter(l => l.category === 'edge' || l.category === 'network');
    } else if (activeTab === 'crud') {
      filtered = filtered.filter(l => l.category === 'crud' || l.category === 'db' || l.category === 'mutation');
    } else if (activeTab === 'sync') {
      filtered = filtered.filter(l => l.category === 'sync' || l.category === 'realtime');
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

    // Entity filter
    if (entityFilter !== 'all') {
      filtered = filtered.filter(l => l.entityType === entityFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        l.message.toLowerCase().includes(query) ||
        l.category.toLowerCase().includes(query) ||
        l.correlationId?.toLowerCase().includes(query) ||
        l.entityType?.toLowerCase().includes(query) ||
        JSON.stringify(l.payload || {}).toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [logs, activeTab, levelFilter, categoryFilter, entityFilter, searchQuery, correlationFilter]);

  const handleCopy = useCallback(() => {
    const text = filteredLogs
      .map(l => `[${l.timestamp.toISOString()}] [${l.level}] [${l.category}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: "Logs copied to clipboard" });
  }, [filteredLogs, toast]);

  const handleCopyEntry = useCallback((entry: DebugLogEntry) => {
    const json = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }, null, 2);
    navigator.clipboard.writeText(json);
    toast({ title: "Event copied to clipboard" });
  }, [toast]);

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

  const handleExportSupportSnapshot = useCallback(async () => {
    try {
      const snapshot = await buildSupportSnapshot({
        logs: debugLog.getLogs(),
        userEmail: userEmail || undefined,
        orgId: orgId || undefined,
        currentRoute: window.location.pathname,
      });
      downloadSnapshot(snapshot);
      toast({ 
        title: "Snapshot exported (redacted)", 
        description: "Safe to share with support." 
      });
    } catch (error) {
      toast({ 
        title: "Export failed", 
        description: "Could not generate snapshot",
        variant: "destructive"
      });
    }
  }, [userEmail, orgId, toast]);

  const handleFilterByCorrelation = useCallback((correlationId: string) => {
    setCorrelationFilter(correlationId);
    toast({ title: `Filtering by correlation: ${correlationId.slice(-8)}` });
  }, [toast]);

  const handleClearCorrelationFilter = useCallback(() => {
    setCorrelationFilter(null);
  }, []);

  if (!isDebugEnabled || !isTerminalVisible) return null;

  const environment = window.location.hostname.includes('localhost') ? 'dev' : 
                      window.location.hostname.includes('staging') ? 'staging' : 'prod';

  return (
    <>
      <ErrorExplanationModal
        entry={selectedErrorForExplanation}
        allLogs={logs}
        isOpen={!!selectedErrorForExplanation}
        onClose={hideExplanation}
        userEmail={userEmail || undefined}
        orgId={orgId || undefined}
      />
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
          <Badge variant="outline" className="text-[10px]">
            {logs.length} / {debugLog.getMaxBufferSize()}
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
          {correlationFilter && (
            <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {correlationFilter.slice(-8)}
              <button 
                onClick={handleClearCorrelationFilter}
                className="ml-1 hover:bg-background/50 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
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
                <TabsTrigger value="events" className="text-xs h-6 px-2">
                  Events
                  {categoryCounts.all > 0 && (
                    <span className="ml-1 text-[9px] text-muted-foreground">({categoryCounts.all})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="crud" className="text-xs h-6 px-2">
                  CRUD
                  {categoryCounts.crud > 0 && (
                    <span className="ml-1 text-[9px] text-muted-foreground">({categoryCounts.crud})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="network" className="text-xs h-6 px-2">
                  Network
                  {categoryCounts.network > 0 && (
                    <span className="ml-1 text-[9px] text-muted-foreground">({categoryCounts.network})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sync" className="text-xs h-6 px-2">
                  Sync
                  {categoryCounts.sync > 0 && (
                    <span className="ml-1 text-[9px] text-muted-foreground">({categoryCounts.sync})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ttn" className="text-xs h-6 px-2">
                  TTN
                  {categoryCounts.ttn > 0 && (
                    <span className="ml-1 text-[9px] text-muted-foreground">({categoryCounts.ttn})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="errors" className="text-xs h-6 px-2">
                  Errors
                  {categoryCounts.errors > 0 && (
                    <span className="ml-1 text-[9px] text-red-400">({categoryCounts.errors})</span>
                  )}
                </TabsTrigger>
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
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value as EntityType | 'all')}
              >
                <option value="all">All Entities</option>
                <option value="sensor">Sensor</option>
                <option value="gateway">Gateway</option>
                <option value="unit">Unit</option>
                <option value="area">Area</option>
                <option value="site">Site</option>
                <option value="alert">Alert</option>
                <option value="device">Device</option>
              </select>

              <div className="flex items-center gap-1 border-l border-border pl-2">
                <div className="flex items-center space-x-1">
                  <Checkbox
                    id="autoscroll"
                    checked={autoScroll}
                    onCheckedChange={(checked) => setAutoScroll(!!checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="autoscroll" className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowDown className="h-3 w-3" />
                  </label>
                </div>
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
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy} title="Copy all">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleExport} title="Export Logs">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs" 
                  onClick={handleExportSupportSnapshot}
                  title="Export Support Snapshot"
                >
                  <FileJson className="h-3.5 w-3.5 mr-1" />
                  Snapshot
                </Button>
              </div>
            </div>
          </div>

          {/* Log Content */}
          <ScrollArea className="flex-1" style={{ height: height - 80 }}>
            <div ref={scrollRef}>
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                  {correlationFilter ? (
                    <div className="text-center">
                      <p>No events for correlation ID</p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={handleClearCorrelationFilter}
                      >
                        Clear filter
                      </Button>
                    </div>
                  ) : (
                    "No logs to display"
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredLogs.map(entry => (
                    <LogEntry 
                      key={entry.id} 
                      entry={entry} 
                      onExplain={showExplanation} 
                      onFilterByCorrelation={handleFilterByCorrelation}
                      onCopyEntry={handleCopyEntry}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
    </>
  );
}
