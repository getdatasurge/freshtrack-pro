#!/bin/bash

# Setup TTN Secrets for Production
# This script sets the TTN credentials as Supabase secrets for the production environment.
#
# Usage:
#   chmod +x scripts/setup-ttn-secrets.sh
#   ./scripts/setup-ttn-secrets.sh

set -e

echo "🔧 Setting up TTN Secrets for Supabase Edge Functions"
echo "=================================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo "  # or"
    echo "  brew install supabase/tap/supabase"
    echo ""
    exit 1
fi

# TTN credentials
TTN_USER_ID="frostguard"
TTN_ADMIN_API_KEY="NNSXS.BMG4N2AJ43HN4YVPZ6DLQAPHVHUZBVPTOB37JFQ.FHBMPAB26Q2XM4QVBE4GBQ772NBIYP5MGOKCBBOM5NTCCMCJZRWQ"

echo "📝 Setting TTN_USER_ID..."
supabase secrets set TTN_USER_ID="$TTN_USER_ID"

echo "📝 Setting TTN_ADMIN_API_KEY..."
supabase secrets set TTN_ADMIN_API_KEY="$TTN_ADMIN_API_KEY"

echo ""
echo "✅ TTN secrets configured successfully!"
echo ""
echo "📊 Verifying configuration..."
echo "You can verify the edge function is ready by running:"
echo "  curl https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-provision-org"
echo ""
echo "Look for: \"ready\": true"
echo ""
