/**
 * Last Known Good Widget
 * 
 * Wrapper for LastKnownGoodCard component with dashboard widget props.
 */

import LastKnownGoodCard from "@/components/unit/LastKnownGoodCard";
import type { WidgetProps } from "../types";

export function LastKnownGoodWidget({ 
  unit,
  lastKnownGood,
  derivedStatus,
}: WidgetProps) {
  return (
    <LastKnownGoodCard
      lastValidTemp={lastKnownGood?.temp ?? null}
      lastValidAt={lastKnownGood?.at ?? null}
      source={lastKnownGood?.source ?? null}
      tempLimitHigh={unit?.temp_limit_high ?? 40}
      tempLimitLow={unit?.temp_limit_low ?? null}
      isCurrentlyOnline={derivedStatus?.isOnline ?? false}
    />
  );
}
