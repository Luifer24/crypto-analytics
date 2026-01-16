"use client";

import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

const timeRanges = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

// Coins to track for dominance (top coins by market cap)
const TRACKED_COINS = [
  { id: "bitcoin", symbol: "BTC", color: "#f7931a" },
  { id: "ethereum", symbol: "ETH", color: "#627eea" },
  { id: "tether", symbol: "USDT", color: "#26a17b" },
  { id: "binancecoin", symbol: "BNB", color: "#f3ba2f" },
  { id: "solana", symbol: "SOL", color: "#9945ff" },
];

interface MarketCapPoint {
  timestamp: number;
  marketCap: number;
}

const fetchMarketCapHistory = async (coinId: string, days: number): Promise<MarketCapPoint[]> => {
  const response = await fetch(
    `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  );
  if (!response.ok) throw new Error("Failed to fetch");
  const data = await response.json();
  return data.market_caps.map(([timestamp, marketCap]: [number, number]) => ({
    timestamp,
    marketCap,
  }));
};

export const DominanceHistoryChart = () => {
  const [days, setDays] = useState(30);

  const queries = useQueries({
    queries: TRACKED_COINS.map((coin) => ({
      queryKey: ["marketCapHistory", coin.id, days],
      queryFn: () => fetchMarketCapHistory(coin.id, days),
      staleTime: 60 * 60 * 1000,
      retry: 2,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const hasData = queries.every((q) => q.data && q.data.length > 0);

  const chartData = useMemo(() => {
    if (!hasData) return [];

    // Get all unique timestamps
    const allTimestamps = new Set<number>();
    queries.forEach((q) => {
      q.data?.forEach((point) => {
        // Round to hour
        const rounded = Math.floor(point.timestamp / (1000 * 60 * 60)) * 1000 * 60 * 60;
        allTimestamps.add(rounded);
      });
    });

    const sortedTimestamps = Array.from(allTimestamps).sort();

    return sortedTimestamps.map((timestamp) => {
      const point: Record<string, number> = { time: timestamp };

      // Calculate total market cap for this timestamp
      let totalMarketCap = 0;
      const marketCaps: Record<string, number> = {};

      TRACKED_COINS.forEach((coin, idx) => {
        const data = queries[idx].data;
        if (!data) return;

        // Find closest data point
        const closest = data.reduce((prev, curr) =>
          Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp)
            ? curr
            : prev
        );

        marketCaps[coin.id] = closest.marketCap;
        totalMarketCap += closest.marketCap;
      });

      // Calculate dominance percentages
      // We need to estimate "Others" - assume tracked coins are ~70% of market
      const trackedTotal = totalMarketCap;
      const estimatedTotal = trackedTotal / 0.7; // Rough estimate

      TRACKED_COINS.forEach((coin) => {
        point[coin.symbol] = (marketCaps[coin.id] / estimatedTotal) * 100;
      });

      // Others
      point["Others"] = 100 - TRACKED_COINS.reduce((sum, coin) => sum + (point[coin.symbol] || 0), 0);

      return point;
    });
  }, [queries, hasData]);

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-crypto-text text-lg">Dominance Evolution</h3>
          <p className="text-crypto-muted text-sm mt-1">Historical market dominance trends</p>
        </div>
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
        {isLoading ? (
          <div className="animate-pulse h-full bg-crypto-border rounded" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                tickFormatter={(ts) => format(new Date(ts), days <= 7 ? "MMM d" : "MMM d")}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 70]}
                tickFormatter={(v) => `${v}%`}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload?.length && label) {
                    return (
                      <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-crypto-muted text-xs mb-2">
                          {format(new Date(label as number), "MMM d, yyyy")}
                        </p>
                        {payload.map((entry, index) => (
                          <p
                            key={index}
                            className="text-sm"
                            style={{ color: entry.color }}
                          >
                            {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(2) : 0}%
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
              {TRACKED_COINS.map((coin) => (
                <Line
                  key={coin.id}
                  type="monotone"
                  dataKey={coin.symbol}
                  stroke={coin.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
              <Line
                type="monotone"
                dataKey="Others"
                stroke="#64748b"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-crypto-muted">
            Failed to load dominance data
          </div>
        )}
      </div>
    </div>
  );
};
