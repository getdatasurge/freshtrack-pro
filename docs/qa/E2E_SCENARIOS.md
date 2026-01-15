# End-to-End Test Scenarios

> Critical user flows with full preconditions, steps, and expected results

---

## Overview

These scenarios represent the most critical user journeys through FreshTrack Pro. Each scenario should be executed completely to validate system behavior under real-world conditions.

### Scenario Priority Levels

| Level | Description | Testing Frequency |
|-------|-------------|-------------------|
| **P0** | Business-critical, safety-impacting | Every release |
| **P1** | Core functionality | Every release |
| **P2** | Important features | Major releases |
| **P3** | Nice-to-have | Quarterly |

---

## Scenario 1: New Customer Onboarding (P0)

### Description
A new customer signs up, configures their organization, connects TTN, provisions their first device, and receives their first temperature reading.

### Preconditions
- Fresh test account (not previously registered)
- Valid TTN application with API key
- Physical gateway and sensor (or simulator)
- Email access for verification

### Test Data Required
```
Email: test-{timestamp}@example.com
TTN Application ID: test-freshtrack-app
TTN API Key: NNSXS.xxx... (with full permissions)
Gateway EUI: AABBCCDDEEFF0011
Sensor DevEUI: 0011223344556677
Sensor AppKey: 00112233445566778899AABBCCDDEEFF
```

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Navigate to `/auth` | Sign-up form displays | |
| 2 | Create account with test email | Account created, redirect to onboarding | |
| 3 | Complete onboarding wizard (org, site, area, unit) | Organization structure created | |
| 4 | Navigate to Settings → TTN | TTN settings page shows "Not Connected" | |
| 5 | Enter TTN Application ID | Field accepts input | |
| 6 | Enter TTN API Key | Field accepts input (masked) | |
| 7 | Click "Validate Connection" | Permission validation runs | |
| 8 | Verify all permissions valid | Green checkmarks for all permissions | |
| 9 | Click "Save Configuration" | Configuration saved, webhook created | |
| 10 | Navigate to Settings → Gateways | Gateway list shows (empty) | |
| 11 | Add gateway with test EUI | Gateway created in "pending" status | |
| 12 | Click "Provision to TTN" | Provisioning starts | |
| 13 | Wait for provisioning | Status changes to "active" | |
| 14 | Navigate to Settings → Sensors | Sensor list shows (empty) | |
| 15 | Add sensor with test DevEUI/AppKey | Sensor created in "pending" status | |
| 16 | Assign sensor to unit | Sensor assigned | |
| 17 | Click "Provision to TTN" | Provisioning starts | |
| 18 | Wait for device to join | Status changes to "joining" then "active" | |
| 19 | Navigate to Dashboard | Dashboard shows unit | |
| 20 | Wait for first reading (~5 min) | Temperature value appears on unit card | |
| 21 | Click on unit card | Unit detail page shows temperature graph | |

### Success Criteria
- [ ] Account created successfully
- [ ] Organization structure visible
- [ ] TTN webhook verified in TTN Console
- [ ] Gateway visible in TTN Console
- [ ] Sensor visible in TTN Console
- [ ] First temperature reading received within 10 minutes
- [ ] Temperature displays correctly on dashboard

### Failure Handling

| Failure Point | Recovery Action |
|---------------|-----------------|
| TTN validation fails | Verify API key permissions in TTN Console |
| Gateway provisioning fails | Check Gateway EUI format, verify not already registered |
| Sensor won't join | Verify AppKey matches, check gateway is online |
| No readings received | Check TTN Live Data tab, verify webhook URL |

---

## Scenario 2: Temperature Excursion Alert Lifecycle (P0)

### Description
A refrigerator temperature rises above threshold, triggering an alert that is acknowledged and then resolves when temperature returns to normal.

### Preconditions
- Unit with active sensor
- Alert rule configured (e.g., max 40°F)
- Notification policy with email enabled
- Escalation contacts configured

### Test Data Required
```
Unit: Test Cooler
Max Temperature Threshold: 40°F (4.4°C)
Confirm Time: 5 minutes
Escalation Delay: 15 minutes
Primary Contact: primary@test.com
Secondary Contact: secondary@test.com
```

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Verify unit shows "OK" status | Dashboard shows green status | |
| 2 | Cause temperature to rise above 40°F | (Use simulator or physical test) | |
| 3 | Wait 1 minute | Unit status may show "excursion" | |
| 4 | Wait for confirm time (5 min) | Alert status changes to "triggered" | |
| 5 | Check primary contact email | Alert notification received | |
| 6 | Verify notification content | Contains unit name, temperature, timestamp | |
| 7 | Navigate to `/alerts` | Alert appears in active list | |
| 8 | Click on alert row | Alert detail displays | |
| 9 | Verify alert details | Type, severity, timestamps correct | |
| 10 | Click "Acknowledge" | Acknowledgment dialog appears | |
| 11 | Enter note: "Investigating issue" | Note field accepts input | |
| 12 | Confirm acknowledgment | Alert status changes to "acknowledged" | |
| 13 | Verify escalation stopped | Secondary contact NOT notified yet | |
| 14 | Return temperature to normal | (Use simulator or physical test) | |
| 15 | Wait for next processing cycle | Alert auto-resolves | |
| 16 | Verify alert resolved | Status shows "resolved" in history | |
| 17 | Verify unit status | Dashboard shows "OK" again | |

### Success Criteria
- [ ] Alert triggered after confirm time
- [ ] Email notification delivered within 2 minutes of trigger
- [ ] Notification contains accurate information
- [ ] Acknowledgment stops escalation
- [ ] Alert resolves when condition clears
- [ ] Full audit trail preserved

### Failure Handling

| Failure Point | Recovery Action |
|---------------|-----------------|
| Alert not triggered | Check `process-unit-states` logs, verify alert rules |
| Email not received | Check spam, verify notification policy, check Resend logs |
| Alert won't resolve | Verify temperature actually below threshold, check processing |

---

## Scenario 3: Alert Escalation Chain (P0)

### Description
An alert is triggered but not acknowledged, causing automatic escalation through the contact chain.

### Preconditions
- Alert rule configured
- Notification policy with escalation enabled
- Multiple escalation levels configured:
  - Level 1: primary@test.com (0 min delay)
  - Level 2: manager@test.com (15 min delay)
  - Level 3: director@test.com (30 min delay)

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Trigger temperature excursion | Alert created | |
| 2 | Wait for confirm time | Alert status: "triggered" | |
| 3 | Check Level 1 email | Notification received | |
| 4 | **Do NOT acknowledge** | Alert remains triggered | |
| 5 | Wait 15 minutes | Escalation timer runs | |
| 6 | Check Level 2 email | Escalation notification received | |
| 7 | Verify escalation flag | Alert shows "escalated" | |
| 8 | **Do NOT acknowledge** | Alert remains triggered | |
| 9 | Wait 15 more minutes (30 total) | Second escalation | |
| 10 | Check Level 3 email | Second escalation notification received | |
| 11 | Acknowledge as Level 3 | Alert acknowledged | |
| 12 | Verify acknowledgment record | Shows who acknowledged, timestamp | |

### Success Criteria
- [ ] Each escalation level notified at correct time
- [ ] Escalation notifications include escalation context
- [ ] Acknowledgment at any level stops further escalation
- [ ] Full escalation history preserved

### Timing Diagram

```
0 min     5 min     15 min    30 min
  |         |         |         |
  |--Confirm--|--Wait---|--Wait---|
  |           |         |         |
              |         |         |
            Alert     Level 2   Level 3
           Triggers   Notified  Notified
           Level 1
           Notified
```

---

## Scenario 4: Offline Manual Logging with Sync (P1)

### Description
Staff logs temperature manually while offline, data syncs when connectivity returns.

### Preconditions
- Unit exists with manual logging enabled
- Staff user account
- Mobile device with app access

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Log in on mobile device | Dashboard loads | |
| 2 | Navigate to Manual Log | Manual log page displays | |
| 3 | Enable airplane mode | Device offline | |
| 4 | Verify offline indicator | "Offline" badge appears | |
| 5 | Select unit from dropdown | Unit selected (cached) | |
| 6 | Enter temperature: 38°F | Input accepted | |
| 7 | Add note: "Visual check" | Note accepted | |
| 8 | Tap "Log Temperature" | Success with "pending sync" | |
| 9 | Repeat for 2 more entries | All stored locally | |
| 10 | Disable airplane mode | Device online | |
| 11 | Wait for sync | Sync indicator appears | |
| 12 | Verify sync complete | "Pending" badges clear | |
| 13 | Check unit detail page | All 3 entries appear in history | |
| 14 | Verify timestamps | Original entry times preserved | |

### Success Criteria
- [ ] Offline logging works without errors
- [ ] All entries synced without data loss
- [ ] Original timestamps preserved
- [ ] Entries appear in correct chronological order

### Failure Handling

| Failure Point | Recovery Action |
|---------------|-----------------|
| Offline mode not working | Check service worker registration, clear cache |
| Sync fails | Check network, retry sync, examine IndexedDB |
| Entries missing | Check local storage, check for sync conflicts |

---

## Scenario 5: Multi-Location Monitoring (P1)

### Description
Regional manager monitors multiple locations, receives alerts from different sites, and generates consolidated reports.

### Preconditions
- Organization with 3+ sites configured
- Units at each site with sensors
- Regional manager account with access to all sites
- Alert rules configured for each site

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Log in as regional manager | Dashboard loads | |
| 2 | Verify all sites visible | 3+ sites displayed | |
| 3 | Verify aggregate status | Overall org status shows | |
| 4 | Click on Site A | Site detail page shows | |
| 5 | Verify Site A units | Units list displays | |
| 6 | Navigate back to dashboard | Dashboard displays | |
| 7 | Click on Site B | Site B detail page shows | |
| 8 | Trigger alert at Site A | (Background action) | |
| 9 | Refresh dashboard | Alert indicator appears for Site A | |
| 10 | Click alert notification | Navigate to alert | |
| 11 | Acknowledge alert | Alert acknowledged | |
| 12 | Navigate to Reports | Reports page displays | |
| 13 | Select "All Sites" | Multi-site scope selected | |
| 14 | Select last 7 days | Date range set | |
| 15 | Generate compliance report | Report generates | |
| 16 | Verify all sites in report | Data from all 3 sites included | |
| 17 | Export PDF | PDF downloads | |
| 18 | Verify PDF content | All site data in document | |

### Success Criteria
- [ ] All sites accessible from single dashboard
- [ ] Aggregate status accurate
- [ ] Alerts visible regardless of source site
- [ ] Cross-site reports generate correctly

---

## Scenario 6: Device Failure and Recovery (P1)

### Description
A sensor goes offline, triggers monitoring interrupt alert, and then recovers when replaced.

### Preconditions
- Unit with active sensor
- Monitoring interrupt rule enabled (e.g., offline > 30 min)
- Replacement sensor available

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Verify sensor is "active" | Dashboard shows normal status | |
| 2 | Simulate sensor failure | (Power off or remove battery) | |
| 3 | Wait 30 minutes | Sensor goes offline | |
| 4 | Verify sensor status | Status changes to "offline" | |
| 5 | Verify unit status | Shows "monitoring_interrupted" | |
| 6 | Check for alert | "Monitoring Interrupted" alert created | |
| 7 | Check notification | Alert notification received | |
| 8 | Navigate to Settings → Sensors | Sensor shows offline | |
| 9 | Deprovision failed sensor | Sensor removed from TTN | |
| 10 | Add replacement sensor | New sensor added | |
| 11 | Provision replacement | Sensor provisioned to TTN | |
| 12 | Assign to unit | Sensor assigned | |
| 13 | Power on replacement sensor | Device joins network | |
| 14 | Wait for first reading | Reading received | |
| 15 | Verify unit status | Returns to "OK" | |
| 16 | Verify original alert | Should auto-resolve | |

### Success Criteria
- [ ] Offline detection works within expected timeframe
- [ ] Monitoring interrupt alert triggers
- [ ] Sensor replacement process works
- [ ] Unit status recovers automatically

---

## Scenario 7: Health Inspection Report (P1)

### Description
Generate compliance documentation for a health inspector requesting 90 days of temperature records.

### Preconditions
- 90+ days of temperature data
- Some alerts during period (for realistic testing)
- Admin or manager account

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Navigate to Reports | Reports page displays | |
| 2 | Select "Compliance Report" | Report type selected | |
| 3 | Set date range: last 90 days | Date range set | |
| 4 | Select specific site | Site scope set | |
| 5 | Click "Generate Report" | Report loading starts | |
| 6 | Wait for completion | Report displays | |
| 7 | Verify summary section | Total readings, alert count | |
| 8 | Verify reading counts | Expected number present | |
| 9 | Verify alert history | Alerts listed with resolution | |
| 10 | Verify corrective actions | Actions documented | |
| 11 | Click "Export PDF" | PDF generates | |
| 12 | Download PDF | File downloads | |
| 13 | Open PDF | Content renders correctly | |
| 14 | Verify all sections present | Summary, data, alerts, actions | |
| 15 | Verify timestamps | All in correct timezone | |

### Success Criteria
- [ ] Report generates within 30 seconds
- [ ] All 90 days of data included
- [ ] Alert history complete
- [ ] PDF professional and print-ready
- [ ] Data matches on-screen display

---

## Scenario 8: Billing and Plan Upgrade (P2)

### Description
Customer upgrades from Starter to Pro plan to add more sensors.

### Preconditions
- Account on Starter plan
- Stripe test mode enabled
- Test card numbers available

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Navigate to Settings → Billing | Billing page displays | |
| 2 | Verify current plan | Shows "Starter" | |
| 3 | Click "Upgrade Plan" | Plan selection appears | |
| 4 | Select "Pro" plan | Pro features highlighted | |
| 5 | Click "Continue" | Stripe checkout opens | |
| 6 | Enter test card: 4242... | Card accepted | |
| 7 | Complete checkout | Payment processes | |
| 8 | Return to app | Success message | |
| 9 | Verify plan updated | Shows "Pro" | |
| 10 | Verify sensor limit increased | Limit shows 25 | |
| 11 | Add sensor beyond old limit | Sensor added successfully | |
| 12 | Check Stripe dashboard | Subscription active | |

### Success Criteria
- [ ] Checkout flow completes
- [ ] Plan updates immediately
- [ ] New limits take effect
- [ ] Stripe webhook processed correctly

---

## Scenario 9: User Role and Permission Changes (P2)

### Description
Admin invites new user, assigns role, and verifies permission enforcement.

### Preconditions
- Admin account
- New user email for invitation

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Log in as admin | Dashboard displays | |
| 2 | Navigate to Settings → Users | User list displays | |
| 3 | Click "Invite User" | Invitation form opens | |
| 4 | Enter new user email | Email accepted | |
| 5 | Select role: "Staff" | Role selected | |
| 6 | Send invitation | Invitation sent | |
| 7 | Check new user email | Invitation received | |
| 8 | Accept invitation (new session) | Account created | |
| 9 | Log in as new staff user | Dashboard displays | |
| 10 | Verify dashboard access | Units visible | |
| 11 | Try to access Settings → TTN | Access denied | |
| 12 | Try to delete a unit | Action blocked | |
| 13 | Log temperature manually | Action succeeds | |
| 14 | Acknowledge an alert | Action succeeds | |
| 15 | Log back in as admin | Admin dashboard | |
| 16 | Change user role to Manager | Role updated | |
| 17 | Log back in as user | Role change reflected | |
| 18 | Verify expanded permissions | Settings access granted | |

### Success Criteria
- [ ] Invitation flow works
- [ ] Role restrictions enforced immediately
- [ ] Role changes take effect without re-login
- [ ] No permission leakage

---

## Scenario 10: Data Integrity Under Load (P2)

### Description
Verify system handles high-frequency sensor readings without data loss.

### Preconditions
- Sensor simulator available
- Ability to send rapid readings

### Steps

| # | Action | Expected Result | Actual Result |
|---|--------|-----------------|---------------|
| 1 | Configure simulator for 10 sensors | Simulator ready | |
| 2 | Set reading frequency: 1 per minute | Fast mode enabled | |
| 3 | Start simulator | Readings begin flowing | |
| 4 | Run for 30 minutes | 300+ readings generated | |
| 5 | Stop simulator | Readings stop | |
| 6 | Query database: count readings | Should match sent count | |
| 7 | Verify no duplicates | No duplicate timestamps | |
| 8 | Verify no gaps | Sequential readings present | |
| 9 | Check dashboard performance | Still responsive | |
| 10 | Generate report for period | Report includes all data | |

### Success Criteria
- [ ] 100% of sent readings stored
- [ ] No duplicate entries
- [ ] Dashboard remains responsive
- [ ] No webhook failures (check TTN logs)

---

## Test Session Log Template

```markdown
## E2E Test Session

**Date:** YYYY-MM-DD HH:MM
**Tester:** [Name]
**Environment:** [Staging/Local]
**Scenario:** [Scenario Name]

### Execution Log

| Step | Start Time | Status | Notes |
|------|------------|--------|-------|
| 1    | HH:MM      | Pass   |       |
| 2    | HH:MM      | Pass   |       |
| 3    | HH:MM      | FAIL   | [Details] |

### Failure Details
[Detailed description of any failures]

### Screenshots
[Attach relevant screenshots]

### Environment Notes
- Browser:
- Device:
- Network conditions:

### Sign-off
- [ ] All steps completed
- [ ] All success criteria verified
- [ ] Issues documented and reported
```

---

## Related Documents

- [TEST_STRATEGY.md](./TEST_STRATEGY.md) — Overall testing philosophy
- [COVERAGE_MAP.md](./COVERAGE_MAP.md) — Feature-to-test mapping
- [MANUAL_TESTING.md](./MANUAL_TESTING.md) — Step-by-step manual QA checklists
- [KNOWN_GAPS.md](./KNOWN_GAPS.md) — Missing coverage and risks
