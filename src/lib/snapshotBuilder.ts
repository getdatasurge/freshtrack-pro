/**
 * Support Snapshot Builder
 * Creates redacted diagnostic bundles for support
 */

import { DebugLogEntry, debugLog } from './debugLogger';
import { format } from 'date-fns';

// Re-use sensitive patterns from debugLogger
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /authorization/i,
  /bearer/i,
  /credential/i,
  /private/i,
  /app[_-]?key/i,
  /session/i,
  /jwt/i,
];

const SENSITIVE_URL_PARAMS = ['key', 'token', 'secret', 'api_key', 'apikey', 'password', 'auth'];

interface SnapshotMeta {
  app_name: string;
  environment: 'dev' | 'staging' | 'prod';
  version: string;
  generated_at: string;
  current_route: string;
}

interface SnapshotUser {
  email_domain: string;
  organization_id: string;
  site_id: string | null;
  debug_mode_enabled: boolean;
}

interface SnapshotLogs {
  total_count: number;
  included_count: number;
  entries: RedactedLogEntry[];
}

interface SnapshotNetworkCall {
  function_name: string;
  method?: string;
  status?: number;
  duration_ms?: number;
  timestamp: string;
  had_error: boolean;
}

interface SnapshotNetwork {
  recent_calls: SnapshotNetworkCall[];
}

interface SnapshotDomain {
  ttn: {
    enabled: boolean;
    cluster?: string;
    application_id_present: boolean;
    api_key_last4?: string;
  };
  sensors_count?: number;
  gateways_count?: number;
  sync: {
    last_sync_version?: number;
    is_dirty?: boolean;
  };
}

interface SnapshotFocus {
  error_entry: RedactedLogEntry;
  surrounding_logs: RedactedLogEntry[];
  correlated_network: SnapshotNetworkCall[];
}

export interface SupportSnapshot {
  meta: SnapshotMeta;
  user: SnapshotUser;
  logs: SnapshotLogs;
  network: SnapshotNetwork;
  domain: SnapshotDomain;
  focus?: SnapshotFocus;
}

interface RedactedLogEntry {
  id: string;
  timestamp: string;
  level: string;
  category: string;
  message: string;
  payload?: Record<string, unknown>;
}

interface BuildSnapshotOptions {
  logs: DebugLogEntry[];
  focusEntry?: DebugLogEntry;
  userEmail?: string;
  orgId?: string;
  siteId?: string;
  currentRoute?: string;
  maxLogs?: number;
}

/**
 * Detect environment from URL
 */
function detectEnvironment(): 'dev' | 'staging' | 'prod' {
  const host = window.location.hostname;
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'dev';
  }
  if (host.includes('staging') || host.includes('preview') || host.includes('lovableproject')) {
    return 'staging';
  }
  return 'prod';
}

/**
 * Extract email domain only
 */
function getEmailDomain(email?: string): string {
  if (!email) return 'unknown';
  const parts = email.split('@');
  return parts.length > 1 ? `@${parts[1]}` : 'unknown';
}

/**
 * Check if a key is sensitive
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redact a value deeply
 */
function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Check if key is sensitive
  if (isSensitiveKey(key)) {
    if (typeof value === 'string' && value.length > 4) {
      return `****${value.slice(-4)}`;
    }
    return '[REDACTED]';
  }

  // Recursively redact objects
  if (typeof value === 'object' && !Array.isArray(value)) {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      redacted[k] = redactValue(k, v);
    }
    return redacted;
  }

  // Recursively redact arrays
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item));
  }

  // Truncate long strings
  if (typeof value === 'string' && value.length > 500) {
    return value.substring(0, 500) + '... [truncated]';
  }

  return value;
}

/**
 * Redact URL query parameters
 */
function redactUrl(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    SENSITIVE_URL_PARAMS.forEach(param => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Convert log entry to redacted format
 */
function redactLogEntry(entry: DebugLogEntry): RedactedLogEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp.toISOString(),
    level: entry.level,
    category: entry.category,
    message: entry.message,
    payload: entry.payload ? redactValue('payload', entry.payload) as Record<string, unknown> : undefined,
  };
}

/**
 * Extract network calls from logs
 */
function extractNetworkCalls(logs: DebugLogEntry[]): SnapshotNetworkCall[] {
  return logs
    .filter(log => log.category === 'edge' || log.category === 'network')
    .map(log => ({
      function_name: (log.payload?.function as string) || log.message.split(' ')[0] || 'unknown',
      method: log.payload?.method as string,
      status: log.payload?.status as number,
      duration_ms: log.payload?.duration as number,
      timestamp: log.timestamp.toISOString(),
      had_error: log.level === 'error' || (log.payload?.status as number) >= 400,
    }))
    .slice(-50); // Last 50 network calls
}

/**
 * Build a support snapshot
 */
export async function buildSupportSnapshot(options: BuildSnapshotOptions): Promise<SupportSnapshot> {
  const {
    logs,
    focusEntry,
    userEmail,
    orgId,
    siteId,
    currentRoute = window.location.pathname,
    maxLogs = 500,
  } = options;

  // Get app version from meta tag or default
  const versionMeta = document.querySelector('meta[name="version"]');
  const version = versionMeta?.getAttribute('content') || 'unknown';

  // Build meta section
  const meta: SnapshotMeta = {
    app_name: 'FrostGuard',
    environment: detectEnvironment(),
    version,
    generated_at: new Date().toISOString(),
    current_route: currentRoute,
  };

  // Build user section (safe fields only)
  const user: SnapshotUser = {
    email_domain: getEmailDomain(userEmail),
    organization_id: orgId || 'unknown',
    site_id: siteId || null,
    debug_mode_enabled: debugLog.isEnabled(),
  };

  // Build logs section
  const recentLogs = logs.slice(-maxLogs);
  const logsSection: SnapshotLogs = {
    total_count: logs.length,
    included_count: recentLogs.length,
    entries: recentLogs.map(redactLogEntry),
  };

  // Build network section
  const network: SnapshotNetwork = {
    recent_calls: extractNetworkCalls(logs),
  };

  // Build domain section (extract from logs where possible)
  const ttnLogs = logs.filter(l => l.category === 'ttn');
  const syncLogs = logs.filter(l => l.category === 'sync');
  
  const domain: SnapshotDomain = {
    ttn: {
      enabled: ttnLogs.length > 0,
      application_id_present: ttnLogs.some(l => l.payload?.application_id),
      api_key_last4: undefined, // Never expose even last4 in snapshot
    },
    sync: {
      last_sync_version: syncLogs.length > 0 ? 
        (syncLogs[syncLogs.length - 1]?.payload?.sync_version as number) : undefined,
      is_dirty: syncLogs.some(l => l.payload?.is_dirty === true),
    },
  };

  // Build focus section if specific error provided
  let focus: SnapshotFocus | undefined;
  if (focusEntry) {
    const targetTime = focusEntry.timestamp.getTime();
    const windowMs = 30 * 1000; // 30 seconds

    const surroundingLogs = logs
      .filter(log => {
        const logTime = log.timestamp.getTime();
        return Math.abs(logTime - targetTime) <= windowMs && log.id !== focusEntry.id;
      })
      .map(redactLogEntry);

    const correlatedNetwork = extractNetworkCalls(
      logs.filter(log => {
        const logTime = log.timestamp.getTime();
        return Math.abs(logTime - targetTime) <= windowMs;
      })
    );

    focus = {
      error_entry: redactLogEntry(focusEntry),
      surrounding_logs: surroundingLogs,
      correlated_network: correlatedNetwork,
    };
  }

  return {
    meta,
    user,
    logs: logsSection,
    network,
    domain,
    focus,
  };
}

/**
 * Download snapshot as JSON file
 */
export function downloadSnapshot(snapshot: SupportSnapshot): void {
  const filename = `frostguard-support-snapshot-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
  const content = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy snapshot to clipboard
 */
export async function copySnapshotToClipboard(snapshot: SupportSnapshot): Promise<boolean> {
  try {
    const content = JSON.stringify(snapshot, null, 2);
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
