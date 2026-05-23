# QA Walkthrough — Fix & Audit Task List

**Source:** QA walkthrough recording `2026-05-23_13-26-01.mp4` (6m 51s) and accompanying notes PDF.
**Captured:** 2026-05-23
**Author:** cbialek@getdatasurge.com (transcribed narration + frame review)
**Branch:** `claude/codebase-audit-tasks-cIKYr`

This document picks the project back up after a pause. Every task below is grounded in (a) what was said in the recording and (b) a real file path verified against the current `main`. Timestamps reference the recording; PDF section numbers reference the bundled notes.

---

## Priority key

- **P0** — explicitly flagged as broken in the walkthrough narration. Customer-facing or blocks downstream work.
- **P1** — status unknown per the walkthrough; needs verify-or-fix.
- **P2** — tech-debt / hidden gaps surfaced by the codebase audit while reviewing the items above.
- **P3** — strategic direction stated in the narration but not yet a task; tracked so it isn't lost.

---

## P0 — Explicitly broken (from narration)

### P0-1. Walk-in Cooler LDS02 door sensor: uplinks not flowing
**Source:** PDF Section 1 / Narration 0:04–1:10 — *"the sensor currently is not working with these communications. I had it working using command line and was able to get it working correctly, however a couple of changes and it is no longer working as expected — this needs to be fixed."*
**Sensor:** `sensor-a8404137f1867792`, Dragino LDS02.

**Investigation surface:**
- `supabase/functions/ttn-webhook/index.ts` — inbound uplink handler.
- `supabase/functions/_shared/uplinkParser.ts`, `supabase/functions/_shared/sensorBinding.ts` — parser + binding the uplink to a sensor record.
- `src/lib/devices/lds02Normalizer.ts` and `src/lib/devices/__tests__/lds02Normalizer.test.ts` — LDS02-specific normalization.
- `supabase/migrations/20260202060000_sensor_catalog.sql` and the LDS02 seed row in `src/pages/platform/PlatformSensorLibrary.tsx` (SEED_CATALOG) — verify decoder/payload mapping wasn't broken by a recent migration.

**Definition of done:**
1. Reproduce: confirm TTN is receiving the uplink (TTN console) and the webhook is being called (`ttn-webhook` logs).
2. If the webhook is being called but no row lands in `sensor_readings`, identify which step drops the message and add a regression test under `supabase/functions/_shared/__tests__/`.
3. If the webhook is *not* being called, diff against the last known-good commit when the CLI flow worked — likely a TTN webhook URL/credential rotation. Compare against `update-ttn-webhook` / `manage-ttn-settings` edge functions.
4. Document the working sequence in `docs/TTN_PRODUCTION_SETUP.md` so the next regression is easier to catch.

---

### P0-2. Uplink-frequency / downlink writes don't reach LoRaWAN devices
**Source:** PDF Section 1 + Closing TODOs / Narration 6:26 — *"making sure we're able to send and change the uplink frequency on the LoRaWAN devices."* UI exposes Quick Presets (Power Saver / Frequent / Standard) but a downlink is never observed on the device.

**Investigation surface:**
- `src/components/unit/SensorSettingsDrawer.tsx` — Quick Presets UI (the drawer in the recording).
- `src/hooks/useSensorUplinkInterval.ts`, `src/hooks/useSensorConfig.ts`, `src/hooks/useSensorConfigurations.ts` — client side of the setting change.
- `supabase/functions/ttn-send-downlink/index.ts` — downlink edge function.
- `supabase/functions/_shared/downlinkCommands.ts` — command encoder (`set_tdc`, `set_alarm`, `set_confirmed_uplinks`, `request_status`, `reset_device` for LHT65; LDS02 has its own set).
- `src/components/platform/DownlinkEditor.tsx` — platform-admin downlink editor.

**Definition of done:**
1. Click a Quick Preset in the drawer → confirm `ttn-send-downlink` is invoked with the right `f_port`, payload, and device EUI. Add a log line at the entry point so this is permanently visible in Supabase function logs.
2. Confirm TTN receives the downlink (TTN console → Live data → Downlink scheduled).
3. Confirm device acknowledges next uplink at the new cadence. Capture in a runbook step inside `docs/operations/`.
4. Add an end-to-end test (Vitest) that mocks the Supabase function client and asserts the encoder output matches the bytes the TTN device expects for each preset.
5. Catalog of Quick Presets and the bytes they generate should live in `supabase/functions/_shared/downlinkCommands.ts` (or a sibling), one source of truth — don't duplicate in the UI.

---

### P0-3. Sensor Library → Fields tab is not editable (architectural blocker)
**Source:** PDF Section 8–9 / Narration 3:17–4:09 and 4:09–5:09 — *"all of this should be editable which I don't know if it is. Yeah, so it's not editable."* The intent: raw hex → decoder → named fields → assign to a canonical **metric** → metrics drive alarms (Alarm Library) and widgets (dashboards). The "assign decoded value to metric" step does not exist today.

**Audit findings:**
- `src/pages/platform/PlatformSensorLibrary.tsx` lines ~1745–1779 — Fields tab is a read-only `<Table>`; no `useState`, no `onChange`, no Save button.
- `decoded_fields` column on `sensor_catalog` is `jsonb` (`supabase/migrations/20260202060000_sensor_catalog.sql`) — schema is ready for edits; UI just isn't built.
- RLS on `sensor_catalog` already restricts writes to `super_admin`, so the editor only needs to exist on the platform-admin page.
- **No metric/field-mapping table exists.** `src/pages/platform/PlatformAlarmLibrary.tsx` ~line 84–91 has a hardcoded `SENSORS` map (`LHT65: ["temperature", "humidity", "battery_voltage"]`) whose names do *not* match the decoded field names (`temperature_c`, `humidity_pct`, `battery_v`). The alarm-definition `eval_field` column (`supabase/migrations/20260220100000_alarm_definition_library.sql` ~line 128) is a raw string with no foreign key to anything.

**Definition of done:**
1. Add edit mode to the Fields tab: field name, type, unit, range, description (plus the new metric binding from step 2). Use the existing tab structure in `PlatformSensorLibrary.tsx`.
2. Introduce a `canonical_metrics` table (or enum-backed lookup) — values like `temperature_c`, `humidity_pct`, `door_open`, `battery_v`, `co2_ppm`, etc. Each decoded field on a sensor maps to zero-or-one canonical metric.
3. Migrate `alarm_definitions.eval_field` to reference canonical metrics. Migrate the hardcoded `SENSORS` map in `PlatformAlarmLibrary.tsx` to read from the same source.
4. Widget builders (`src/features/dashboard-layout/widgets/`) should reference canonical metrics, not raw decoded-field names.
5. Tests: round-trip a decoded payload through the binding and assert the resulting metric matches what an alarm rule would consume.

This is the largest item on the list and the unlock for several others. Consider splitting into PRs: (a) metric table + migration, (b) Fields tab editor, (c) alarm/widget rewiring.

---

### P0-4. Alarm firing is unverified end-to-end
**Source:** PDF Section 5 + Closing TODOs / Narration 2:09–2:52, 6:13–6:45 — *"the next thing we need to really work on is making sure that the alarms work."*

**Audit findings (the wiring exists; verification doesn't):**
- Engine: `supabase/functions/evaluate-alarms/index.ts`. Invoked from `ttn-webhook` on each uplink. Fetches alarms via RPC `get_available_alarms_for_unit`, dispatches across T1–T5 evaluators, inserts into `alarm_events` (and bridges to `alerts`), logs to `alarm_evaluation_log`. Auto-resolves with dedup. No stub paths detected.
- Emulator scenarios exist: see commit `ac55767 feat: add alarm emulator scenarios (T1-T5) with 36+ test scenarios` and `docs/EMULATOR_ALARM_SCENARIOS.md`.

**Definition of done:**
1. Walk through `docs/EMULATOR_QUICK_START.md` against a real org and run each T1–T5 scenario. Capture before/after rows in `alarm_events`, `alerts`, and `alarm_evaluation_log` for each.
2. Add a "scenario coverage" status table to `docs/EMULATOR_ALARM_SCENARIOS.md` with pass/fail per scenario and a screenshot of the resulting alert in the UI.
3. For each scenario that fails: file a sub-task here with the specific tier and definition ID that didn't fire.
4. Once verified, wire one production smoke check (e.g., a single canary alarm definition whose firing is monitored externally) so we know if the engine silently regresses.

---

### P0-5. SMS + email notifications never confirmed working
**Source:** PDF Closing TODOs / Narration 6:37 — *"I don't think we ever got text messages working, or email notifications working."*

**Audit findings (the wiring exists; delivery is unverified):**
- `supabase/functions/process-escalations/index.ts` — orchestrates delivery.
- Email: Resend API (`resend.emails.send`), HTML via `renderEmailTemplate()`. Deliveries logged to `notification_events`.
- SMS: `supabase/functions/send-sms-alert/` → Telnyx. Phone validation pre-send. Deliveries logged to `notification_events`.
- Smoke endpoint already exists: `supabase/functions/test-notification/index.ts`.
- Telnyx-specific config: `supabase/functions/telnyx-configure-webhook/`, `telnyx-verification-status/`, `telnyx-webhook/`, `test-telnyx-config/`.

**Definition of done:**
1. Hit `test-notification` from a real admin session and confirm an email lands in inbox and a real SMS lands on a real phone. Record the `notification_events` row IDs.
2. If either fails: check the secret manager — `RESEND_API_KEY`, `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER` (+18889890560 toll-free per `KNOWLEDGE.md`). Confirm they're set in the *production* Supabase project, not just local.
3. Trigger a real alarm via the emulator (P0-4) and confirm the escalation pipeline sends both channels for a user who has both opted in.
4. Add a recurring (daily) `health-check` extension that runs `test-notification` to a known-good test inbox/number and alerts if it fails. The existing `health-check/` function is the natural home.
5. Document the verified happy path in `docs/operations/notification-runbook.md` (new file is justified here; nothing equivalent exists).

---

## P1 — Verify-or-fix (status unknown)

### P1-6. Decoder Confidence page may be broken (or legitimately empty)
**Source:** PDF Section 4 / Narration 2:04 — *"Decoder Confidence — I don't know 100% that this is working yet."*

**Audit findings:**
- `src/hooks/useDecoderConfidence.ts` queries a `decoder_confidence_rollup` view; gracefully returns `[]` if the view is missing.
- Fallback hook `useDecoderMismatches()` filters `sensor_readings` by `decode_match=false`.

**Definition of done:**
1. Confirm whether `decoder_confidence_rollup` exists in production. If not, write the migration that creates it (rollup of trust-mode decode comparisons over a window).
2. With at least one trust-mode sensor reporting, confirm the KPI cards (Decoders / Compared / Mismatches / Overall Match Rate) populate.
3. If trust-mode isn't configurable on a sensor today, file the follow-up to expose that toggle on `PlatformSensorLibrary.tsx`.

---

### P1-7. Developer Tools → Database Stats shows all zeros
**Source:** PDF Section 13 — Database Statistics: Organizations 0 · Users 0 · Sites 0 · Units 0 · Readings 0 · Alerts 0.

**Audit findings:**
- `src/pages/platform/PlatformDeveloperTools.tsx` issues `select('*', { count: 'exact', head: true })` against each table with `is('deleted_at', null)`.
- Counts are subject to the **caller's RLS context** — a non-super-admin will legitimately see zeros.

**Definition of done:**
1. Confirm the QA login at the time of recording was the super-admin user. If not, the zeros are a UX bug (the page should say "you don't have permission to see global stats") not a data bug.
2. If the user *was* a super-admin: bypass RLS for these counts by moving them into a `SECURITY DEFINER` RPC, or add a UI affordance that the counts are scoped.
3. Either outcome: add a one-line scope label under each KPI card ("All organizations" vs "Your organizations").

---

### P1-8. DL-TP marked Supported but has no decoder or field schema
**Source:** PDF Section 12 — frames at 5:40 and 5:50; bundled audit observation.

**Audit findings:**
- `src/pages/platform/PlatformSensorLibrary.tsx` lines ~679–684 — DL-TP entry uses `_mkSeed()` with `is_supported: true` but `decoder_js: null` and `decoded_fields: []`.
- TTN reference shown in UI: `TheThingsNetwork/lorawan-devices @ 0db70e31`.

**Definition of done — pick one:**
- (a) Port the official Decentlab DL-TP decoder JS into the seed and populate `decoded_fields` (depth_temperature_1..N).
- (b) Or flip the flag: `is_supported: false` and surface a "decoder pending" badge in the card grid.

---

### P1-9. Demo/seed login `info@sustainablefinishes.com` fails
**Source:** PDF Section 3 / 1:50 frame — "Sign in failed — Invalid login credentials".

**Audit findings:**
- `supabase/migrations/20260115235109_…sql` grants `SUPER_ADMIN` to this email *iff* the user already exists in `auth.users`. The migration silently skips otherwise.

**Definition of done:**
1. Decide whether this is a real demo account or a stale one. If real, document the sign-up step (or seed it deterministically via a setup script). If stale, remove it from the migration so the next person isn't confused.
2. If kept: rotate the password and put the new credential in a dev-only secret store. Don't commit it.

---

### P1-10. Org Settings → Delete Account confirmation
**Source:** PDF Section 2 — frame at 1:20 shows the Danger Zone button.

**Audit findings:**
- `src/components/settings/AccountDeletionModal.tsx` already requires typing "DELETE" (case-insensitive), blocks during deletion, and refuses when the user is the org owner with other members. **This looks fine.**

**Definition of done:**
1. Manual QA: click the button and confirm the modal appears in the production build (not just dev). Capture a screenshot in the QA log.
2. Add a Playwright/Vitest UI test that asserts the modal blocks if "DELETE" isn't typed. Close the task.

---

## P2 — Tech debt surfaced during the audit

### P2-11. LHT65 `// TEMP SCALE FIX: /1000 instead of /100` workaround needs durable docs
**Source:** PDF Section 8 — frame at 3:30. *"inline comments tend to disappear in refactors."*

**Audit findings:**
- LHT65 decoder is inlined in `src/pages/platform/PlatformSensorLibrary.tsx` (SEED_CATALOG ~lines 175–189). Current code path uses `/100`; the `/1000` comment may be in a Notes/`admin_note` field or in the `decoder_js` text stored in `sensor_catalog` (verify by querying the row).

**Definition of done:**
1. Find the actual location of the `/1000 instead of /100` comment (DB row or seed source).
2. Move the explanation out of inline JS comments and into either: (a) `docs/architecture/decoder-quirks.md`, or (b) a structured `decoder_notes` JSONB column on `sensor_catalog`. Cross-link from the inline code.
3. Add a unit test against a real LHT65 hex sample that asserts the produced `temperature_c` matches a known good value (so a future refactor that "fixes" the divisor without reading the note will fail loudly).

---

### P2-12. Canonical metric layer (depends on P0-3 step 2)
Promote step 2 of P0-3 into its own PR-able task so the dependency is explicit. Output: a `canonical_metrics` table (or enum), a `sensor_field_bindings` join, and migrations rewiring `alarm_definitions.eval_field` + the `SENSORS` map in `PlatformAlarmLibrary.tsx`. Without this, P0-3, P1-8, and the strategic vibration-sensor expansion (P3-15) all stay blocked.

---

### P2-13. Field-name canonicalization mismatch in Alarm Library UI
**Source:** Audit finding.

**Audit findings:**
- `PlatformAlarmLibrary.tsx` ~line 84: `LHT65: ["temperature", "humidity", "battery_voltage"]`.
- `sensor_catalog.decoded_fields` for LHT65: `temperature_c`, `humidity_pct`, `battery_v`.
- These names diverge. When P2-12 lands, both should pull from the same canonical-metric list — this task is the cleanup that removes the duplicated literal.

---

### P2-14. Sensor uplink-interval read vs. write asymmetry
**Source:** Audit finding while investigating P0-2.

**Audit findings:**
- `src/hooks/useSensorUplinkInterval.ts` exists and reads the interval; it's not yet clear which hook *writes* it through to `ttn-send-downlink`.

**Definition of done:**
1. Map every read/write site of the uplink interval (the drawer, the platform editor, the alarm-rule editor).
2. Funnel writes through a single hook (e.g. `useSetSensorUplinkInterval`) that wraps `ttn-send-downlink`. Optimistic UI update only after the function call succeeds.
3. Eliminates the failure mode in P0-2 where the UI shows the new interval but the device never received it.

---

## P3 — Strategic (tracked, not actionable yet)

### P3-15. Vibration / non-temperature sensor support
**Source:** PDF Section 12 / Narration 5:09–6:07 — *"we will be able to add vibration sensors and all kinds of different things… the ability to add the payload, their fields, and then uplink and downlinks on here is very, very important."*

Blocked on P0-3 + P2-12. Once those land, the cost of adding a new sensor type drops to: add the catalog row, point at the TTN decoder, bind decoded fields to canonical metrics, define alarms in the library. No code changes needed.

### P3-16. White-label / multi-industry branding
**Source:** PDF Strategic Context / Narration 5:54–6:07 — *"many different industries that we can implement this and just do a slight brand change… wouldn't require a major rework, just some branding."*

No task. Capture as a non-goal for this milestone; revisit once P0/P1 are green.

---

## Things the user confirmed are working (do not touch)

- **Alarm Library data model.** Fact / Inference / AI Hints / Corrective Action / `eval_field` / thresholds / confidence / timing. 75 definitions, 51 AI-enhanced, 21 HACCP-linked. *"a great foundation."* (PDF Section 5, 2:14)
- **QR Provisioning.** *"I believe is working decently. I don't think we need to touch any of this right now."* (PDF Section 6, 2:52)
- **Decoder catalog wiring.** TTN-official + custom-decoder slot is the right architecture. The gap is downstream field editing (P0-3), not the decoder slot itself. (PDF Section 8, 3:22–3:48)

---

## Suggested execution order

1. **Week 1 (verify-fast):** P0-5 (notifications smoke test), P0-4 (alarm engine emulator walkthrough), P1-7 (stats scope label), P1-10 (delete-account screenshot test). These either close out as "already working, here's proof" or escalate to fix tasks with concrete repro.
2. **Week 2 (LoRaWAN round-trip):** P0-1 (LDS02 inbound) and P0-2 (downlink write) together — they share the TTN integration surface. P2-14 falls out of P0-2.
3. **Weeks 3–4 (architecture):** P0-3 + P2-12 + P2-13 as a tightly-scoped multi-PR effort on the canonical-metric layer. P1-8 (DL-TP) and P2-11 (LHT65 doc) ride along.
4. **Week 5 (cleanup):** P1-6 (Decoder Confidence view), P1-9 (demo login).
