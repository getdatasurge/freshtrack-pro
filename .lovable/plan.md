
# Battery Life Estimation Widget — Production-Grade Implementation

## Overview

Transform the Battery Health widget from a simple SOC-decline model into a production-grade LoRaWAN battery life estimator that incorporates:
- Sensor model battery profiles (capacity, mAh/uplink, sleep current)
- Observed uplink frequency analysis
- Confidence scoring with explicit data thresholds
- Clear user messaging for each widget state

---

## Phase 1: Database Schema

### 1.1 Create `battery_profiles` Table

A lookup table storing battery specifications per sensor model.

```text
┌─────────────────────────────────────────────────────────────────┐
│ battery_profiles                                                │
├─────────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                          │
│ model                 TEXT NOT NULL UNIQUE                      │
│ manufacturer          TEXT                                      │
│ battery_type          TEXT           (e.g., "2×AA Lithium")     │
│ nominal_capacity_mah  INTEGER        (e.g., 3600)               │
│ mah_per_uplink        NUMERIC(6,4)   (e.g., 0.025)              │
│ sleep_current_ua      INTEGER        (µA, e.g., 5)              │
│ usable_capacity_pct   INTEGER        (default 85, for cold env) │
│ replacement_threshold INTEGER        (default 10, % SOC)        │
│ notes                 TEXT                                      │
│ created_at            TIMESTAMPTZ DEFAULT NOW()                 │
│ updated_at            TIMESTAMPTZ DEFAULT NOW()                 │
└─────────────────────────────────────────────────────────────────┘
```

**Seed data for common models:**

| Model | Battery Type | Capacity | mAh/uplink | Sleep µA |
|-------|--------------|----------|------------|----------|
| LDS02 | 2×AAA | 1000 | 0.02 | 3 |
| EM300-TH | 2×AA Lithium | 3600 | 0.025 | 5 |
| ERS | CR2032 | 230 | 0.015 | 2 |
| LDDS75 | 2×AA Lithium | 3600 | 0.03 | 5 |

---

## Phase 2: Enhanced Estimation Logic

### 2.1 New Hook: `useBatteryEstimate`

Replace/extend `useBatteryForecast` with physics-based estimation.

**Input Data:**
1. Sensor model → lookup battery profile
2. Configured uplink interval (from `sensor_configurations.uplink_interval_s`)
3. Inferred uplink interval (median delta from recent readings)
4. Current SOC (latest `battery_level` %)
5. Uplink history (count + time span)

**Core Estimation Formula:**

```text
Uplinks per day = 86,400 / effective_interval_seconds

Daily sleep consumption (mAh) = (sleep_current_ua × 24) / 1000

Daily uplink consumption (mAh) = uplinks_per_day × mah_per_uplink

Total daily consumption = sleep + uplink

Usable capacity = nominal_capacity × (usable_capacity_pct / 100)

Remaining capacity = usable_capacity × (current_soc / 100)

Days remaining = remaining_capacity / total_daily_consumption

Replacement date = today + days_remaining
```

### 2.2 Uplink Interval Inference

When configured interval is not set:
1. Query last 50 readings for the sensor
2. Calculate time deltas between consecutive uplinks
3. Use **median** delta (ignores outliers/gaps)
4. Cap at 24h max to avoid skew from prolonged offline periods

### 2.3 Confidence Scoring

| Confidence Level | Criteria |
|------------------|----------|
| **None** | < 12 uplinks OR < 6h of data |
| **Low** | 12–50 uplinks OR 6–24h of data |
| **High** | ≥ 50 uplinks AND ≥ 48h of consistent data |

---

## Phase 3: Widget State Machine

### 3.1 Widget States (6 total)

```text
┌──────────────────────────────────────────────────────────────┐
│ State                    │ Condition                         │
├──────────────────────────┼───────────────────────────────────┤
│ NOT_CONFIGURED           │ No sensor assigned                │
│ MISSING_PROFILE          │ Sensor model has no battery spec  │
│ COLLECTING_DATA          │ < 12 uplinks OR < 6h span         │
│ SENSOR_OFFLINE           │ No uplink in 3× expected interval │
│ ESTIMATE_LOW_CONFIDENCE  │ 12–50 uplinks, 6–24h span         │
│ ESTIMATE_HIGH_CONFIDENCE │ ≥ 50 uplinks, ≥ 48h span          │
│ CRITICAL_BATTERY         │ SOC ≤ 10%                         │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 User-Facing Copy for Each State

| State | Display |
|-------|---------|
| `NOT_CONFIGURED` | "No sensor assigned" + action button |
| `MISSING_PROFILE` | "Battery estimate unavailable — battery profile not configured for this sensor model." |
| `COLLECTING_DATA` | "Collecting data to estimate battery life (requires 6 hours of readings)." with progress indicator |
| `SENSOR_OFFLINE` | "Sensor offline — battery estimate unavailable." |
| `ESTIMATE_LOW_CONFIDENCE` | Shows estimate with "~" prefix and "Low confidence" badge |
| `ESTIMATE_HIGH_CONFIDENCE` | Shows estimate with green checkmark |
| `CRITICAL_BATTERY` | Red banner: "Critical — Replace Battery Now" + estimated days if calculable |

---

## Phase 4: File Changes

### Database Migration

Create `battery_profiles` table with seed data for known sensor models.

### Frontend Files

| File | Change |
|------|--------|
| `src/lib/devices/types.ts` | Add `BatteryProfile` interface |
| `src/lib/devices/batteryProfiles.ts` | New file: constants + utility functions |
| `src/hooks/useBatteryEstimate.ts` | New hook replacing `useBatteryForecast` |
| `src/features/dashboard-layout/widgets/BatteryHealthWidget.tsx` | Refactor to use new hook + state machine |

### Hook Interface

```text
interface BatteryEstimateResult {
  // Current state
  state: BatteryWidgetState;
  currentSoc: number | null;
  
  // Estimate (if available)
  estimatedDaysRemaining: number | null;
  estimatedReplacementDate: Date | null;
  confidence: 'none' | 'low' | 'high';
  
  // Profile info
  batteryProfile: BatteryProfile | null;
  profileSource: 'database' | 'fallback' | 'none';
  
  // Uplink analysis
  inferredIntervalSeconds: number | null;
  configuredIntervalSeconds: number | null;
  uplinkCount: number;
  dataSpanHours: number;
  
  // Loading state
  loading: boolean;
  error: string | null;
}
```

---

## Phase 5: Widget UI Redesign

### Layout Structure

```text
┌──────────────────────────────────────────────────────────────┐
│ 🔋 Battery Health                          [Confidence Badge] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ████████████░░░░░░░░  68%    Est. ~4 months remaining      │
│                                                              │
│   [Mini trend chart - last 30 days]                          │
│                                                              │
│   ──────────────────────────────────────────────────────     │
│   Profile: EM300-TH (3600 mAh)   Interval: 10 min            │
│   Daily usage: ~2.4 mAh          Replace by: Jun 2026        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Critical Battery State

```text
┌──────────────────────────────────────────────────────────────┐
│ 🔋 Battery Health                                    ⚠ CRITICAL │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   🔴 Replace Battery Now                                     │
│                                                              │
│   Battery level at 8%                                        │
│   Estimated ~3 days remaining                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Sequence

1. **Migration**: Create `battery_profiles` table + seed data
2. **Types**: Add `BatteryProfile` interface to device types
3. **Hook**: Implement `useBatteryEstimate` with physics-based calculation
4. **Widget**: Refactor `BatteryHealthWidget` to use new hook + states
5. **Testing**: Add unit tests for estimation logic

---

## Technical Notes

### Gating Logic (Pseudocode)

```text
if (!sensorId) return NOT_CONFIGURED
if (isOffline) return SENSOR_OFFLINE
if (!batteryProfile) return MISSING_PROFILE
if (uplinkCount < 12 || dataSpanHours < 6) return COLLECTING_DATA
if (currentSoc <= 10) return CRITICAL_BATTERY
if (uplinkCount < 50 || dataSpanHours < 48) return ESTIMATE_LOW_CONFIDENCE
return ESTIMATE_HIGH_CONFIDENCE
```

### Offline Detection

Sensor is offline if `now - last_seen_at > 3 × expected_interval`

Where `expected_interval` = configured interval OR inferred interval OR 15 min default.

### Fallback Logic

When battery profile doesn't exist for a model:
1. First try: Match by manufacturer (use similar model's profile)
2. Second try: Use conservative generic profile (2×AA, 3000 mAh)
3. Final: Show `MISSING_PROFILE` state

---

## Out of Scope (Future Enhancements)

- Temperature compensation for cold environments
- Historical accuracy tracking (predicted vs actual replacements)
- Maintenance task integration (auto-create replacement tasks)
- Multi-battery support (external power sources)
