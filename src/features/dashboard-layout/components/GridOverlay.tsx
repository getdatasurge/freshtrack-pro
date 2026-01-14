import { GRID_CONFIG } from "../types";

interface GridOverlayProps {
  containerWidth: number;
  isVisible: boolean;
}

/**
 * SVG-based grid overlay that appears during resize/drag operations.
 * Uses the same grid math as react-grid-layout for perfect alignment.
 */
export function GridOverlay({ containerWidth, isVisible }: GridOverlayProps) {
  if (!isVisible) return null;

  const { cols, rowHeight, margin } = GRID_CONFIG;
  const colWidth = containerWidth / cols;
  
  // Calculate enough rows to cover typical dashboard content
  const numRows = 20;
  const totalHeight = numRows * rowHeight;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-[5] animate-in fade-in duration-150"
      aria-hidden="true"
    >
      <svg 
        className="w-full" 
        style={{ height: totalHeight }}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern 
            id="grid-pattern" 
            width={colWidth} 
            height={rowHeight} 
            patternUnits="userSpaceOnUse"
          >
            {/* Vertical lines */}
            <line 
              x1={margin[0] / 2} 
              y1="0" 
              x2={margin[0] / 2} 
              y2={rowHeight} 
              stroke="hsl(var(--accent))" 
              strokeWidth="1" 
              strokeOpacity="0.25"
              strokeDasharray="4 4"
            />
            {/* Horizontal lines */}
            <line 
              x1="0" 
              y1={margin[1] / 2} 
              x2={colWidth} 
              y2={margin[1] / 2} 
              stroke="hsl(var(--accent))" 
              strokeWidth="1" 
              strokeOpacity="0.25"
              strokeDasharray="4 4"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        
        {/* Column boundary lines (solid, more visible) */}
        {Array.from({ length: cols + 1 }).map((_, i) => (
          <line
            key={`col-${i}`}
            x1={i * colWidth}
            y1="0"
            x2={i * colWidth}
            y2={totalHeight}
            stroke="hsl(var(--accent))"
            strokeWidth="1"
            strokeOpacity="0.15"
          />
        ))}
        
        {/* Row boundary lines (solid, more visible) */}
        {Array.from({ length: numRows + 1 }).map((_, i) => (
          <line
            key={`row-${i}`}
            x1="0"
            y1={i * rowHeight}
            x2={containerWidth}
            y2={i * rowHeight}
            stroke="hsl(var(--accent))"
            strokeWidth="1"
            strokeOpacity="0.15"
          />
        ))}
      </svg>
    </div>
  );
}
