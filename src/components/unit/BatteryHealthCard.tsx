import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Battery, BatteryLow, BatteryMedium, BatteryFull, TrendingDown, Minus, Loader2 } from "lucide-react";
import { useBatteryForecast, formatBatteryEstimate } from "@/hooks/useBatteryForecast";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { format } from "date-fns";

interface BatteryHealthCardProps {
  deviceId: string | null;
}

const BatteryHealthCard = ({ deviceId }: BatteryHealthCardProps) => {
  const { forecast, loading, error } = useBatteryForecast(deviceId);

  if (!deviceId) {
    return null;
  }

  const getBatteryIcon = (level: number | null) => {
    if (level === null) return Battery;
    if (level < 20) return BatteryLow;
    if (level < 50) return BatteryMedium;
    return BatteryFull;
  };

  const getBatteryColor = (level: number | null) => {
    if (level === null) return "text-muted-foreground";
    if (level < 20) return "text-alarm";
    if (level < 50) return "text-warning";
    return "text-safe";
  };

  const getEstimateColor = (months: number | null, trend: string) => {
    if (trend === "stable") return "bg-safe/10 text-safe border-safe/20";
    if (months === null || months > 6) return "bg-safe/10 text-safe border-safe/20";
    if (months > 3) return "bg-warning/10 text-warning border-warning/20";
    return "bg-alarm/10 text-alarm border-alarm/20";
  };

  const BatteryIcon = getBatteryIcon(forecast.currentLevel);
  const batteryColor = getBatteryColor(forecast.currentLevel);

  // Format chart data
  const chartData = forecast.dataPoints.map((point) => ({
    date: format(new Date(point.recorded_at), "MMM d"),
    battery: point.battery_level,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Battery className="w-4 h-4" />
          Battery Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4">{error}</p>
        ) : forecast.currentLevel === null ? (
          <p className="text-sm text-muted-foreground py-4">No battery data available</p>
        ) : (
          <div className="space-y-4">
            {/* Current Level & Estimate */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${batteryColor}`}>
                  <BatteryIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${batteryColor}`}>
                    {forecast.currentLevel}%
                  </p>
                  <p className="text-xs text-muted-foreground">Current Level</p>
                </div>
              </div>

              <div className="text-right">
                <Badge 
                  variant="outline" 
                  className={getEstimateColor(forecast.estimatedMonthsRemaining, forecast.trend)}
                >
                  {forecast.trend === "declining" && (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {forecast.trend === "stable" && (
                    <Minus className="w-3 h-3 mr-1" />
                  )}
                  {formatBatteryEstimate(forecast)}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Est. Remaining</p>
              </div>
            </div>

            {/* Battery Trend Chart */}
            {chartData.length > 3 && (
              <div className="h-24 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10 }} 
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [`${value}%`, "Battery"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="battery"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Decay Rate Info */}
            {forecast.hasEnoughData && forecast.dailyDecayRate !== null && forecast.dailyDecayRate > 0.01 && (
              <p className="text-xs text-muted-foreground">
                Avg. decay: {forecast.dailyDecayRate.toFixed(2)}%/day
              </p>
            )}

            {!forecast.hasEnoughData && (
              <p className="text-xs text-muted-foreground">
                Need more data points for accurate forecast
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BatteryHealthCard;
