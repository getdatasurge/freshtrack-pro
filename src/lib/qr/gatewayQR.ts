/**
 * SenseCAP Gateway QR Code Parser
 *
 * SenseCAP gateways encode a semicolon-delimited string on their bottom label:
 *   G1-00001;2CF7F1117280001E;2021E15F44E1A696;0;1000912
 *
 * We only care about field index 1 — the Gateway EUI (16-char hex).
 * Everything else is ignored.
 */

/**
 * Extracts Gateway EUI from a SenseCAP QR code string.
 * Returns the 16-char hex Gateway EUI (uppercased) or null if invalid.
 */
export function parseGatewayQR(raw: string): string | null {
  const parts = raw.split(";");
  if (parts.length < 2) return null;
  const eui = parts[1]?.trim().toUpperCase();
  if (!eui || !/^[0-9A-F]{16}$/.test(eui)) return null;
  return eui;
}

/**
 * Format a 16-char Gateway EUI into grouped display: 2CF7 F111 7280 001E
 */
export function formatGatewayEUI(eui: string): string {
  const clean = eui.replace(/\s/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

/**
 * Validate a string is a valid 16-char hex Gateway EUI.
 */
export function isValidGatewayEUI(value: string): boolean {
  const clean = value.replace(/[\s:-]/g, "").toUpperCase();
  return /^[0-9A-F]{16}$/.test(clean);
}

/**
 * Clean a Gateway EUI input to uppercase hex only.
 */
export function cleanGatewayEUI(value: string): string {
  return value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}
