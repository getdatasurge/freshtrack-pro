

# Fix Plan: Build Errors from Unapplied Database Migrations

## Problem Summary

The project has **21 build errors** caused by TypeScript code referencing database schema elements that don't exist yet in the auto-generated Supabase types file. The migrations exist in `supabase/migrations/` but haven't been applied to the live database.

## Root Cause

**Missing database objects** in `src/integrations/supabase/types.ts`:

| Missing Element | Used By | Migration File |
|----------------|---------|----------------|
| `sensor_catalog` table | `useSensorCatalog.ts` | `20260202060000_sensor_catalog.sql` |
| `sensor_catalog_public` view | `useSensorCatalog.ts` | `20260202060000_sensor_catalog.sql` |
| `decoder_confidence_rollup` view | `useDecoderConfidence.ts` | `20260203100001_decoder_confidence_views.sql` |
| `lora_sensors.sensor_catalog_id` column | `LoraSensor` type in `types/ttn.ts` | `20260203060000_add_sensor_catalog_fk.sql` |
| `lora_sensors.decode_mode_override` column | `LoraSensor` type in `types/ttn.ts` | `20260203100000_add_decode_mode.sql` |

The TypeScript types expect these to exist, but the database hasn't been updated yet. This creates a mismatch between code and schema.

---

## Solution Options

### Option A: Apply the Database Migrations (Recommended)

If you're ready to deploy the Sensor Catalog feature, apply the pending migrations using Lovable Cloud. This will:
1. Create the `sensor_catalog` table and `sensor_catalog_public` view
2. Add `sensor_catalog_id` and `decode_mode_override` to `lora_sensors`
3. Create the `decoder_confidence_rollup` view
4. Regenerate `types.ts` with all new schema elements

**Pros**: Code and database stay in sync; no workarounds needed
**Cons**: Requires deploying all pending migrations

---

### Option B: Make TypeScript Tolerant of Missing Schema (Temporary Fix)

If the migrations can't be applied yet, we can update the TypeScript code to be more defensive:

1. **Update `LoraSensor` interface** to make the new fields optional with `| undefined`
2. **Update hooks** to cast types through `unknown` to bypass PostgREST type inference
3. **Update `PlatformSensorLibrary.tsx`** to fix the incorrect function call signatures

This is a workaround that allows the build to succeed while the database migration is pending.

---

## Recommended Approach

Since the migrations already exist in the repository, **Option A is preferred**. The migrations need to be applied to the database so the types file can be regenerated.

### Action Required by User

If you're ready to apply the schema changes, they will be applied automatically when you publish/deploy through Lovable Cloud. The types file will regenerate to include:
- `sensor_catalog` table
- `sensor_catalog_public` view  
- `decoder_confidence_rollup` view
- New columns on `lora_sensors`

---

## If Migrations Cannot Be Applied Yet (Option B)

We'll make these code changes to fix the build:

### 1. Fix LoraSensor Type (src/types/ttn.ts)

Make the new fields explicitly optional in both `LoraSensor` and `LoraSensorInsert`:

```typescript
// Already has these, but the DB types don't match yet
sensor_catalog_id: string | null;
decode_mode_override: string | null;
```

### 2. Fix useLoraSensors.ts Type Casts

Change all `as LoraSensor` and `as LoraSensor[]` to cast through `unknown`:

```typescript
// Before
return data as LoraSensor[];

// After  
return data as unknown as LoraSensor[];
```

### 3. Fix useSensorCatalog.ts Supabase Queries

Cast the table names to bypass type checking until migrations run:

```typescript
// Before
.from("sensor_catalog")

// After
.from("sensor_catalog" as any)
```

### 4. Fix useDecoderConfidence.ts

Same pattern:

```typescript
.from("decoder_confidence_rollup" as any)
```

### 5. Fix PlatformSensorLibrary.tsx Function Calls

Lines 1405, 1423, 1437 have incorrect argument types. The `logSuperAdminAction` function expects a string, but objects are being passed:

```typescript
// Before (line 1405)
logSuperAdminAction("ADDED_SENSOR_TO_CATALOG", { model: entry.model, manufacturer: entry.manufacturer });

// After
logSuperAdminAction("ADDED_SENSOR_TO_CATALOG", JSON.stringify({ model: entry.model, manufacturer: entry.manufacturer }));
```

Or update the function signature if it should accept objects.

---

## Summary

| File | Error Count | Fix |
|------|-------------|-----|
| `useLoraSensors.ts` | 8 errors | Cast through `unknown` |
| `useSensorCatalog.ts` | 8 errors | Use `as any` for table names |
| `useDecoderConfidence.ts` | 3 errors | Use `as any` for view name |
| `useSetPrimarySensor.ts` | 1 error | Cast through `unknown` |
| `PlatformSensorLibrary.tsx` | 3 errors | Fix function call arguments |

**Total: 23 errors → 0 errors**

---

## My Recommendation

**Apply the migrations first.** This is the cleanest path:
1. The migrations are already in the repo
2. They're designed to be non-breaking (additive changes)
3. The types file will regenerate automatically
4. No workaround code needed

If you confirm the migrations should be applied, I can help verify they're ready. If you want the temporary workaround instead, I'll implement Option B.

