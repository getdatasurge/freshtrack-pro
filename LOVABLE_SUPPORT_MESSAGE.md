# Message for Lovable Support

Hi Lovable Support,

I need help deploying edge function changes to my Supabase instance.

## Issue
I've made updates to my `ttn-provision-org` edge function (committed to branch `claude/update-ttn-connection-ui-OxSS6`), but the changes haven't been deployed to production yet.

## Current Status
- ✅ Code changes committed to git
- ✅ Branch: `claude/update-ttn-connection-ui-OxSS6`
- ✅ Files changed: `supabase/functions/ttn-provision-org/index.ts`
- ❌ Changes not deployed to production

## Verification
When I check the deployed version:
```bash
curl https://mfwyiifehsvwnjwqoxht.supabase.co/functions/v1/ttn-provision-org
```

I see:
- **Current**: `"version": "ttn-provision-org-v1-perorg-20251231"`
- **Expected**: `"version": "ttn-provision-org-v1.1-webhook-fix-20251231"`

## What I Need
Please help me:
1. Deploy the latest edge function changes from my branch
2. Or explain how to trigger edge function deployments in Lovable
3. Or merge my branch to trigger an automatic deployment

## Repository
- **Project**: freshtrack-pro (getdatasurge/freshtrack-pro)
- **Branch**: `claude/update-ttn-connection-ui-OxSS6`
- **Supabase Project**: mfwyiifehsvwnjwqoxht

Thank you!
