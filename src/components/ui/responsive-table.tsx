import * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * ResponsiveTable - A wrapper component for tables that ensures proper
 * horizontal scrolling behavior on constrained viewports.
 * 
 * Features:
 * - Prevents page-level horizontal scrolling
 * - Enables internal table scrolling when content exceeds container
 * - Works consistently across all screen sizes including high-DPI displays
 */
const ResponsiveTable = React.forwardRef<HTMLDivElement, ResponsiveTableProps>(
  ({ className, children, ...props }, ref) => (
    <div 
      ref={ref}
      className={cn(
        "w-full max-w-full overflow-x-auto rounded-md border",
        // Styled scrollbar for better UX
        "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  )
);
ResponsiveTable.displayName = "ResponsiveTable";

export { ResponsiveTable };
