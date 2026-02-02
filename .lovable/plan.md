

# Fix Plan: "Configure Sensor" Buttons Not Working in Validation Banner

## Root Cause

The **`LayoutValidationBanner`** component (lines 110-117) renders action buttons for each validation issue, but **the Button has no click handler at all**:

```tsx
{issue.action && (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 px-2 text-xs shrink-0"
  >
    {issue.action.label}
  </Button>
)}
```

The button:
- Has no `onClick` handler
- Ignores the `issue.action.href` property
- Is completely non-functional

The `ValidationIssue.action` interface does include an `href` property:
```typescript
action?: {
  label: string;
  href?: string;  // <-- This is available but unused
};
```

---

## Solution Overview

Wire the action buttons in `LayoutValidationBanner` to:
1. **Use `Link`** when `issue.action.href` is provided (e.g., "#sensors")
2. **Translate relative hash anchors** like `#sensors` into proper routes with the unit ID
3. **Use `stopPropagation`** to prevent the customization grid from intercepting clicks

Since the UnitDetail page uses Radix Tabs without URL-based tab state, the simplest approach is to:
- Navigate to `/units/${entityId}` with a **query parameter** (e.g., `?tab=settings`)  
- Update the UnitDetail page to read this query param and set the initial tab value

---

## Files to Change

### 1. `src/features/dashboard-layout/components/LayoutValidationBanner.tsx`

**Changes:**
- Accept `entityId` and `entityType` props to construct proper navigation URLs
- Replace the non-functional Button with a Link-based approach
- Map relative hrefs like `#sensors` to `/units/{entityId}?tab=settings`
- Add `onClick` with `stopPropagation` to ensure clicks work in customizing mode

```tsx
interface LayoutValidationBannerProps {
  validation: LayoutValidationResult;
  entityId: string;       // NEW
  entityType: EntityType; // NEW
  className?: string;
}

// In the render, replace the Button with:
{issue.action && (
  <Button
    asChild
    variant="ghost"
    size="sm"
    className="h-6 px-2 text-xs shrink-0"
    onClick={(e) => e.stopPropagation()} // Prevent grid capture
  >
    <Link to={resolveActionHref(issue.action.href, entityId, entityType)}>
      {issue.action.label}
    </Link>
  </Button>
)}
```

**Helper function:**
```tsx
function resolveActionHref(
  href: string | undefined, 
  entityId: string, 
  entityType: EntityType
): string {
  if (!href) return "#";
  
  // Handle hash anchors like "#sensors"
  if (href.startsWith("#sensors")) {
    return entityType === "unit" 
      ? `/units/${entityId}?tab=settings` 
      : `/sites/${entityId}?tab=settings`;
  }
  
  // Handle settings paths
  if (href.startsWith("/settings")) {
    return entityType === "unit"
      ? `/units/${entityId}${href.replace("/settings", "")}?tab=settings`
      : href;
  }
  
  return href;
}
```

### 2. `src/features/dashboard-layout/components/EntityDashboard.tsx`

**Changes:**
- Pass `entityId` and `entityType` to `LayoutValidationBanner`

```tsx
// Around line 435:
{state.isCustomizing && validation.issues.length > 0 && (
  <LayoutValidationBanner 
    validation={validation}
    entityId={entityId}        // NEW
    entityType={entityType}    // NEW
  />
)}
```

### 3. `src/pages/UnitDetail.tsx`

**Changes:**
- Read `tab` query param from URL
- Use it as the Tabs `defaultValue` (or controlled `value`)

```tsx
// Near top:
import { useSearchParams } from "react-router-dom";

// In component:
const [searchParams] = useSearchParams();
const initialTab = searchParams.get("tab") || "dashboard";

// Replace Tabs:
<Tabs defaultValue={initialTab} className="space-y-4">
```

---

## Technical Notes

1. **Why `stopPropagation`?**: In customizing mode, the `react-grid-layout` library attaches mouse handlers for drag-and-drop. Without `stopPropagation`, clicks on buttons inside widgets could be captured by the grid.

2. **Why URL-based tabs?**: The cleanest approach for deep-linking to the Settings tab. Using query params (`?tab=settings`) is less intrusive than changing the route structure.

3. **Export update**: The `EntityType` type needs to be imported in the banner file from `../hooks/useEntityLayoutStorage`.

---

## Testing Plan

### Manual Verification
1. Navigate to Unit Dashboard with a widget that triggers validation warnings (e.g., Temperature Chart without a temperature sensor)
2. Enable "Customizing" mode
3. Click "Configure Sensor" button in the validation banner
4. Verify:
   - Navigates to `/units/{unitId}?tab=settings`
   - Settings tab is active
   - UnitSensorsCard is visible

### Component Test (New)

Create `src/features/dashboard-layout/components/__tests__/LayoutValidationBanner.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LayoutValidationBanner } from "../LayoutValidationBanner";

const mockValidation = {
  isValid: false,
  hasErrors: false,
  hasWarnings: true,
  issues: [
    {
      id: "capability-temperature_chart",
      widgetId: "temperature_chart",
      widgetName: "Temperature Chart",
      severity: "warning" as const,
      message: "Missing temperature capability",
      action: { label: "Configure Sensor", href: "#sensors" },
    },
  ],
  errorCount: 0,
  warningCount: 1,
};

describe("LayoutValidationBanner", () => {
  it("renders action button as navigable link", () => {
    render(
      <MemoryRouter>
        <LayoutValidationBanner
          validation={mockValidation}
          entityId="unit-123"
          entityType="unit"
        />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /configure sensor/i });
    expect(link).toHaveAttribute("href", "/units/unit-123?tab=settings");
  });
});
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `LayoutValidationBanner.tsx` | Add `entityId`/`entityType` props, wire Button to Link with proper URL resolution |
| `EntityDashboard.tsx` | Pass `entityId` and `entityType` to banner |
| `UnitDetail.tsx` | Read `?tab=` query param for initial tab selection |
| New test file | Component test verifying link behavior |

