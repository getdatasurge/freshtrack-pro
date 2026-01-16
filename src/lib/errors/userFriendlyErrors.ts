/**
 * User-Friendly Error Translation
 * 
 * Maps technical error codes and messages to user-friendly language.
 * Provides suggestions for resolution where appropriate.
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface UserFriendlyError {
  /** Technical error code or message (for matching) */
  technical: string;
  /** User-facing message */
  user: string;
  /** Suggested action to resolve */
  suggestion?: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** Category for grouping */
  category: 'sensor' | 'gateway' | 'network' | 'database' | 'auth' | 'config' | 'external' | 'general';
}

/**
 * Error translation map.
 * Keys are technical error patterns (can be partial matches).
 */
export const ERROR_TRANSLATIONS: Record<string, UserFriendlyError> = {
  // Sensor errors
  'SENSOR_OFFLINE': {
    technical: 'No uplink received in 3600 seconds',
    user: "The sensor hasn't sent data recently",
    suggestion: 'Check if the sensor is powered on and in range of a gateway',
    severity: 'warning',
    category: 'sensor',
  },
  'SENSOR_BATTERY_LOW': {
    technical: 'Battery level below 20%',
    user: 'Sensor battery is running low',
    suggestion: 'Replace the sensor batteries soon',
    severity: 'warning',
    category: 'sensor',
  },
  'SENSOR_BATTERY_CRITICAL': {
    technical: 'Battery level below 10%',
    user: 'Sensor battery is critically low',
    suggestion: 'Replace the sensor batteries immediately',
    severity: 'error',
    category: 'sensor',
  },
  'SENSOR_NOT_FOUND': {
    technical: 'Device not found in TTN',
    user: 'Sensor is not registered in the network',
    suggestion: 'Re-register the sensor or check its DevEUI',
    severity: 'error',
    category: 'sensor',
  },
  'SENSOR_WEAK_SIGNAL': {
    technical: 'RSSI below -110 dBm',
    user: 'Sensor signal is weak',
    suggestion: 'Move the sensor closer to a gateway or add another gateway',
    severity: 'warning',
    category: 'sensor',
  },

  // Gateway errors
  'GATEWAY_UNREACHABLE': {
    technical: '503 Service Unavailable from TTN API',
    user: 'The gateway may be offline',
    suggestion: "Check the gateway's power and internet connection",
    severity: 'error',
    category: 'gateway',
  },
  'GATEWAY_OFFLINE': {
    technical: 'Gateway status: offline',
    user: 'Gateway is not connected to the network',
    suggestion: "Verify the gateway's ethernet/WiFi and power supply",
    severity: 'error',
    category: 'gateway',
  },
  'GATEWAY_NOT_CONFIGURED': {
    technical: 'No gateway found for site',
    user: 'No gateway has been set up for this location',
    suggestion: 'Add and configure a gateway in Settings',
    severity: 'info',
    category: 'gateway',
  },

  // TTN/Network errors
  'TTN_API_ERROR': {
    technical: 'Failed to fetch from api.thethings.network',
    user: 'Network service temporarily unavailable',
    suggestion: 'This is usually temporary - please wait and try again',
    severity: 'warning',
    category: 'network',
  },
  'DECODER_FAILED': {
    technical: 'PayloadDecodingError',
    user: "We couldn't read the sensor data",
    suggestion: 'This may require technical support - please contact us',
    severity: 'error',
    category: 'network',
  },
  'WEBHOOK_TIMEOUT': {
    technical: '504 Gateway Timeout',
    user: 'Data delivery was delayed',
    suggestion: 'Data should arrive soon - this is usually temporary',
    severity: 'info',
    category: 'network',
  },
  'WEBHOOK_FAILED': {
    technical: 'Webhook delivery failed',
    user: 'Data delivery encountered an issue',
    suggestion: 'System will retry automatically',
    severity: 'warning',
    category: 'network',
  },

  // Database errors
  'DB_CONNECTION_ERROR': {
    technical: 'Connection refused',
    user: 'Unable to connect to the database',
    suggestion: 'This is usually temporary - please try again in a moment',
    severity: 'error',
    category: 'database',
  },
  'DB_QUERY_ERROR': {
    technical: 'Query execution error',
    user: 'Error retrieving data',
    suggestion: 'Please refresh the page. If the issue persists, contact support',
    severity: 'error',
    category: 'database',
  },
  'DB_TIMEOUT': {
    technical: 'Statement timeout',
    user: 'Data request took too long',
    suggestion: 'Try selecting a smaller date range',
    severity: 'warning',
    category: 'database',
  },

  // Auth errors
  'AUTH_REQUIRED': {
    technical: 'JWT required',
    user: 'Please sign in to continue',
    suggestion: 'Your session may have expired',
    severity: 'info',
    category: 'auth',
  },
  'AUTH_EXPIRED': {
    technical: 'JWT expired',
    user: 'Your session has expired',
    suggestion: 'Please sign in again',
    severity: 'info',
    category: 'auth',
  },
  'PERMISSION_DENIED': {
    technical: 'RLS policy violation',
    user: "You don't have access to this resource",
    suggestion: 'Contact your administrator for access',
    severity: 'warning',
    category: 'auth',
  },
  'ROLE_REQUIRED': {
    technical: 'Insufficient permissions',
    user: 'This action requires additional permissions',
    suggestion: 'Contact your administrator to upgrade your role',
    severity: 'warning',
    category: 'auth',
  },

  // Configuration errors
  'CONFIG_MISSING': {
    technical: 'Configuration not found',
    user: 'Setup required to use this feature',
    suggestion: 'Complete the setup in Settings',
    severity: 'info',
    category: 'config',
  },
  'LOCATION_NOT_SET': {
    technical: 'Site coordinates not configured',
    user: 'Location not configured',
    suggestion: 'Set the site location to enable weather features',
    severity: 'info',
    category: 'config',
  },
  'NO_SENSOR_ASSIGNED': {
    technical: 'No sensor assigned to unit',
    user: 'No sensor is monitoring this unit',
    suggestion: 'Assign a sensor to start monitoring',
    severity: 'info',
    category: 'config',
  },

  // External API errors
  'WEATHER_API_ERROR': {
    technical: 'Failed to fetch weather data',
    user: 'Weather data temporarily unavailable',
    suggestion: 'Weather will update automatically when service is restored',
    severity: 'info',
    category: 'external',
  },
  'EXTERNAL_API_TIMEOUT': {
    technical: 'External API request timeout',
    user: 'External service is slow to respond',
    suggestion: 'Please wait a moment and try again',
    severity: 'warning',
    category: 'external',
  },

  // General errors
  'NETWORK_ERROR': {
    technical: 'Failed to fetch',
    user: 'Network connection issue',
    suggestion: 'Check your internet connection and try again',
    severity: 'warning',
    category: 'general',
  },
  'UNKNOWN_ERROR': {
    technical: 'Unknown error',
    user: 'Something unexpected happened',
    suggestion: 'Please try again. If the issue persists, contact support',
    severity: 'error',
    category: 'general',
  },
  'RATE_LIMITED': {
    technical: '429 Too Many Requests',
    user: 'Too many requests',
    suggestion: 'Please wait a moment before trying again',
    severity: 'warning',
    category: 'general',
  },
  'SERVER_ERROR': {
    technical: '500 Internal Server Error',
    user: 'Server error occurred',
    suggestion: 'Our team has been notified. Please try again later',
    severity: 'error',
    category: 'general',
  },
};

/**
 * Translate a technical error to user-friendly format.
 * Attempts to match the error against known patterns.
 */
export function translateError(error: string | Error): UserFriendlyError {
  const errorString = typeof error === 'string' ? error : error.message;
  const errorLower = errorString.toLowerCase();

  // Try exact key match first
  if (ERROR_TRANSLATIONS[errorString]) {
    return ERROR_TRANSLATIONS[errorString];
  }

  // Try pattern matching
  for (const [key, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    const pattern = translation.technical.toLowerCase();
    if (errorLower.includes(pattern) || pattern.includes(errorLower)) {
      return translation;
    }
  }

  // Try to categorize by keywords
  if (errorLower.includes('network') || errorLower.includes('fetch')) {
    return {
      ...ERROR_TRANSLATIONS['NETWORK_ERROR'],
      technical: errorString,
    };
  }

  if (errorLower.includes('permission') || errorLower.includes('denied') || errorLower.includes('unauthorized')) {
    return {
      ...ERROR_TRANSLATIONS['PERMISSION_DENIED'],
      technical: errorString,
    };
  }

  if (errorLower.includes('timeout')) {
    return {
      ...ERROR_TRANSLATIONS['DB_TIMEOUT'],
      technical: errorString,
    };
  }

  // Default to unknown error
  return {
    ...ERROR_TRANSLATIONS['UNKNOWN_ERROR'],
    technical: errorString,
  };
}

/**
 * Get severity color class for UI.
 */
export function getSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case 'info':
      return 'text-muted-foreground';
    case 'warning':
      return 'text-warning';
    case 'error':
      return 'text-alarm';
    case 'critical':
      return 'text-alarm';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get severity background color class for UI.
 */
export function getSeverityBgColor(severity: ErrorSeverity): string {
  switch (severity) {
    case 'info':
      return 'bg-muted';
    case 'warning':
      return 'bg-warning/10';
    case 'error':
      return 'bg-alarm/10';
    case 'critical':
      return 'bg-alarm/20';
    default:
      return 'bg-muted';
  }
}

/**
 * Terminology translations for technical → user language.
 */
export const TERMINOLOGY: Record<string, string> = {
  'uplink': 'reading',
  'downlink': 'command',
  'gateway': 'network hub',
  'decoder': 'data processor',
  'webhook': 'data delivery',
  'RLS policy': 'access restriction',
  'DevEUI': 'device ID',
  'AppEUI': 'application ID',
  'AppKey': 'security key',
  'RSSI': 'signal strength',
  'SNR': 'signal quality',
  'spreading factor': 'range setting',
  'payload': 'sensor data',
  'JOIN request': 'connection request',
  'ABP': 'direct connection',
  'OTAA': 'secure connection',
};

/**
 * Replace technical terms with user-friendly equivalents.
 */
export function simplifyMessage(message: string): string {
  let simplified = message;
  
  for (const [technical, user] of Object.entries(TERMINOLOGY)) {
    const regex = new RegExp(technical, 'gi');
    simplified = simplified.replace(regex, user);
  }
  
  return simplified;
}
