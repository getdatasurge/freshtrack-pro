# Emulator Quick Start - TTN Integration

Copy-paste code to get started quickly.

## 1. Database Setup (Run in Emulator Supabase)

```sql
-- Create synced_users table with TTN support
CREATE TABLE IF NOT EXISTS synced_users (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  organization_id uuid,
  site_id uuid,
  unit_id uuid,
  default_site_id uuid,
  user_sites jsonb DEFAULT '[]'::jsonb,
  ttn jsonb,  -- Stores: {enabled, cluster, application_id, api_key, api_key_last4}
  synced_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_synced_users_org ON synced_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_synced_users_ttn_enabled
  ON synced_users((ttn->>'enabled'))
  WHERE (ttn->>'enabled')::boolean = true;

-- RLS: Only service role
ALTER TABLE synced_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON synced_users;
CREATE POLICY "Service role only" ON synced_users
  FOR ALL USING (auth.role() = 'service_role');
```

## 2. Receive Sync Payload

**File**: `supabase/functions/user-sync/index.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Auth
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("SYNC_API_KEY");
  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Parse payload
  const payload = await req.json();

  // Setup Supabase
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Upsert users
  for (const user of payload.users) {
    await supabase.from("synced_users").upsert({
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      organization_id: user.organization_id,
      site_id: user.site_id,
      unit_id: user.unit_id,
      default_site_id: user.default_site_id,
      user_sites: user.user_sites,
      ttn: user.ttn,  // {enabled, cluster, application_id, api_key, api_key_last4}
      updated_at: user.updated_at,
      synced_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  return new Response(
    JSON.stringify({ success: true, synced: payload.users.length }),
    { status: 200 }
  );
});
```

## 3. Simulate TTN Uplink

**File**: `supabase/functions/simulate-uplink/index.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REGIONAL_URLS: Record<string, string> = {
  nam1: "https://nam1.cloud.thethings.network",
  eu1: "https://eu1.cloud.thethings.network",
  au1: "https://au1.cloud.thethings.network",
};

Deno.serve(async (req) => {
  const { userId, devEui, temperature, humidity } = await req.json();

  // Get user's TTN config
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: user } = await supabase
    .from("synced_users")
    .select("ttn")
    .eq("user_id", userId)
    .single();

  if (!user?.ttn || !user.ttn.enabled || !user.ttn.api_key) {
    return new Response(
      JSON.stringify({ error: "TTN not configured" }),
      { status: 400 }
    );
  }

  const ttn = user.ttn;

  // Normalize DevEUI
  const normalizedDevEui = devEui.replace(/[:\-\s]/g, '').toLowerCase();
  const deviceId = `sensor-${normalizedDevEui}`;

  // Encode payload (Cayenne LPP)
  const bytes: number[] = [];
  if (temperature !== undefined) {
    bytes.push(0x01, 0x67);  // Temperature sensor
    const temp = Math.round(temperature * 10);
    bytes.push((temp >> 8) & 0xFF, temp & 0xFF);
  }
  if (humidity !== undefined) {
    bytes.push(0x02, 0x68);  // Humidity sensor
    bytes.push(Math.round(humidity * 2));
  }

  const encodedPayload = btoa(String.fromCharCode(...bytes));

  // Send uplink to TTN
  const ttnUrl = REGIONAL_URLS[ttn.cluster] || REGIONAL_URLS.nam1;
  const response = await fetch(
    `${ttnUrl}/api/v3/as/applications/${ttn.application_id}/devices/${deviceId}/up`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ttn.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        end_device_ids: {
          device_id: deviceId,
          application_ids: { application_id: ttn.application_id },
          dev_eui: normalizedDevEui.toUpperCase(),
        },
        uplink_message: {
          f_port: 1,
          frm_payload: encodedPayload,
          rx_metadata: [{
            gateway_ids: { gateway_id: "emulator-gateway" },
            rssi: -50,
            snr: 10,
          }],
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return new Response(
      JSON.stringify({ error: `TTN API error: ${error}` }),
      { status: response.status }
    );
  }

  return new Response(
    JSON.stringify({ success: true, deviceId, cluster: ttn.cluster }),
    { status: 200 }
  );
});
```

## 4. Test It

### Setup Environment Variables (Emulator)

```bash
# In emulator Supabase project secrets
SYNC_API_KEY=your-random-secure-key-here
```

### Test Sync

```bash
curl -X POST https://YOUR_EMULATOR.supabase.co/functions/v1/user-sync \
  -H "Authorization: Bearer your-sync-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "users": [{
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "test@example.com",
      "full_name": "Test User",
      "organization_id": "org-123",
      "site_id": null,
      "unit_id": null,
      "default_site_id": null,
      "user_sites": [],
      "updated_at": "2025-12-31T21:00:00Z",
      "ttn": {
        "enabled": true,
        "cluster": "eu1",
        "application_id": "ft-test-org",
        "api_key": "NNSXS.YOUR_ACTUAL_TTN_API_KEY",
        "api_key_last4": "tkey"
      }
    }]
  }'
```

### Test Uplink Simulation

```bash
curl -X POST https://YOUR_EMULATOR.supabase.co/functions/v1/simulate-uplink \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "devEui": "0004A30B001A2B3C",
    "temperature": 5.5,
    "humidity": 80
  }'
```

### Verify in Database

```sql
-- Check synced users
SELECT
  user_id,
  email,
  ttn->>'enabled' as ttn_enabled,
  ttn->>'cluster' as ttn_cluster,
  ttn->>'application_id' as ttn_app,
  ttn->>'api_key_last4' as api_key_last4
FROM synced_users;

-- Check TTN-enabled users only
SELECT
  user_id,
  email,
  organization_id,
  ttn->'enabled' as enabled,
  ttn->'cluster' as cluster,
  ttn->'application_id' as app_id
FROM synced_users
WHERE (ttn->>'enabled')::boolean = true;
```

## 5. Expected Sync Payload

```json
{
  "users": [{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "peter@sustainablefinishes.com",
    "full_name": "Peter Smith",
    "organization_id": "org-123",
    "site_id": "site-456",
    "unit_id": null,
    "default_site_id": "site-456",
    "user_sites": [
      { "site_id": "site-456", "site_name": "Main Kitchen" }
    ],
    "updated_at": "2025-12-31T21:30:00.000Z",
    "ttn": {
      "enabled": true,
      "cluster": "eu1",
      "application_id": "ft-sustainablefinishes",
      "api_key": "NNSXS.BMG4N2AJ43HN4YVPZ6DLQAPHVHUZBVPTOB37JFQ.FHBMPAB26Q2XM4QVBE4GBQ772NBIYP5MGOKCBBOM5NTCCMCJZRWQ",
      "api_key_last4": "ZRWQ"
    }
  }]
}
```

## 6. Troubleshooting

### "TTN not configured" Error

**Check**:
```sql
SELECT user_id, ttn FROM synced_users WHERE user_id = 'your-user-id';
```

**Fix**: Ensure user is synced and `ttn.enabled = true`

### "401 Unauthorized" from TTN

**Check**: API key is valid
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://eu1.cloud.thethings.network/api/v3/applications/ft-your-org
```

### "404 Device not found" from TTN

**Fix**: Register device in TTN Console first, or use FreshTrack Pro's "Provision to TTN" feature

## Done! 🎉

You now have:
- ✅ Database table for synced users with TTN
- ✅ Edge function to receive sync payload
- ✅ Edge function to simulate uplinks
- ✅ Full TTN API access for each organization

The emulator can now authenticate with TTN and test the complete sensor data pipeline!
