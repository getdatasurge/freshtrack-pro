# Sensor Online/Offline Status Architecture

## 🎯 Single Source of Truth

**CRITICAL**: All sensor online/offline status calculations happen in **ONE place only**.

### Source of Truth
- **Module**: `src/hooks/useUnitStatus.ts`
- **Function**: `computeUnitStatus()`
- **Output**: `ComputedUnitStatus` object

## 📊 Data Flow

```
┌─────────────────┐
│   Unit Data     │  (from database)
│   - last_reading_at
│   - last_checkin_at
│   - checkin_interval_minutes
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  computeUnitStatus()    │  ← SINGLE SOURCE OF TRUTH
│  src/hooks/useUnitStatus.ts
│
│  Logic:
│  1. Get latest timestamp (max of last_checkin_at, last_reading_at)
│  2. Calculate missed check-ins:
│     missed = floor((now - lastUplink) / uplinkInterval)
│  3. Determine offline severity:
│     - none: missed < warning threshold
│     - warning: missed >= 1 (default)
│     - critical: missed >= 5 (default)
│  4. Set status label, colors
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  ComputedUnitStatus     │  ← Passed as derivedStatus prop
│
│  {
│    sensorOnline: boolean
│    offlineSeverity: "none"|"warning"|"critical"
│    missedCheckins: number
│    statusLabel: string
│    statusColor: string
│    statusBgColor: string
│    ...
│  }
└────────┬────────────────┘
         │
         ├─────────────────────────┬──────────────────────┬─────────────────┐
         ▼                         ▼                      ▼                 ▼
   ┌─────────────┐     ┌──────────────────┐    ┌───────────────┐  ┌─────────────┐
   │CurrentTemp  │     │DeviceReadiness   │    │DeviceStatus   │  │LastKnownGood│
   │Widget       │     │Widget            │    │Widget         │  │Widget       │
   │             │     │                  │    │               │  │             │
   │Uses:        │     │Uses:             │    │Uses:          │  │Uses:        │
   │isOnline     │     │offlineSeverity   │    │statusLabel    │  │isOnline     │
   └─────────────┘     └──────────────────┘    └───────────────┘  └─────────────┘
```

## ✅ All Consumers (Verified)

All widgets receive `derivedStatus` prop and use it correctly:

| Widget | File | Uses |
|--------|------|------|
| **Current Temperature** | `CurrentTempWidget.tsx` | `derivedStatus.isOnline` |
| **Device Status** | `DeviceStatusWidget.tsx` | `derivedStatus.statusLabel/Color` |
| **Device Readiness** | `DeviceReadinessWidget.tsx` | `derivedStatus.offlineSeverity` |
| **Last Known Good** | `LastKnownGoodWidget.tsx` | `derivedStatus.isOnline` |
| **Monitoring Active** | `LastKnownGoodWidget.tsx` | `derivedStatus.isOnline` |
| **Alert System** | `useUnitAlerts.ts` | `computed.offlineSeverity` |

## 🔧 Calculation Logic

### 1. Timestamp Selection
```typescript
// Use MOST RECENT of last_checkin_at or last_reading_at
const getLatestTimestamp = (): string | null => {
  if (!unit.last_checkin_at && !unit.last_reading_at) return null;
  if (!unit.last_checkin_at) return unit.last_reading_at;
  if (!unit.last_reading_at) return unit.last_checkin_at;

  // Both exist - use the most recent
  const checkinTime = new Date(unit.last_checkin_at).getTime();
  const readingTime = new Date(unit.last_reading_at).getTime();
  return checkinTime > readingTime ? unit.last_checkin_at : unit.last_reading_at;
};
```

### 2. Missed Check-ins Calculation
```typescript
// From src/lib/missedCheckins.ts
missed = Math.floor((now - lastUplinkAt) / (uplinkIntervalMinutes * 60 * 1000))
```

### 3. Offline Severity Determination
```typescript
if (missedCheckins >= rules.offline_critical_missed_checkins) return "critical";  // >= 5
if (missedCheckins >= rules.offline_warning_missed_checkins) return "warning";    // >= 1
return "none";  // Online
```

### 4. Status Label Assignment
```typescript
if (offlineSeverity === "critical") {
  statusLabel = "Offline";
  statusColor = "text-alarm";
} else if (offlineSeverity === "warning") {
  statusLabel = "Offline";
  statusColor = "text-warning";
} else {
  statusLabel = "OK";
  statusColor = "text-safe";
}
```

## 🚫 Anti-Patterns (DON'T DO THIS)

### ❌ BAD: Calculating status in widget
```typescript
// DON'T DO THIS
export function MyWidget({ unit }) {
  // ❌ WRONG: Calculating status independently
  const isOnline = unit.last_reading_at
    && (Date.now() - new Date(unit.last_reading_at).getTime()) < 600000;

  return <div>{isOnline ? "Online" : "Offline"}</div>;
}
```

### ✅ GOOD: Using derivedStatus prop
```typescript
// DO THIS
export function MyWidget({ derivedStatus }) {
  // ✅ CORRECT: Using single source of truth
  return <div>{derivedStatus.isOnline ? "Online" : "Offline"}</div>;
}
```

## 📝 Adding New Status Displays

When adding a new widget or component that shows online/offline status:

1. **Receive `derivedStatus` prop**
   ```typescript
   interface MyWidgetProps {
     derivedStatus: WidgetDerivedStatus;  // Required!
     // ... other props
   }
   ```

2. **Use existing fields**
   ```typescript
   export function MyWidget({ derivedStatus }: MyWidgetProps) {
     // Use derivedStatus.isOnline for boolean checks
     if (derivedStatus.isOnline) { ... }

     // Or use derivedStatus.offlineSeverity for detailed status
     if (derivedStatus.offlineSeverity === "critical") { ... }

     // Or use derivedStatus.statusLabel for display
     return <span>{derivedStatus.statusLabel}</span>;
   }
   ```

3. **DO NOT calculate independently**
   - Don't check timestamps directly
   - Don't calculate missed check-ins
   - Don't determine offline status yourself

## 🔍 Debugging Status Issues

If you see conflicting online/offline displays:

1. **Check data consistency**
   ```sql
   SELECT
     id,
     name,
     last_reading_at,
     last_checkin_at,
     checkin_interval_minutes
   FROM units
   WHERE id = 'your-unit-id';
   ```

2. **Verify timestamp usage**
   - All widgets should use `derivedStatus`
   - Check dev console for "Debug: Using..." messages (DeviceReadinessWidget)

3. **Check uplink interval**
   - Ensure `checkin_interval_minutes` matches sensor's `uplink_interval_s`
   - Backend should sync these values

4. **Review alert rules**
   - Check `offline_warning_missed_checkins` (default: 1)
   - Check `offline_critical_missed_checkins` (default: 5)

## 🎯 Key Benefits

1. **Consistency**: All widgets show the same status
2. **Maintainability**: Update logic in ONE place only
3. **Testability**: Test `computeUnitStatus()` once, covers all widgets
4. **Accuracy**: Uses most recent timestamp, respects uplink interval
5. **Clarity**: Clear data flow from source to UI

## 📚 Related Files

- **Source of Truth**: `src/hooks/useUnitStatus.ts`
- **Calculations**: `src/lib/missedCheckins.ts`
- **Alerts**: `src/hooks/useUnitAlerts.ts`
- **Types**: `src/features/dashboard-layout/types.ts` (WidgetDerivedStatus)
- **Widgets**: `src/features/dashboard-layout/widgets/*.tsx`

## 🔄 Updates

| Date | Change |
|------|--------|
| 2024-02-07 | Fixed timestamp selection to use most recent |
| 2024-02-07 | Added comprehensive documentation |
| 2024-02-07 | Verified all widgets use single source |
