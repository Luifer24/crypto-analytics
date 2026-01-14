"use client";

import { useGlobalData } from "@/hooks/useCryptoData";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(decimals)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
  return `$${num.toFixed(decimals)}`;
};

export const GlobalMetrics = () => {
  const { data: globalData, isLoading } = useGlobalData();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-crypto-card rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-crypto-border rounded w-24 mb-2" />
            <div className="h-6 bg-crypto-border rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (!globalData) return null;

  const marketCap = globalData.total_market_cap?.usd || 0;
  const volume = globalData.total_volume?.usd || 0;
  const btcDominance = globalData.market_cap_percentage?.btc || 0;
  const ethDominance = globalData.market_cap_percentage?.eth || 0;
  const change24h = globalData.market_cap_change_percentage_24h_usd || 0;

  const metrics = [
    {
      label: "Total Market Cap",
      value: formatNumber(marketCap),
      change: change24h,
      icon: DollarSign,
    },
    {
      label: "24h Volume",
      value: formatNumber(volume),
      icon: BarChart3,
    },
    {
      label: "BTC Dominance",
      value: `${btcDominance.toFixed(1)}%`,
      icon: Activity,
    },
    {
      label: "ETH Dominance",
      value: `${ethDominance.toFixed(1)}%`,
      icon: Activity,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="bg-crypto-card rounded-lg p-4 border border-crypto-border"
        >
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-1">
            <metric.icon className="w-4 h-4" />
            {metric.label}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-crypto-text">
              {metric.value}
            </span>
            {metric.change !== undefined && (
              <span
                className={cn(
                  "flex items-center text-sm font-medium",
                  metric.change >= 0 ? "text-crypto-positive" : "text-crypto-negative"
                )}
              >
                {metric.change >= 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {Math.abs(metric.change).toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
