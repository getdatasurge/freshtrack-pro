# The Things Network (TTN) Setup Guide

This guide explains how to configure FreshTrack Pro to provision TTN applications for each organization.

## Overview

FreshTrack Pro uses a **per-organization TTN architecture** where:
- Each organization gets its own dedicated TTN application
- Applications are auto-provisioned with a single button click
- All credentials are securely stored and encrypted
- Complete tenant isolation between organizations

## Prerequisites

To enable TTN provisioning, you need:

1. **A TTN account** with admin privileges
2. **A TTN Admin API Key** (platform-level access)
3. **Your TTN User ID**

## Step 1: Create a TTN Admin API Key

1. Log in to [The Things Network Console](https://console.cloud.thethings.network/)
2. Click on your profile (top right) → **Personal API keys**
3. Click **+ Add personal API key**
4. Configure the API key:
   - **Name**: `FreshTrack Admin Key`
   - **Rights**: Select the following:
     - `Grant all current and future rights` (or individually select):
       - `Create applications under user`
       - `List applications of user`
       - `Edit basic application settings`
       - `Delete applications`
       - `Create application API keys`
       - `View application API keys`
       - `Edit application API keys`
       - `Delete application API keys`
5. Click **Create personal API key**
6. **Copy the generated API key** - you won't be able to see it again!

## Step 2: Get Your TTN User ID

1. While logged into TTN Console, go to **Console settings**
2. Your **User ID** is displayed at the top (format: `your-username`)
3. Copy this User ID

## Step 3: Configure Supabase Secrets

Add the TTN credentials as secrets to your Supabase project.

> **Quick Setup**: If your credentials are already configured, see [TTN_PRODUCTION_SETUP.md](./TTN_PRODUCTION_SETUP.md) for your specific setup instructions.

### Using Supabase Dashboard:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Manage secrets**
4. Add the following secrets:
   - **Name**: `TTN_ADMIN_API_KEY`
     - **Value**: (paste your TTN admin API key from Step 1)
   - **Name**: `TTN_USER_ID`
     - **Value**: (paste your TTN user ID from Step 2)

### Using Supabase CLI:

```bash
# Set TTN Admin API Key
supabase secrets set TTN_ADMIN_API_KEY="your-ttn-admin-api-key-here"

# Set TTN User ID
supabase secrets set TTN_USER_ID="your-ttn-user-id-here"
```

### For Local Development:

Create a `supabase/.env.local` file:

```bash
TTN_USER_ID=your-ttn-user-id
TTN_ADMIN_API_KEY=your-ttn-admin-api-key
```

This file is gitignored and won't be committed to version control.

## Step 4: Verify Configuration

You can verify the configuration by checking the edge function health endpoint:

```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/ttn-provision-org
```

Look for the response:
```json
{
  "status": "ok",
  "environment": {
    "hasTtnAdminKey": true,
    "hasTtnUserId": true,
    "ready": true
  }
}
```

If `ready` is `false`, double-check your secrets.

## Step 5: Test Provisioning

1. Log in to FreshTrack Pro as an organization admin/owner
2. Go to **Settings** → **Gateways** tab
3. In the **TTN Connection** section:
   - Select your TTN region (e.g., "North America", "Europe", "Australia")
   - Click **Provision TTN Application**
4. If successful, you'll see:
   - A green success banner with your TTN application ID
   - Webhook configuration details
   - Enable/disable toggle for the integration

## Troubleshooting

### Error: "TTN credentials not configured"

**Cause**: The `TTN_ADMIN_API_KEY` or `TTN_USER_ID` secrets are not set.

**Solution**: Follow Steps 1-3 above to configure the secrets.

### Error: "Failed to create application"

**Causes**:
- Invalid API key (expired or insufficient permissions)
- TTN User ID is incorrect
- Network connectivity issues with TTN servers

**Solutions**:
1. Verify your API key has all required rights
2. Check that the TTN User ID matches your account
3. Try again after a few moments

### Error: "Failed to create API key"

**Cause**: The admin API key doesn't have permission to create application API keys.

**Solution**: Recreate the admin API key with `Grant all current and future rights` enabled.

### Provisioning stuck at "Provisioning..."

**Cause**: Edge function may have encountered an error mid-process.

**Solution**:
1. Click **Check Status** button to refresh
2. If stuck, contact support to manually reset the provisioning status

## TTN Architecture Details

### Per-Organization Applications

Each organization gets a TTN application with:
- **Application ID**: `freshtracker-{org-slug}`
- **Application Name**: `FreshTracker - {Org Name}`
- **Dedicated API Key**: Application-scoped with minimal required permissions
- **Dedicated Webhook**: Points to FreshTrack with unique secret for authentication

### Security Features

- **Encrypted Storage**: All API keys and secrets are encrypted in the database
- **Tenant Isolation**: Each org's TTN traffic is isolated via unique webhook secrets
- **Minimal Permissions**: Application API keys only have rights needed for sensor management
- **Admin-Only**: Only org admins/owners can provision TTN applications

### Webhook Configuration

Automatically configured webhook:
- **URL**: `https://YOUR_PROJECT.supabase.co/functions/v1/ttn-webhook`
- **Format**: JSON
- **Events**: Uplink messages, join accepts
- **Authentication**: Unique webhook secret per organization

## Regional Servers

FreshTrack Pro supports these TTN regions:

| Region | Code | Server URL | Frequency Plan |
|--------|------|------------|----------------|
| **North America** (default) | `nam1` | `nam1.cloud.thethings.network` | US915 (US_902_928_FSB_2) |
| Europe | `eu1` | `eu1.cloud.thethings.network` | EU868 (EU_863_870_TTN) |
| Australia | `au1` | `au1.cloud.thethings.network` | AU915 (AU_915_928_FSB_2) |

**Default Region**: New organizations are provisioned on **NAM1 (North America)** by default with the US915 frequency plan.

**Important**: Select the region closest to where your sensors are deployed for best performance. Sensors must use the correct frequency plan for their region (US915 for NAM1, EU868 for EU1, AU915 for AU1).

## Next Steps

After provisioning:

1. **Add Sensors**: Register your LoRaWAN sensors in the TTN Console
2. **Configure Devices**: Add device EUIs and keys
3. **Test Data Flow**: Send test uplinks to verify webhook delivery
4. **Monitor**: Check FreshTrack's sensor data to see incoming readings

## Support

If you encounter issues:
1. Check the Edge Function Diagnostics section in Settings
2. Review Supabase Edge Function logs
3. Verify TTN application exists in TTN Console
4. Contact FreshTrack support with error details
