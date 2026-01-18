/**
 * Payload Normalization Utilities
 * 
 * Converts vendor-specific payload formats to canonical fields
 * that Frost Guard widgets and processing expect.
 */

/**
 * Normalize door data from various payload formats to canonical door_open boolean
 * 
 * Handles:
 * - door_status: "open"/"closed" (LDS02, Dragino)
 * - door: true/false or "open"/"closed"
 * - door_open: boolean (already normalized)
 * - open_close: 1/0 (Milesight)
 * - DOOR_OPEN_STATUS: "OPEN"/"CLOSED" (Dragino uppercase variant)
 * 
 * @param decoded - The decoded payload from TTN or other sources
 * @returns boolean | undefined - true = open, false = closed, undefined = no door data
 */
export function normalizeDoorData(decoded: Record<string, unknown>): boolean | undefined {
  // Check door_open first (already in canonical format)
  if ('door_open' in decoded) {
    const value = decoded.door_open;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value.toLowerCase() === 'open' || value === '1';
  }
  
  // Check door_status (string "open"/"closed" - LDS02 format)
  if ('door_status' in decoded && decoded.door_status !== undefined) {
    const status = String(decoded.door_status).toLowerCase();
    return status === 'open';
  }
  
  // Check door (boolean or string)
  if ('door' in decoded && decoded.door !== undefined) {
    const value = decoded.door;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value.toLowerCase() === 'open' || value.toLowerCase() === 'true' || value === '1';
  }
  
  // Check open_close (1 = open, 0 = closed - Milesight format)
  if ('open_close' in decoded && decoded.open_close !== undefined) {
    return decoded.open_close === 1 || decoded.open_close === true || decoded.open_close === 'open';
  }
  
  // Check DOOR_OPEN_STATUS (Dragino uppercase format)
  if ('DOOR_OPEN_STATUS' in decoded && decoded.DOOR_OPEN_STATUS !== undefined) {
    return String(decoded.DOOR_OPEN_STATUS).toUpperCase() === 'OPEN';
  }
  
  // Check contactStatus (some sensors use this)
  if ('contactStatus' in decoded && decoded.contactStatus !== undefined) {
    const status = String(decoded.contactStatus).toLowerCase();
    return status === 'open' || status === '1' || status === 'true';
  }
  
  // No door data found
  return undefined;
}

/**
 * Check if payload contains any door-related fields
 */
export function hasDoorFields(decoded: Record<string, unknown>): boolean {
  return normalizeDoorData(decoded) !== undefined;
}

/**
 * Get debug info about what door field was found (for logging)
 */
export function getDoorFieldSource(decoded: Record<string, unknown>): string | null {
  const doorFields = ['door_open', 'door_status', 'door', 'open_close', 'DOOR_OPEN_STATUS', 'contactStatus'];
  for (const field of doorFields) {
    if (field in decoded && decoded[field] !== undefined) {
      return `${field}=${JSON.stringify(decoded[field])}`;
    }
  }
  return null;
}
