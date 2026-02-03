

## Fix: Apply Database Migration for sensor_catalog

### Problem

The Sensor Library page shows 404 errors because the `sensor_catalog` table doesn't exist in the database yet. The migration file `20260202060000_sensor_catalog.sql` is in the codebase, but it hasn't been applied to the live database.

**Evidence:**
- Database query for `sensor_catalog` returns empty (table doesn't exist)
- Network requests to `/rest/v1/sensor_catalog` return 404
- Toast shows "Save failed - Could not update. Ensure migrations are applied."

---

### Solution

Apply the pending database migration to create the `sensor_catalog` table. This migration will:

1. Create the `sensor_catalog` table with all required columns
2. Set up indexes for search and lookups
3. Configure RLS policies (super admins: full access, authenticated users: read-only on visible entries)
4. Create the `sensor_catalog_public` view for org-level users
5. Seed initial sensor data (Dragino LHT65, LDS02, Elsys ERS CO2, etc.)

---

### Technical Details

**Migration to apply:** `20260202060000_sensor_catalog.sql`

**What it creates:**
- Table: `sensor_catalog` (415 lines of SQL)
  - 40+ columns for sensor metadata, decoder info, battery info, sample payloads
  - Full-text search index
  - Unique constraint on manufacturer/model/variant
  - Auto-increment revision trigger
- View: `sensor_catalog_public` (read-only subset for org users)
- RLS Policies:
  - Super admins can read/insert/update/delete all entries
  - Authenticated users can read visible, non-deprecated entries only
- Seed data: 4-5 pre-configured sensor models

**Additional migrations to apply:**
After `sensor_catalog` is created, these related migrations should also be applied:
- `20260203060000_add_sensor_catalog_fk.sql` - Adds `sensor_catalog_id` FK to `lora_sensors`
- `20260203070000_backfill_catalog_id_and_sync_trigger.sql` - Syncs existing sensors
- `20260203100001_decoder_confidence_views.sql` - Creates decoder confidence rollup view

---

### Action Required

I'll use the database migration tool to apply the `sensor_catalog` table schema. Once applied:
1. The Sensor Library page will load correctly
2. Saves/updates will work (no more 404s)
3. The auto-generated `src/integrations/supabase/types.ts` will include the new table
4. The TypeScript workarounds (using `as any`) can be removed

