# Manual Testing Guide

> Step-by-step QA checklists for FreshTrack Pro

---

## How to Use This Guide

1. **Before testing:** Ensure you have access to a test environment
2. **During testing:** Follow each step exactly, check the boxes
3. **After testing:** Document any failures with screenshots
4. **Report issues:** Create tickets with reproduction steps

### Test Environment Requirements

| Requirement | Details |
|-------------|---------|
| Browser | Chrome (latest), Firefox, Safari, Edge |
| Mobile | iOS Safari, Android Chrome |
| Test account | QA account with admin permissions |
| TTN access | Test TTN application (not production) |
| Stripe | Test mode API keys |

---

## Section 1: Authentication & Onboarding

### 1.1 New User Registration

**Preconditions:** Logged out, fresh browser session

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/auth` | Sign in form displays | [ ] |
| 2 | Click "Sign Up" tab | Sign up form displays | [ ] |
| 3 | Enter valid email | Email field accepts input | [ ] |
| 4 | Enter password (< 6 chars) | Error: "Password must be at least 6 characters" | [ ] |
| 5 | Enter valid password (6+ chars) | Password field accepts input | [ ] |
| 6 | Click "Sign Up" | Loading indicator appears | [ ] |
| 7 | Wait for completion | Redirects to onboarding page | [ ] |
| 8 | Check email | Confirmation email received | [ ] |

### 1.2 User Login

**Preconditions:** Registered account exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/auth` | Sign in form displays | [ ] |
| 2 | Enter registered email | Email field accepts input | [ ] |
| 3 | Enter wrong password | Error: "Invalid login credentials" | [ ] |
| 4 | Enter correct password | Password field accepts input | [ ] |
| 5 | Click "Sign In" | Loading indicator appears | [ ] |
| 6 | Wait for completion | Redirects to dashboard | [ ] |

### 1.3 Onboarding Wizard

**Preconditions:** New user, first login

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | After first login | Onboarding wizard appears | [ ] |
| 2 | Enter organization name | Field accepts input | [ ] |
| 3 | Click "Next" | Moves to site creation step | [ ] |
| 4 | Enter site name | Field accepts input | [ ] |
| 5 | Enter site address (optional) | Address field works | [ ] |
| 6 | Click "Next" | Moves to area creation step | [ ] |
| 7 | Enter area name | Field accepts input | [ ] |
| 8 | Click "Next" | Moves to unit creation step | [ ] |
| 9 | Enter unit name | Field accepts input | [ ] |
| 10 | Select unit type | Dropdown works | [ ] |
| 11 | Set temperature range | Min/Max sliders work | [ ] |
| 12 | Click "Complete Setup" | Wizard completes | [ ] |
| 13 | Verify redirect | Dashboard displays with new unit | [ ] |

### 1.4 Password Reset

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/auth` | Sign in form displays | [ ] |
| 2 | Click "Forgot Password" | Reset form appears | [ ] |
| 3 | Enter registered email | Email field accepts input | [ ] |
| 4 | Click "Send Reset Link" | Success message appears | [ ] |
| 5 | Check email | Reset link received | [ ] |
| 6 | Click reset link | Password reset form appears | [ ] |
| 7 | Enter new password | Password accepted | [ ] |
| 8 | Submit | Success message, redirect to login | [ ] |
| 9 | Login with new password | Login successful | [ ] |

---

## Section 2: TTN Configuration

### 2.1 TTN Setup Wizard

**Preconditions:** Logged in as admin, TTN not configured

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → TTN | TTN settings page displays | [ ] |
| 2 | Click "Connect to TTN" | Setup wizard opens | [ ] |
| 3 | Enter TTN Application ID | Field accepts input | [ ] |
| 4 | Enter TTN API Key | Field accepts input (masked) | [ ] |
| 5 | Click "Validate" | Validation starts | [ ] |
| 6 | Wait for validation | Permission report displays | [ ] |
| 7 | If permissions valid | "Configuration Valid" message | [ ] |
| 8 | If permissions invalid | Missing permissions listed | [ ] |
| 9 | Click "Save Configuration" | Configuration saved | [ ] |
| 10 | Verify webhook created | TTN console shows webhook | [ ] |

### 2.2 TTN Permission Validation

**Preconditions:** Have TTN API key with known permissions

| Permission | Required | Test Action | Pass/Fail |
|------------|----------|-------------|-----------|
| `RIGHT_APPLICATION_INFO` | Yes | Validate basic info read | [ ] |
| `RIGHT_APPLICATION_TRAFFIC_READ` | Yes | Required for webhook data | [ ] |
| `RIGHT_APPLICATION_SETTINGS_BASIC` | Yes | Webhook configuration | [ ] |
| `RIGHT_APPLICATION_DEVICES_READ` | Yes | Device listing | [ ] |
| `RIGHT_APPLICATION_DEVICES_WRITE` | Yes | Device provisioning | [ ] |
| `RIGHT_APPLICATION_TRAFFIC_DOWN_WRITE` | No | Downlink (optional) | [ ] |

---

## Section 3: Device Management

### 3.1 Gateway Registration

**Preconditions:** TTN configured, admin access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Gateways | Gateway list displays | [ ] |
| 2 | Click "Add Gateway" | Add gateway form opens | [ ] |
| 3 | Enter Gateway EUI (invalid format) | Error: "Invalid EUI format" | [ ] |
| 4 | Enter Gateway EUI (16 hex chars) | Field accepts input | [ ] |
| 5 | Enter Gateway name | Field accepts input | [ ] |
| 6 | Select location | Location selector works | [ ] |
| 7 | Click "Save" | Gateway saved (pending status) | [ ] |
| 8 | Click "Provision" on gateway | Provisioning starts | [ ] |
| 9 | Wait for completion | Status changes to "active" | [ ] |
| 10 | Verify in TTN Console | Gateway appears in TTN | [ ] |

### 3.2 Sensor Registration

**Preconditions:** TTN configured, admin access, unit exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Sensors | Sensor list displays | [ ] |
| 2 | Click "Add Sensor" | Add sensor form opens | [ ] |
| 3 | Enter DevEUI (invalid format) | Error: "Invalid DevEUI format" | [ ] |
| 4 | Enter DevEUI (16 hex chars) | Field accepts input | [ ] |
| 5 | Enter AppKey (32 hex chars) | Field accepts input | [ ] |
| 6 | Select unit to assign | Unit dropdown works | [ ] |
| 7 | Click "Save" | Sensor saved (pending status) | [ ] |
| 8 | Click "Provision" on sensor | Provisioning starts | [ ] |
| 9 | Wait for completion | Status changes to "joining" | [ ] |
| 10 | Verify in TTN Console | Device appears in TTN | [ ] |
| 11 | Power on physical sensor | Wait for join | [ ] |
| 12 | Verify sensor joins | Status changes to "active" | [ ] |

### 3.3 Sensor Assignment to Unit

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to unit detail page | Unit page displays | [ ] |
| 2 | Click "Assign Sensor" | Sensor selector opens | [ ] |
| 3 | Select available sensor | Sensor selected | [ ] |
| 4 | Click "Assign" | Sensor assigned to unit | [ ] |
| 5 | Verify sensor shows on unit | Sensor card displays | [ ] |
| 6 | Verify readings flow | Temperature data appears | [ ] |

### 3.4 Device Deprovisioning

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Select provisioned device | Device selected | [ ] |
| 2 | Click "Deprovision" | Confirmation dialog appears | [ ] |
| 3 | Confirm deprovisioning | Deprovisioning starts | [ ] |
| 4 | Wait for completion | Status changes to "pending" | [ ] |
| 5 | Verify removed from TTN | Device gone from TTN console | [ ] |

---

## Section 4: Alert Configuration

### 4.1 Alert Rules Setup

**Preconditions:** Unit exists, admin access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Alert Rules | Alert rules list displays | [ ] |
| 2 | Select a unit | Unit-specific rules show | [ ] |
| 3 | Click "Add Rule" | Rule form opens | [ ] |
| 4 | Set high temperature threshold | Slider/input works | [ ] |
| 5 | Set low temperature threshold | Slider/input works | [ ] |
| 6 | Set confirm time (minutes) | Input accepts number | [ ] |
| 7 | Click "Save" | Rule saved | [ ] |
| 8 | Verify rule appears in list | Rule displays correctly | [ ] |

### 4.2 Notification Policy Setup

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Notifications | Notification settings display | [ ] |
| 2 | Click "Add Policy" | Policy form opens | [ ] |
| 3 | Enter policy name | Field accepts input | [ ] |
| 4 | Select alert types | Multi-select works | [ ] |
| 5 | Select notification channels | Email/SMS/Push checkboxes | [ ] |
| 6 | Set escalation delay | Time input works | [ ] |
| 7 | Add escalation contacts | Contact selector works | [ ] |
| 8 | Click "Save" | Policy saved | [ ] |

### 4.3 Escalation Contact Management

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Settings → Contacts | Contact list displays | [ ] |
| 2 | Click "Add Contact" | Contact form opens | [ ] |
| 3 | Enter contact name | Field accepts input | [ ] |
| 4 | Enter email address | Email validation works | [ ] |
| 5 | Enter phone number | Phone validation works | [ ] |
| 6 | Set escalation level | Level selector works | [ ] |
| 7 | Click "Save" | Contact saved | [ ] |
| 8 | Verify in contact list | Contact appears | [ ] |

---

## Section 5: Dashboard & Monitoring

### 5.1 Dashboard Overview

**Preconditions:** Logged in, units configured

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/dashboard` | Dashboard loads | [ ] |
| 2 | Verify unit cards display | All units show status | [ ] |
| 3 | Verify color coding | Green/Yellow/Red correct | [ ] |
| 4 | Click on a unit card | Navigates to unit detail | [ ] |
| 5 | Verify battery indicators | Battery levels show | [ ] |
| 6 | Verify last reading time | Timestamps accurate | [ ] |

### 5.2 Unit Detail Page

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to unit detail | Unit page loads | [ ] |
| 2 | Verify temperature graph | Graph displays readings | [ ] |
| 3 | Change time range | Graph updates | [ ] |
| 4 | Verify current temperature | Current reading displays | [ ] |
| 5 | Verify status badge | Status correct | [ ] |
| 6 | Verify sensor list | Assigned sensors show | [ ] |
| 7 | Verify alert banner | Active alerts show (if any) | [ ] |

### 5.3 Real-Time Updates

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open unit detail page | Page displays | [ ] |
| 2 | Wait for new sensor reading | (5-minute interval) | [ ] |
| 3 | Verify auto-update | New reading appears | [ ] |
| 4 | Verify no page refresh needed | Data updates in place | [ ] |

---

## Section 6: Alert Handling

### 6.1 Alert Acknowledgment

**Preconditions:** Active alert exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/alerts` | Alert list displays | [ ] |
| 2 | Find active alert | Alert row visible | [ ] |
| 3 | Click "Acknowledge" | Confirmation dialog appears | [ ] |
| 4 | Enter acknowledgment note | Text field accepts input | [ ] |
| 5 | Click "Confirm" | Alert status changes | [ ] |
| 6 | Verify status update | Shows "acknowledged" | [ ] |
| 7 | Verify timestamp | Acknowledgment time recorded | [ ] |

### 6.2 Alert Resolution

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Temperature returns to normal | Condition resolves | [ ] |
| 2 | Wait for processing | System processes state | [ ] |
| 3 | Verify alert auto-resolves | Status changes to "resolved" | [ ] |
| 4 | Check resolution time | Timestamp recorded | [ ] |
| 5 | Alert moves to history | Not in active list | [ ] |

### 6.3 Alert Notification Delivery

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Trigger temperature excursion | (Simulator or real) | [ ] |
| 2 | Wait for confirm time | Alert triggers | [ ] |
| 3 | Check email | Email notification received | [ ] |
| 4 | Check SMS (if configured) | SMS received | [ ] |
| 5 | Check push notification | Push received | [ ] |
| 6 | Verify notification content | Contains unit, temp, time | [ ] |

---

## Section 7: Manual Temperature Logging

### 7.1 Online Manual Log

**Preconditions:** Logged in, unit exists

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/manual-log` | Manual log page displays | [ ] |
| 2 | Select unit | Unit dropdown works | [ ] |
| 3 | Enter temperature value | Number input works | [ ] |
| 4 | Add optional note | Text field works | [ ] |
| 5 | Click "Log Temperature" | Submission starts | [ ] |
| 6 | Verify success message | "Temperature logged" shows | [ ] |
| 7 | Check unit detail | Manual log appears in history | [ ] |

### 7.2 Offline Manual Log

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Enable airplane mode | Device offline | [ ] |
| 2 | Navigate to `/manual-log` | Page loads from cache | [ ] |
| 3 | Enter temperature | Input works offline | [ ] |
| 4 | Click "Log Temperature" | Stored locally | [ ] |
| 5 | Verify pending indicator | Shows "pending sync" | [ ] |
| 6 | Disable airplane mode | Device online | [ ] |
| 7 | Wait for sync | Data syncs to server | [ ] |
| 8 | Verify synced | Pending indicator clears | [ ] |
| 9 | Check unit detail | Entry appears in history | [ ] |

---

## Section 8: Reports

### 8.1 Temperature Log Report

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/reports` | Reports page displays | [ ] |
| 2 | Select "Temperature Log" | Report type selected | [ ] |
| 3 | Select date range | Date picker works | [ ] |
| 4 | Select units/sites | Multi-select works | [ ] |
| 5 | Click "Generate" | Report generates | [ ] |
| 6 | Verify data content | Readings display correctly | [ ] |
| 7 | Click "Export PDF" | PDF downloads | [ ] |
| 8 | Open PDF | Content matches on-screen | [ ] |

### 8.2 Compliance Report

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Select "Compliance Report" | Report type selected | [ ] |
| 2 | Select time period | 30/60/90 days options | [ ] |
| 3 | Click "Generate" | Report generates | [ ] |
| 4 | Verify summary stats | Counts accurate | [ ] |
| 5 | Verify alert history | Alerts listed | [ ] |
| 6 | Verify corrective actions | Actions documented | [ ] |

---

## Section 9: Mobile Responsiveness

### 9.1 Mobile Layout Check

**Test on:** iPhone SE (375px), iPhone 14 (390px), Android (360px)

| Page | Test | Pass/Fail |
|------|------|-----------|
| Dashboard | Units readable, cards stack vertically | [ ] |
| Unit Detail | Graph scrollable, data visible | [ ] |
| Settings | Navigation accessible, forms usable | [ ] |
| Manual Log | Form fields full width, easy to tap | [ ] |
| Alerts | Alert rows readable, actions accessible | [ ] |

### 9.2 Touch Interactions

| Interaction | Test | Pass/Fail |
|-------------|------|-----------|
| Buttons | Minimum 44px tap target | [ ] |
| Dropdowns | Easy to select on mobile | [ ] |
| Modals | Close button accessible | [ ] |
| Scroll | Smooth, no jank | [ ] |
| Pull to refresh | Works where expected | [ ] |

---

## Section 10: Role-Based Access

### 10.1 Staff Role Permissions

**Preconditions:** Logged in as staff user

| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| View dashboard | Allowed | [ ] |
| View unit details | Allowed | [ ] |
| Log temperature manually | Allowed | [ ] |
| Acknowledge alerts | Allowed | [ ] |
| Add new sensor | **Denied** | [ ] |
| Delete unit | **Denied** | [ ] |
| Access billing | **Denied** | [ ] |

### 10.2 Manager Role Permissions

**Preconditions:** Logged in as manager

| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| All staff permissions | Allowed | [ ] |
| Create units | Allowed | [ ] |
| Edit alert rules | Allowed | [ ] |
| View reports | Allowed | [ ] |
| Manage users | **Denied** | [ ] |
| Access billing | **Denied** | [ ] |

### 10.3 Admin/Owner Permissions

| Action | Expected Result | Pass/Fail |
|--------|-----------------|-----------|
| All manager permissions | Allowed | [ ] |
| Manage users | Allowed | [ ] |
| Configure TTN | Allowed | [ ] |
| Access billing | Allowed | [ ] |
| Delete organization | Allowed (owner only) | [ ] |

---

## Section 11: Browser Compatibility

Test all major pages on:

| Browser | Version | Dashboard | Settings | Alerts | Manual Log |
|---------|---------|-----------|----------|--------|------------|
| Chrome | Latest | [ ] | [ ] | [ ] | [ ] |
| Firefox | Latest | [ ] | [ ] | [ ] | [ ] |
| Safari | Latest | [ ] | [ ] | [ ] | [ ] |
| Edge | Latest | [ ] | [ ] | [ ] | [ ] |
| Safari iOS | Latest | [ ] | [ ] | [ ] | [ ] |
| Chrome Android | Latest | [ ] | [ ] | [ ] | [ ] |

---

## Section 12: Performance Checks

### 12.1 Page Load Times

| Page | Target | Actual | Pass/Fail |
|------|--------|--------|-----------|
| Dashboard | < 3s | ___s | [ ] |
| Unit Detail | < 2s | ___s | [ ] |
| Settings | < 2s | ___s | [ ] |
| Reports | < 3s | ___s | [ ] |

### 12.2 Data Operations

| Operation | Target | Actual | Pass/Fail |
|-----------|--------|--------|-----------|
| Save alert rule | < 1s | ___s | [ ] |
| Acknowledge alert | < 1s | ___s | [ ] |
| Log temperature | < 1s | ___s | [ ] |
| Generate report | < 5s | ___s | [ ] |

---

## Test Session Template

```markdown
## Test Session Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Staging/Local/Production]
**Browser:** [Browser/Version]
**Device:** [Desktop/Mobile/Tablet]

### Sections Tested
- [ ] Section 1: Authentication
- [ ] Section 2: TTN Configuration
- [ ] Section 3: Device Management
- [ ] Section 4: Alert Configuration
- [ ] Section 5: Dashboard
- [ ] Section 6: Alert Handling
- [ ] Section 7: Manual Logging
- [ ] Section 8: Reports
- [ ] Section 9: Mobile
- [ ] Section 10: Permissions
- [ ] Section 11: Browser Compatibility
- [ ] Section 12: Performance

### Issues Found
| ID | Section | Description | Severity | Screenshot |
|----|---------|-------------|----------|------------|
| 1  |         |             |          |            |

### Notes
[Additional observations]
```

---

## Related Documents

- [TEST_STRATEGY.md](./TEST_STRATEGY.md) — Overall testing philosophy
- [COVERAGE_MAP.md](./COVERAGE_MAP.md) — Feature-to-test mapping
- [E2E_SCENARIOS.md](./E2E_SCENARIOS.md) — Critical user flow testing
- [KNOWN_GAPS.md](./KNOWN_GAPS.md) — Missing coverage and risks
