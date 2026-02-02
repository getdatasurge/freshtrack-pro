
# Battery Health & Readiness System — Voltage as Source of Truth

## Overview

Refactor the battery system to treat **voltage as the canonical input** and derive all other metrics from it. This eliminates false precision from device-reported percentages, reduces alert noise, and provides a compliance-safe battery story for HACCP audits.

---

## Phase 1: Data Model Changes

### 1.1 Add Voltage Columns to Tables

**lora_sensors** — add columns:
- `battery_voltage` (NUMERIC(4,3)) — latest raw voltage reading
- `battery_voltage_filtered` (NUMERIC(4,3)) — median-smoothed voltage
- `battery_health_state` (TEXT) — OK, WARNING, LOW, CRITICAL, REPLACE_ASAP

**sensor_readings** — add column:
- `battery_voltage` (NUMERIC(4,3)) — raw voltage per reading

### 1.2 Voltage-to-Percentage Mapping Curve

For CR17450 (3.0V Li-MnO₂) with flat discharge curve:

```text
Voltage Range   |  Percentage  |  Notes
----------------|--------------|--------
≥ 3.00V         |  100%        |  Fresh battery
2.95–2.99V      |  80%         |  Good
2.85–2.94V      |  50%         |  Mid-life plateau
2.75–2.84V      |  20%         |  Warning zone
2.60–2.74V      |  5%          |  Low
< 2.60V         |  0%          |  Replace ASAP
```

This curve respects the flat discharge characteristic where most of battery life occurs at the ~2.85V plateau.

---

## Phase 2: Battery Health State Machine

### 2.1 States

| State | Voltage Band | UI Color |
|-------|--------------|----------|
| OK | ≥ 2.85V | Green |
| WARNING | 2.75–2.84V | Yellow |
| LOW | 2.60–2.74V | Orange |
| CRITICAL | < 2.60V | Red |
| REPLACE_ASAP | < 2.50V OR consistent drop | Red + banner |

### 2.2 Hysteresis Logic

State changes require **3 consecutive readings** in the new band to prevent flapping:
- Store last 5 readings in a rolling buffer
- Only transition when median of last 3 crosses threshold
- Downgrade transitions (OK → WARNING) are immediate for safety
- Upgrade transitions (WARNING → OK) require hysteresis

---

## Phase 3: Voltage Trend & Remaining Life

### 3.1 Slope Calculation

Calculate voltage slope over last 7 days:

```text
slope_v_per_day = (V_now - V_7_days_ago) / 7
```

Use linear regression for robustness against noise.

### 3.2 Remaining Life Estimation

```text
service_threshold = 2.60V (LOW state entry)
current_voltage = median of last 5 readings
days_remaining = (current_voltage - service_threshold) / abs(slope_v_per_day)
```

**Confidence gating:**
- Requires ≥ 14 days of data for estimate
- Display "Projected" if < 30 days of data
- Display "Estimated" if ≥ 30 days of data
- If slope is positive or near-zero, show "12+ months"

---

## Phase 4: Updated UI Copy

### 4.1 Device Readiness Widget

```text
┌─────────────────────────────────────┐
│ Battery Level                       │
│ 85% (Est.)        [OK]              │
│ Last: 3m ago                        │
└─────────────────────────────────────┘
```

- Show percentage with "(Est.)" suffix
- State badge: OK / Warning / Low / Critical
- Never claim exact remaining time

### 4.2 Battery Health Widget (Expanded)

```text
┌──────────────────────────────────────────────────────────┐
│ Battery Health                              [OK]         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   2.91V              ≈ 85%                               │
│   Current voltage    Est. level                          │
│                                                          │
│   [7-day voltage trend mini-chart]                       │
│                                                          │
│   ──────────────────────────────────────────────────     │
│   Trend: -0.002 V/day       Est. ~8 months remaining     │
│   Based on current reporting rate (10 min interval)      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Messaging Guidelines

| Do Use | Do NOT Use |
|--------|------------|
| "Estimated" | "Exactly X days" |
| "Projected" | "X% remaining" (without "Est.") |
| "Based on current settings" | "Guaranteed to last" |
| "Approximately" | "Battery will die on" |

---

## Phase 5: File Changes

### Database Migration

Create migration to add voltage columns:
- `lora_sensors.battery_voltage`
- `lora_sensors.battery_voltage_filtered`
- `lora_sensors.battery_health_state`
- `sensor_readings.battery_voltage`

### Backend Files

| File | Change |
|------|--------|
| `supabase/functions/_shared/payloadNormalization.ts` | Extract and store raw voltage alongside percentage |
| `supabase/functions/ingest-readings/index.ts` | Store battery_voltage in readings |
| `supabase/functions/ttn-webhook/index.ts` | Pass voltage through to ingestion |

### Frontend Files

| File | Change |
|------|--------|
| `src/lib/devices/batteryProfiles.ts` | Add CR17450 voltage curve, hysteresis logic |
| `src/hooks/useBatteryEstimate.ts` | Switch to voltage-based estimation |
| `src/features/dashboard-layout/widgets/BatteryHealthWidget.tsx` | Show voltage, trend chart, state badge |
| `src/features/dashboard-layout/widgets/DeviceReadinessWidget.tsx` | Update to show "XX% (Est.)" and state badge |

---

## Phase 6: Technical Implementation

### 6.1 Voltage Curve Function

```typescript
interface VoltageToPercentCurve {
  chemistry: "CR17450" | "LiFeS2_AA" | "Alkaline_AA";
  minVoltage: number;
  maxVoltage: number;
  curve: Array<{ voltage: number; percent: number }>;
}

const CR17450_CURVE: VoltageToPercentCurve = {
  chemistry: "CR17450",
  minVoltage: 2.50,
  maxVoltage: 3.00,
  curve: [
    { voltage: 3.00, percent: 100 },
    { voltage: 2.95, percent: 80 },
    { voltage: 2.85, percent: 50 },
    { voltage: 2.75, percent: 20 },
    { voltage: 2.60, percent: 5 },
    { voltage: 2.50, percent: 0 },
  ],
};
```

### 6.2 Median Filter Function

```typescript
function medianFilter(readings: number[], windowSize = 5): number {
  const sorted = [...readings].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
```

### 6.3 Health State Determination

```typescript
function determineBatteryState(
  filteredVoltage: number,
  previousState: BatteryHealthState,
  recentReadings: number[]
): BatteryHealthState {
  const medianRecent = medianFilter(recentReadings.slice(-3));
  
  // Immediate downgrade for safety
  if (medianRecent < 2.50) return "REPLACE_ASAP";
  if (medianRecent < 2.60) return "CRITICAL";
  if (medianRecent < 2.75) return "LOW";
  if (medianRecent < 2.85) return "WARNING";
  
  // Hysteresis for upgrade (require 3 readings above threshold)
  if (previousState !== "OK" && medianRecent >= 2.85) {
    const allAbove = recentReadings.slice(-3).every(v => v >= 2.85);
    if (allAbove) return "OK";
    return previousState;
  }
  
  return "OK";
}
```

---

## Integration with Existing System

### Backward Compatibility

- Existing `battery_level` (integer %) remains the UI-facing value
- New `battery_voltage` is source of truth for calculations
- If sensor only reports percentage (no voltage), fall back to existing logic
- Gradual migration: new sensors use voltage, legacy sensors use percentage

### Battery Profile Enhancement

Update `battery_profiles` table to include:
- `chemistry` — CR17450, LiFeS2_AA, etc.
- `nominal_voltage` — 3.0V for CR17450
- `cutoff_voltage` — 2.5V service threshold

---

## Out of Scope (Future Enhancements)

- Temperature compensation for cold environments
- Load-adjusted estimation (airtime, SF impact)
- Multi-cell configurations (2S, 3S)
- Firmware-reported SOC calibration
