/**
 * Temperature Chart Widget
 * 
 * Displays temperature readings over time with comparison overlay support.
 * Note: Card wrapper is provided by WidgetWrapper.
 */

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { Activity } from "lucide-react";
import type { TimelineState } from "../types";

interface SensorReading {
  id: string;
  temperature: number;
  humidity: number | null;
  recorded_at: string;
}

interface ComparisonReading {
  temperature: number;
  recorded_at: string;
}

interface TemperatureChartWidgetProps {
  readings: SensorReading[];
  comparisonReadings?: ComparisonReading[];
  tempLimitHigh: number;
  tempLimitLow: number | null;
  timelineState: TimelineState;
  isCompact?: boolean;
}

export function TemperatureChartWidget({
  readings,
  comparisonReadings,
  tempLimitHigh,
  tempLimitLow,
  timelineState,
  isCompact = false,
}: TemperatureChartWidgetProps) {
  const chartData = useMemo(() => {
    // Build base chart data
    const baseData = readings.map((r, index) => ({
      time: format(new Date(r.recorded_at), "HH:mm"),
      fullTime: format(new Date(r.recorded_at), "MMM d, HH:mm"),
      temperature: r.temperature,
      humidity: r.humidity,
      // Comparison data aligned by index
      comparisonTemp: comparisonReadings?.[index]?.temperature ?? null,
    }));

    return baseData;
  }, [readings, comparisonReadings]);

  const showComparison = timelineState.compare !== null && comparisonReadings && comparisonReadings.length > 0;

  if (readings.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-4 pb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Temperature History
          </h3>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-muted-foreground">No sensor readings in this time period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-4 pb-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          Temperature History
          {showComparison && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (Comparing with previous period)
            </span>
          )}
        </h3>
      </div>
      <div className="flex-1 min-h-0 px-4 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              fontSize={isCompact ? 10 : 12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={isCompact ? 10 : 12}
              tickLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${v}°`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ""}
              formatter={(value: number, name: string) => [
                `${value?.toFixed(1) ?? "--"}°F`,
                name === "comparisonTemp" ? "Previous Period" : "Temperature",
              ]}
            />
            <ReferenceLine
              y={tempLimitHigh}
              stroke="hsl(var(--alarm))"
              strokeDasharray="5 5"
              label={{ value: `Limit: ${tempLimitHigh}°F`, fill: "hsl(var(--alarm))", fontSize: 11 }}
            />
            {tempLimitLow !== null && (
              <ReferenceLine
                y={tempLimitLow}
                stroke="hsl(var(--accent))"
                strokeDasharray="5 5"
              />
            )}
            <Area
              type="monotone"
              dataKey="temperature"
              stroke="hsl(var(--accent))"
              fill="url(#tempGradient)"
              strokeWidth={2}
              connectNulls={true}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--accent))" }}
              connectNulls={true}
            />
            {/* Comparison overlay line (dashed) */}
            {showComparison && (
              <Line
                type="monotone"
                dataKey="comparisonTemp"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
                connectNulls={true}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
