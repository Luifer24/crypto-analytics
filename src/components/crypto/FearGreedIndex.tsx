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
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Professional SVG Gauge Component
const FearGreedGauge = ({ value }: { value: number }) => {
  const color = getFearGreedColor(value);

  // Needle angle: 0 = left (Extreme Fear), 180 = right (Extreme Greed)
  const needleAngle = (value / 100) * 180;

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg viewBox="0 0 200 120" className="w-full">
        <defs>
          {/* Gradient for the arc */}
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          {/* Shadow filter */}
          <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Background arc (gray) */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Colored gradient arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          filter="url(#gaugeShadow)"
        />

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = (tick / 100) * 180;
          const rad = (angle - 180) * (Math.PI / 180);
          const x1 = 100 + 70 * Math.cos(rad);
          const y1 = 100 + 70 * Math.sin(rad);
          const x2 = 100 + 60 * Math.cos(rad);
          const y2 = 100 + 60 * Math.sin(rad);
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#475569"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Needle */}
        <g transform={`rotate(${needleAngle - 180}, 100, 100)`}>
          <path
            d="M 100 100 L 96 95 L 100 30 L 104 95 Z"
            fill={color}
            filter="url(#gaugeShadow)"
          />
          <circle cx="100" cy="100" r="8" fill={color} />
          <circle cx="100" cy="100" r="4" fill="#0f172a" />
        </g>

        {/* Labels */}
        <text x="15" y="115" fontSize="8" fill="#64748b" textAnchor="start">0</text>
        <text x="100" y="30" fontSize="8" fill="#64748b" textAnchor="middle">50</text>
        <text x="185" y="115" fontSize="8" fill="#64748b" textAnchor="end">100</text>
      </svg>

      {/* Value display */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className="text-5xl font-bold" style={{ color }}>{value}</span>
      </div>
    </div>
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
      .slice(0, 90)
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
          <div className="h-48 bg-crypto-border rounded" />
        </div>
      </div>
    );
  }

  const ValueBadge = ({ value, label }: { value: number; label: string }) => {
    const color = getFearGreedColor(value);
    const classification = value <= 25 ? "Extreme Fear" : value <= 45 ? "Fear" : value <= 55 ? "Neutral" : value <= 75 ? "Greed" : "Extreme Greed";
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-crypto-muted text-sm">{label}</span>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {classification} - {value}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-crypto-text text-lg">Fear & Greed Index</h3>
        <a
          href="https://alternative.me/crypto/fear-and-greed-index/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-crypto-muted hover:text-crypto-accent transition-colors"
        >
          Data by Alternative.me
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Gauge and Historical Values */}
        <div className="space-y-6">
          {current && (
            <>
              <FearGreedGauge value={current.value} />
              <p
                className="text-center text-xl font-bold -mt-2"
                style={{ color: getFearGreedColor(current.value) }}
              >
                {current.classification}
              </p>
            </>
          )}

          {historicalValues && (
            <div className="space-y-1 pt-4 border-t border-crypto-border">
              <h4 className="text-sm font-semibold text-crypto-text mb-3">Historical Values</h4>
              <ValueBadge value={historicalValues.yesterday?.value || 0} label="Yesterday" />
              <ValueBadge value={historicalValues.lastWeek?.value || 0} label="Last Week" />
              <ValueBadge value={historicalValues.lastMonth?.value || 0} label="Last Month" />

              <div className="pt-3 mt-3 border-t border-crypto-border">
                <h4 className="text-sm font-semibold text-crypto-text mb-3">Year Extremes</h4>
                <div className="flex items-center justify-between py-2">
                  <span className="text-crypto-muted text-sm">
                    Max ({format(new Date(historicalValues.max.timestamp), "MMM d, yyyy")})
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${getFearGreedColor(historicalValues.max.value)}20`,
                      color: getFearGreedColor(historicalValues.max.value),
                      border: `1px solid ${getFearGreedColor(historicalValues.max.value)}40`
                    }}
                  >
                    {historicalValues.max.value}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-crypto-muted text-sm">
                    Min ({format(new Date(historicalValues.min.timestamp), "MMM d, yyyy")})
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${getFearGreedColor(historicalValues.min.value)}20`,
                      color: getFearGreedColor(historicalValues.min.value),
                      border: `1px solid ${getFearGreedColor(historicalValues.min.value)}40`
                    }}
                  >
                    {historicalValues.min.value}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Chart */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-crypto-text">Fear & Greed Chart</h4>
            <div className="flex items-center gap-4 text-xs text-crypto-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#f59e0b] rounded" /> Fear & Greed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#64748b] rounded" /> BTC Price
              </span>
            </div>
          </div>

          <div className="h-[320px]">
            {historyLoading ? (
              <div className="animate-pulse h-full bg-crypto-border rounded" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fearGreedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="time"
                    tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="fg"
                    domain={[0, 100]}
                    stroke="#f59e0b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <YAxis
                    yAxisId="btc"
                    orientation="right"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    width={45}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload?.length && label) {
                        const fg = payload.find((p) => p.dataKey === "fearGreed");
                        const btc = payload.find((p) => p.dataKey === "btcPrice");
                        return (
                          <div className="bg-crypto-bg border border-crypto-border rounded-lg px-3 py-2 shadow-xl">
                            <p className="text-crypto-muted text-xs mb-2">
                              {format(new Date(label as number), "MMM d, yyyy")}
                            </p>
                            {fg && (
                              <p className="text-sm font-medium" style={{ color: getFearGreedColor(fg.value as number) }}>
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

                  {/* Zone reference lines */}
                  <ReferenceLine yAxisId="fg" y={25} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.3} />
                  <ReferenceLine yAxisId="fg" y={50} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.3} />
                  <ReferenceLine yAxisId="fg" y={75} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.3} />

                  <Area
                    yAxisId="fg"
                    type="monotone"
                    dataKey="fearGreed"
                    stroke="#f59e0b"
                    fill="url(#fearGreedFill)"
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

          {/* Zone legend */}
          <div className="flex justify-center gap-2 flex-wrap text-[10px]">
            <span className="px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444]">0-25 Extreme Fear</span>
            <span className="px-2 py-0.5 rounded bg-[#f97316]/20 text-[#f97316]">26-45 Fear</span>
            <span className="px-2 py-0.5 rounded bg-[#eab308]/20 text-[#eab308]">46-55 Neutral</span>
            <span className="px-2 py-0.5 rounded bg-[#84cc16]/20 text-[#84cc16]">56-75 Greed</span>
            <span className="px-2 py-0.5 rounded bg-[#22c55e]/20 text-[#22c55e]">76-100 Extreme Greed</span>
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
      <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Fear & Greed
      </div>
      <div className="flex items-center gap-3">
        <span className="text-3xl font-bold" style={{ color }}>
          {current.value}
        </span>
        <span
          className="px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {current.classification}
        </span>
      </div>
      {/* Mini gauge bar */}
      <div className="mt-3 h-2 bg-crypto-border rounded-full overflow-hidden relative">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)",
          }}
        />
        <div
          className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg transition-all duration-500"
          style={{ left: `${current.value}%`, transform: "translateX(-50%)" }}
        />
      </div>
    </div>
  );
};
