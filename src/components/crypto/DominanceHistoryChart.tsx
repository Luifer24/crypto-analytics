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
  AreaChart,
  Area,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CRYPTOCOMPARE_API = "https://min-api.cryptocompare.com/data/v2";

const timeRanges = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

// Top coins to track - using CryptoCompare symbols
const TRACKED_COINS = [
  { symbol: "BTC", name: "Bitcoin", color: "#f7931a" },
  { symbol: "ETH", name: "Ethereum", color: "#627eea" },
  { symbol: "USDT", name: "Tether", color: "#26a17b" },
  { symbol: "BNB", name: "BNB", color: "#f3ba2f" },
  { symbol: "SOL", name: "Solana", color: "#9945ff" },
];

interface PricePoint {
  timestamp: number;
  price: number;
}

const fetchPriceHistory = async (symbol: string, days: number): Promise<PricePoint[]> => {
  const endpoint = days <= 1 ? "histohour" : "histoday";
  const limit = days <= 1 ? 24 : Math.min(days, 365);

  const response = await fetch(
    `${CRYPTOCOMPARE_API}/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}`
  );

  if (!response.ok) throw new Error("Failed to fetch");
  const json = await response.json();

  if (json.Response !== "Success") throw new Error("API error");

  return json.Data.Data.map((item: { time: number; close: number }) => ({
    timestamp: item.time * 1000,
    price: item.close,
  }));
};

// Approximate circulating supplies (updated periodically)
const CIRCULATING_SUPPLY: Record<string, number> = {
  BTC: 19_800_000,
  ETH: 120_000_000,
  USDT: 140_000_000_000,
  BNB: 145_000_000,
  SOL: 440_000_000,
};

export const DominanceHistoryChart = () => {
  const [days, setDays] = useState(30);

  const queries = useQueries({
    queries: TRACKED_COINS.map((coin) => ({
      queryKey: ["cryptoCompareDominance", coin.symbol, days],
      queryFn: () => fetchPriceHistory(coin.symbol, days),
      staleTime: 60 * 60 * 1000,
      retry: 2,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const hasError = queries.some((q) => q.isError);
  const hasData = queries.every((q) => q.data && q.data.length > 0);

  const chartData = useMemo(() => {
    if (!hasData) return [];

    // Get BTC data as reference for timestamps
    const btcData = queries[0].data;
    if (!btcData) return [];

    return btcData.map((btcPoint, idx) => {
      const point: Record<string, number> = { time: btcPoint.timestamp };

      // Calculate market caps for each coin
      let totalMarketCap = 0;
      const marketCaps: Record<string, number> = {};

      TRACKED_COINS.forEach((coin, coinIdx) => {
        const coinData = queries[coinIdx].data;
        if (!coinData || !coinData[idx]) return;

        const price = coinData[idx].price;
        const supply = CIRCULATING_SUPPLY[coin.symbol] || 1;
        const marketCap = price * supply;

        marketCaps[coin.symbol] = marketCap;
        totalMarketCap += marketCap;
      });

      // Estimate total crypto market cap (tracked coins are ~75% of market)
      const estimatedTotalMarket = totalMarketCap / 0.75;

      // Calculate dominance percentages
      TRACKED_COINS.forEach((coin) => {
        point[coin.symbol] = ((marketCaps[coin.symbol] || 0) / estimatedTotalMarket) * 100;
      });

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
        ) : hasError ? (
          <div className="h-full flex items-center justify-center text-crypto-muted">
            Error loading data. Please try again.
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} stackOffset="expand">
              <XAxis
                dataKey="time"
                tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
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
                            {entry.name}: {typeof entry.value === "number" ? (entry.value * 100).toFixed(2) : 0}%
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
                <Area
                  key={coin.symbol}
                  type="monotone"
                  dataKey={coin.symbol}
                  stackId="1"
                  stroke={coin.color}
                  fill={coin.color}
                  fillOpacity={0.8}
                />
              ))}
              <Area
                type="monotone"
                dataKey="Others"
                stackId="1"
                stroke="#64748b"
                fill="#64748b"
                fillOpacity={0.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-crypto-muted">
            No data available
          </div>
        )}
      </div>
    </div>
  );
};
