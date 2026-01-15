/**
 * Sensor Signal Trend Widget
 * 
 * Shows signal strength history chart.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Signal } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { WidgetProps } from "../types";
import { format } from "date-fns";

interface SignalReading {
  recorded_at: string;
  signal_strength: number;
}

export function SensorSignalTrendWidget({ entityId, sensor }: WidgetProps) {
  const [readings, setReadings] = useState<SignalReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSignalData() {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        // Get sensor readings with signal strength for this unit
        const { data, error } = await supabase
          .from("sensor_readings")
          .select("recorded_at, signal_strength")
          .eq("unit_id", entityId)
          .not("signal_strength", "is", null)
          .order("recorded_at", { ascending: true })
          .limit(100);

        if (error) throw error;
        setReadings(data || []);
      } catch (err) {
        console.error("Error fetching signal data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSignalData();
  }, [entityId]);

  const chartData = readings.map(r => ({
    time: format(new Date(r.recorded_at), "HH:mm"),
    signal: r.signal_strength,
    timestamp: new Date(r.recorded_at).getTime(),
  }));

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Signal className="h-4 w-4" />
            Sensor Signal Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Signal className="h-4 w-4" />
            Sensor Signal Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground text-sm py-8">
          No signal data available
        </CardContent>
      </Card>
    );
  }

  const currentSignal = sensor?.signal_strength;
  const signalStatus = currentSignal 
    ? currentSignal > -80 ? "Good" : currentSignal > -100 ? "Fair" : "Weak"
    : "Unknown";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Signal className="h-4 w-4" />
            Sensor Signal Trend
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {signalStatus} ({currentSignal ?? "—"} dBm)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
            />
            <YAxis
              domain={[-120, -40]}
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number) => [`${value} dBm`, "Signal"]}
            />
            <ReferenceLine
              y={-80}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              label={{ value: "Good", position: "right", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="signal"
              stroke="hsl(192, 85%, 45%)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
