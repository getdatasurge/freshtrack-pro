# Emulator TTN Integration Guide

Complete guide for integrating TTN data in the emulator project (Project 2).

## Overview

FreshTrack Pro (Project 1) syncs user data to the emulator including their organization's complete TTN configuration. This allows the emulator to:

- ✅ Authenticate with The Things Network API
- ✅ Simulate uplinks to the correct TTN application
- ✅ Target the correct TTN cluster (nam1, eu1, au1)
- ✅ Test sensor data flow end-to-end

## Incoming Sync Payload Structure

### Complete Payload

```typescript
{
  users: [{
    // User Identity
    user_id: string,              // "550e8400-e29b-41d4-a716-446655440000"
    email: string,                // "user@example.com"
    full_name: string | null,     // "John Doe"

    // Organization & Location
    organization_id: string | null,   // "org-uuid" (critical for TTN)
    site_id: string | null,           // Current/default site
    unit_id: string | null,           // Current/default unit
    default_site_id: string | null,   // User's preferred site
    user_sites: [{                    // All sites user has access to
      site_id: string,
      site_name: string
    }],

    // Sync Metadata
    updated_at: string,           // "2025-12-31T21:00:00.000Z"

    // TTN Configuration (NEW)
    ttn: {
      enabled: boolean,           // Is TTN integration active for this org?
      cluster: string,            // "nam1" | "eu1" | "au1" | "as1"
      application_id: string | null,  // "ft-acme-corp" (org's TTN app)
      api_key: string | null,     // "NNSXS.BMG4N2AJ43HN4YVPZ6DLQAPHVHU..." (FULL KEY)
      api_key_last4: string | null    // "VZRWQ" (for display/logging only)
    }
  }]
}
```

### Example Payload

```json
{
  "users": [{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "peter@sustainablefinishes.com",
    "full_name": "Peter Smith",
    "organization_id": "org-123",
    "site_id": "site-456",
    "unit_id": "unit-789",
    "default_site_id": "site-456",
    "user_sites": [
      { "site_id": "site-456", "site_name": "Main Kitchen" },
      { "site_id": "site-999", "site_name": "Storage Room" }
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

## Database Schema for Emulator

### Recommended Table Structure

```sql
-- Store synced users with TTN credentials
CREATE TABLE synced_users (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  organization_id uuid,
  site_id uuid,
  unit_id uuid,
  default_site_id uuid,
  user_sites jsonb DEFAULT '[]'::jsonb,

  -- TTN Configuration (store as JSONB for flexibility)
  ttn jsonb,

  -- Sync metadata
  synced_at timestamptz DEFAULT now(),
  updated_at timestamptz NOT NULL,

  -- Indexes for performance
  CONSTRAINT synced_users_pkey PRIMARY KEY (user_id)
);

-- Index for organization lookups
CREATE INDEX idx_synced_users_org ON synced_users(organization_id);

-- Index for TTN-enabled orgs
CREATE INDEX idx_synced_users_ttn_enabled ON synced_users((ttn->>'enabled'))
WHERE (ttn->>'enabled')::boolean = true;

-- Enable RLS
ALTER TABLE synced_users ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (edge functions only)
CREATE POLICY "Service role only" ON synced_users
  FOR ALL USING (auth.role() = 'service_role');
```

### Alternative: Separate TTN Table

```sql
-- If you prefer normalized structure
CREATE TABLE user_ttn_config (
  organization_id uuid PRIMARY KEY,
  enabled boolean DEFAULT false,
  cluster text NOT NULL,
  application_id text,
  api_key text,  -- FULL decrypted key
  api_key_last4 text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_ttn_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON user_ttn_config
  FOR ALL USING (auth.role() = 'service_role');
```

## Processing Sync Payload in Emulator

### Edge Function: Receive Sync

```typescript
// supabase/functions/user-sync/index.ts (in Emulator project)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface IncomingSyncPayload {
  users: Array<{
    user_id: string;
    email: string;
    full_name: string | null;
    organization_id: string | null;
    site_id: string | null;
    unit_id: string | null;
    updated_at: string;
    default_site_id: string | null;
    user_sites: Array<{ site_id: string; site_name: string }>;
    ttn: {
      enabled: boolean;
      cluster: string;
      application_id: string | null;
      api_key: string | null;
      api_key_last4: string | null;
    };
  }>;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate request
  const authHeader = req.headers.get("Authorization");
  const expectedKey = Deno.env.get("SYNC_API_KEY");

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const payload: IncomingSyncPayload = await req.json();
  console.log(`[user-sync] Received ${payload.users.length} users`);

  for (const user of payload.users) {
    // Upsert user with TTN config
    const { error } = await supabase
      .from("synced_users")
      .upsert({
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        organization_id: user.organization_id,
        site_id: user.site_id,
        unit_id: user.unit_id,
        default_site_id: user.default_site_id,
        user_sites: user.user_sites,
        ttn: user.ttn,  // Store entire TTN config as JSONB
        updated_at: user.updated_at,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (error) {
      console.error(`[user-sync] Error syncing user ${user.user_id}:`, error);
    } else {
      console.log(`[user-sync] Synced user ${user.user_id}, TTN enabled: ${user.ttn.enabled}`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, synced: payload.users.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
```

## Using TTN Data in Emulator

### 1. Get User's TTN Config

```typescript
// Helper function to get TTN config for a user
async function getTtnConfigForUser(userId: string) {
  const { data: user } = await supabase
    .from("synced_users")
    .select("organization_id, ttn")
    .eq("user_id", userId)
    .single();

  if (!user?.ttn) {
    return null;
  }

  const ttn = user.ttn as {
    enabled: boolean;
    cluster: string;
    application_id: string | null;
    api_key: string | null;
    api_key_last4: string | null;
  };

  if (!ttn.enabled || !ttn.api_key || !ttn.application_id) {
    console.log(`TTN not fully configured for user ${userId}`);
    return null;
  }

  return {
    cluster: ttn.cluster,
    applicationId: ttn.application_id,
    apiKey: ttn.api_key,
    regionalUrl: getRegionalUrl(ttn.cluster),
  };
}

function getRegionalUrl(cluster: string): string {
  const urls: Record<string, string> = {
    nam1: "https://nam1.cloud.thethings.network",
    eu1: "https://eu1.cloud.thethings.network",
    au1: "https://au1.cloud.thethings.network",
    as1: "https://as1.cloud.thethings.network",
  };
  return urls[cluster] || urls.nam1;
}
```

### 2. Simulate Uplink to TTN

```typescript
// Simulate an uplink message to TTN
async function simulateUplink(
  userId: string,
  devEui: string,
  payload: {
    temperature?: number;
    humidity?: number;
    battery?: number;
  }
) {
  // Get user's TTN config
  const ttnConfig = await getTtnConfigForUser(userId);
  if (!ttnConfig) {
    throw new Error("TTN not configured for this user");
  }

  // Normalize DevEUI
  const normalizedDevEui = devEui.replace(/[:\-\s]/g, '').toLowerCase();
  const deviceId = `sensor-${normalizedDevEui}`;

  console.log(`[simulate-uplink] Sending to ${ttnConfig.cluster}: ${deviceId}`);

  // Encode payload (example: Cayenne LPP format)
  const encodedPayload = encodePayload(payload);

  // Construct uplink message
  const uplinkMessage = {
    end_device_ids: {
      device_id: deviceId,
      application_ids: {
        application_id: ttnConfig.applicationId,
      },
      dev_eui: normalizedDevEui.toUpperCase(),
    },
    uplink_message: {
      f_port: 1,
      frm_payload: btoa(encodedPayload),  // Base64 encoded
      rx_metadata: [{
        gateway_ids: {
          gateway_id: "emulator-gateway",
        },
        rssi: -50,
        snr: 10,
        timestamp: Date.now() * 1000,
      }],
      settings: {
        data_rate: {
          lora: {
            bandwidth: 125000,
            spreading_factor: 7,
          }
        },
        frequency: "868100000",
      },
    },
  };

  // Send to TTN Application Server
  const response = await fetch(
    `${ttnConfig.regionalUrl}/api/v3/as/applications/${ttnConfig.applicationId}/devices/${deviceId}/up`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ttnConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(uplinkMessage),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`[simulate-uplink] Failed: ${response.status} - ${error}`);
    throw new Error(`TTN API error: ${response.status}`);
  }

  console.log(`[simulate-uplink] Success! Uplink sent for ${deviceId}`);
  return { success: true, deviceId };
}

// Simple payload encoder (example)
function encodePayload(payload: { temperature?: number; humidity?: number; battery?: number }): string {
  // Cayenne LPP format example
  let bytes: number[] = [];

  if (payload.temperature !== undefined) {
    bytes.push(0x01, 0x67);  // Channel 1, Temperature
    const temp = Math.round(payload.temperature * 10);
    bytes.push((temp >> 8) & 0xFF, temp & 0xFF);
  }

  if (payload.humidity !== undefined) {
    bytes.push(0x02, 0x68);  // Channel 2, Humidity
    bytes.push(Math.round(payload.humidity * 2));
  }

  if (payload.battery !== undefined) {
    bytes.push(0x03, 0x02);  // Channel 3, Analog
    const batt = Math.round(payload.battery * 100);
    bytes.push((batt >> 8) & 0xFF, batt & 0xFF);
  }

  return String.fromCharCode(...bytes);
}
```

### 3. Edge Function: Simulate Uplink

```typescript
// supabase/functions/simulate-uplink/index.ts (in Emulator)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { userId, devEui, temperature, humidity, battery } = await req.json();

  // Get TTN config
  const { data: user } = await supabase
    .from("synced_users")
    .select("ttn")
    .eq("user_id", userId)
    .single();

  if (!user?.ttn) {
    return new Response(
      JSON.stringify({ error: "User not found or TTN not configured" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const ttn = user.ttn as any;

  if (!ttn.enabled || !ttn.api_key) {
    return new Response(
      JSON.stringify({ error: "TTN not enabled or API key missing" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Simulate uplink (use the function from above)
  try {
    const result = await simulateUplink(userId, devEui, {
      temperature,
      humidity,
      battery,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

## Security Best Practices

### 1. Secure Storage

```sql
-- Encrypt API keys at rest (optional additional layer)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store encrypted
INSERT INTO synced_users (user_id, ttn)
VALUES (
  'user-id',
  jsonb_build_object(
    'enabled', true,
    'cluster', 'eu1',
    'application_id', 'ft-org',
    'api_key', pgp_sym_encrypt('NNSXS.KEY...', 'encryption-key'),
    'api_key_last4', 'JZRWQ'
  )
);

-- Retrieve decrypted
SELECT
  user_id,
  ttn->>'enabled' as enabled,
  ttn->>'cluster' as cluster,
  ttn->>'application_id' as application_id,
  pgp_sym_decrypt((ttn->>'api_key')::bytea, 'encryption-key') as api_key
FROM synced_users;
```

### 2. RLS Policies

```sql
-- Only service role can read TTN data
CREATE POLICY "Service role full access" ON synced_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Prevent client access
CREATE POLICY "No client access" ON synced_users
  FOR ALL
  TO authenticated, anon
  USING (false);
```

### 3. Audit Logging

```sql
-- Log TTN API usage
CREATE TABLE ttn_simulation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dev_eui text NOT NULL,
  ttn_cluster text NOT NULL,
  ttn_application_id text NOT NULL,
  success boolean NOT NULL,
  error text,
  created_at timestamptz DEFAULT now()
);

-- Log each simulation
INSERT INTO ttn_simulation_log (user_id, dev_eui, ttn_cluster, ttn_application_id, success)
VALUES ('user-id', '0004A30B001A2B3C', 'eu1', 'ft-org', true);
```

## Testing

### 1. Verify Sync Payload

```bash
# Test sync endpoint
curl -X POST https://emulator.supabase.co/functions/v1/user-sync \
  -H "Authorization: Bearer YOUR_SYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "users": [{
      "user_id": "test-user",
      "email": "test@example.com",
      "full_name": "Test User",
      "organization_id": "test-org",
      "site_id": null,
      "unit_id": null,
      "updated_at": "2025-12-31T21:00:00Z",
      "default_site_id": null,
      "user_sites": [],
      "ttn": {
        "enabled": true,
        "cluster": "eu1",
        "application_id": "ft-test-org",
        "api_key": "NNSXS.TEST_KEY",
        "api_key_last4": "tkey"
      }
    }]
  }'
```

### 2. Test Uplink Simulation

```bash
# Simulate uplink
curl -X POST https://emulator.supabase.co/functions/v1/simulate-uplink \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "devEui": "0004A30B001A2B3C",
    "temperature": 5.5,
    "humidity": 80,
    "battery": 3.6
  }'
```

### 3. Verify in TTN Console

1. Log in to [TTN Console](https://console.cloud.thethings.network/)
2. Navigate to your application (e.g., `ft-test-org`)
3. Go to **Live Data**
4. You should see the simulated uplink appear

## Troubleshooting

### TTN API Returns 401 (Unauthorized)

**Cause**: API key is invalid or expired

**Fix**:
- Verify the API key in FreshTrack Pro Settings
- Regenerate the API key in TTN Console
- Trigger a user sync to get the new key

### TTN API Returns 403 (Forbidden)

**Cause**: API key doesn't have sufficient permissions

**Fix**:
- Check API key rights in TTN Console → Applications → API keys
- Ensure it has: `Write downlink application traffic`, `Read application traffic`
- Regenerate with correct permissions

### TTN API Returns 404 (Device Not Found)

**Cause**: Device not registered in TTN

**Fix**:
- Register the device in TTN Console first
- Or use FreshTrack Pro's "Provision to TTN" feature

### Sync Payload Missing TTN Data

**Cause**: Organization doesn't have TTN configured

**Fix**:
- Go to FreshTrack Pro → Settings → Gateways
- Click "Provision TTN Application"
- Enable the TTN integration

## Summary

✅ **Sync Payload** includes full TTN config per user's organization
✅ **API Key** is decrypted and ready to use
✅ **Cluster** info allows targeting correct TTN region
✅ **Application ID** identifies the org's TTN app
✅ **Security** ensured with RLS and service role policies
✅ **Simulation** can authenticate and send uplinks to TTN

The emulator now has everything needed to test the complete sensor data flow! 🚀
