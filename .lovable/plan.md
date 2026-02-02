

# Deployment Gap: Preview vs Published URL

## Problem

The gear icon for sensor settings is appearing in the **Lovable preview** but not on the **published live URL** (`safe-temps-everywhere.lovable.app`).

This is expected behavior - Lovable has two separate environments:

| Environment | URL | Status |
|-------------|-----|--------|
| **Preview** | `id-preview--786443f8...lovable.app` | Shows latest code changes (gear icon visible) |
| **Published** | `safe-temps-everywhere.lovable.app` | Shows last published version (gear icon missing) |

## Solution

**Publish the project** to deploy your latest code changes to the live URL.

### How to Publish

1. Click the **"Publish"** button in the top-right corner of the Lovable interface
2. Wait for the deployment to complete (usually 30-60 seconds)
3. Refresh `https://safe-temps-everywhere.lovable.app` to see the gear icon

## What Gets Deployed

When you publish, these recent changes will go live:
- ✅ Gear icon on sensor rows in `ConnectedSensorsWidget.tsx`
- ✅ Gear icon on sensor rows in `UnitSensorsCard.tsx`
- ✅ `SensorSettingsDrawer` component
- ✅ `usePendingChangeCounts` hook integration
- ✅ Pending change badge on gear icon

The database tables (`sensor_configurations`, `sensor_pending_changes`) are already live since database migrations apply immediately to production.

## No Code Changes Required

This is purely a deployment step - no code modifications needed.

