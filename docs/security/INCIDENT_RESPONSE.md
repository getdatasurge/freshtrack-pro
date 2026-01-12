# Incident Response

> Detection, containment, recovery, and postmortem procedures

---

## Document Information

| Attribute | Value |
|-----------|-------|
| Document Owner | Security Lead |
| Last Updated | 2026-01-12 |
| Review Frequency | Semi-annual |
| Test Frequency | Annual tabletop exercise |

---

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1 - Critical** | Active breach, data exfiltration | Immediate (< 15 min) | Credential theft, RLS bypass |
| **P2 - High** | Potential breach, service impact | < 1 hour | Suspicious access, DoS attack |
| **P3 - Medium** | Security weakness, limited impact | < 4 hours | Vulnerability discovered, failed attacks |
| **P4 - Low** | Minor issue, informational | < 24 hours | Policy violation, audit finding |

### Incident Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Unauthorized Access** | Access beyond permissions | Tenant escape, privilege escalation |
| **Data Breach** | Data exposure or theft | Customer data leak, API key exposure |
| **Service Disruption** | Availability impact | DoS, infrastructure failure |
| **Malware/Compromise** | System infection | Compromised credentials, malicious code |
| **Policy Violation** | Non-compliance | Improper access, audit failure |

---

## Response Team

### Roles and Responsibilities

| Role | Primary Responsibility | Backup |
|------|----------------------|--------|
| **Incident Commander** | Overall coordination, decisions | Engineering Lead |
| **Security Lead** | Technical investigation, containment | Senior Developer |
| **Communications Lead** | Customer/stakeholder updates | Product Manager |
| **Engineering Lead** | Technical remediation | On-call Engineer |
| **Legal Counsel** | Regulatory compliance | External Counsel |

### Escalation Path

```
P4 → On-call Engineer (monitor)
P3 → Security Lead (investigate)
P2 → Incident Commander + Security Lead (respond)
P1 → Full Response Team (all hands)
```

### Contact Information

| Role | Contact Method | Availability |
|------|---------------|--------------|
| Security Lead | **[TBD - Add contact]** | 24/7 for P1/P2 |
| On-call Engineer | **[TBD - PagerDuty/Opsgenie]** | 24/7 |
| Incident Commander | **[TBD - Add contact]** | Business hours + P1 |

---

## Phase 1: Detection

### Detection Sources

| Source | What It Detects | Alert Mechanism |
|--------|-----------------|-----------------|
| Supabase Logs | Auth failures, errors | Dashboard monitoring |
| Edge Function Logs | Application errors | Log aggregation |
| Event Logs Table | Business anomalies | Periodic review |
| Customer Reports | Visible issues | Support channel |
| External Scanners | Vulnerabilities | Scheduled scans |
| Platform Alerts | Infrastructure issues | Supabase status |

### Detection Indicators

#### High Confidence Indicators

| Indicator | Likely Incident | Action |
|-----------|-----------------|--------|
| Multiple failed logins from one IP | Brute force attack | Block IP, investigate |
| Cross-org data in logs | RLS bypass | Escalate immediately |
| Unexpected service role usage | Credential theft | Rotate keys, investigate |
| Webhook failures spike | Attack or misconfiguration | Validate secrets |

#### Medium Confidence Indicators

| Indicator | Possible Incident | Action |
|-----------|-------------------|--------|
| Unusual login times/locations | Account compromise | Verify with user |
| High API request volume | DoS or scraping | Review rate limits |
| New admin user created | Privilege escalation | Audit user creation |
| Configuration changes | Unauthorized change | Verify with admins |

### Initial Triage Checklist

```markdown
## Triage Checklist

- [ ] What was detected and when?
- [ ] What systems are affected?
- [ ] Is the attack ongoing?
- [ ] What data may be exposed?
- [ ] Are customers impacted?
- [ ] What is the preliminary severity (P1-P4)?
- [ ] Who needs to be notified?
```

---

## Phase 2: Containment

### Immediate Actions by Incident Type

#### Credential Compromise

```
1. Identify compromised credentials
2. Revoke/rotate affected credentials:
   - User password: Force password reset
   - API key: Regenerate in Supabase
   - Webhook secret: Regenerate + update integrations
   - Service role key: Contact Supabase support
3. Invalidate active sessions
4. Block suspicious IPs (if identifiable)
5. Preserve logs for investigation
```

#### Data Breach

```
1. Identify scope of exposure
2. If ongoing: Disable affected endpoints
3. Preserve evidence (logs, database state)
4. Document what data was accessed
5. Identify affected customers
6. Assess regulatory notification requirements
```

#### DoS Attack

```
1. Identify attack vector
2. Enable enhanced rate limiting
3. Block attacking IPs/ranges
4. Scale infrastructure if possible
5. Monitor for attack pattern changes
6. Consider CDN-level mitigation
```

#### RLS Bypass / Tenant Escape

```
1. CRITICAL: Disable affected functionality immediately
2. Identify all potentially affected queries
3. Audit logs for unauthorized access
4. Notify affected tenants
5. Preserve full database state for analysis
6. Review and fix RLS policies
```

### Containment Commands

#### Rotate Supabase Secrets

```bash
# API keys - via Supabase Dashboard
# Settings → API → Regenerate Keys

# JWT secret rotation - Contact Supabase Support
# This invalidates ALL sessions
```

#### Block User Access

```sql
-- Disable specific user (preserves data)
UPDATE auth.users
SET banned_until = 'infinity'
WHERE id = 'user-uuid-here';

-- Or delete session
DELETE FROM auth.sessions
WHERE user_id = 'user-uuid-here';
```

#### Emergency RLS Policy

```sql
-- If RLS bypass suspected, add emergency deny-all
CREATE POLICY "emergency_lockdown"
ON affected_table
AS RESTRICTIVE
FOR ALL
USING (false);

-- Remember to drop after investigation
-- DROP POLICY "emergency_lockdown" ON affected_table;
```

### Evidence Preservation

| Evidence | Collection Method | Retention |
|----------|------------------|-----------|
| Database logs | Supabase export | 90 days minimum |
| Edge function logs | Supabase export | 90 days minimum |
| Event logs table | Database backup | Permanent |
| Network logs | Supabase/CDN logs | As available |
| Timeline of actions | Incident document | Permanent |

---

## Phase 3: Eradication

### Root Cause Analysis

```markdown
## Root Cause Template

1. **What happened?**
   - Factual description of the incident

2. **How did it happen?**
   - Attack vector or failure mode
   - Vulnerabilities exploited

3. **Why wasn't it prevented?**
   - Control gaps
   - Detection failures

4. **What data/systems were affected?**
   - Scope of impact
   - Customer impact

5. **Timeline of events**
   - Detection time
   - Response time
   - Resolution time
```

### Remediation Checklist

```markdown
## Remediation Checklist

- [ ] Vulnerability identified and understood
- [ ] Fix developed and tested
- [ ] Fix deployed to production
- [ ] Verification that fix works
- [ ] Similar vulnerabilities identified and fixed
- [ ] Detection improved for future incidents
- [ ] Credentials rotated (if applicable)
- [ ] Affected users notified (if applicable)
```

### Common Remediation Actions

| Issue | Remediation |
|-------|-------------|
| Weak RLS policy | Rewrite policy, audit similar |
| Missing input validation | Add validation, review endpoints |
| Exposed credentials | Rotate all affected, add scanning |
| Missing rate limiting | Implement application-level limits |
| Insufficient logging | Add logging for blind spots |

---

## Phase 4: Recovery

### Recovery Procedures

#### Service Restoration

```markdown
1. Verify eradication is complete
2. Remove emergency controls (if applied)
3. Restore normal operations
4. Monitor for incident recurrence
5. Confirm functionality with smoke tests
```

#### Customer Communication

| Scenario | Communication |
|----------|---------------|
| No customer impact | Internal documentation only |
| Service disruption | Status page update |
| Data exposure (specific users) | Direct notification to affected |
| Data breach (broad) | Public notification + regulatory |

#### Regulatory Notification

| Regulation | Notification Requirement | Timeline |
|------------|-------------------------|----------|
| GDPR | Data breach to supervisory authority | 72 hours |
| State laws (varies) | Consumer notification | Varies by state |
| Industry specific | Per contractual requirements | Per contract |

### Recovery Verification

```markdown
## Recovery Checklist

- [ ] All affected systems restored
- [ ] Monitoring confirms normal operation
- [ ] No indicators of persistence
- [ ] Customer impact resolved
- [ ] Communications completed
- [ ] Documentation updated
```

---

## Phase 5: Postmortem

### Postmortem Process

```
1. Schedule postmortem meeting (within 5 business days)
2. Gather all timeline and evidence
3. Conduct blameless review
4. Document findings
5. Identify action items
6. Assign owners and deadlines
7. Share learnings (as appropriate)
```

### Postmortem Template

```markdown
# Security Incident Postmortem

## Incident Summary
- **Date/Time:**
- **Duration:**
- **Severity:**
- **Incident Commander:**

## What Happened
[Factual description]

## Timeline
| Time | Event |
|------|-------|
| | Detection |
| | Containment began |
| | Root cause identified |
| | Fix deployed |
| | Incident closed |

## Impact
- **Users Affected:**
- **Data Exposed:**
- **Service Downtime:**
- **Financial Impact:**

## Root Cause
[Technical explanation]

## What Went Well
- [List positives]

## What Went Poorly
- [List improvements needed]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | |

## Lessons Learned
[Key takeaways]
```

### Action Item Tracking

| Priority | Timeline | Example Actions |
|----------|----------|-----------------|
| Critical | 24 hours | Emergency patches, key rotation |
| High | 1 week | Security control additions |
| Medium | 1 month | Process improvements |
| Low | 1 quarter | Documentation updates |

---

## Communication Templates

### Internal Escalation

```
SECURITY INCIDENT - [P1/P2/P3/P4]

What: [Brief description]
When: [Detection time]
Impact: [Current assessment]
Status: [Detection/Containment/Eradication/Recovery]

Next Steps:
- [Immediate actions]

Requested:
- [Any assistance needed]
```

### Customer Notification (Data Breach)

```
Subject: Important Security Notice from FreshTrack Pro

Dear [Customer],

We are writing to inform you of a security incident that may
have affected your data.

**What Happened:**
[Clear, factual description]

**What Information Was Involved:**
[Specific data types]

**What We Are Doing:**
[Remediation steps]

**What You Can Do:**
[Recommended actions]

**For More Information:**
[Contact details]

We apologize for this incident and are committed to protecting
your data. If you have questions, please contact [support].

Sincerely,
[Name]
FreshTrack Pro Security Team
```

### Status Page Update

```
[TIMESTAMP] - Investigating increased error rates
[TIMESTAMP] - Identified issue, implementing fix
[TIMESTAMP] - Fix deployed, monitoring
[TIMESTAMP] - Incident resolved, all systems normal
```

---

## Tabletop Exercises

### Exercise Schedule

| Exercise Type | Frequency | Participants |
|---------------|-----------|--------------|
| Tabletop scenario | Quarterly | Response team |
| Technical drill | Semi-annual | Engineering |
| Full simulation | Annual | All stakeholders |

### Sample Scenarios

1. **Credential Stuffing Attack**
   - Large volume of failed logins detected
   - Some accounts may be compromised
   - Practice: Detection, containment, communication

2. **RLS Policy Bypass**
   - Customer reports seeing another org's data
   - Practice: Immediate containment, investigation

3. **Webhook Secret Exposure**
   - TTN webhook secret found in public log
   - Practice: Rotation, impact assessment

4. **Ransomware Scenario**
   - Supabase account access compromised
   - Practice: Escalation, recovery from backup

---

## Metrics and Improvement

### Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mean Time to Detect (MTTD) | < 1 hour (P1) | Detection time - incident start |
| Mean Time to Contain (MTTC) | < 4 hours (P1) | Containment time - detection |
| Mean Time to Recover (MTTR) | < 24 hours (P1) | Recovery time - detection |
| Postmortem completion | 100% (P1-P2) | Days to complete |
| Action item closure | 90% on time | Per due date |

### Continuous Improvement

After each incident:
1. Update runbooks with lessons learned
2. Improve detection for similar incidents
3. Enhance automated response where possible
4. Train team on new procedures
5. Update this document as needed

---

## Related Documents

- [SECURITY_OVERVIEW.md](./SECURITY_OVERVIEW.md) — High-level security architecture
- [AUTH_MODEL.md](./AUTH_MODEL.md) — Authentication and authorization
- [DATA_PROTECTION.md](./DATA_PROTECTION.md) — Encryption and secrets
- [THREAT_MODEL.md](./THREAT_MODEL.md) — Threats and mitigations
