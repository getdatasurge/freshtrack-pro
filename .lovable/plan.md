

# Run Alarm Library Migration and Verify

## What needs to happen

The code (route, sidebar nav, hooks, types, query keys, page component) is already fully committed. The only missing piece is applying the database migration that creates the tables and seeds the 86 alarm definitions.

## Step 1: Run the migration

Execute `supabase/migrations/20260220100000_alarm_definition_library.sql` against the database. This migration:

- Extends the `sensor_kind` enum with `co2`, `leak`, `tvoc`
- Creates 6 new enums: `alarm_category`, `alarm_subcategory`, `alarm_severity`, `detection_tier`, `alarm_unit_type`, `alarm_sensor_type`
- Creates 5 tables: `alarm_definitions`, `alarm_org_overrides`, `alarm_site_overrides`, `alarm_unit_overrides`, `alarm_events`
- Creates indexes, triggers, and 3 functions (`get_effective_alarm_config`, `resolve_available_tiers`, `get_available_alarms_for_unit`)
- Seeds 86 alarm definitions across all categories and tiers
- Purely additive -- no existing tables are modified

## Step 2: Verify seed data

Run these validation queries:
- `SELECT count(*) FROM alarm_definitions;` -- expect 86
- `SELECT detection_tier, count(*) FROM alarm_definitions GROUP BY detection_tier ORDER BY detection_tier;`
- `SELECT category, count(*) FROM alarm_definitions GROUP BY category ORDER BY category;`

## Step 3: Verify the admin UI

Navigate to `/platform/alarm-library` and confirm:
- Library tab loads all 86 definitions from the database
- Search, category/tier/severity filters work correctly
- Expanding a row shows observe/infer, thresholds, corrective actions, AI hints
- Unit Simulator tab: toggling sensors activates/locks tiers and filters available alarms
- AI Engine tab renders the capabilities list and pipeline steps

## Step 4: Test the RPC

Call `get_available_alarms_for_unit` with a test unit ID to verify it returns only alarms matching the unit's sensor tiers.

## Technical Details

- No RLS policies needed on `alarm_definitions` for now since it's queried by the Super Admin platform page (already behind `PlatformGuard`)
- The hooks in `useAlarmLibrary.ts` query `alarm_definitions` directly using the Supabase client
- The `resolve_available_tiers` function references `lora_sensors.org_id` and `lora_sensors.sensor_kind` columns -- these must exist in the schema for the RPC to work

