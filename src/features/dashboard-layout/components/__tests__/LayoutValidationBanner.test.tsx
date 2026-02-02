import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { LayoutValidationBanner } from "../LayoutValidationBanner";
import type { LayoutValidationResult } from "../../hooks/useLayoutValidation";

const mockValidation: LayoutValidationResult = {
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
  it("renders action button as navigable link for unit entity", () => {
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

  it("renders action button as navigable link for site entity", () => {
    render(
      <MemoryRouter>
        <LayoutValidationBanner
          validation={mockValidation}
          entityId="site-456"
          entityType="site"
        />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /configure sensor/i });
    expect(link).toHaveAttribute("href", "/sites/site-456?tab=settings");
  });

  it("does not render when there are no issues", () => {
    const emptyValidation: LayoutValidationResult = {
      isValid: true,
      hasErrors: false,
      hasWarnings: false,
      issues: [],
      errorCount: 0,
      warningCount: 0,
    };

    const { container } = render(
      <MemoryRouter>
        <LayoutValidationBanner
          validation={emptyValidation}
          entityId="unit-123"
          entityType="unit"
        />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it("clicking action link does not throw and has correct href", () => {
    render(
      <MemoryRouter initialEntries={["/units/unit-123"]}>
        <LayoutValidationBanner
          validation={mockValidation}
          entityId="unit-123"
          entityType="unit"
        />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /configure sensor/i });
    
    // Verify href is correct
    expect(link).toHaveAttribute("href", "/units/unit-123?tab=settings");
    
    // Verify click doesn't throw (stopPropagation works)
    expect(() => fireEvent.click(link)).not.toThrow();
    fireEvent.click(link);

    // The link should have the correct href (navigation happens via the Link component)
    expect(link).toHaveAttribute("href", "/units/unit-123?tab=settings");
  });
});
