/**
 * Error Explainer Engine
 * Deterministic pattern-matching for error explanations
 */

import { DebugLogEntry } from './debugLogger';

export interface ErrorExplanation {
  title: string;
  summary: string;
  likelyCauses: string[];
  recommendedActions: string[];
  relatedFilters?: {
    category?: string;
    timeWindowSeconds?: number;
  };
  severity: 'info' | 'warning' | 'error';
  documentationUrl?: string;
}

interface ErrorPattern {
  id: string;
  match: (entry: DebugLogEntry) => boolean;
  explanation: Omit<ErrorExplanation, 'severity'>;
}

// Pattern definitions for common FrostGuard errors
const ERROR_PATTERNS: ErrorPattern[] = [
  // HTTP 401 - Authentication Failed
  {
    id: 'http_401',
    match: (entry) => {
      const status = entry.payload?.status || entry.payload?.statusCode;
      return status === 401;
    },
    explanation: {
      title: 'Authentication Failed',
      summary: 'The request was rejected because the authentication credentials are missing or invalid.',
      likelyCauses: [
        'API key is missing or expired',
        'Session has timed out',
        'Invalid authorization header format',
        'Token has been revoked'
      ],
      recommendedActions: [
        'Check if your API key is correctly configured in Settings → Developer',
        'Try logging out and logging back in',
        'If using TTN, regenerate your API key in TTN Console',
        'Clear browser cache and refresh the page'
      ],
      relatedFilters: { category: 'auth', timeWindowSeconds: 60 }
    }
  },

  // HTTP 403 - Permission Denied
  {
    id: 'http_403',
    match: (entry) => {
      const status = entry.payload?.status || entry.payload?.statusCode;
      return status === 403;
    },
    explanation: {
      title: 'Permission Denied',
      summary: "The request was authenticated but you don't have permission to perform this action.",
      likelyCauses: [
        'Your user role lacks the required permissions',
        'RLS policy is blocking access to this resource',
        "API key doesn't have the necessary scopes",
        'Resource belongs to a different organization'
      ],
      recommendedActions: [
        'Contact your organization admin to verify your role',
        'If this is a TTN operation, check API key permissions: applications:read, end_devices:write',
        'Verify you are accessing resources within your organization',
        'Export a snapshot for support if the issue persists'
      ],
      relatedFilters: { category: 'edge', timeWindowSeconds: 30 }
    }
  },

  // HTTP 400 - Bad Request / Validation Error
  {
    id: 'http_400',
    match: (entry) => {
      const status = entry.payload?.status || entry.payload?.statusCode;
      return status === 400;
    },
    explanation: {
      title: 'Validation Error',
      summary: 'The request was rejected because the data provided was invalid or incomplete.',
      likelyCauses: [
        'Required field is missing',
        'Data format is incorrect (e.g., invalid DevEUI format)',
        'Value is out of acceptable range',
        'Schema mismatch between client and server'
      ],
      recommendedActions: [
        'Check the form for any highlighted validation errors',
        'Verify all required fields are filled in correctly',
        'For DevEUI/AppEUI, ensure they are 16 hex characters',
        'Review the error details in the logs for specific field issues'
      ],
      relatedFilters: { category: 'edge', timeWindowSeconds: 30 }
    }
  },

  // HTTP 404 - Not Found
  {
    id: 'http_404',
    match: (entry) => {
      const status = entry.payload?.status || entry.payload?.statusCode;
      return status === 404;
    },
    explanation: {
      title: 'Resource Not Found',
      summary: 'The requested resource does not exist or has been deleted.',
      likelyCauses: [
        'The item was deleted by another user',
        'The URL or route is incorrect',
        'The resource ID is invalid or outdated',
        'You may be looking at a cached/stale link'
      ],
      recommendedActions: [
        'Refresh the page to get the latest data',
        'Navigate back to the parent page and try again',
        'Check if the item still exists in your inventory',
        'Clear browser cache if the issue persists'
      ],
      relatedFilters: { timeWindowSeconds: 30 }
    }
  },

  // HTTP 500+ - Server Error
  {
    id: 'http_5xx',
    match: (entry) => {
      const status = entry.payload?.status || entry.payload?.statusCode;
      return typeof status === 'number' && status >= 500;
    },
    explanation: {
      title: 'Server Error',
      summary: 'The server encountered an unexpected error while processing the request.',
      likelyCauses: [
        'Temporary backend service disruption',
        'Database connection issue',
        'Edge function timeout or crash',
        'External service (TTN, SMS provider) unavailable'
      ],
      recommendedActions: [
        'Wait a moment and try the operation again',
        'Check your internet connection',
        'If the issue persists, export a support snapshot',
        'Contact support if the error continues for more than 5 minutes'
      ],
      relatedFilters: { category: 'edge', timeWindowSeconds: 60 }
    }
  },

  // TTN Cluster Mismatch
  {
    id: 'ttn_cluster_mismatch',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      const payload = JSON.stringify(entry.payload || {}).toLowerCase();
      return entry.category === 'ttn' && 
        (msg.includes('cluster') || msg.includes('region') || 
         payload.includes('cluster_mismatch') || payload.includes('different cluster'));
    },
    explanation: {
      title: 'TTN Region Mismatch',
      summary: 'Your TTN application is registered on a different cluster than selected.',
      likelyCauses: [
        "Selected region doesn't match where your application was created",
        'Gateway is registered on a different regional server',
        'Application was moved or recreated on a different cluster'
      ],
      recommendedActions: [
        'Go to Settings → Developer → TTN Connection',
        'Select the correct region (nam1, eu1, au1, or as1)',
        'Verify in TTN Console which cluster your application uses',
        'The cluster is shown in your TTN Console URL (e.g., nam1.cloud.thethings.network)'
      ],
      relatedFilters: { category: 'ttn', timeWindowSeconds: 120 },
      documentationUrl: '/docs/TTN_SETUP.md'
    }
  },

  // TTN API Key Invalid
  {
    id: 'ttn_api_key_invalid',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      const payload = JSON.stringify(entry.payload || {}).toLowerCase();
      return entry.category === 'ttn' && 
        (msg.includes('api key') || msg.includes('unauthorized') ||
         payload.includes('api_key_invalid') || payload.includes('unauthenticated'));
    },
    explanation: {
      title: 'TTN API Key Invalid',
      summary: 'The TTN API key is missing, expired, or lacks required permissions.',
      likelyCauses: [
        'API key was not saved correctly',
        'API key has expired or been revoked',
        'API key lacks required permissions (applications, devices)',
        'Wrong API key for this application'
      ],
      recommendedActions: [
        'Go to Settings → Developer → TTN Connection',
        'Generate a new API key in TTN Console with these permissions:',
        '  - Read/write application info',
        '  - Read/write end devices',
        'Paste the new key and test the connection'
      ],
      relatedFilters: { category: 'ttn', timeWindowSeconds: 60 },
      documentationUrl: '/docs/TTN_SETUP.md'
    }
  },

  // TTN Provisioning Failed
  {
    id: 'ttn_provisioning_failed',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      return entry.category === 'ttn' && 
        (msg.includes('provision') || msg.includes('registration failed'));
    },
    explanation: {
      title: 'Device Provisioning Failed',
      summary: 'Failed to register the sensor with The Things Network.',
      likelyCauses: [
        'DevEUI is already registered on TTN',
        'Application has reached device limit',
        'Invalid DevEUI, AppEUI, or AppKey format',
        'Network connectivity issue to TTN'
      ],
      recommendedActions: [
        'Check if this DevEUI is already registered in TTN Console',
        'Verify the sensor credentials (DevEUI must be 16 hex characters)',
        'Try removing the existing device from TTN and re-provisioning',
        'Check the TTN tab in the debug terminal for more details'
      ],
      relatedFilters: { category: 'ttn', timeWindowSeconds: 120 }
    }
  },

  // RLS / Permission Denied (Database)
  {
    id: 'rls_denied',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      const payload = JSON.stringify(entry.payload || {}).toLowerCase();
      return msg.includes('permission denied') || 
             msg.includes('row-level security') ||
             payload.includes('rls') ||
             payload.includes('policy');
    },
    explanation: {
      title: 'Database Access Denied',
      summary: 'A row-level security policy prevented this database operation.',
      likelyCauses: [
        "You're trying to access data from another organization",
        "Your user role doesn't have access to this table",
        "The RLS policy requires a field that wasn't provided",
        'Session may have expired'
      ],
      recommendedActions: [
        'Verify you are logged in as the correct user',
        'Check that you have the required role (owner/admin/viewer)',
        'Try logging out and logging back in',
        'Contact support if you believe this is a bug'
      ],
      relatedFilters: { category: 'db', timeWindowSeconds: 30 }
    }
  },

  // Unique Constraint Violation
  {
    id: 'unique_violation',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      const payload = JSON.stringify(entry.payload || {}).toLowerCase();
      return msg.includes('duplicate') || 
             msg.includes('unique_violation') ||
             msg.includes('already exists') ||
             payload.includes('23505'); // PostgreSQL unique violation code
    },
    explanation: {
      title: 'Duplicate Entry Detected',
      summary: 'An item with the same identifier already exists.',
      likelyCauses: [
        'A sensor with this DevEUI is already registered',
        'The name you chose is already in use',
        'A previous operation created this record',
        'The item exists but may be in a different site/area'
      ],
      recommendedActions: [
        'Check if the item already exists in your inventory',
        'Use a different name or identifier',
        'Search across all sites for existing items',
        'If the duplicate was created in error, delete it first'
      ],
      relatedFilters: { category: 'db', timeWindowSeconds: 30 }
    }
  },

  // Network / Fetch Error
  {
    id: 'network_error',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      return msg.includes('failed to fetch') || 
             msg.includes('network error') ||
             msg.includes('cors') ||
             msg.includes('timeout') ||
             msg.includes('aborted');
    },
    explanation: {
      title: 'Network Connection Error',
      summary: 'Unable to reach the server. The request did not complete.',
      likelyCauses: [
        'Internet connection is unavailable or unstable',
        'Server is temporarily unreachable',
        'Request timed out due to slow connection',
        'Firewall or proxy blocking the request'
      ],
      recommendedActions: [
        'Check your internet connection',
        'Try refreshing the page',
        'Disable any VPN or proxy temporarily',
        'Wait a moment and try again'
      ],
      relatedFilters: { category: 'network', timeWindowSeconds: 30 }
    }
  },

  // Sync Errors
  {
    id: 'sync_error',
    match: (entry) => {
      const msg = entry.message.toLowerCase();
      return entry.category === 'sync' && 
        (msg.includes('failed') || msg.includes('error') || entry.level === 'error');
    },
    explanation: {
      title: 'Sync Operation Failed',
      summary: 'The synchronization between FrostGuard and external systems failed.',
      likelyCauses: [
        'Network connectivity issue during sync',
        'Conflict with data modified elsewhere',
        'External service (emulator, TTN) unavailable',
        'Sync version mismatch'
      ],
      recommendedActions: [
        'Wait a moment and the system will retry automatically',
        'Check the Sync tab for more details',
        'If using emulator, verify it is running and accessible',
        'Export a snapshot if the issue persists'
      ],
      relatedFilters: { category: 'sync', timeWindowSeconds: 120 }
    }
  },

  // Edge Function Errors (generic)
  {
    id: 'edge_function_error',
    match: (entry) => {
      return entry.category === 'edge' && entry.level === 'error';
    },
    explanation: {
      title: 'Backend Function Error',
      summary: 'A backend function encountered an error while processing the request.',
      likelyCauses: [
        'Invalid input data sent to the function',
        'External service dependency failed',
        'Function timeout or resource limit exceeded',
        'Temporary infrastructure issue'
      ],
      recommendedActions: [
        'Review the error message for specific details',
        'Check the Network tab for the request/response details',
        'Try the operation again',
        'Export a support snapshot if the error persists'
      ],
      relatedFilters: { category: 'edge', timeWindowSeconds: 60 }
    }
  }
];

/**
 * Get explanation for a log entry
 */
export function explainError(entry: DebugLogEntry): ErrorExplanation {
  // Find matching pattern
  for (const pattern of ERROR_PATTERNS) {
    try {
      if (pattern.match(entry)) {
        return {
          ...pattern.explanation,
          severity: entry.level === 'error' ? 'error' : 'warning'
        };
      }
    } catch {
      // Pattern match failed, continue to next
    }
  }

  // Generic fallback explanation
  return {
    title: 'Unexpected Error',
    summary: 'An unexpected error occurred. The specific cause could not be determined automatically.',
    likelyCauses: [
      'This may be a temporary issue',
      'The error pattern is not yet recognized',
      'Multiple factors may be contributing'
    ],
    recommendedActions: [
      'Review the error message and payload for clues',
      'Check related logs in the terminal (±30 seconds)',
      'Export a support snapshot to share with the team',
      'Try the operation again after a moment'
    ],
    severity: entry.level === 'error' ? 'error' : 'warning',
    relatedFilters: { timeWindowSeconds: 30 }
  };
}

/**
 * Get related logs within a time window
 */
export function getRelatedLogs(
  allLogs: DebugLogEntry[],
  targetEntry: DebugLogEntry,
  windowSeconds: number = 30
): DebugLogEntry[] {
  const targetTime = targetEntry.timestamp.getTime();
  const windowMs = windowSeconds * 1000;

  return allLogs.filter(log => {
    const logTime = log.timestamp.getTime();
    return Math.abs(logTime - targetTime) <= windowMs && log.id !== targetEntry.id;
  });
}

/**
 * Format explanation as markdown for copying
 */
export function formatExplanationAsMarkdown(
  entry: DebugLogEntry,
  explanation: ErrorExplanation
): string {
  const lines: string[] = [
    `# ${explanation.title}`,
    '',
    `**Time:** ${entry.timestamp.toISOString()}`,
    `**Category:** ${entry.category} | **Level:** ${entry.level}`,
    '',
    '## What Happened',
    explanation.summary,
    '',
    '## Likely Causes',
    ...explanation.likelyCauses.map(cause => `- ${cause}`),
    '',
    '## Recommended Actions',
    ...explanation.recommendedActions.map((action, i) => `${i + 1}. ${action}`),
    '',
    '## Original Error',
    `\`\`\``,
    entry.message,
    `\`\`\``,
  ];

  if (entry.payload) {
    lines.push('', '## Error Details', '```json', JSON.stringify(entry.payload, null, 2), '```');
  }

  return lines.join('\n');
}
