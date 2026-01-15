-- Migration: Add TTN Organization fields to ttn_connections
--
-- Purpose: Support organization-based TTN provisioning flow.
-- Creating a TTN Organization first (before applications) provides better
-- permission isolation and allows the organization API key to manage
-- all resources within that organization.
--
-- New Flow:
-- 1. Create TTN Organization under User
-- 2. Create Organization API Key (with org-level rights)
-- 3. Create TTN Application under Organization (not User)
-- 4. Create Application API Key using Org API Key
-- 5. Create Webhook
--
-- This fixes the 403 "no_application_rights" error that occurred when trying
-- to create application API keys using an admin key that didn't have proper
-- rights to user-owned applications.

-- Add TTN organization columns (if they don't exist)
DO $$
BEGIN
    -- TTN Organization ID (e.g., fg-org-fa73acc7)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_organization_id'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_organization_id TEXT;

        COMMENT ON COLUMN ttn_connections.ttn_organization_id IS
            'TTN Organization ID (e.g., fg-org-fa73acc7). Organization is created first, then applications are created under it.';
    END IF;

    -- TTN Organization Name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_organization_name'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_organization_name TEXT;

        COMMENT ON COLUMN ttn_connections.ttn_organization_name IS
            'Human-readable name for the TTN Organization (e.g., FrostGuard - OrgName)';
    END IF;

    -- Organization API key (encrypted) - this key has org-level rights
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_org_api_key_encrypted'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_org_api_key_encrypted TEXT;

        COMMENT ON COLUMN ttn_connections.ttn_org_api_key_encrypted IS
            'Organization-scoped TTN API key (XOR encrypted). Has rights to create applications and manage resources within the org.';
    END IF;

    -- Organization API key last 4 chars (for display)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_org_api_key_last4'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_org_api_key_last4 VARCHAR(4);

        COMMENT ON COLUMN ttn_connections.ttn_org_api_key_last4 IS
            'Last 4 characters of organization API key for display purposes only';
    END IF;

    -- Organization API key ID (for management/revocation)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_org_api_key_id'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_org_api_key_id TEXT;

        COMMENT ON COLUMN ttn_connections.ttn_org_api_key_id IS
            'TTN API key ID for the organization key (used for key management)';
    END IF;
END $$;

-- Add index for TTN organization lookups
CREATE INDEX IF NOT EXISTS idx_ttn_connections_ttn_org_id
ON ttn_connections(ttn_organization_id)
WHERE ttn_organization_id IS NOT NULL;
