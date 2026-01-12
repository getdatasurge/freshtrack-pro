# Common Development Tasks

> Step-by-step guides for everyday development work

---

## Table of Contents

1. [Adding a New Page](#adding-a-new-page)
2. [Adding a New Component](#adding-a-new-component)
3. [Fetching Data from Supabase](#fetching-data-from-supabase)
4. [Adding a New Edge Function](#adding-a-new-edge-function)
5. [Creating a Database Migration](#creating-a-database-migration)
6. [Adding a New Alert Type](#adding-a-new-alert-type)
7. [Modifying the TTN Integration](#modifying-the-ttn-integration)
8. [Working with the Settings Wizard](#working-with-the-settings-wizard)
9. [Adding Role-Based Access](#adding-role-based-access)
10. [Testing Your Changes](#testing-your-changes)

---

## Adding a New Page

### Step 1: Create the Page Component

Create a new file in `/src/pages/`:

```typescript
// src/pages/MyNewPage.tsx
import { useNavigate } from "react-router-dom";

const MyNewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">My New Page</h1>
      <p>Page content goes here.</p>
    </div>
  );
};

export default MyNewPage;
```

### Step 2: Add the Route

Edit `/src/App.tsx` to add the route:

```typescript
// Import your page
import MyNewPage from "@/pages/MyNewPage";

// Add to the Routes (inside the <Routes> component)
<Route path="/my-new-page" element={<MyNewPage />} />
```

### Step 3: Add Navigation (Optional)

If the page should appear in navigation, update the appropriate navigation component:

```typescript
// In the navigation component
<Link to="/my-new-page">My New Page</Link>
```

### Protected Routes

To require authentication, wrap the page in a protected route check:

```typescript
// In App.tsx, use the auth check pattern
<Route
  path="/my-new-page"
  element={
    <ProtectedRoute>
      <MyNewPage />
    </ProtectedRoute>
  }
/>
```

---

## Adding a New Component

### Step 1: Choose the Right Location

```
src/components/
├── ui/              # Base UI components (shadcn) - DON'T ADD HERE
├── dashboard/       # Dashboard-related components
├── settings/        # Settings page components
├── unit/            # Unit detail components
├── alerts/          # Alert-related components
└── [feature]/       # Create a new folder for new features
```

### Step 2: Create the Component

```typescript
// src/components/dashboard/MyWidget.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MyWidgetProps {
  title: string;
  data: SomeDataType;
}

export function MyWidget({ title, data }: MyWidgetProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Widget content */}
      </CardContent>
    </Card>
  );
}
```

### Step 3: Use shadcn/ui Components

Always use existing shadcn/ui components from `/src/components/ui/`:

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
```

**Adding a new shadcn component:**

```bash
npx shadcn-ui@latest add [component-name]
```

---

## Fetching Data from Supabase

### Pattern 1: Using TanStack Query (Recommended)

Create a custom hook in `/src/hooks/`:

```typescript
// src/hooks/useMyData.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyData(organizationId: string) {
  return useQuery({
    queryKey: ["my-data", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("my_table")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateMyData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newData: MyDataInsert) => {
      const { data, error } = await supabase
        .from("my_table")
        .insert(newData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-data"] });
    },
  });
}
```

### Pattern 2: Using in Components

```typescript
// In your component
import { useMyData, useCreateMyData } from "@/hooks/useMyData";

function MyComponent() {
  const { data, isLoading, error } = useMyData(organizationId);
  const createMutation = useCreateMyData();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;

  const handleCreate = async () => {
    await createMutation.mutateAsync({ name: "New Item" });
  };

  return (
    <div>
      {data.map(item => <ItemRow key={item.id} item={item} />)}
      <Button onClick={handleCreate}>Add New</Button>
    </div>
  );
}
```

### Query Key Conventions

Follow these patterns for consistent cache invalidation:

```typescript
// Entity lists
["units", organizationId]
["alerts", { organizationId, status: "active" }]
["sensors", { unitId }]

// Single entities
["unit", unitId]
["alert", alertId]

// Related data
["unit-sensors", unitId]
["unit-readings", unitId, { period: "24h" }]
```

---

## Adding a New Edge Function

### Step 1: Create the Function Directory

```bash
mkdir supabase/functions/my-new-function
touch supabase/functions/my-new-function/index.ts
```

### Step 2: Write the Function

```typescript
// supabase/functions/my-new-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with auth context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();

    // Your business logic here
    const result = await processData(body, supabaseClient);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### Step 3: Call from Frontend

```typescript
// In a hook or component
const { data, error } = await supabase.functions.invoke("my-new-function", {
  body: { key: "value" },
});
```

### Step 4: Deploy

```bash
# Deploy to Supabase
supabase functions deploy my-new-function
```

---

## Creating a Database Migration

### Step 1: Create Migration File

```bash
supabase migration new add_my_table
# Creates: supabase/migrations/YYYYMMDDHHMMSS_add_my_table.sql
```

### Step 2: Write the SQL

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_my_table.sql

-- Create the table
CREATE TABLE public.my_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org's data"
    ON public.my_table
    FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert their org's data"
    ON public.my_table
    FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- Create updated_at trigger
CREATE TRIGGER update_my_table_updated_at
    BEFORE UPDATE ON public.my_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Step 3: Apply Migration

```bash
# Locally
supabase db reset

# Remote (careful!)
supabase db push
```

### Step 4: Regenerate Types

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## Adding a New Alert Type

Alerts are managed by the `process-unit-states` edge function. Here's how to add a new alert type:

### Step 1: Add to Alert Config (Frontend)

Edit `/src/lib/alertConfig.ts`:

```typescript
export const ALERT_TYPES = {
  // ... existing types
  my_new_alert: {
    label: "My New Alert",
    icon: AlertCircle,
    color: "warning", // or "critical"
    description: "Description of when this triggers",
    clearCondition: "When the condition is resolved",
  },
} as const;
```

### Step 2: Add Detection Logic (Backend)

Edit `/supabase/functions/process-unit-states/index.ts`:

```typescript
// In the alert evaluation section
function evaluateAlerts(unit: Unit, reading: Reading, rules: AlertRules) {
  const alerts: Alert[] = [];

  // ... existing alert checks

  // Add your new alert check
  if (shouldTriggerMyNewAlert(unit, reading, rules)) {
    alerts.push({
      type: "my_new_alert",
      severity: "warning",
      unit_id: unit.id,
      message: `My new alert triggered for ${unit.name}`,
    });
  }

  return alerts;
}
```

### Step 3: Add Database Support

Create a migration if needed to support new alert metadata.

---

## Modifying the TTN Integration

TTN (The Things Network) integration has several components:

### Webhook Handler

`/supabase/functions/ttn-webhook/index.ts` — Receives uplink messages from TTN.

To modify how sensor data is processed:

```typescript
// In ttn-webhook/index.ts
async function processUplink(payload: TTNUplink) {
  // Normalize the DevEUI
  const devEUI = normalizeDevEUI(payload.end_device_ids.dev_eui);

  // Find the sensor
  const sensor = await findSensorByDevEUI(devEUI);

  // Extract and transform readings
  const reading = extractReading(payload);

  // Save to database
  await saveReading(sensor.id, reading);
}
```

### Device Provisioning

`/supabase/functions/ttn-provision-device/index.ts` — Registers devices with TTN.

### TTN Configuration

`/src/components/settings/TTNConnectionSettings.tsx` — UI for configuring TTN credentials.

### Key Files for TTN Work

| File | Purpose |
|------|---------|
| `/supabase/functions/_shared/ttnConfig.ts` | DevEUI normalization, TTN helpers |
| `/supabase/functions/_shared/ttnPermissions.ts` | API key permission validation |
| `/src/types/ttn.ts` | TypeScript types for TTN entities |
| `/src/hooks/useTTNSetupWizard.ts` | TTN onboarding flow logic |

---

## Working with the Settings Wizard

The settings wizard is in `/src/components/settings/`. The main orchestration happens in:

### Wizard Structure

```
settings/
├── SettingsTabs.tsx           # Main tab container
├── TTNConnectionSettings.tsx   # TTN configuration
├── SensorManager.tsx           # Sensor CRUD
├── GatewayManager.tsx          # Gateway CRUD
├── AlertRulesEditor.tsx        # Alert thresholds
└── NotificationPolicyEditor.tsx # Notification settings
```

### Adding a New Settings Section

1. Create your component:

```typescript
// src/components/settings/MyNewSettings.tsx
export function MyNewSettings({ organizationId }: Props) {
  // Your settings UI
}
```

2. Add to the tabs:

```typescript
// In SettingsTabs.tsx
<TabsContent value="my-new">
  <MyNewSettings organizationId={organizationId} />
</TabsContent>
```

### Cascading Settings Pattern

Settings cascade: Organization → Site → Unit. Use the `get_effective_*` RPCs:

```typescript
// Get effective settings for a unit (includes org/site defaults)
const { data } = await supabase.rpc("get_effective_alert_rules", {
  p_unit_id: unitId,
});
```

---

## Adding Role-Based Access

### Check User Role

Use the `useUserRole` hook:

```typescript
import { useUserRole } from "@/hooks/useUserRole";

function MyComponent() {
  const { role, isAdmin, isOwner, isLoading } = useUserRole();

  if (isLoading) return <Spinner />;

  return (
    <div>
      {isAdmin && <AdminOnlyFeature />}
      {role === "staff" && <StaffView />}
    </div>
  );
}
```

### Role Hierarchy

| Role | Can Do |
|------|--------|
| `owner` | Everything, including billing and user management |
| `admin` | All operations except billing |
| `manager` | View and manage assigned locations |
| `staff` | Log temperatures, acknowledge alerts |

### Backend Role Checks

In edge functions, check roles via the profiles table:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .single();

if (!["owner", "admin"].includes(profile.role)) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
}
```

---

## Testing Your Changes

### Frontend Testing

```bash
# Run Vitest
npm run test

# Watch mode
npm run test -- --watch
```

### Manual Testing Checklist

Before pushing, verify:

- [ ] No console errors in browser
- [ ] No TypeScript errors (`npm run lint`)
- [ ] Feature works as expected
- [ ] Mobile responsive (check at 375px width)
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Works with empty data

### Testing Edge Functions

```bash
# Start function server
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Testing Database Changes

```bash
# Reset local database (applies all migrations)
supabase db reset

# Check RLS policies work
# 1. Sign in as a user
# 2. Try to access data from another org
# 3. Should get no results (not an error)
```

---

## Quick Reference

### Import Aliases

```typescript
import { something } from "@/components/...";  // src/components
import { something } from "@/hooks/...";       // src/hooks
import { something } from "@/lib/...";         // src/lib
import { something } from "@/pages/...";       // src/pages
```

### Supabase Client

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Toast Notifications

```typescript
import { toast } from "@/hooks/use-toast";

toast({
  title: "Success",
  description: "Your changes have been saved.",
});

toast({
  title: "Error",
  description: "Something went wrong.",
  variant: "destructive",
});
```

### Common Hooks

```typescript
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnitStatus } from "@/hooks/useUnitStatus";
```

---

## Next Steps

- [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) — Troubleshooting common issues
- [REPO_TOUR.md](./REPO_TOUR.md) — Understand the codebase structure
- [GETTING_STARTED.md](./GETTING_STARTED.md) — Mental model for the system
