// FrostGuard Debug Logger
// Central logging module with redaction, ring buffer, and no-op mode

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
  | 'auth';

export interface DebugLogEntry {
  id: string;
  timestamp: Date;
  level: DebugLogLevel;
  category: DebugLogCategory;
  message: string;
  payload?: Record<string, unknown>;
  source?: string;
  duration?: number;
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
];

// Fields that should show last4 instead of full redaction
const LAST4_FIELDS = ['ttn_api_key', 'api_key', 'webhook_secret'];

type LogSubscriber = (entry: DebugLogEntry) => void;

class DebugLogger {
  private enabled = false;
  private paused = false;
  private buffer: DebugLogEntry[] = [];
  private maxBufferSize = 1000;
  private subscribers: Set<LogSubscriber> = new Set();

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.buffer = [];
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

  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getLogs(): DebugLogEntry[] {
    return [...this.buffer];
  }

  clearLogs() {
    this.buffer = [];
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
    duration?: number
  ): DebugLogEntry {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      message,
      payload: payload ? this.redactObject(payload) : undefined,
      source,
      duration,
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
    duration?: number
  ) {
    if (!this.enabled) return;
    
    const entry = this.createEntry(level, category, message, payload, source, duration);
    this.addEntry(entry);
    
    // Also log to console in development
    if (import.meta.env.DEV) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${category.toUpperCase()}] ${message}`, payload || '');
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

  // Convenience methods for common operations
  edgeFunction(
    functionName: string,
    status: 'start' | 'success' | 'error',
    payload?: Record<string, unknown>,
    duration?: number
  ) {
    const level: DebugLogLevel = status === 'error' ? 'error' : status === 'start' ? 'debug' : 'info';
    const message = status === 'start' 
      ? `Calling ${functionName}` 
      : status === 'success'
      ? `${functionName} completed`
      : `${functionName} failed`;
    
    this.log(level, 'edge', message, payload, functionName, duration);
  }

  syncEvent(message: string, payload?: Record<string, unknown>) {
    this.info('sync', message, payload);
  }

  ttnEvent(message: string, payload?: Record<string, unknown>) {
    this.info('ttn', message, payload);
  }

  routeChange(from: string, to: string, params?: Record<string, string>) {
    this.debug('routing', `Navigation: ${from} → ${to}`, { from, to, params });
  }

  exportLogs(): string {
    const logs = this.getLogs().map(entry => ({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
    }));
    return JSON.stringify(logs, null, 2);
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
