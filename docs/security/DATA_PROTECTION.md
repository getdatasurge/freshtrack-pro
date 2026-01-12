# Data Protection

> Encryption, secrets management, and data handling practices

---

## Data Classification

### Classification Scheme

| Level | Description | Examples | Controls |
|-------|-------------|----------|----------|
| **Secret** | Credentials, keys | API keys, passwords | Encrypted, never logged |
| **Confidential** | Sensitive business data | Customer data, configs | Encrypted, access controlled |
| **Internal** | Operational data | Temperature readings | RLS protected |
| **Public** | Non-sensitive | Marketing content | Standard controls |

### Data Inventory

| Data Type | Classification | Storage | Encryption |
|-----------|---------------|---------|------------|
| User passwords | Secret | Supabase Auth | bcrypt hashed |
| TTN API keys | Secret | `ttn_connections` | Application-level |
| Webhook secrets | Secret | `ttn_connections` | Application-level |
| Stripe keys | Secret | Environment only | Not stored in DB |
| Temperature readings | Internal | `sensor_readings` | At rest (platform) |
| Organization info | Confidential | `organizations` | At rest (platform) |
| User profiles | Confidential | `profiles` | At rest (platform) |

---

## Encryption at Rest

### Platform-Level Encryption

Supabase provides transparent encryption for all database storage:

| Component | Encryption | Key Management |
|-----------|------------|----------------|
| PostgreSQL data files | AES-256 | Supabase managed |
| PostgreSQL WAL | AES-256 | Supabase managed |
| Backups | AES-256 | Supabase managed |
| Blob storage | AES-256 | Supabase managed |

### Application-Level Encryption

Sensitive fields receive additional application-level encryption:

#### Encrypted Fields

| Table | Field | Encryption Method |
|-------|-------|-------------------|
| `ttn_connections` | `ttn_api_key_encrypted` | XOR v2 |
| `ttn_connections` | `ttn_webhook_secret_encrypted` | XOR v2 |
| `ttn_connections` | `ttn_gateway_api_key_encrypted` | XOR v2 |
| `ttn_connections` | `ttn_org_api_key_encrypted` | XOR v2 |

#### Encryption Algorithm (v2 Format)

```typescript
// Location: supabase/functions/_shared/ttnConfig.ts

function obfuscateKey(key: string, salt: string): string {
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key);
    const saltBytes = encoder.encode(salt);

    const obfuscated = new Uint8Array(keyBytes.length);
    for (let i = 0; i < keyBytes.length; i++) {
        obfuscated[i] = keyBytes[i] ^ saltBytes[i % saltBytes.length];
    }

    return "v2:" + btoa(String.fromCharCode(...obfuscated));
}
```

**Key Derivation:**
- Salt source: `TTN_ENCRYPTION_SALT` environment variable
- Fallback: First 32 characters of `SUPABASE_SERVICE_ROLE_KEY`
- Format prefix: `v2:` for version identification

#### Decryption

```typescript
function deobfuscateKey(encoded: string, salt: string): string {
    // Handle v2 format
    if (encoded.startsWith("v2:")) {
        const decoded = atob(encoded.slice(3));
        // XOR with salt to recover original
        // ...
    }
    // Legacy format fallback
    // ...
}
```

### Display Safety

For user interface display, only the last 4 characters are shown:

| Stored Field | Display Field | Example |
|--------------|--------------|---------|
| `ttn_api_key_encrypted` | `ttn_api_key_last4` | `•••••A1B2` |
| `ttn_webhook_secret_encrypted` | (computed) | `•••••X9Y8` |

---

## Encryption in Transit

### TLS Configuration

All communications use TLS 1.3:

| Connection | TLS Version | Certificate |
|------------|-------------|-------------|
| Browser → CDN | TLS 1.3 | Supabase managed |
| CDN → Edge Functions | TLS 1.3 | Internal |
| Edge Functions → Database | TLS 1.3 | Internal |
| Application → TTN | TLS 1.3 | TTN certificate |
| Application → Stripe | TLS 1.3 | Stripe certificate |

### API Security Headers

```typescript
// Applied to all responses
{
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
}
```

---

## Secrets Management

### Secret Categories

| Category | Examples | Storage Location |
|----------|----------|------------------|
| **Platform secrets** | Database password, JWT secret | Supabase Vault |
| **Integration secrets** | TTN admin key, Stripe secret | Environment variables |
| **Per-org secrets** | TTN app keys, webhook secrets | Database (encrypted) |
| **User secrets** | Passwords | Supabase Auth |

### Environment Variables

#### Frontend (Exposed to Browser)

```env
# .env - VITE_ prefix exposes to browser
VITE_SUPABASE_PROJECT_ID=xxxxx
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJS...  # Public anon key (safe)
```

**Security Note:** `VITE_` prefixed variables are bundled into client-side code. Never put secrets here.

#### Backend (Server-Side Only)

```env
# Edge function secrets (never exposed to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJS...  # Privileged access
TTN_ADMIN_API_KEY=NNSXS.xxxxx             # TTN admin operations
TTN_ENCRYPTION_SALT=xxxxxxxx              # Encryption salt
STRIPE_SECRET_KEY=sk_live_xxxxx           # Stripe API
STRIPE_WEBHOOK_SECRET=whsec_xxxxx         # Stripe webhook
INTERNAL_API_KEY=xxxxx                     # Internal service calls
DEVICE_INGEST_API_KEY=xxxxx               # Device data ingestion
```

### Secret Rotation

| Secret Type | Rotation Method | Frequency |
|-------------|-----------------|-----------|
| Database password | Supabase dashboard | On compromise |
| JWT secret | Supabase dashboard | On compromise |
| TTN API keys | Manual re-provisioning | On compromise |
| Stripe keys | Stripe dashboard | On compromise |
| Webhook secrets | Regenerate + update DB | On compromise |

### Secret Access Patterns

```typescript
// Correct: Server-side secret access
const apiKey = Deno.env.get("TTN_ADMIN_API_KEY");

// Incorrect: Never log secrets
console.log("API Key:", apiKey);  // NEVER DO THIS

// Acceptable: Log last 4 for debugging
console.log("Using key ending in:", apiKey.slice(-4));
```

---

## CI/CD Security

### Build-Time Security

| Check | Tool | Stage |
|-------|------|-------|
| Secret scanning | **TBD** | Pre-commit |
| Dependency audit | `npm audit` | Build |
| Type checking | TypeScript | Build |
| Linting | ESLint | Build |

### Deployment Security

| Environment | Secret Injection | Method |
|-------------|-----------------|--------|
| Development | `.env` file | Local only, gitignored |
| Staging | Supabase Secrets | Dashboard/CLI |
| Production | Supabase Secrets | Dashboard/CLI |

### Gitignore Rules

```gitignore
# Secrets - NEVER commit
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json

# Supabase local
supabase/.branches
supabase/.temp
```

### Secret Exposure Prevention

| Control | Implementation |
|---------|----------------|
| Pre-commit hooks | **TBD** - Recommend git-secrets |
| Branch protection | **TBD** - Configure in repository |
| Secret scanning | **TBD** - GitHub secret scanning |
| Audit logging | Supabase audit logs |

---

## Sensitive Data Handling

### PII (Personally Identifiable Information)

| Data Type | Collected | Storage | Retention |
|-----------|-----------|---------|-----------|
| Email | Yes | `auth.users` | Account lifetime |
| Name | Optional | `profiles` | Account lifetime |
| Phone | Optional | `escalation_contacts` | Account lifetime |
| IP Address | Logged | `event_logs` | Configurable |

### Data Minimization

- Only collect data necessary for functionality
- Phone numbers only for SMS alerts
- IP addresses only for audit trails

### Data Retention

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Temperature readings | Permanent | N/A (compliance) |
| Alert history | Permanent | N/A (compliance) |
| Audit logs | Permanent | N/A (compliance) |
| Session data | 7 days | Automatic |
| Deleted user data | Immediate cascade | Referential delete |

### Right to Deletion

```sql
-- User deletion cascades through:
-- 1. profiles (FK to auth.users)
-- 2. user_roles (FK to profiles)
-- 3. Organization data remains (other users may exist)

-- Full org deletion required for complete data removal
DELETE FROM organizations WHERE id = ?;
-- Cascades to all related data
```

---

## Database Security

### Connection Security

| Aspect | Configuration |
|--------|---------------|
| Connection encryption | TLS required |
| Connection pooling | Supabase managed |
| Prepared statements | Yes (SQL injection prevention) |
| Query timeouts | Configured |

### RLS as Data Protection

Row Level Security acts as a data protection mechanism:

```sql
-- Users can only see their organization's data
CREATE POLICY "org_isolation" ON sensor_readings
    FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id FROM profiles
            WHERE id = auth.uid()
        )
    );
```

### Privileged Access

| Role | Access Level | Use Case |
|------|-------------|----------|
| `anon` | RLS enforced, limited | Public/unauthenticated |
| `authenticated` | RLS enforced, user context | Normal users |
| `service_role` | Bypasses RLS | Backend services |

**Service Role Protection:**
- Never expose service role key to frontend
- Use only in edge functions for internal operations
- Audit all service role usage

---

## Backup and Recovery

### Backup Configuration

| Aspect | Configuration |
|--------|---------------|
| Frequency | Daily (Supabase managed) |
| Retention | 7 days (configurable) |
| Encryption | AES-256 |
| Location | Same region as database |

### Recovery Procedures

| Scenario | Recovery Method | RTO |
|----------|-----------------|-----|
| Accidental deletion | Point-in-time recovery | Hours |
| Database corruption | Restore from backup | Hours |
| Region failure | Cross-region restore | Hours |

---

## Audit and Compliance

### Audit Trail

```sql
-- Event logs table structure
CREATE TABLE event_logs (
    id UUID PRIMARY KEY,
    organization_id UUID,
    event_type TEXT NOT NULL,
    actor_id UUID,
    actor_type TEXT,  -- 'user' | 'system'
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    previous_hash TEXT,  -- Chain hash for tamper detection
    event_hash TEXT,
    created_at TIMESTAMPTZ
);
```

### Logged Events

| Event Type | Logged Details |
|------------|----------------|
| `user.login` | IP, user agent, success/failure |
| `user.logout` | Session ID |
| `role.change` | Old role, new role, actor |
| `data.export` | Export type, date range |
| `settings.change` | Field changed, old/new values |
| `alert.acknowledge` | Alert ID, actor, note |

### Tamper Detection

Events are hash-chained to detect tampering:

```typescript
// Each event includes hash of previous event
const eventHash = hash(event.id + event.data + previousHash);
```

---

## Security Monitoring

### Log Analysis

| Log Source | Contains | Access |
|------------|----------|--------|
| Supabase logs | Database queries, auth events | Supabase dashboard |
| Edge function logs | Application events | Supabase dashboard |
| Event logs table | Business events | Application |

### Alerting (TBD)

| Condition | Alert | Priority |
|-----------|-------|----------|
| Failed login spike | **TBD** | High |
| Service role access anomaly | **TBD** | High |
| RLS policy bypass attempt | **TBD** | Critical |
| Secret access from new IP | **TBD** | Medium |

---

## Security Hardening Checklist

### Implemented

- [x] TLS for all connections
- [x] Encrypted secrets storage
- [x] RLS on all tables
- [x] Input validation (Zod)
- [x] Prepared statements
- [x] Audit logging
- [x] Service role isolation

### Recommended Enhancements

| Enhancement | Priority | Status |
|-------------|----------|--------|
| Secret scanning in CI | High | TBD |
| Automated key rotation | Medium | TBD |
| Enhanced audit alerting | Medium | TBD |
| Field-level encryption expansion | Low | TBD |
| Hardware security module (HSM) | Low | TBD |

---

## Related Documents

- [SECURITY_OVERVIEW.md](./SECURITY_OVERVIEW.md) — High-level security architecture
- [AUTH_MODEL.md](./AUTH_MODEL.md) — Authentication and authorization
- [THREAT_MODEL.md](./THREAT_MODEL.md) — Threats and mitigations
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) — Security incident procedures
