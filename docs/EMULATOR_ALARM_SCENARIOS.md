# FrostGuard Alarm Emulator Scenarios

Complete reference for every alarm scenario the emulator can run, organized by detection tier (T1–T5) and equipment type.

---

## How Scenarios Work

Each scenario defines a **sequence of decoded_payload** messages sent through the TTN SimulateUplink API. The payloads flow through the full production pipeline:

```
Emulator → TTN SimulateUplink → TTN Webhook → ttn-webhook edge function
  → normalize payload → insert sensor_reading → update unit
  → evaluate-alarms → alarm_events + alerts
```

**Temperature values in payloads are always °C** (sensor native). FrostGuard converts to °F internally.

### Key Conversions

| °F | °C | Context |
|----|-----|---------|
| 41 | 5.00 | Cooler critical high / FDA danger zone start |
| 40 | 4.44 | Cooler warning high |
| 33 | 0.56 | Cooler low normal boundary |
| 28 | -2.22 | Cooler warning low |
| 25 | -3.89 | Cooler critical low |
| 10 | -12.22 | Freezer critical high |
| 5 | -15.00 | Freezer warning high |
| -10 | -23.33 | Freezer normal high |
| -18 | -27.78 | Freezer normal low |
| -25 | -31.67 | Freezer warning low |
| -30 | -34.44 | Freezer critical low |
| 80 | 26.67 | Dry storage warning high |
| 90 | 32.22 | Dry storage critical high |
| 135 | 57.22 | Hot holding minimum |
| 120 | 48.89 | Hot holding warning low |

### Sensor Field Names

| Model | Manufacturer | Fields |
|-------|-------------|--------|
| LHT65N | Dragino | `TempC_SHT`, `Hum_SHT`, `BatV`, `Bat_status` |
| LDS02 | Dragino | `DOOR_OPEN_STATUS`, `DOOR_OPEN_TIMES`, `LAST_DOOR_OPEN_DURATION`, `BatV` |
| LDDS75 | Dragino | `distance_mm`, `BatV` |
| AM307 | Milesight | `temperature`, `humidity`, `co2`, `tvoc`, `battery` |
| EM300-TH | Milesight | `temperature`, `humidity`, `battery` |
| ERS | Elsys | `temperature`, `humidity`, `co2`, `vdd` |

---

## T1 — Threshold Breach Scenarios

Single-reading crosses a warning or critical boundary. The simplest alarm tier: one payload is enough to trigger.

### Walk-In Cooler

#### T1-COOLER-HIGH-WARN
- **Description**: Walk-in cooler temperature exceeds warning threshold (40°F / 4.44°C)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_excursion_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 60s | 3.33 (38°F) | 46.0 | 3.1 | Still normal, slight rise |
| 3 | 60s | 4.72 (40.5°F) | 48.0 | 3.1 | Crosses warning threshold |

#### T1-COOLER-HIGH-CRIT
- **Description**: Walk-in cooler temperature exceeds critical threshold (41°F / 5.0°C)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_excursion_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 60s | 4.44 (40°F) | 47.0 | 3.1 | At warning threshold |
| 3 | 60s | 5.56 (42°F) | 50.0 | 3.1 | Crosses critical threshold |
| 4 | 60s | 7.22 (45°F) | 55.0 | 3.1 | Well above critical |

#### T1-COOLER-LOW-WARN
- **Description**: Walk-in cooler temperature drops below warning low threshold (28°F / -2.22°C)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_low_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 60s | 0.00 (32°F) | 42.0 | 3.1 | Dropping |
| 3 | 60s | -2.78 (27°F) | 38.0 | 3.1 | Below warning low threshold |

#### T1-COOLER-LOW-CRIT
- **Description**: Walk-in cooler temperature drops below critical low threshold (25°F / -3.89°C)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_low_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 60s | -2.22 (28°F) | 40.0 | 3.1 | At warning low |
| 3 | 60s | -4.44 (24°F) | 35.0 | 3.1 | Below critical low |

### Walk-In Freezer

#### T1-FREEZER-HIGH-WARN
- **Description**: Walk-in freezer temperature exceeds warning threshold (5°F / -15.0°C)
- **Tier**: T1
- **Equipment**: walk_in_freezer
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_excursion_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | -23.33 (-10°F) | 30.0 | 3.0 | Normal freezer baseline |
| 2 | 60s | -17.78 (0°F) | 35.0 | 3.0 | Rising |
| 3 | 60s | -14.44 (6°F) | 40.0 | 3.0 | Above warning threshold |

#### T1-FREEZER-HIGH-CRIT
- **Description**: Walk-in freezer temperature exceeds critical threshold (10°F / -12.22°C)
- **Tier**: T1
- **Equipment**: walk_in_freezer
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_excursion_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | -23.33 (-10°F) | 30.0 | 3.0 | Normal freezer baseline |
| 2 | 60s | -15.00 (5°F) | 35.0 | 3.0 | At warning threshold |
| 3 | 60s | -11.67 (11°F) | 42.0 | 3.0 | Above critical threshold |
| 4 | 60s | -6.67 (20°F) | 50.0 | 3.0 | Severe excursion |

#### T1-FREEZER-LOW-WARN
- **Description**: Walk-in freezer temperature drops below warning low threshold (-25°F / -31.67°C)
- **Tier**: T1
- **Equipment**: walk_in_freezer
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_low_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | -23.33 (-10°F) | 30.0 | 3.0 | Normal freezer baseline |
| 2 | 60s | -28.89 (-20°F) | 25.0 | 3.0 | Getting cold |
| 3 | 60s | -32.22 (-26°F) | 22.0 | 3.0 | Below warning low |

#### T1-FREEZER-LOW-CRIT
- **Description**: Walk-in freezer temperature drops below critical low threshold (-30°F / -34.44°C)
- **Tier**: T1
- **Equipment**: walk_in_freezer
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_low_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | -23.33 (-10°F) | 30.0 | 3.0 | Normal freezer baseline |
| 2 | 60s | -31.67 (-25°F) | 22.0 | 3.0 | At warning low |
| 3 | 60s | -35.00 (-31°F) | 18.0 | 3.0 | Below critical low |

### Prep Table

#### T1-PREP-HIGH-CRIT
- **Description**: Prep table temperature exceeds critical threshold (41°F / 5.0°C)
- **Tier**: T1
- **Equipment**: prep_table
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_excursion_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 50.0 | 3.1 | Normal prep table |
| 2 | 60s | 4.44 (40°F) | 52.0 | 3.1 | Approaching threshold |
| 3 | 60s | 6.11 (43°F) | 55.0 | 3.1 | Above critical |

### Display Case

#### T1-DISPLAY-HIGH-CRIT
- **Description**: Display case temperature exceeds critical threshold (41°F / 5.0°C)
- **Tier**: T1
- **Equipment**: display_case
- **Sensor**: EM300-TH (f_port: 85)
- **Expected Alarm**: temp_excursion_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | temperature | humidity | battery | Description |
|------|-------|------------|---------|---------|-------------|
| 1 | 0s | 2.22 (36°F) | 50.0 | 95 | Normal baseline |
| 2 | 60s | 4.44 (40°F) | 52.0 | 95 | At threshold |
| 3 | 60s | 6.67 (44°F) | 58.0 | 95 | Above critical |

### Dry Storage

#### T1-DRY-HIGH-WARN
- **Description**: Dry storage temperature exceeds warning threshold (80°F / 26.67°C)
- **Tier**: T1
- **Equipment**: dry_storage
- **Sensor**: AM307 (f_port: 85)
- **Expected Alarm**: temp_excursion_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | temperature | humidity | co2 | battery | Description |
|------|-------|------------|---------|-----|---------|-------------|
| 1 | 0s | 23.33 (74°F) | 45.0 | 420 | 90 | Normal dry storage |
| 2 | 60s | 25.56 (78°F) | 48.0 | 430 | 90 | Rising |
| 3 | 60s | 27.22 (81°F) | 52.0 | 440 | 90 | Above warning |

#### T1-DRY-HIGH-CRIT
- **Description**: Dry storage temperature exceeds critical threshold (90°F / 32.22°C)
- **Tier**: T1
- **Equipment**: dry_storage
- **Sensor**: AM307 (f_port: 85)
- **Expected Alarm**: temp_excursion_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | temperature | humidity | co2 | battery | Description |
|------|-------|------------|---------|-----|---------|-------------|
| 1 | 0s | 23.33 (74°F) | 45.0 | 420 | 90 | Normal dry storage |
| 2 | 60s | 28.89 (84°F) | 50.0 | 440 | 90 | Above warning |
| 3 | 60s | 33.33 (92°F) | 55.0 | 460 | 90 | Above critical |

### Humidity

#### T1-HUMID-HIGH-WARN
- **Description**: Humidity exceeds warning threshold (70%)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: humidity_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 55.0 | 3.1 | Normal humidity |
| 2 | 60s | 2.22 | 65.0 | 3.1 | Rising humidity |
| 3 | 60s | 2.22 | 72.0 | 3.1 | Above warning |

#### T1-HUMID-HIGH-CRIT
- **Description**: Humidity exceeds critical threshold (80%)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: humidity_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 55.0 | 3.1 | Normal humidity |
| 2 | 60s | 2.22 | 75.0 | 3.1 | Above warning |
| 3 | 60s | 2.22 | 85.0 | 3.1 | Above critical |

#### T1-HUMID-LOW-WARN
- **Description**: Humidity drops below warning low threshold (20%)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: humidity_low_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal humidity |
| 2 | 60s | 2.22 | 28.0 | 3.1 | Dropping |
| 3 | 60s | 2.22 | 18.0 | 3.1 | Below warning low |

#### T1-HUMID-LOW-CRIT
- **Description**: Humidity drops below critical low threshold (15%)
- **Tier**: T1
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: humidity_low_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal humidity |
| 2 | 60s | 2.22 | 18.0 | 3.1 | Below warning low |
| 3 | 60s | 2.22 | 12.0 | 3.1 | Below critical low |

---

## T2 — Rate of Change Scenarios

Temperature rising or falling too fast over multiple readings. Requires a sequence that demonstrates the rate.

#### T2-COOLER-RAPID-RISE
- **Description**: Rapid temperature rise in cooler — simulates compressor failure (+5°F in 15 min)
- **Tier**: T2
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_rising_fast
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 300s (5min) | 2.78 (37°F) | 46.0 | 3.1 | Slight rise |
| 3 | 300s | 3.61 (38.5°F) | 48.0 | 3.1 | Accelerating |
| 4 | 300s | 4.72 (40.5°F) | 50.0 | 3.1 | Rapid rise continues |
| 5 | 300s | 5.56 (42°F) | 53.0 | 3.1 | +6°F in 20 min — alarm triggers |

#### T2-FREEZER-RAPID-RISE
- **Description**: Rapid temperature rise in freezer — simulates door left open
- **Tier**: T2
- **Equipment**: walk_in_freezer
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_rising_fast
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | -23.33 (-10°F) | 30.0 | 3.0 | Normal freezer |
| 2 | 300s | -21.11 (-6°F) | 35.0 | 3.0 | Rising 4°F |
| 3 | 300s | -18.33 (-1°F) | 40.0 | 3.0 | Rising fast |
| 4 | 300s | -15.00 (5°F) | 48.0 | 3.0 | +15°F in 15 min — alarm triggers |
| 5 | 300s | -11.67 (11°F) | 55.0 | 3.0 | Continuing to rise |

#### T2-COOLER-RAPID-DROP
- **Description**: Rapid temperature drop — sensor accidentally placed in freezer
- **Tier**: T2
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_dropping_fast
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal cooler |
| 2 | 300s | 0.00 (32°F) | 42.0 | 3.1 | Dropping |
| 3 | 300s | -3.33 (26°F) | 38.0 | 3.1 | Dropping fast |
| 4 | 300s | -7.78 (18°F) | 30.0 | 3.1 | -18°F in 15 min — alarm triggers |

#### T2-COOLER-GRADUAL-DRIFT
- **Description**: Gradual temperature drift that crosses threshold over 30 minutes
- **Tier**: T2
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_rising_slow
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 600s (10min) | 2.78 (37°F) | 46.0 | 3.1 | Slow rise |
| 3 | 600s | 3.33 (38°F) | 47.0 | 3.1 | Continuing |
| 4 | 600s | 3.89 (39°F) | 48.0 | 3.1 | Still rising |
| 5 | 600s | 4.44 (40°F) | 49.0 | 3.1 | At warning |
| 6 | 600s | 5.00 (41°F) | 50.0 | 3.1 | +5°F over 50 min — gradual drift |

---

## T3 — Duration / Persistence Scenarios

Condition sustained beyond a time threshold. Requires payloads spaced over the duration window.

#### T3-DOOR-OPEN-WARN
- **Description**: Door open for more than 5 minutes — warning threshold
- **Tier**: T3
- **Equipment**: walk_in_cooler
- **Sensor**: LDS02 (f_port: 2)
- **Expected Alarm**: door_open_warning
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | DOOR_OPEN_STATUS | DOOR_OPEN_TIMES | LAST_DOOR_OPEN_DURATION | BatV | Description |
|------|-------|-----------------|-----------------|------------------------|------|-------------|
| 1 | 0s | 0 (closed) | 5 | 0 | 3.0 | Door closed baseline |
| 2 | 10s | 1 (open) | 6 | 0 | 3.0 | Door opens |
| 3 | 180s (3min) | 1 (open) | 6 | 180 | 3.0 | Still open at 3 min |
| 4 | 180s (6min total) | 1 (open) | 6 | 360 | 3.0 | Open > 5 min — warning |

#### T3-DOOR-OPEN-CRIT
- **Description**: Door open for more than 10 minutes — critical threshold
- **Tier**: T3
- **Equipment**: walk_in_cooler
- **Sensor**: LDS02 (f_port: 2)
- **Expected Alarm**: door_open_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | DOOR_OPEN_STATUS | DOOR_OPEN_TIMES | LAST_DOOR_OPEN_DURATION | BatV | Description |
|------|-------|-----------------|-----------------|------------------------|------|-------------|
| 1 | 0s | 0 (closed) | 10 | 0 | 3.0 | Door closed baseline |
| 2 | 10s | 1 (open) | 11 | 0 | 3.0 | Door opens |
| 3 | 300s (5min) | 1 (open) | 11 | 300 | 3.0 | Still open — warning |
| 4 | 300s (10min total) | 1 (open) | 11 | 600 | 3.0 | Still open — critical |
| 5 | 120s (12min total) | 1 (open) | 11 | 720 | 3.0 | Confirmed critical |

#### T3-TEMP-SUSTAINED-15
- **Description**: Temperature above threshold sustained for 15 minutes
- **Tier**: T3
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_sustained_danger
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 5.56 (42°F) | 55.0 | 3.1 | Already above threshold |
| 2 | 300s (5min) | 6.11 (43°F) | 56.0 | 3.1 | Sustained at 5 min |
| 3 | 300s (10min) | 5.83 (42.5°F) | 55.0 | 3.1 | Sustained at 10 min |
| 4 | 300s (15min) | 6.39 (43.5°F) | 57.0 | 3.1 | Sustained 15 min — alarm |

#### T3-TEMP-SUSTAINED-30
- **Description**: Temperature above threshold sustained for 30 minutes
- **Tier**: T3
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: temp_sustained_danger
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 5.56 (42°F) | 55.0 | 3.1 | Above threshold |
| 2 | 600s (10min) | 6.67 (44°F) | 58.0 | 3.1 | Sustained 10 min |
| 3 | 600s (20min) | 7.22 (45°F) | 60.0 | 3.1 | Sustained 20 min |
| 4 | 600s (30min) | 7.78 (46°F) | 62.0 | 3.1 | Sustained 30 min — alarm |

#### T3-DOOR-FLAPPING
- **Description**: Intermittent door flapping — open/close/open rapidly
- **Tier**: T3
- **Equipment**: walk_in_cooler
- **Sensor**: LDS02 (f_port: 2)
- **Expected Alarm**: door_rapid_cycling
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | DOOR_OPEN_STATUS | DOOR_OPEN_TIMES | LAST_DOOR_OPEN_DURATION | BatV | Description |
|------|-------|-----------------|-----------------|------------------------|------|-------------|
| 1 | 0s | 0 (closed) | 10 | 0 | 3.0 | Baseline |
| 2 | 30s | 1 (open) | 11 | 0 | 3.0 | Open |
| 3 | 15s | 0 (closed) | 11 | 15 | 3.0 | Closed |
| 4 | 30s | 1 (open) | 12 | 0 | 3.0 | Open again |
| 5 | 15s | 0 (closed) | 12 | 15 | 3.0 | Closed again |
| 6 | 30s | 1 (open) | 13 | 0 | 3.0 | Open — 3 cycles in 2 min |

#### T3-HUMID-SUSTAINED
- **Description**: Humidity sustained above 80% for extended period
- **Tier**: T3
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: humidity_sustained_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 82.0 | 3.1 | Already above 80% |
| 2 | 600s (10min) | 2.22 | 83.0 | 3.1 | Sustained 10 min |
| 3 | 600s (20min) | 2.22 | 84.0 | 3.1 | Sustained 20 min |
| 4 | 600s (30min) | 2.22 | 85.0 | 3.1 | Sustained 30 min |
| 5 | 600s (40min) | 2.22 | 86.0 | 3.1 | Sustained 40 min |
| 6 | 1200s (60min total) | 2.22 | 87.0 | 3.1 | 1 hour sustained — alarm |

---

## T4 — Pattern / Correlation Scenarios

Multi-sensor or multi-reading pattern analysis. These scenarios involve data from multiple sensors or cross-referencing different data types.

#### T4-MULTI-SENSOR-DRIFT
- **Description**: Multiple sensors in same unit all drifting high — compressor dying
- **Tier**: T4
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N x2 (f_port: 2)
- **Expected Alarm**: site_wide_temp_rise
- **Expected Severity**: critical
- **Notes**: Requires 2+ sensors assigned to same unit or site. Send payloads to each sensor sequentially.
- **Payload Sequence (Sensor A)**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Sensor A baseline |
| 2 | 300s | 3.33 (38°F) | 48.0 | 3.1 | Sensor A rising |
| 3 | 300s | 4.44 (40°F) | 50.0 | 3.1 | Sensor A at warning |

- **Payload Sequence (Sensor B — interleaved)**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 60s after A.1 | 2.50 (36.5°F) | 46.0 | 3.0 | Sensor B baseline |
| 2 | 300s | 3.61 (38.5°F) | 49.0 | 3.0 | Sensor B also rising |
| 3 | 300s | 4.72 (40.5°F) | 51.0 | 3.0 | Both sensors drifting — pattern alarm |

#### T4-SINGLE-SENSOR-SPIKE
- **Description**: One sensor spiking while others remain normal — sensor fault vs real event
- **Tier**: T4
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N x2 (f_port: 2)
- **Expected Alarm**: isolated_unit_failure
- **Expected Severity**: warning
- **Notes**: One sensor shows alarm-level values while the other stays normal — indicates localized issue or sensor fault.
- **Payload Sequence (Sensor A — spiking)**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Sensor A baseline |
| 2 | 300s | 7.22 (45°F) | 60.0 | 3.1 | Sensor A spikes |
| 3 | 300s | 10.00 (50°F) | 65.0 | 3.1 | Sensor A severe spike |

- **Payload Sequence (Sensor B — stable)**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 60s after A.1 | 2.22 (36°F) | 45.0 | 3.0 | Sensor B normal |
| 2 | 300s | 2.33 (36.2°F) | 45.0 | 3.0 | Sensor B still normal |
| 3 | 300s | 2.28 (36.1°F) | 45.0 | 3.0 | Sensor B stable — only A is spiking |

#### T4-DOOR-TEMP-CORRELATION
- **Description**: Door open event correlates with temperature rise
- **Tier**: T4
- **Equipment**: walk_in_cooler
- **Sensor**: LDS02 + LHT65N (f_port: 2)
- **Expected Alarm**: door_open_temp_rising
- **Expected Severity**: warning
- **Notes**: Door sensor reports open, temperature sensor shows rise — expected correlation.
- **Payload Sequence (Door Sensor — LDS02)**:

| Step | Delay | DOOR_OPEN_STATUS | DOOR_OPEN_TIMES | LAST_DOOR_OPEN_DURATION | BatV | Description |
|------|-------|-----------------|-----------------|------------------------|------|-------------|
| 1 | 0s | 0 | 5 | 0 | 3.0 | Door closed |
| 2 | 60s | 1 | 6 | 0 | 3.0 | Door opens |

- **Payload Sequence (Temp Sensor — LHT65N, interleaved)**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 30s after door.1 | 2.22 (36°F) | 45.0 | 3.1 | Temp baseline |
| 2 | 120s after door.2 | 3.33 (38°F) | 50.0 | 3.1 | Temp rising after door open |
| 3 | 300s | 5.00 (41°F) | 55.0 | 3.1 | Temp crosses threshold — correlated with door |

#### T4-HUMID-TEMP-CORRELATION
- **Description**: Humidity spike correlates with temperature spike — gasket failure
- **Tier**: T4
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: gasket_leak_infer
- **Expected Severity**: warning
- **Notes**: Both temp and humidity rising together suggests warm moist air infiltrating — possible gasket leak.
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal baseline |
| 2 | 600s | 2.78 (37°F) | 52.0 | 3.1 | Both slightly rising |
| 3 | 600s | 3.33 (38°F) | 60.0 | 3.1 | Humidity rising faster |
| 4 | 600s | 3.89 (39°F) | 68.0 | 3.1 | Both continuing to climb |
| 5 | 600s | 4.44 (40°F) | 75.0 | 3.1 | Correlated drift — gasket alarm |

---

## T5 — System / Infrastructure Scenarios

Device health, connectivity, and sensor integrity. These test the monitoring of the sensors themselves rather than the environment they measure.

#### T5-BATTERY-LOW-WARN
- **Description**: Battery voltage drops below low-battery warning threshold (2.8V)
- **Tier**: T5
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: battery_low
- **Expected Severity**: warning
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal battery |
| 2 | 60s | 2.22 | 45.0 | 2.9 | Battery declining |
| 3 | 60s | 2.22 | 45.0 | 2.75 | Below 2.8V — low battery warning |

#### T5-BATTERY-LOW-CRIT
- **Description**: Battery voltage drops below critical threshold (2.5V)
- **Tier**: T5
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: battery_critical
- **Expected Severity**: critical
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal battery |
| 2 | 60s | 2.22 | 45.0 | 2.7 | Battery low |
| 3 | 60s | 2.22 | 45.0 | 2.4 | Below 2.5V — critical battery |

#### T5-OFFLINE-WARN
- **Description**: No uplink received for 15+ minutes — sensor offline warning
- **Tier**: T5
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: sensor_offline
- **Expected Severity**: warning
- **Notes**: This scenario sends a normal reading then STOPS sending. The alarm is triggered by the ABSENCE of data, detected by `process-unit-states` cron job. The emulator simulates this by sending one reading and then waiting.
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Last normal reading |
| 2 | — | — | — | — | No more uplinks — wait 15+ min for offline detection |

#### T5-OFFLINE-CRIT
- **Description**: No uplink received for 60+ minutes — sensor offline critical
- **Tier**: T5
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: sensor_offline_critical
- **Expected Severity**: critical
- **Notes**: Same as T5-OFFLINE-WARN but requires waiting 60+ minutes for the cron job to detect.
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Last normal reading |
| 2 | — | — | — | — | No more uplinks — wait 60+ min for offline detection |

#### T5-SIGNAL-POOR
- **Description**: RSSI below -120 dBm — poor signal quality
- **Tier**: T5
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: signal_poor
- **Expected Severity**: warning
- **Notes**: The RSSI value comes from `rx_metadata` in the TTN uplink, not the decoded_payload. The emulator must include rx_metadata in the simulated uplink.
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | rx_metadata.rssi | Description |
|------|-------|-----------|---------|------|-----------------|-------------|
| 1 | 0s | 2.22 | 45.0 | 3.1 | -80 | Normal signal |
| 2 | 60s | 2.22 | 45.0 | 3.1 | -105 | Degrading signal |
| 3 | 60s | 2.22 | 45.0 | 3.1 | -125 | Below -120 — poor signal alarm |

#### T5-IMPOSSIBLE-VALUE
- **Description**: Sensor reports physically impossible temperature (327.67°C / 621.8°F) — indicates sensor fault
- **Tier**: T5
- **Equipment**: walk_in_cooler
- **Sensor**: LHT65N (f_port: 2)
- **Expected Alarm**: reading_impossible
- **Expected Severity**: critical
- **Notes**: 327.67°C is the LHT65 error code when the probe is disconnected. FrostGuard should detect this as an impossible value.
- **Payload Sequence**:

| Step | Delay | TempC_SHT | Hum_SHT | BatV | Description |
|------|-------|-----------|---------|------|-------------|
| 1 | 0s | 2.22 (36°F) | 45.0 | 3.1 | Normal reading |
| 2 | 60s | 327.67 | 45.0 | 3.1 | Impossible value — probe disconnected |

---

## Scenario Summary

| Tier | Count | Description |
|------|-------|-------------|
| T1 | 16 | Threshold breach (8 temp + 4 humidity + 2 cooler low + 2 freezer low) |
| T2 | 4 | Rate of change (rapid rise, rapid drop, gradual drift) |
| T3 | 6 | Duration/persistence (door open, temp sustained, door flapping, humidity sustained) |
| T4 | 4 | Pattern/correlation (multi-sensor drift, single spike, door+temp, humidity+temp) |
| T5 | 6 | System/infrastructure (battery, offline, signal, impossible value) |
| **Total** | **36** | |

## Evaluator Implementation Status

Not all tiers are fully implemented in `evaluate-alarms`. Scenarios marked with evaluator gaps will still send correct payloads but may not trigger alarms until the evaluator is extended.

| Feature | Status |
|---------|--------|
| T1 temp thresholds | Working |
| T1 battery/signal | Working |
| T2 rate-of-change | Working (temp_rising_fast, temp_rising_slow) |
| T2 sustained danger | Working (temp_sustained_danger) |
| T3 door duration | Working (door_open_warning, door_stuck_open) |
| T3 door+temp correlation | Working (door_closed_temp_rising, door_open_temp_rising) |
| T4 site-wide | Working (site_wide_temp_rise, isolated_unit_failure) |
| T5 battery/signal | Working |
| T5 offline detection | Deferred to cron job |
| T5 impossible value | Working (reading_impossible) |

## Prerequisites

1. At least one unit of each equipment type must exist
2. At least one sensor (LHT65N, LDS02, etc.) must be registered and assigned to each unit
3. TTN connection must be configured with valid webhook secret
4. The `evaluate-alarms` edge function must be deployed
5. For T4 scenarios: multiple sensors must be assigned to the same unit or site
