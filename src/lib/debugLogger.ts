// FrostGuard Debug Logger
// Central logging module with redaction, ring buffer, correlation IDs, and entity-aware logging

export type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type DebugLogCategory = 
  | 'ui' 
  | 'routing' 
  | 'db' 
  | 'sync' 
  | 'ttn' 
  | 'provisioning' 
  | 'edge' 
  | 'network' 
  | 'auth'
  | 'crud'
  | 'realtime'
  | 'mutation'
  | 'query';

export type EntityType = 'sensor' | 'gateway' | 'unit' | 'area' | 'site' | 'alert' | 'device';
export type CrudAction = 'create' | 'update' | 'delete' | 'assign' | 'unassign' | 'provision' | 'deprovision';

export interface DebugLogEntry {
  id: string;
  timestamp: Date;
  level: DebugLogLevel;
  category: DebugLogCategory;
  message: string;
  payload?: Record<string, unknown>;
  source?: string;
  duration?: number;
  correlationId?: string;
  entityType?: EntityType;
  entityId?: string;
}

export interface OperationTracker {
  correlationId: string;
  startTime: number;
  operation: string;
  metadata?: Record<string, unknown>;
}

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /authorization/i,
  /auth[_-]?token/i,
  /bearer/i,
  /credential/i,
  /private[_-]?key/i,
  /app[_-]?key/i,
];

// Fields that should show last4 instead of full redaction
const LAST4_FIELDS = ['ttn_api_key', 'api_key', 'webhook_secret', 'dev_eui', 'app_eui', 'gateway_eui'];

// LocalStorage keys for debug settings
const LS_DEBUG_ENABLED = 'fg.debug.enabled';
const LS_DEBUG_LEVEL = 'fg.debug.level';
const LS_DEBUG_FILTERS = 'fg.debug.filters';

type LogSubscriber = (entry: DebugLogEntry) => void;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateCorrelationId(): string {
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}

class DebugLogger {
  private enabled = false;
  private paused = false;
  private buffer: DebugLogEntry[] = [];
  private maxBufferSize = 5000; // Increased from 1000
  private subscribers: Set<LogSubscriber> = new Set();
  private activeOperations: Map<string, OperationTracker> = new Map();
  private levelFilter: DebugLogLevel | null = null;
  private categoryFilters: DebugLogCategory[] = [];

  constructor() {
    // Load settings from localStorage
    this.loadSettings();
  }

  private loadSettings() {
    if (typeof window === 'undefined') return;
    
    try {
      const enabled = localStorage.getItem(LS_DEBUG_ENABLED);
      if (enabled === 'true') {
        this.enabled = true;
      }
      
      const level = localStorage.getItem(LS_DEBUG_LEVEL);
      if (level) {
        this.levelFilter = level as DebugLogLevel;
      }
      
      const filters = localStorage.getItem(LS_DEBUG_FILTERS);
      if (filters) {
        this.categoryFilters = JSON.parse(filters);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  private saveSettings() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(LS_DEBUG_ENABLED, String(this.enabled));
      if (this.levelFilter) {
        localStorage.setItem(LS_DEBUG_LEVEL, this.levelFilter);
      }
      if (this.categoryFilters.length > 0) {
        localStorage.setItem(LS_DEBUG_FILTERS, JSON.stringify(this.categoryFilters));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  enable() {
    this.enabled = true;
    this.saveSettings();
  }

  disable() {
    this.enabled = false;
    this.buffer = [];
    this.saveSettings();
  }

  isEnabled() {
    return this.enabled;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  isPaused() {
    return this.paused;
  }

  setLevelFilter(level: DebugLogLevel | null) {
    this.levelFilter = level;
    this.saveSettings();
  }

  setCategoryFilters(categories: DebugLogCategory[]) {
    this.categoryFilters = categories;
    this.saveSettings();
  }

  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getLogs(): DebugLogEntry[] {
    return [...this.buffer];
  }

  getLogsByCorrelationId(correlationId: string): DebugLogEntry[] {
    return this.buffer.filter(entry => entry.correlationId === correlationId);
  }

  getLogsByEntity(entityType: EntityType, entityId: string): DebugLogEntry[] {
    return this.buffer.filter(entry => entry.entityType === entityType && entry.entityId === entityId);
  }

  clearLogs() {
    this.buffer = [];
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getMaxBufferSize(): number {
    return this.maxBufferSize;
  }

  private redactValue(key: string, value: unknown): unknown {
    if (value === null || value === undefined) return value;
    
    const keyLower = key.toLowerCase();
    
    // Check if this is a sensitive field
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitive) {
      if (typeof value === 'string' && value.length > 0) {
        // Show last4 for specific fields
        if (LAST4_FIELDS.some(f => keyLower.includes(f.toLowerCase()))) {
          return `****${value.slice(-4)}`;
        }
        return `[REDACTED]`;
      }
      return '[REDACTED]';
    }
    
    // Recursively handle objects
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item, idx) => this.redactValue(String(idx), item));
      }
      return this.redactObject(value as Record<string, unknown>);
    }
    
    return value;
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.redactValue(key, value);
    }
    
    return result;
  }

  private createEntry(
    level: DebugLogLevel,
    category: DebugLogCategory,
    message: string,
    payload?: Record<string, unknown>,
    source?: string,
    duration?: number,
    correlationId?: string,
    entityType?: EntityType,
    entityId?: string
  ): DebugLogEntry {
    return {
      id: generateId(),
      timestamp: new Date(),
      level,
      category,
      message,
      payload: payload ? this.redactObject(payload) : undefined,
      source,
      duration,
      correlationId,
      entityType,
      entityId,
    };
  }

  private addEntry(entry: DebugLogEntry) {
    if (!this.enabled || this.paused) return;

    this.buffer.push(entry);
    
    // Trim buffer if exceeds max size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }

    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(entry);
      } catch (e) {
        console.error('[DebugLogger] Subscriber error:', e);
      }
    });
  }

  log(
    level: DebugLogLevel,
    category: DebugLogCategory,
    message: string,
    payload?: Record<string, unknown>,
    source?: string,
    duration?: number,
    correlationId?: string,
    entityType?: EntityType,
    entityId?: string
  ) {
    if (!this.enabled) return;
    
    const entry = this.createEntry(level, category, message, payload, source, duration, correlationId, entityType, entityId);
    this.addEntry(entry);
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      const prefix = correlationId ? `[${category.toUpperCase()}][${correlationId.slice(-8)}]` : `[${category.toUpperCase()}]`;
      console[consoleMethod](`${prefix} ${message}`, payload || '');
    }
  }

  debug(category: DebugLogCategory, message: string, payload?: Record<string, unknown>) {
    this.log('debug', category, message, payload);
  }

  info(category: DebugLogCategory, message: string, payload?: Record<string, unknown>) {
    this.log('info', category, message, payload);
  }

  warn(category: DebugLogCategory, message: string, payload?: Record<string, unknown>) {
    this.log('warn', category, message, payload);
  }

  error(category: DebugLogCategory, message: string, payload?: Record<string, unknown>) {
    this.log('error', category, message, payload);
  }

  // ============ CORRELATION ID OPERATIONS ============

  /**
   * Start a tracked async operation - returns correlationId
   */
  startOperation(operation: string, metadata?: Record<string, unknown>): string {
    const correlationId = generateCorrelationId();
    const tracker: OperationTracker = {
      correlationId,
      startTime: Date.now(),
      operation,
      metadata,
    };
    this.activeOperations.set(correlationId, tracker);
    
    this.log('debug', 'db', `[START] ${operation}`, metadata, undefined, undefined, correlationId);
    return correlationId;
  }

  /**
   * End a tracked operation
   */
  endOperation(
    correlationId: string, 
    status: 'success' | 'error', 
    result?: Record<string, unknown>
  ) {
    const tracker = this.activeOperations.get(correlationId);
    if (!tracker) {
      this.warn('db', `Unknown operation ended: ${correlationId}`, result);
      return;
    }
    
    const duration = Date.now() - tracker.startTime;
    const level: DebugLogLevel = status === 'error' ? 'error' : 'info';
    
    this.log(
      level, 
      'db', 
      `[END] ${tracker.operation} (${status})`, 
      { ...tracker.metadata, ...result, duration_ms: duration }, 
      undefined, 
      duration, 
      correlationId
    );
    
    this.activeOperations.delete(correlationId);
  }

  // ============ ENTITY-AWARE CRUD LOGGING ============

  /**
   * Log a CRUD operation on an entity
   */
  crud(
    action: CrudAction,
    entityType: EntityType,
    entityId: string | null,
    payload?: Record<string, unknown>,
    correlationId?: string
  ) {
    const message = `${action.toUpperCase()} ${entityType}${entityId ? ` (${entityId.slice(0, 8)})` : ''}`;
    this.log(
      action === 'delete' ? 'warn' : 'info',
      'crud',
      message,
      { action, entityType, entityId, ...payload },
      undefined,
      undefined,
      correlationId,
      entityType,
      entityId || undefined
    );
  }

  // ============ DATABASE OPERATION LOGGING ============

  /**
   * Log a Supabase table operation
   */
  dbOperation(
    operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc',
    table: string,
    payload?: Record<string, unknown>,
    correlationId?: string
  ) {
    const message = `DB ${operation.toUpperCase()} on ${table}`;
    this.log('debug', 'db', message, { table, operation, ...payload }, table, undefined, correlationId);
  }

  /**
   * Log database operation result
   */
  dbResult(
    operation: string,
    table: string,
    success: boolean,
    payload?: Record<string, unknown>,
    duration?: number,
    correlationId?: string
  ) {
    const level: DebugLogLevel = success ? 'info' : 'error';
    const message = success 
      ? `DB ${operation} on ${table} completed` 
      : `DB ${operation} on ${table} failed`;
    this.log(level, 'db', message, { table, operation, success, ...payload }, table, duration, correlationId);
  }

  // ============ REALTIME SUBSCRIPTION LOGGING ============

  /**
   * Log realtime subscription events
   */
  realtime(
    event: 'subscribe' | 'unsubscribe' | 'message' | 'error',
    channel: string,
    payload?: Record<string, unknown>
  ) {
    const level: DebugLogLevel = event === 'error' ? 'error' : event === 'message' ? 'debug' : 'info';
    const message = `REALTIME ${event.toUpperCase()}: ${channel}`;
    this.log(level, 'realtime', message, { channel, event, ...payload });
  }

  // ============ CONVENIENCE METHODS ============

  edgeFunction(
    functionName: string,
    status: 'start' | 'success' | 'error',
    payload?: Record<string, unknown>,
    duration?: number,
    correlationId?: string
  ) {
    const level: DebugLogLevel = status === 'error' ? 'error' : status === 'start' ? 'debug' : 'info';
    const message = status === 'start' 
      ? `Calling ${functionName}` 
      : status === 'success'
      ? `${functionName} completed`
      : `${functionName} failed`;
    
    this.log(level, 'edge', message, payload, functionName, duration, correlationId);
  }

  syncEvent(message: string, payload?: Record<string, unknown>, correlationId?: string) {
    this.log('info', 'sync', message, payload, undefined, undefined, correlationId);
  }

  ttnEvent(message: string, payload?: Record<string, unknown>, correlationId?: string) {
    this.log('info', 'ttn', message, payload, undefined, undefined, correlationId);
  }

  routeChange(from: string, to: string, params?: Record<string, string>) {
    this.debug('routing', `Navigation: ${from} → ${to}`, { from, to, params });
  }

  queryEvent(
    queryKey: string,
    status: 'loading' | 'success' | 'error' | 'invalidate',
    payload?: Record<string, unknown>
  ) {
    const level: DebugLogLevel = status === 'error' ? 'error' : 'debug';
    this.log(level, 'query', `Query ${queryKey}: ${status}`, { queryKey, status, ...payload });
  }

  mutationEvent(
    mutationKey: string,
    status: 'start' | 'success' | 'error',
    payload?: Record<string, unknown>,
    correlationId?: string
  ) {
    const level: DebugLogLevel = status === 'error' ? 'error' : status === 'start' ? 'debug' : 'info';
    this.log(level, 'mutation', `Mutation ${mutationKey}: ${status}`, { mutationKey, status, ...payload }, undefined, undefined, correlationId);
  }

  exportLogs(): string {
    const logs = this.getLogs().map(entry => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }));
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs with additional metadata for support
   */
  exportSnapshot(): string {
    const snapshot = {
      meta: {
        exported_at: new Date().toISOString(),
        buffer_size: this.buffer.length,
        max_buffer_size: this.maxBufferSize,
        active_operations: this.activeOperations.size,
      },
      logs: this.getLogs().map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })),
    };
    return JSON.stringify(snapshot, null, 2);
  }
}

// Singleton instance
export const debugLog = new DebugLogger();

// Global error handlers (only active when debug enabled)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (debugLog.isEnabled()) {
      debugLog.error('ui', 'Uncaught error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (debugLog.isEnabled()) {
      debugLog.error('ui', 'Unhandled promise rejection', {
        reason: String(event.reason),
      });
    }
  });
}
