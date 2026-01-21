"use client";

import { useMemo } from "react";
import { useCryptoList } from "@/hooks/useCryptoData";
import { FearGreedCard } from "@/components/crypto/FearGreedIndex";
import { DominanceHistoryChart } from "@/components/crypto/DominanceHistoryChart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function SignalsPage() {
  const { data: cryptoList, isLoading } = useCryptoList(50);

  // Market Breadth calculations
  const marketBreadth = useMemo(() => {
    if (!cryptoList) return null;

    const gainers = cryptoList.filter((c) => c.price_change_percentage_24h > 0);
    const losers = cryptoList.filter((c) => c.price_change_percentage_24h < 0);
    const unchanged = cryptoList.filter((c) => c.price_change_percentage_24h === 0);

    const avgChange = cryptoList.reduce((sum, c) => sum + (c.price_change_percentage_24h || 0), 0) / cryptoList.length;

    // Calculate 7d breadth
    const gainers7d = cryptoList.filter((c) => (c.price_change_percentage_7d_in_currency || 0) > 0);
    const losers7d = cryptoList.filter((c) => (c.price_change_percentage_7d_in_currency || 0) < 0);

    return {
      gainers: gainers.length,
      losers: losers.length,
      unchanged: unchanged.length,
      total: cryptoList.length,
      ratio: gainers.length / (losers.length || 1),
      avgChange,
      gainers7d: gainers7d.length,
      losers7d: losers7d.length,
    };
  }, [cryptoList]);

  // Top Movers
  const topMovers = useMemo(() => {
    if (!cryptoList) return { gainers: [], losers: [] };

    const sorted = [...cryptoList].sort(
      (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
    );

    return {
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
    };
  }, [cryptoList]);

  // Volume Analysis
  const volumeData = useMemo(() => {
    if (!cryptoList) return [];

    return cryptoList
      .slice(0, 10)
      .map((crypto) => ({
        name: crypto.symbol.toUpperCase(),
        volume: crypto.total_volume / 1e9,
        volumeToMcap: (crypto.total_volume / crypto.market_cap) * 100,
        color: crypto.price_change_percentage_24h >= 0 ? "#22c55e" : "#ef4444",
      }));
  }, [cryptoList]);

  // Volatility Ranking (using 24h high-low range as proxy)
  const volatilityRanking = useMemo(() => {
    if (!cryptoList) return [];

    return cryptoList
      .map((crypto) => {
        const range = crypto.high_24h && crypto.low_24h
          ? ((crypto.high_24h - crypto.low_24h) / crypto.low_24h) * 100
          : 0;
        return {
          ...crypto,
          volatility: range,
        };
      })
      .sort((a, b) => b.volatility - a.volatility)
      .slice(0, 10);
  }, [cryptoList]);

  // Sentiment gauge data
  const sentimentData = useMemo(() => {
    if (!marketBreadth) return [];
    return [
      { name: "Bullish", value: marketBreadth.gainers, fill: "#22c55e" },
      { name: "Bearish", value: marketBreadth.losers, fill: "#ef4444" },
    ];
  }, [marketBreadth]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-crypto-card rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-crypto-card rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text">Market Signals</h1>
        <p className="text-crypto-muted mt-1">
          Real-time market breadth, movers, and volatility signals
        </p>
      </div>

      {/* Fear & Greed Index */}
      <FearGreedCard />

      {/* Bitcoin Dominance */}
      <DominanceHistoryChart />

      {/* Market Breadth Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <TrendingUp className="w-4 h-4 text-crypto-positive" />
            Gainers (24h)
          </div>
          <p className="text-2xl font-bold text-crypto-positive">
            {marketBreadth?.gainers || 0}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {((marketBreadth?.gainers || 0) / (marketBreadth?.total || 1) * 100).toFixed(0)}% of market
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <TrendingDown className="w-4 h-4 text-crypto-negative" />
            Losers (24h)
          </div>
          <p className="text-2xl font-bold text-crypto-negative">
            {marketBreadth?.losers || 0}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {((marketBreadth?.losers || 0) / (marketBreadth?.total || 1) * 100).toFixed(0)}% of market
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <Activity className="w-4 h-4" />
            Avg Change (24h)
          </div>
          <p className={cn(
            "text-2xl font-bold",
            (marketBreadth?.avgChange || 0) >= 0 ? "text-crypto-positive" : "text-crypto-negative"
          )}>
            {(marketBreadth?.avgChange || 0) >= 0 ? "+" : ""}
            {(marketBreadth?.avgChange || 0).toFixed(2)}%
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            Top 50 average
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Bull/Bear Ratio
          </div>
          <p className={cn(
            "text-2xl font-bold",
            (marketBreadth?.ratio || 0) >= 1 ? "text-crypto-positive" : "text-crypto-negative"
          )}>
            {(marketBreadth?.ratio || 0).toFixed(2)}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {(marketBreadth?.ratio || 0) >= 1 ? "Bullish" : "Bearish"} sentiment
          </p>
        </div>
      </div>

      {/* Sentiment Gauge + Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text mb-4">Market Sentiment</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                  startAngle={180}
                  endAngle={0}
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      return (
                        <div className="bg-crypto-card border border-crypto-border rounded px-2 py-1 text-sm">
                          {payload[0].name}: {payload[0].value}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-crypto-positive" />
              Bullish: {marketBreadth?.gainers}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-crypto-negative" />
              Bearish: {marketBreadth?.losers}
            </span>
          </div>
        </div>

        {/* Top Gainers */}
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-crypto-positive" />
            Top Gainers (24h)
          </h3>
          <div className="space-y-3">
            {topMovers.gainers.map((crypto) => (
              <div key={crypto.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image src={crypto.image} alt={crypto.name} width={24} height={24} className="rounded-full" />
                  <span className="text-crypto-text font-medium">{crypto.symbol.toUpperCase()}</span>
                </div>
                <span className="text-crypto-positive font-mono text-sm">
                  +{crypto.price_change_percentage_24h?.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-crypto-negative" />
            Top Losers (24h)
          </h3>
          <div className="space-y-3">
            {topMovers.losers.map((crypto) => (
              <div key={crypto.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image src={crypto.image} alt={crypto.name} width={24} height={24} className="rounded-full" />
                  <span className="text-crypto-text font-medium">{crypto.symbol.toUpperCase()}</span>
                </div>
                <span className="text-crypto-negative font-mono text-sm">
                  {crypto.price_change_percentage_24h?.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Volume Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text text-lg mb-4">
            24h Volume (Top 10)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `$${v}B`}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2">
                          <p className="text-crypto-text font-semibold">{data.name}</p>
                          <p className="text-crypto-muted text-sm">Volume: ${data.volume.toFixed(2)}B</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                  {volumeData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text text-lg mb-4">
            Volume/Market Cap Ratio
          </h3>
          <p className="text-crypto-muted text-sm mb-4">Higher ratio = more liquid/active trading</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} stroke="#64748b" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={50} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2">
                          <p className="text-crypto-text font-semibold">{data.name}</p>
                          <p className="text-crypto-muted text-sm">V/MC: {data.volumeToMcap.toFixed(2)}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="volumeToMcap" radius={[0, 4, 4, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Volatility Ranking */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-2">
          Volatility Ranking (24h Range)
        </h3>
        <p className="text-crypto-muted text-sm mb-4">
          Coins with highest price range in last 24 hours - potential arbitrage opportunities
        </p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-crypto-border">
                <th className="text-left text-crypto-muted text-sm font-medium py-3 px-2">#</th>
                <th className="text-left text-crypto-muted text-sm font-medium py-3 px-2">Coin</th>
                <th className="text-right text-crypto-muted text-sm font-medium py-3 px-2">Price</th>
                <th className="text-right text-crypto-muted text-sm font-medium py-3 px-2">24h Low</th>
                <th className="text-right text-crypto-muted text-sm font-medium py-3 px-2">24h High</th>
                <th className="text-right text-crypto-muted text-sm font-medium py-3 px-2">Range %</th>
                <th className="text-right text-crypto-muted text-sm font-medium py-3 px-2">24h Change</th>
              </tr>
            </thead>
            <tbody>
              {volatilityRanking.map((crypto, idx) => (
                <tr key={crypto.id} className="border-b border-crypto-border/50 hover:bg-crypto-border/20">
                  <td className="py-3 px-2 text-crypto-muted">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <Image src={crypto.image} alt={crypto.name} width={24} height={24} className="rounded-full" />
                      <span className="text-crypto-text font-medium">{crypto.symbol.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-crypto-text">
                    ${crypto.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-crypto-negative">
                    ${crypto.low_24h?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-crypto-positive">
                    ${crypto.high_24h?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="font-mono text-yellow-500 font-semibold">
                      {crypto.volatility.toFixed(2)}%
                    </span>
                  </td>
                  <td className={cn(
                    "py-3 px-2 text-right font-mono",
                    crypto.price_change_percentage_24h >= 0 ? "text-crypto-positive" : "text-crypto-negative"
                  )}>
                    {crypto.price_change_percentage_24h >= 0 ? "+" : ""}
                    {crypto.price_change_percentage_24h?.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
