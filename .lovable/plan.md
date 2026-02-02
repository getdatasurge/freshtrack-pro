
# Fix Plan: Sensor Settings Gear Icon Feature

## Problem Summary

The sensor settings feature is broken due to **missing database tables**. The migrations exist in the codebase but were never applied to the live database.

## Root Cause

| Component | Status | Issue |
|-----------|--------|-------|
| Database tables | Missing | `sensor_configurations` and `sensor_pending_changes` tables don't exist |
| TypeScript types | Stale | Auto-generated types don't include the missing tables |
| useSensorConfig hook | Breaking | TypeScript rejects non-existent table names |
| SensorSettingsDrawer | Complete | 945-line implementation ready to use |
| ttn-send-downlink edge function | Deployed | Will work once tables exist |
| UnitSensorsCard | Complete | Gear icon code exists but drawer won't open due to hook errors |

## Fix Steps

### Step 1: Create Database Tables

Run the first migration to create the tables, enums, RLS policies, and triggers:

```sql
-- sensor_change_status enum
CREATE TYPE sensor_change_status AS ENUM ('queued', 'sent', 'applied', 'failed', 'timeout');

-- sensor_change_type enum  
CREATE TYPE sensor_change_type AS ENUM ('uplink_interval', 'ext_mode', 'time_sync', 'set_time', 'alarm', 'clear_datalog', 'pnackmd', 'raw');

-- sensor_configurations table
CREATE TABLE sensor_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES lora_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uplink_interval_s INTEGER,
  ext_mode TEXT CHECK (ext_mode IN ('e3_ext1', 'e3_ext9')),
  time_sync_enabled BOOLEAN DEFAULT false,
  time_sync_days INTEGER CHECK (time_sync_days >= 0 AND time_sync_days <= 255),
  override_unit_alarm BOOLEAN DEFAULT false,
  alarm_enabled BOOLEAN DEFAULT false,
  alarm_low NUMERIC(6,2),
  alarm_high NUMERIC(6,2),
  alarm_check_minutes INTEGER CHECK (alarm_check_minutes >= 1 AND alarm_check_minutes <= 65535),
  default_fport INTEGER DEFAULT 2 CHECK (default_fport >= 1 AND default_fport <= 223),
  last_applied_at TIMESTAMPTZ,
  pending_change_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (sensor_id)
);

-- sensor_pending_changes table
CREATE TABLE sensor_pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES lora_sensors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  change_type sensor_change_type NOT NULL,
  requested_payload_hex TEXT NOT NULL,
  requested_fport INTEGER DEFAULT 2 CHECK (requested_fport >= 1 AND requested_fport <= 223),
  status sensor_change_status DEFAULT 'queued' NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sent_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  command_params JSONB,
  expected_result TEXT,
  debug_response JSONB,
  requested_by UUID REFERENCES auth.users(id),
  requested_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS policies and indexes (included in full migration)
```

### Step 2: Add RLS Policies

Enable Row Level Security on both tables with policies allowing organization members to manage their own sensor configurations.

### Step 3: Add Foreign Key and Indexes

- Add FK from `sensor_configurations.pending_change_id` to `sensor_pending_changes.id`
- Create indexes for efficient querying

### Step 4: Verify Auto-Generated Types

After migration, the TypeScript types will auto-regenerate to include:
- `Database['public']['Tables']['sensor_configurations']`
- `Database['public']['Tables']['sensor_pending_changes']`

This will resolve all 11 TypeScript errors in `useSensorConfig.ts`.

---

## Technical Details

### Why the Build is Broken

The Supabase client uses TypeScript generics to validate table names:

```typescript
// This fails because "sensor_configurations" isn't in the types
supabase.from("sensor_configurations")  // Error: 'sensor_configurations' is not assignable to type 'never'
```

Once the tables exist and types regenerate, the same code will work.

### Files That Will Start Working

1. **useSensorConfig.ts** - All hooks will function
2. **SensorSettingsDrawer.tsx** - Will open and load data
3. **UnitSensorsCard.tsx** - Gear icon will work, pending counts will show
4. **ttn-send-downlink edge function** - Already deployed, will save pending changes

---

## Verification Steps

After applying the migration:

1. Confirm tables exist: `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'sensor%'`
2. Verify build passes (no TypeScript errors)
3. Navigate to a unit page with sensors
4. Confirm gear icon appears on each sensor row
5. Click gear icon - drawer should open
6. Test a simple downlink command (e.g., change uplink interval)
