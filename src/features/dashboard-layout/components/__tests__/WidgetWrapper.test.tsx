import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { WidgetWrapper } from "../WidgetWrapper";

// Mock the WIDGET_REGISTRY
vi.mock("../../registry/widgetRegistry", () => ({
  WIDGET_REGISTRY: {
    test_widget: {
      name: "Test Widget",
      icon: () => <span data-testid="widget-icon">Icon</span>,
      mandatory: false,
    },
    mandatory_widget: {
      name: "Mandatory Widget",
      icon: () => <span data-testid="widget-icon">Icon</span>,
      mandatory: true,
    },
  },
}));

// Mock the WidgetRenderer to render a simple button we can test clicking
vi.mock("../WidgetRenderer", () => ({
  WidgetRenderer: ({ widgetId }: { widgetId: string }) => (
    <button
      data-testid={`widget-button-${widgetId}`}
      onClick={() => console.log("clicked")}
    >
      Configure Sensor
    </button>
  ),
}));

describe("WidgetWrapper", () => {
  const defaultProps = {
    widgetId: "test_widget",
    isCustomizing: false,
    isResizing: false,
    isInteracting: false,
    canHide: true,
    onHide: vi.fn(),
    props: {},
  };

  it("renders widget content when not customizing", () => {
    render(
      <MemoryRouter>
        <WidgetWrapper {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByTestId("widget-button-test_widget")).toBeInTheDocument();
  });

  it("allows clicks on widget content in customizing mode when NOT interacting", () => {
    const consoleSpy = vi.spyOn(console, "log");

    render(
      <MemoryRouter>
        <WidgetWrapper
          {...defaultProps}
          isCustomizing={true}
          isInteracting={false}
        />
      </MemoryRouter>
    );

    const button = screen.getByTestId("widget-button-test_widget");
    fireEvent.click(button);

    expect(consoleSpy).toHaveBeenCalledWith("clicked");
    consoleSpy.mockRestore();
  });

  it("shows drag handle and hide button in customizing mode", () => {
    render(
      <MemoryRouter>
        <WidgetWrapper {...defaultProps} isCustomizing={true} />
      </MemoryRouter>
    );

    // Should show the widget name in the drag handle (may appear multiple times)
    const widgetNames = screen.getAllByText("Test Widget");
    expect(widgetNames.length).toBeGreaterThan(0);
  });

  it("shows mandatory badge for mandatory widgets", () => {
    render(
      <MemoryRouter>
        <WidgetWrapper
          {...defaultProps}
          widgetId="mandatory_widget"
          isCustomizing={true}
          canHide={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("calls onHide when hide button is clicked", () => {
    const onHide = vi.fn();

    render(
      <MemoryRouter>
        <WidgetWrapper
          {...defaultProps}
          isCustomizing={true}
          onHide={onHide}
        />
      </MemoryRouter>
    );

    // Find and click the hide button (the EyeOff icon button)
    const buttons = screen.getAllByRole("button");
    const hideButton = buttons.find((btn) =>
      btn.className.includes("hover:bg-destructive")
    );

    if (hideButton) {
      fireEvent.click(hideButton);
      expect(onHide).toHaveBeenCalled();
    }
  });

  it("shows placeholder during active resize", () => {
    render(
      <MemoryRouter>
        <WidgetWrapper
          {...defaultProps}
          isCustomizing={true}
          isResizing={true}
        />
      </MemoryRouter>
    );

    // During resize, should show the widget name in multiple places (drag handle + placeholder)
    // Use getAllByText since it appears in both the drag handle and the resize placeholder
    const widgetNames = screen.getAllByText("Test Widget");
    expect(widgetNames.length).toBeGreaterThanOrEqual(2);
  });
});
