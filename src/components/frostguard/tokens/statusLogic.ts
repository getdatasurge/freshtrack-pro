export type UnitStatusResult = {
  status: 'online' | 'offline' | 'warning' | 'critical' | 'unknown';
  reason: string;
  missedCheckins: number;
};

/**
 * THE single source of truth for unit/sensor status computation.
 * Every component that needs to display status MUST import and use this function.
 * NEVER read `unit.status` from the database for display.
 */
export function computeUnitStatus(
  lastReadingAt: string | null,
  uplinkIntervalS: number,
  activeAlerts?: { severity: 'warning' | 'critical' }[],
): UnitStatusResult {
  if (!lastReadingAt) {
    return { status: 'unknown', reason: 'No readings received', missedCheckins: 0 };
  }

  const elapsed = (Date.now() - new Date(lastReadingAt).getTime()) / 1000;
  const missed = Math.floor(elapsed / uplinkIntervalS) - 1;

  let computedStatus: UnitStatusResult['status'];
  let reason: string;

  if (elapsed < uplinkIntervalS * 1.5) {
    computedStatus = 'online';
    reason = 'Reporting normally';
  } else if (elapsed < uplinkIntervalS * 3) {
    computedStatus = 'warning';
    reason = `${missed} missed check-in${missed > 1 ? 's' : ''}`;
  } else {
    computedStatus = 'offline';
    reason = `No uplink for ${Math.round(elapsed / 60)} min`;
  }

  // Alert severity overrides
  if (activeAlerts?.some((a) => a.severity === 'critical') && computedStatus !== 'offline') {
    computedStatus = 'critical';
    reason = 'Critical alert active';
  } else if (activeAlerts?.some((a) => a.severity === 'warning') && computedStatus === 'online') {
    computedStatus = 'warning';
    reason = 'Warning alert active';
  }

  return { status: computedStatus, reason, missedCheckins: Math.max(0, missed) };
}

/** Map UnitStatus to design system StatusVariant */
export function statusToVariant(s: UnitStatusResult['status']): 'info' | 'success' | 'warning' | 'danger' | 'neutral' {
  switch (s) {
    case 'online': return 'success';
    case 'warning': return 'warning';
    case 'critical': return 'danger';
    case 'offline': return 'neutral';
    case 'unknown': return 'neutral';
  }
}

/** Human-readable status label */
export function statusLabel(s: UnitStatusResult['status']): string {
  switch (s) {
    case 'online': return 'Online';
    case 'warning': return 'Warning';
    case 'critical': return 'Critical';
    case 'offline': return 'Offline';
    case 'unknown': return 'Unknown';
  }
}
