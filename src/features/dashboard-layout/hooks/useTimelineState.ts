import { useState, useEffect, useCallback, useMemo } from "react";
import { subHours, subDays, startOfDay, endOfDay, format, parseISO } from "date-fns";
import type { TimelineState } from "../types";
import { DEFAULT_TIMELINE_STATE } from "../constants/defaultLayout";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ComparisonRange {
  primary: DateRange;
  comparison: DateRange | null;
}

function computeDateRange(state: TimelineState): DateRange {
  const now = new Date();

  switch (state.range) {
    case "1h":
      return { from: subHours(now, 1), to: now };
    case "6h":
      return { from: subHours(now, 6), to: now };
    case "24h":
      return { from: subHours(now, 24), to: now };
    case "7d":
      return { from: subDays(now, 7), to: now };
    case "30d":
      return { from: subDays(now, 30), to: now };
    case "custom":
      if (state.customFrom && state.customTo) {
        return {
          from: parseISO(state.customFrom),
          to: parseISO(state.customTo),
        };
      }
      return { from: subHours(now, 24), to: now };
    default:
      return { from: subHours(now, 24), to: now };
  }
}

function computeComparisonRange(state: TimelineState): ComparisonRange {
  const primary = computeDateRange(state);

  if (!state.compare) {
    return { primary, comparison: null };
  }

  if (state.compare === "previous_period") {
    const duration = primary.to.getTime() - primary.from.getTime();
    return {
      primary,
      comparison: {
        from: new Date(primary.from.getTime() - duration),
        to: new Date(primary.to.getTime() - duration),
      },
    };
  }

  // Custom comparison range
  if (typeof state.compare === "object" && state.compare.from && state.compare.to) {
    return {
      primary,
      comparison: {
        from: parseISO(state.compare.from),
        to: parseISO(state.compare.to),
      },
    };
  }

  return { primary, comparison: null };
}

export function useTimelineState(
  initialState: TimelineState = DEFAULT_TIMELINE_STATE,
  onUpdate?: (state: TimelineState) => void,
  isDefaultLayout: boolean = true
) {
  const [timelineState, setTimelineState] = useState<TimelineState>(initialState);

  // Sync with external state changes
  useEffect(() => {
    setTimelineState(initialState);
  }, [initialState]);

  const updateTimeline = useCallback(
    (updates: Partial<TimelineState>) => {
      const newState = { ...timelineState, ...updates };
      setTimelineState(newState);

      // Only persist for custom layouts
      if (!isDefaultLayout && onUpdate) {
        onUpdate(newState);
      }
    },
    [timelineState, isDefaultLayout, onUpdate]
  );

  // Quick range setters
  const setRange = useCallback(
    (range: TimelineState["range"]) => {
      updateTimeline({
        range,
        customFrom: undefined,
        customTo: undefined,
      });
    },
    [updateTimeline]
  );

  const setCustomRange = useCallback(
    (from: Date, to: Date) => {
      updateTimeline({
        range: "custom",
        customFrom: from.toISOString(),
        customTo: to.toISOString(),
      });
    },
    [updateTimeline]
  );

  const setCompare = useCallback(
    (compare: TimelineState["compare"]) => {
      updateTimeline({ compare });
    },
    [updateTimeline]
  );

  const clearCompare = useCallback(() => {
    updateTimeline({ compare: null });
  }, [updateTimeline]);

  const setZoomLevel = useCallback(
    (zoomLevel: number) => {
      updateTimeline({ zoomLevel: Math.max(1, Math.min(4, zoomLevel)) });
    },
    [updateTimeline]
  );

  // Computed values
  const dateRange = useMemo(() => computeDateRange(timelineState), [timelineState]);
  const comparisonRanges = useMemo(() => computeComparisonRange(timelineState), [timelineState]);

  // Formatted labels for display
  const rangeLabel = useMemo(() => {
    if (timelineState.range === "custom" && timelineState.customFrom && timelineState.customTo) {
      const from = parseISO(timelineState.customFrom);
      const to = parseISO(timelineState.customTo);
      return `${format(from, "MMM d")} - ${format(to, "MMM d")}`;
    }
    return timelineState.range;
  }, [timelineState]);

  return {
    timelineState,
    updateTimeline,
    setRange,
    setCustomRange,
    setCompare,
    clearCompare,
    setZoomLevel,
    dateRange,
    comparisonRanges,
    rangeLabel,
    isComparing: !!timelineState.compare,
  };
}
