"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useDominanceHistory,
  formatMarketCap,
  type DominancePoint,
} from "@/hooks/useDominanceData";
import { TrendingUp, TrendingDown } from "lucide-react";

const timeRanges = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "3Y", days: 1095 },
  { label: "Max", days: 2200 }, // CMC API limit is 2200 (~6 years)
];

const COLORS = {
  BTC: "#f7931a",
  ETH: "#627eea",
  Others: "#64748b",
};

export const DominanceHistoryChart = () => {
  const [days, setDays] = useState(365);
  const { data: history, isLoading, isError } = useDominanceHistory(days);

  // Process data for different views
  const processedData = useMemo(() => {
    if (!history || history.length === 0) return null;

    const current = history[history.length - 1];
    const yesterday = history[history.length - 2];
    const weekAgo = history.find(
      (p) => p.timestamp <= Date.now() - 7 * 24 * 60 * 60 * 1000
    );
    const monthAgo = history.find(
      (p) => p.timestamp <= Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    // Find max and min BTC dominance
    let maxBtc = { value: 0, timestamp: 0 };
    let minBtc = { value: 100, timestamp: 0 };

    history.forEach((point) => {
      if (point.btcDominance > maxBtc.value) {
        maxBtc = { value: point.btcDominance, timestamp: point.timestamp };
      }
      if (point.btcDominance < minBtc.value) {
        minBtc = { value: point.btcDominance, timestamp: point.timestamp };
      }
    });

    return {
      current,
      yesterday,
      weekAgo,
      monthAgo,
      maxBtc,
      minBtc,
      chartData: history.map((p) => ({
        time: p.timestamp,
        BTC: p.btcDominance,
        ETH: p.ethDominance,
        Others: p.othersDominance,
      })),
    };
  }, [history]);

  const DominanceChange = ({
    current,
    previous,
  }: {
    current: number;
    previous?: number;
  }) => {
    if (!previous) return <span className="text-crypto-muted">-</span>;
    const change = current - previous;
    const isPositive = change >= 0;
    return (
      <span
        className={cn(
          "text-xs flex items-center gap-0.5",
          isPositive ? "text-crypto-positive" : "text-crypto-negative"
        )}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {Math.abs(change).toFixed(2)}%
      </span>
    );
  };

  const DominanceBadge = ({
    value,
    color,
    label,
  }: {
    value: number;
    color: string;
    label: string;
  }) => (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-crypto-muted text-sm">{label}</span>
      <span className="text-crypto-text font-semibold ml-auto">
        {value.toFixed(1)}%
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-crypto-border rounded" />
          <div className="h-80 bg-crypto-border rounded" />
        </div>
      </div>
    );
  }

  if (isError || !processedData) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="text-center py-12 text-crypto-muted">
          Error loading dominance data. Please try again.
        </div>
      </div>
    );
  }

  const { current, yesterday, weekAgo, monthAgo, maxBtc, minBtc, chartData } =
    processedData;

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-crypto-text text-lg">
            Bitcoin Dominance
          </h3>
          <p className="text-crypto-muted text-sm mt-1">
            Market share of Bitcoin vs total crypto market cap
          </p>
        </div>
        <a
          href="https://coinmarketcap.com/charts/bitcoin-dominance/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-crypto-muted hover:text-crypto-accent transition-colors"
        >
          Data by CoinMarketCap
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Current Values */}
        <div className="space-y-6">
          {/* Current Dominance */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-crypto-text">
              Current Dominance
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS.BTC }}
                  />
                  <span className="text-crypto-text font-medium">Bitcoin</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-crypto-text">
                    {current.btcDominance.toFixed(1)}%
                  </span>
                  <DominanceChange
                    current={current.btcDominance}
                    previous={yesterday?.btcDominance}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS.ETH }}
                  />
                  <span className="text-crypto-text font-medium">Ethereum</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-crypto-text">
                    {current.ethDominance.toFixed(1)}%
                  </span>
                  <DominanceChange
                    current={current.ethDominance}
                    previous={yesterday?.ethDominance}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS.Others }}
                  />
                  <span className="text-crypto-text font-medium">Others</span>
                </div>
                <span className="text-lg font-semibold text-crypto-muted">
                  {current.othersDominance.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Dominance bar */}
            <div className="h-3 rounded-full overflow-hidden flex">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${current.btcDominance}%`,
                  backgroundColor: COLORS.BTC,
                }}
              />
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${current.ethDominance}%`,
                  backgroundColor: COLORS.ETH,
                }}
              />
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${current.othersDominance}%`,
                  backgroundColor: COLORS.Others,
                }}
              />
            </div>
          </div>

          {/* Historical Values */}
          <div className="space-y-3 pt-4 border-t border-crypto-border">
            <h4 className="text-sm font-semibold text-crypto-text">
              Historical Values (BTC)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-crypto-muted">Yesterday</span>
                <div className="flex items-center gap-2">
                  <span className="text-crypto-text font-medium">
                    {yesterday?.btcDominance.toFixed(1)}%
                  </span>
                  <DominanceBadgeSmall
                    btc={yesterday?.btcDominance || 0}
                    eth={yesterday?.ethDominance || 0}
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-crypto-muted">Last Week</span>
                <div className="flex items-center gap-2">
                  <span className="text-crypto-text font-medium">
                    {weekAgo?.btcDominance.toFixed(1)}%
                  </span>
                  <DominanceBadgeSmall
                    btc={weekAgo?.btcDominance || 0}
                    eth={weekAgo?.ethDominance || 0}
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-crypto-muted">Last Month</span>
                <div className="flex items-center gap-2">
                  <span className="text-crypto-text font-medium">
                    {monthAgo?.btcDominance.toFixed(1)}%
                  </span>
                  <DominanceBadgeSmall
                    btc={monthAgo?.btcDominance || 0}
                    eth={monthAgo?.ethDominance || 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Period Extremes */}
          <div className="space-y-3 pt-4 border-t border-crypto-border">
            <h4 className="text-sm font-semibold text-crypto-text">
              {days <= 365 ? "Year" : days >= 2000 ? "Max" : `${Math.round(days/365)}Y`} Extremes (BTC)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-crypto-muted">
                  Max ({format(new Date(maxBtc.timestamp), "MMM d, yyyy")})
                </span>
                <span className="text-crypto-positive font-semibold">
                  {maxBtc.value.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-crypto-muted">
                  Min ({format(new Date(minBtc.timestamp), "MMM d, yyyy")})
                </span>
                <span className="text-crypto-negative font-semibold">
                  {minBtc.value.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Total Market Cap */}
          <div className="pt-4 border-t border-crypto-border">
            <div className="flex justify-between items-center">
              <span className="text-crypto-muted text-sm">Total Market Cap</span>
              <span className="text-crypto-text font-semibold">
                {formatMarketCap(current.totalMarketCap)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Chart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-crypto-text">
              Dominance Chart
            </h4>
            <div className="flex items-center gap-1 bg-crypto-bg rounded-lg p-1">
              {timeRanges.map((range) => (
                <button
                  key={range.days}
                  onClick={() => setDays(range.days)}
                  className={cn(
                    "px-3 py-1 text-sm font-medium rounded transition-colors",
                    days === range.days
                      ? "bg-crypto-accent text-crypto-bg"
                      : "text-crypto-muted hover:text-crypto-text"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="time"
                  tickFormatter={(ts) => {
                    const date = new Date(ts);
                    // Show year for longer time ranges
                    if (days > 365) {
                      return format(date, "MMM yyyy");
                    }
                    return format(date, "MMM d");
                  }}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length && label) {
                      return (
                        <div className="bg-crypto-bg border border-crypto-border rounded-lg px-3 py-2 shadow-xl">
                          <p className="text-crypto-muted text-xs mb-2">
                            {format(new Date(label as number), "MMM d, yyyy")}
                          </p>
                          {payload.map((entry, index) => (
                            <p
                              key={index}
                              className="text-sm font-medium"
                              style={{ color: entry.color }}
                            >
                              {entry.name}: {Number(entry.value).toFixed(2)}%
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-crypto-text text-sm">{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="BTC"
                  name="Bitcoin"
                  stroke={COLORS.BTC}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ETH"
                  name="Ethereum"
                  stroke={COLORS.ETH}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Others"
                  name="Others"
                  stroke={COLORS.Others}
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with current values */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-1 rounded"
                style={{ backgroundColor: COLORS.BTC }}
              />
              <span className="text-crypto-muted">Bitcoin</span>
              <span
                className="font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${COLORS.BTC}20`,
                  color: COLORS.BTC,
                }}
              >
                {current.btcDominance.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-1 rounded"
                style={{ backgroundColor: COLORS.ETH }}
              />
              <span className="text-crypto-muted">Ethereum</span>
              <span
                className="font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${COLORS.ETH}20`,
                  color: COLORS.ETH,
                }}
              >
                {current.ethDominance.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-0.5 rounded border-dashed border-t-2"
                style={{ borderColor: COLORS.Others }}
              />
              <span className="text-crypto-muted">Others</span>
              <span className="font-semibold text-crypto-muted">
                {current.othersDominance.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small badge showing ETH value next to BTC
const DominanceBadgeSmall = ({ btc, eth }: { btc: number; eth: number }) => (
  <span
    className="text-xs px-1.5 py-0.5 rounded"
    style={{
      backgroundColor: `${COLORS.ETH}20`,
      color: COLORS.ETH,
    }}
  >
    ETH {eth.toFixed(1)}%
  </span>
);
