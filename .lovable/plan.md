

# Fix 15 TypeScript Errors in process-unit-states

## Root Cause

The unit loop casts units to `Record<string, unknown>`, making `u.id` type `unknown`. Functions like `isAlertSuppressed` and `correlateAlert` expect `string`. Two `else if` branches also access properties on possibly-null variables.

## Changes (1 file)

**File:** `supabase/functions/process-unit-states/index.ts`

### 1. Add typed unit ID at line 318

After `const currentStatus = u.status as UnitStatus;`, add:
```typescript
const unitId = u.id as string;
```

### 2. Replace `u.id` with `unitId` in 11 function calls

Lines 461, 490, 559, 582, 666, 698, 787, 880, 939, 1016, 1038 -- only where `u.id` is passed as a function argument to `isAlertSuppressed` or `correlateAlert`.

### 3. Add null guards on 2 else-if branches

**Line 688:**
```typescript
// Before:
} else if (existingDoorAlert.severity !== "critical") {
// After:
} else if (existingDoorAlert && existingDoorAlert.severity !== "critical") {
```

**Line 1041:**
```typescript
// Before:
} else if (existingAlert.severity !== alertSeverity) {
// After:
} else if (existingAlert && existingAlert.severity !== alertSeverity) {
```

### 4. Redeploy

Deploy `process-unit-states` after the fix.

## TTN Webhook Status

The webhook is healthy -- processing uplinks from 3 devices. Two devices (`sensor-c441725e8aa5f523`, `sensor-8059a496ab11ecfe`) have "Missing dev_eui" warnings which is a separate data issue (not related to this fix).

