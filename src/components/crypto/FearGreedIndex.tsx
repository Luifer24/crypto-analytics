"use client";

import { useMemo } from "react";
import {
  useFearGreedCurrent,
  useFearGreedHistory,
  getFearGreedColor,
} from "@/hooks/useFearGreedIndex";
import { useCryptoComparePriceHistory } from "@/hooks/useCryptoCompareData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

// Gauge component using SVG
const FearGreedGauge = ({ value, size = 200 }: { value: number; size?: number }) => {
  const color = getFearGreedColor(value);

  // Calculate needle rotation (-90 to 90 degrees for a semicircle)
  const rotation = -90 + (value / 100) * 180;

  const radius = size / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;

  // Create gradient arc segments
  const segments = [
    { start: 0, end: 25, color: "#ef4444" },
    { start: 25, end: 45, color: "#f97316" },
    { start: 45, end: 55, color: "#eab308" },
    { start: 55, end: 75, color: "#84cc16" },
    { start: 75, end: 100, color: "#22c55e" },
  ];

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle - 90) * (Math.PI / 180);
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const createArc = (startPercent: number, endPercent: number, r: number) => {
    const startAngle = -90 + (startPercent / 100) * 180;
    const endAngle = -90 + (endPercent / 100) * 180;
    const start = polarToCartesian(centerX, centerY, r, startAngle);
    const end = polarToCartesian(centerX, centerY, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
      {/* Background arc segments */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={createArc(seg.start, seg.end, radius)}
          fill="none"
          stroke={seg.color}
          strokeWidth={16}
          strokeLinecap="round"
          opacity={0.3}
        />
      ))}

      {/* Active arc up to current value */}
      <path
        d={createArc(0, value, radius)}
        fill="none"
        stroke={color}
        strokeWidth={16}
        strokeLinecap="round"
      />

      {/* Needle */}
      <g transform={`rotate(${rotation}, ${centerX}, ${centerY})`}>
        <line
          x1={centerX}
          y1={centerY}
          x2={centerX}
          y2={centerY - radius + 25}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={centerX} cy={centerY} r={8} fill={color} />
        <circle cx={centerX} cy={centerY} r={4} fill="#1a1a2e" />
      </g>

      {/* Value text */}
      <text
        x={centerX}
        y={centerY + 20}
        textAnchor="middle"
        className="text-3xl font-bold"
        fill={color}
      >
        {value}
      </text>

      {/* Labels */}
      <text x={10} y={size / 2 + 20} className="text-xs" fill="#64748b">
        Extreme Fear
      </text>
      <text x={size - 10} y={size / 2 + 20} textAnchor="end" className="text-xs" fill="#64748b">
        Extreme Greed
      </text>
    </svg>
  );
};

export const FearGreedCard = () => {
  const { data: current, isLoading: currentLoading } = useFearGreedCurrent();
  const { data: history, isLoading: historyLoading } = useFearGreedHistory(365);
  const { data: btcPrices } = useCryptoComparePriceHistory("bitcoin", 365);

  // Get historical values
  const historicalValues = useMemo(() => {
    if (!history || history.length < 30) return null;

    const yesterday = history[1];
    const lastWeek = history[7];
    const lastMonth = history[30];

    // Find max and min in last year
    let max = { value: 0, timestamp: 0 };
    let min = { value: 100, timestamp: 0 };

    history.forEach((item) => {
      if (item.value > max.value) max = item;
      if (item.value < min.value) min = item;
    });

    return { yesterday, lastWeek, lastMonth, max, min };
  }, [history]);

  // Combine Fear & Greed with BTC price for chart
  const chartData = useMemo(() => {
    if (!history || !btcPrices) return [];

    const btcMap = new Map(btcPrices.map((p) => [
      new Date(p.timestamp).toDateString(),
      p.price,
    ]));

    return history
      .slice(0, 90) // Last 90 days
      .reverse()
      .map((item) => {
        const dateStr = new Date(item.timestamp).toDateString();
        return {
          time: item.timestamp,
          fearGreed: item.value,
          btcPrice: btcMap.get(dateStr) || null,
        };
      });
  }, [history, btcPrices]);

  if (currentLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-crypto-border rounded" />
          <div className="h-32 bg-crypto-border rounded" />
        </div>
      </div>
    );
  }

  const getClassificationBadge = (classification: string, value: number) => {
    const color = getFearGreedColor(value);
    return (
      <span
        className="px-2 py-0.5 rounded text-xs font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {classification} - {value}
      </span>
    );
  };

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <h3 className="font-semibold text-crypto-text text-lg mb-4">
        Fear & Greed Index
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gauge and Historical Values */}
        <div className="space-y-4">
          {current && (
            <div className="flex justify-center">
              <FearGreedGauge value={current.value} size={220} />
            </div>
          )}

          {current && (
            <p
              className="text-center text-lg font-semibold"
              style={{ color: getFearGreedColor(current.value) }}
            >
              {current.classification}
            </p>
          )}

          {historicalValues && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-medium text-crypto-muted">Historical Values</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-crypto-muted">Yesterday</span>
                  {getClassificationBadge(
                    historicalValues.yesterday?.classification || "",
                    historicalValues.yesterday?.value || 0
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-crypto-muted">Last Week</span>
                  {getClassificationBadge(
                    historicalValues.lastWeek?.classification || "",
                    historicalValues.lastWeek?.value || 0
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-crypto-muted">Last Month</span>
                  {getClassificationBadge(
                    historicalValues.lastMonth?.classification || "",
                    historicalValues.lastMonth?.value || 0
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-crypto-border">
                <h4 className="text-sm font-medium text-crypto-muted mb-2">Year Max/Min</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-crypto-muted">
                      Max ({format(new Date(historicalValues.max.timestamp), "MMM d, yyyy")})
                    </span>
                    {getClassificationBadge(
                      historicalValues.max.value > 75 ? "Extreme Greed" : "Greed",
                      historicalValues.max.value
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-crypto-muted">
                      Min ({format(new Date(historicalValues.min.timestamp), "MMM d, yyyy")})
                    </span>
                    {getClassificationBadge(
                      historicalValues.min.value <= 25 ? "Extreme Fear" : "Fear",
                      historicalValues.min.value
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chart */}
        <div>
          <h4 className="text-sm font-medium text-crypto-muted mb-3">
            Fear & Greed vs BTC Price (90 days)
          </h4>
          <div className="h-72">
            {historyLoading ? (
              <div className="animate-pulse h-full bg-crypto-border rounded" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="fearGreedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="fg"
                    domain={[0, 100]}
                    stroke="#f59e0b"
                    fontSize={11}
                    tickLine={false}
                    orientation="left"
                  />
                  <YAxis
                    yAxisId="btc"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    orientation="right"
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload?.length && label) {
                        const fg = payload.find((p) => p.dataKey === "fearGreed");
                        const btc = payload.find((p) => p.dataKey === "btcPrice");
                        return (
                          <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-crypto-muted text-xs mb-2">
                              {format(new Date(label as number), "MMM d, yyyy")}
                            </p>
                            {fg && (
                              <p className="text-sm" style={{ color: getFearGreedColor(fg.value as number) }}>
                                Fear & Greed: {fg.value}
                              </p>
                            )}
                            {btc && btc.value && (
                              <p className="text-sm text-crypto-muted">
                                BTC: ${Number(btc.value).toLocaleString()}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Reference lines for zones */}
                  <ReferenceLine yAxisId="fg" y={25} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine yAxisId="fg" y={50} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine yAxisId="fg" y={75} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />

                  <Area
                    yAxisId="fg"
                    type="monotone"
                    dataKey="fearGreed"
                    stroke="#f59e0b"
                    fill="url(#fearGreedGradient)"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="btc"
                    type="monotone"
                    dataKey="btcPrice"
                    stroke="#64748b"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-crypto-muted">
                No data available
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-2 text-xs text-crypto-muted">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#f59e0b]" /> Fear & Greed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[#64748b]" /> BTC Price
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini widget for Overview
export const FearGreedMini = () => {
  const { data: current, isLoading } = useFearGreedCurrent();

  if (isLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-24 bg-crypto-border rounded" />
          <div className="h-8 w-16 bg-crypto-border rounded" />
        </div>
      </div>
    );
  }

  if (!current) return null;

  const color = getFearGreedColor(current.value);

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
      <p className="text-crypto-muted text-sm mb-1">Fear & Greed</p>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold" style={{ color }}>
          {current.value}
        </span>
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {current.classification}
        </span>
      </div>
      {/* Mini progress bar */}
      <div className="mt-2 h-1.5 bg-crypto-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${current.value}%`,
            background: `linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)`,
          }}
        />
      </div>
    </div>
  );
};
