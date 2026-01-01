# Lovable Deployment Troubleshooting

## Quick Checks

### 1. Check Lovable Build Logs
- Go to Lovable dashboard
- Look for "Deployments" or "Build" tab
- Check the error message (copy it here if you see one)

### 2. Common Issues

**Issue: "Cannot find module" or "Import error"**
- Check that all edge function dependencies are correct
- Verify `_shared/ttnConfig.ts` exists

**Issue: "Type error" or "TypeScript error"**
- Edge functions use Deno, not Node
- All imports should use full URLs (https://deno.land/...)

**Issue: "Merge conflict"**
- PR has conflicts with main branch
- Need to merge main into your branch (we already did this)

### 3. Force Redeploy

If the code is correct but deployment stuck:

```bash
# Make a small change to force redeploy
git commit --allow-empty -m "Trigger deployment"
git push origin claude/update-ttn-connection-ui-OxSS6
```

### 4. Check Edge Function Syntax

```bash
# Verify edge function is valid Deno TypeScript
deno check supabase/functions/user-sync-emitter/index.ts
```

### 5. Verify All Files Are Pushed

```bash
git log origin/claude/update-ttn-connection-ui-OxSS6 --oneline -5
```

Should show:
- e8662b1 Merge branch 'main'
- 1647b81 Add comprehensive emulator TTN integration documentation
- bc6e25c Add TTN data to user sync payload for emulator

## What to Send Me

If still failing, please share:
1. **Error message** from Lovable deployment logs
2. **Which stage** it's failing at (build, deploy, post-deploy)
3. **Full error output** if available

## Manual Deployment (If Lovable Stuck)

If Lovable won't deploy, you can deploy edge functions manually:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref mfwyiifehsvwnjwqoxht

# Deploy specific function
supabase functions deploy user-sync-emitter
supabase functions deploy ttn-provision-org

# Deploy all functions
supabase functions deploy
```

## Rollback Plan

If deployment is completely broken:

```bash
# Revert to previous working state
git revert HEAD~3..HEAD
git push origin claude/update-ttn-connection-ui-OxSS6
```

This will undo the last 3 commits while preserving history.
