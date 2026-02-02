
## What I found (where the “Configure Sensor” actions come from)

There are two “sensor configuration” action sources in the Unit dashboard UI:

1) **Layout customization validation banner** (only shows in Customize mode)  
- File: `src/features/dashboard-layout/components/LayoutValidationBanner.tsx`  
- Issues are produced by: `src/features/dashboard-layout/hooks/useLayoutValidation.ts`  
- It sets: `action: { label: "Configure Sensor", href: "#sensors" }`

2) **Widget-level empty/warning states** (inside the dashboard grid widgets)  
- File: `src/features/dashboard-layout/components/WidgetEmptyState.tsx`  
- States/actions are produced by: `src/features/dashboard-layout/hooks/useWidgetState.ts` (examples: “Assign Sensor”, “Configure Sensors”)

Your description (“click Customize, then click Configure… nothing happens”) strongly matches the **widget-level action buttons**, because in Customize mode widgets are intentionally made non-interactive.

---

## Root cause (why click does nothing)

### Primary root cause: widget content is non-interactive in Customize mode
In `src/features/dashboard-layout/components/WidgetWrapper.tsx`, the widget content wrapper is rendered with:

- `style={{ pointerEvents: isCustomizing ? "none" : "auto" }}`

That means **all buttons/links inside widgets (including WidgetEmptyState “Configure/Assign Sensor”) cannot receive clicks** when Customize mode is ON. This exactly produces “nothing at all” (no URL change, no modal, no console error).

### Secondary root cause (affects banner navigation): Tabs don’t react to query param changes
`src/pages/UnitDetail.tsx` currently uses:
- `<Tabs defaultValue={initialTab} … />` where `initialTab` is derived from `useSearchParams()`

But Radix Tabs’ `defaultValue` is only used on initial mount. If you click a link that changes `?tab=settings` while you’re already on the Unit page, **the URL can update but the visible tab may remain “Dashboard”**, making it seem like nothing changed (especially if the URL update is subtle).

Even if the user is clicking the banner action, this can make the UX appear broken.

---

## Minimal fix approach (meets constraints, no unrelated refactors)

### Goal behavior
- Clicking “Configure Sensor” in Customize mode should:
  - Navigate to **Unit → Settings → Connected Sensors** (preferred), and ideally
  - Jump/scroll to the sensors section so it’s obvious something happened.

### Fix steps (small, targeted)

#### 1) Make widget actions clickable in Customize mode (core fix)
**Files:**
- `src/features/dashboard-layout/components/GridCanvas.tsx`
- `src/features/dashboard-layout/components/WidgetWrapper.tsx`

**Change:**
- Stop globally disabling pointer events for widget content during Customize mode.
- Instead, disable pointer events only while actively dragging/resizing, or remove the pointer-events restriction entirely (the grid already uses `draggableHandle=".widget-drag-handle"`).

**Recommended minimal implementation:**
- In `GridCanvas.tsx`, you already track `isDragging` and `isResizing`. Pass a boolean like `disableContentPointerEvents={isInteracting}` into `WidgetWrapper`.
- In `WidgetWrapper.tsx`, change the pointerEvents rule to:
  - `pointerEvents: isCustomizing && disableContentPointerEvents ? "none" : "auto"`

This keeps customization safe during drag/resize, but restores click behavior the rest of the time.

#### 2) Ensure all “configure sensors” actions go to the correct Unit page location
**File:**
- `src/features/dashboard-layout/hooks/useWidgetState.ts`

**Change:**
- Where widget actions currently link to `/settings?tab=sensors` or `/settings?tab=sensors&unitId=…`, update to a unit-scoped route:
  - `/units/${unit.id}?tab=settings&section=sensors`

This aligns with your requirement: Unit → Settings → Connected Sensors.

(Keep existing global settings links for actions that are truly global, e.g. gateways.)

#### 3) Make the Unit page Tabs respond to `?tab=` changes (so navigation is visible)
**File:**
- `src/pages/UnitDetail.tsx`

**Change:**
- Convert the top-level Unit tabs to a controlled Tabs:
  - Read `tab` from `useSearchParams`
  - Pass `value={tab}` to `<Tabs>`
  - Add `onValueChange` that writes back to search params (preserving any existing params)

This ensures that navigating to `?tab=settings` reliably switches to Settings, even if you’re already on the Unit page.

#### 4) Optional but strongly recommended: auto-scroll to “Connected Sensors”
**File:**
- `src/pages/UnitDetail.tsx`

**Change:**
- Wrap the `UnitSensorsCard` section in a container with a stable id, e.g.:
  - `<div id="connected-sensors"> … </div>`
- When `tab === "settings"` and `section === "sensors"`, run a `useEffect` that calls:
  - `document.getElementById("connected-sensors")?.scrollIntoView({ behavior: "smooth", block: "start" })`
- If needed, do it in `requestAnimationFrame` or `setTimeout(0)` to ensure the Settings content is mounted.

#### 5) Hardening against grid event capture (very small addition)
Even with draggableHandle, I’ll add `stopPropagation` on pointer down for these action links:
- `LayoutValidationBanner.tsx` action link
- `WidgetEmptyState.tsx` action link/button

Add handlers:
- `onPointerDown={(e) => e.stopPropagation()}`
- optionally also `onMouseDown={(e) => e.stopPropagation()}`

This is minimal and prevents future “mousedown starts something else” issues.

---

## Test plan (small tests, feasible)

### A) Update the existing banner test to verify click actually navigates
**File:**
- `src/features/dashboard-layout/components/__tests__/LayoutValidationBanner.test.tsx`

**Change:**
- Instead of only checking `href`, render a `MemoryRouter` with `<Routes>` and a destination route, click “Configure Sensor”, and assert the destination content renders.

This verifies click triggers navigation.

### B) Add a tiny component test for WidgetWrapper interactivity in Customize mode
**New test file:**
- `src/features/dashboard-layout/components/__tests__/WidgetWrapper.test.tsx`

**Approach:**
- Mock `WidgetRenderer` to render a simple `<button onClick={mockFn}>Configure Sensor</button>`
- Render `WidgetWrapper` with `isCustomizing={true}` and `disableContentPointerEvents={false}`
- Assert clicking the button calls the handler

Optionally add a second case with `disableContentPointerEvents={true}` to ensure clicks are blocked during drag/resize only.

---

## Manual validation checklist (to confirm the bug is fixed)
1) Open a Unit detail page.
2) Toggle **Customize** ON.
3) Click the “Configure Sensor” action:
   - inside a widget empty/warning state, and
   - in the validation banner (if present).
4) Confirm:
   - you land on the **Settings** tab
   - you see **Connected Sensors** (and ideally it scrolls there)
   - no console errors
5) Repeat with Customize OFF to ensure behavior still works.

---

## Commands to run (and what “good” looks like)
- `npx vitest run`  
  - Expected: all tests pass
- `npx tsc -p tsconfig.json --noEmit`  
  - Expected: zero TS errors
- (Optional) `npm run lint`  
  - Expected: no eslint errors

---

## Files that will change (summary)
- `src/features/dashboard-layout/components/WidgetWrapper.tsx` (fix pointer-events behavior)
- `src/features/dashboard-layout/components/GridCanvas.tsx` (pass “isInteracting/disable pointer events” into WidgetWrapper)
- `src/features/dashboard-layout/hooks/useWidgetState.ts` (unit-scoped “Configure/Assign Sensor” href)
- `src/pages/UnitDetail.tsx` (controlled tabs + optional scroll-to-sensors)
- `src/features/dashboard-layout/components/WidgetEmptyState.tsx` (stopPropagation hardening)
- `src/features/dashboard-layout/components/LayoutValidationBanner.tsx` (stopPropagation hardening + ensure unit-scoped href includes section=sensors)
- Tests:
  - `src/features/dashboard-layout/components/__tests__/LayoutValidationBanner.test.tsx` (assert click navigates)
  - `src/features/dashboard-layout/components/__tests__/WidgetWrapper.test.tsx` (assert click works in customize mode)

No backend/database changes required.
