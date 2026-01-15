# Local Development Setup

> Get FreshTrack Pro running on your machine

---

## Prerequisites

Before you begin, install these tools:

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ | Package manager | Included with Node |
| **Git** | 2.30+ | Version control | [git-scm.com](https://git-scm.com) |
| **Supabase CLI** | Latest | Local backend | `npm install -g supabase` |
| **Deno** | 1.40+ | Edge function runtime | [deno.land](https://deno.land) |

**Optional but recommended:**
- VS Code with extensions: ESLint, Prettier, Tailwind CSS IntelliSense
- Docker (for running Supabase locally)

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd freshtrack-pro

# 2. Install dependencies
npm install

# 3. Set up environment variables (see below)
cp .env.example .env

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:8080`.

---

## Environment Variables

Create a `.env` file in the project root. Here are the required variables:

### Required Variables

```env
# Supabase Connection (required)
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Where to Find These Values

1. **Supabase Dashboard**: Go to Project Settings → API
   - `VITE_SUPABASE_PROJECT_ID`: The project reference ID
   - `VITE_SUPABASE_URL`: The project URL
   - `VITE_SUPABASE_ANON_KEY`: The `anon` public key

### Optional Variables (for local development)

```env
# Feature flags
VITE_ENABLE_DEBUG_MODE="true"    # Shows debug terminal

# Stripe (for payment testing)
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### Environment Variable Naming

All frontend variables **must** start with `VITE_` to be exposed to the browser.

```typescript
// Access in code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

---

## NPM Scripts

```bash
# Development
npm run dev           # Start dev server (port 8080)
npm run build         # Build for production
npm run preview       # Preview production build locally

# Code Quality
npm run lint          # Run ESLint
npm run typecheck     # TypeScript type checking (if configured)

# Testing
npm run test          # Run tests (Vitest)
```

---

## Running Supabase Locally

For full backend development, run Supabase locally:

### Start Local Supabase

```bash
# Start all Supabase services
supabase start

# This will output local URLs:
# - API URL: http://localhost:54321
# - Studio URL: http://localhost:54323
# - Anon Key: eyJhb...
```

### Update `.env` for Local Development

```env
VITE_SUPABASE_URL="http://localhost:54321"
VITE_SUPABASE_ANON_KEY="<local-anon-key>"
```

### Apply Migrations

```bash
# Apply all migrations to local database
supabase db reset

# This runs all migrations in /supabase/migrations/
```

### View Local Database

```bash
# Open Supabase Studio in browser
supabase studio

# Or connect directly with psql
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

---

## Running Edge Functions Locally

Edge functions are in `/supabase/functions/`. To run them locally:

### Serve All Functions

```bash
supabase functions serve
```

This runs all functions on `http://localhost:54321/functions/v1/<function-name>`.

### Serve a Specific Function

```bash
supabase functions serve process-unit-states
```

### Test a Function

```bash
# Example: Call the health check function
curl http://localhost:54321/functions/v1/health-check \
  -H "Authorization: Bearer <anon-key>"
```

### Environment Variables for Functions

Edge functions need their own environment variables:

```bash
# Create a .env file for functions
touch supabase/.env.local

# Add function-specific secrets
TTN_API_KEY="your-ttn-key"
STRIPE_SECRET_KEY="sk_test_..."
TELNYX_API_KEY="KEY..."
```

---

## Project Structure for Development

```
freshtrack-pro/
├── src/                    # Frontend (what you'll edit most)
│   ├── pages/              # Route components
│   ├── components/         # React components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utilities
├── supabase/
│   ├── functions/          # Edge functions (backend logic)
│   └── migrations/         # Database schema
├── public/                 # Static assets
├── .env                    # Environment variables (DON'T COMMIT)
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite build configuration
└── tailwind.config.ts      # Tailwind CSS configuration
```

---

## IDE Setup

### VS Code (Recommended)

Install these extensions:
- **ESLint** — Linting
- **Prettier** — Code formatting
- **Tailwind CSS IntelliSense** — Autocomplete for Tailwind classes
- **TypeScript Vue Plugin (Volar)** — Better TypeScript support
- **Deno** — For edge function development

### Recommended Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## Common Setup Problems

### Problem: "Module not found" errors

**Cause**: Dependencies not installed or outdated.

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: Supabase connection errors

**Cause**: Wrong environment variables or Supabase not running.

**Solutions**:
1. Check `.env` file has correct values
2. Ensure no quotes around values in some shells
3. Restart the dev server after changing `.env`

```bash
# Verify your env vars are loaded
npm run dev
# Check browser console for connection errors
```

### Problem: "Port 8080 already in use"

**Cause**: Another process using the port.

**Solution**:
```bash
# Find and kill the process
lsof -i :8080
kill -9 <PID>

# Or use a different port
npm run dev -- --port 3000
```

### Problem: Edge functions not working locally

**Cause**: Deno not installed or functions not served.

**Solutions**:
1. Install Deno: `curl -fsSL https://deno.land/install.sh | sh`
2. Start function server: `supabase functions serve`
3. Check function logs in terminal

### Problem: TypeScript errors on first run

**Cause**: Generated types may be stale.

**Solution**:
```bash
# Regenerate Supabase types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Problem: Hot reload not working

**Cause**: File watcher limits or Vite cache issues.

**Solutions**:
```bash
# Increase file watcher limit (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Problem: CORS errors in browser

**Cause**: Frontend calling wrong backend URL.

**Solution**: Check `VITE_SUPABASE_URL` matches your running backend:
- Local: `http://localhost:54321`
- Remote: `https://your-project.supabase.co`

---

## Development Workflow

### Typical Day

1. **Pull latest changes**
   ```bash
   git pull origin main
   npm install  # If package.json changed
   ```

2. **Start the dev server**
   ```bash
   npm run dev
   ```

3. **Make changes** — Hot reload will update the browser

4. **Check for errors**
   ```bash
   npm run lint
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Working on Backend

1. **Start Supabase locally**
   ```bash
   supabase start
   ```

2. **Make database changes** via migration:
   ```bash
   supabase migration new my_change_name
   # Edit the generated SQL file
   supabase db reset  # Apply changes
   ```

3. **Test edge functions**
   ```bash
   supabase functions serve
   # Call from frontend or curl
   ```

---

## Connecting to Remote Environments

### Development Environment

Use the development Supabase project for shared testing:

```env
VITE_SUPABASE_URL="https://dev-project.supabase.co"
VITE_SUPABASE_ANON_KEY="dev-anon-key"
```

### Production Environment

**Never develop against production.** But for debugging:

```env
# Use read-only access only
VITE_SUPABASE_URL="https://prod-project.supabase.co"
VITE_SUPABASE_ANON_KEY="prod-anon-key"
```

---

## Troubleshooting Checklist

If something isn't working, check these in order:

1. [ ] Is Node.js 18+ installed? `node --version`
2. [ ] Are dependencies installed? `npm install`
3. [ ] Does `.env` file exist with correct values?
4. [ ] Is the dev server running? `npm run dev`
5. [ ] Is Supabase running (if using local)? `supabase status`
6. [ ] Are there console errors in the browser?
7. [ ] Are there terminal errors in the dev server?
8. [ ] Did you try clearing caches? `rm -rf node_modules/.vite`

---

## Getting Help

1. Check this guide and [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md)
2. Search existing issues in the repository
3. Ask in the team chat
4. File an issue with:
   - What you're trying to do
   - What you expected to happen
   - What actually happened
   - Error messages and logs

---

## Next Steps

- [COMMON_TASKS.md](./COMMON_TASKS.md) — How to do common development tasks
- [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md) — Troubleshooting and debugging
- [REPO_TOUR.md](./REPO_TOUR.md) — Understand the codebase structure
