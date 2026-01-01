# TTN Production Secrets Setup

Your TTN credentials are configured for local development in `supabase/.env.local`, but you also need to set them in **production** (Supabase Cloud) for the edge functions to work when deployed.

## Your TTN Credentials

- **TTN User ID**: `frostguard`
- **TTN Admin API Key**: `NNSXS.BMG4N2AJ43HN4YVPZ6DLQAPHVHUZBVPTOB37JFQ.FHBMPAB26Q2XM4QVBE4GBQ772NBIYP5MGOKCBBOM5NTCCMCJZRWQ`

## Option 1: Using the Setup Script (Recommended)

If you have the Supabase CLI installed:

```bash
./scripts/setup-ttn-secrets.sh
```

This will automatically set both secrets in your Supabase project.

## Option 2: Using Supabase CLI Manually

```bash
# Set TTN User ID
supabase secrets set TTN_USER_ID="frostguard"

# Set TTN Admin API Key
supabase secrets set TTN_ADMIN_API_KEY="NNSXS.BMG4N2AJ43HN4YVPZ6DLQAPHVHUZBVPTOB37JFQ.FHBMPAB26Q2XM4QVBE4GBQ772NBIYP5MGOKCBBOM5NTCCMCJZRWQ"
```

## Option 3: Using Supabase Dashboard (If CLI is not available)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **mfwyiifehsvwnjwqoxht**
3. Navigate to **Project Settings** → **Edge Functions** → **Manage secrets**
4. Click **Add new secret** and add:

   **Secret 1:**
   - Name: `TTN_USER_ID`
   - Value: `frostguard`

   **Secret 2:**
   - Name: `TTN_ADMIN_API_KEY`
   - Value: `NNSXS.BMG4N2AJ43HN4YVPZ6DLQAPHVHUZBVPTOB37JFQ.FHBMPAB26Q2XM4QVBE4GBQ772NBIYP5MGOKCBBOM5NTCCMCJZRWQ`

5. Click **Save** for each secret

## Verify Configuration

After setting the secrets, verify they're working:

```bash
curl https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-provision-org
```

You should see a response like:
```json
{
  "status": "ok",
  "function": "ttn-provision-org",
  "environment": {
    "hasTtnAdminKey": true,
    "hasTtnUserId": true,
    "ready": true
  }
}
```

**Important**: `ready` must be `true`!

## Security Note

⚠️ **Keep these credentials secure!**

- Never commit `.env.local` to git (it's already in `.gitignore`)
- The TTN Admin API Key has platform-level access to create/delete applications
- Only share these credentials with trusted administrators

## Next Steps

Once the secrets are set in production:

1. Go to your FreshTrack Pro app
2. Navigate to **Settings** → **Gateways** tab
3. Select your TTN region (North America, Europe, or Australia)
4. Click **Provision TTN Application**
5. Your organization's TTN application will be created automatically!

## Troubleshooting

### "Supabase CLI not found" when running the script

**Solution**: Install the Supabase CLI:
```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### Secrets set but edge function still returns "ready": false

**Causes**:
- Secrets may take a few seconds to propagate
- Edge function may need to be redeployed

**Solutions**:
1. Wait 10-30 seconds and check again
2. Redeploy the edge function:
   ```bash
   supabase functions deploy ttn-provision-org
   ```

### Still getting "Edge Function returned a non-2xx status code"

**Solution**: Check the Supabase logs:
1. Go to Supabase Dashboard → Edge Functions → ttn-provision-org
2. Click on **Logs** tab
3. Look for error messages that explain what's wrong

## Support

If you continue to have issues:
- Check [docs/TTN_SETUP.md](./TTN_SETUP.md) for general TTN setup documentation
- Review edge function logs in the Supabase dashboard
- Ensure your TTN Admin API Key has all required permissions
