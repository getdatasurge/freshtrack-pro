interface ResizeSizeLabelProps {
  width: number;
  height: number;
  isVisible: boolean;
}

/**
 * Floating label that shows the current grid size (W × H) during widget resize.
 */
export function ResizeSizeLabel({ width, height, isVisible }: ResizeSizeLabelProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-4 right-4 z-50 bg-accent text-accent-foreground px-3 py-1.5 rounded-md shadow-lg text-sm font-mono font-medium animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {width} × {height}
    </div>
  );
}
