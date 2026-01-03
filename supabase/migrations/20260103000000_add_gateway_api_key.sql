-- Migration: Add gateway-specific API key columns to ttn_connections
--
-- Purpose: TTN gateway provisioning requires a USER-SCOPED API key, not an
-- APPLICATION-SCOPED key. This migration adds columns to store a dedicated
-- gateway API key with proper gateway rights.
--
-- Background:
-- - Application API keys (created via /api/v3/applications/{id}/api-keys)
--   CANNOT provision gateways - gateways are top-level TTN entities
-- - User/Personal API keys (created via /api/v3/users/{id}/api-keys)
--   CAN provision gateways when granted gateway rights
-- - This fix creates a separate user-scoped key specifically for gateway ops

-- Add gateway API key columns (if they don't exist)
DO $$
BEGIN
    -- Gateway API key (encrypted, user-scoped)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_gateway_api_key_encrypted'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_gateway_api_key_encrypted TEXT;

        COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_encrypted IS
            'User-scoped TTN API key for gateway provisioning (XOR encrypted). Required because application-scoped keys cannot manage gateways.';
    END IF;

    -- Gateway API key last 4 chars (for display)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_gateway_api_key_last4'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_gateway_api_key_last4 VARCHAR(4);

        COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_last4 IS
            'Last 4 characters of gateway API key for display purposes only';
    END IF;

    -- Gateway API key ID (for management/revocation)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_gateway_api_key_id'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_gateway_api_key_id TEXT;

        COMMENT ON COLUMN ttn_connections.ttn_gateway_api_key_id IS
            'TTN API key ID for the gateway key (used for key management)';
    END IF;

    -- Gateway rights verified flag (may already exist, make idempotent)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_gateway_rights_verified'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_gateway_rights_verified BOOLEAN DEFAULT FALSE;

        COMMENT ON COLUMN ttn_connections.ttn_gateway_rights_verified IS
            'Whether gateway rights have been verified for this org';
    END IF;

    -- Gateway rights check timestamp (may already exist)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ttn_connections'
        AND column_name = 'ttn_gateway_rights_checked_at'
    ) THEN
        ALTER TABLE ttn_connections
        ADD COLUMN ttn_gateway_rights_checked_at TIMESTAMPTZ;

        COMMENT ON COLUMN ttn_connections.ttn_gateway_rights_checked_at IS
            'Last time gateway rights were verified';
    END IF;
END $$;

-- Add index for gateway key lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_ttn_connections_gateway_key
ON ttn_connections(organization_id)
WHERE ttn_gateway_api_key_encrypted IS NOT NULL;
