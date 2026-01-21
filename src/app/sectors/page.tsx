"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSectorPerformance, formatMarketCap, formatVolume } from "@/hooks/useSectorData";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SectorsPage() {
  const { sectors, isLoading } = useSectorPerformance(250);

  // Calculate totals for market overview
  const totals = useMemo(() => {
    const totalMarketCap = sectors.reduce((sum, s) => sum + s.marketCap, 0);
    const totalVolume = sectors.reduce((sum, s) => sum + s.volume24h, 0);

    // Find best and worst performing sectors
    const sortedByChange = [...sectors].sort((a, b) => b.priceChange24h - a.priceChange24h);
    const bestSector = sortedByChange[0];
    const worstSector = sortedByChange[sortedByChange.length - 1];

    return { totalMarketCap, totalVolume, bestSector, worstSector };
  }, [sectors]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text">Sectors</h1>
          <p className="text-crypto-muted mt-1">Loading sector data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-crypto-card border border-crypto-border rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-crypto-text">Crypto Sectors</h1>
        <p className="text-crypto-muted mt-1">
          Performance overview by sector - weighted by market cap
        </p>
      </div>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <p className="text-crypto-muted text-sm mb-1">Total Tracked</p>
          <p className="text-xl font-bold text-crypto-text">
            {formatMarketCap(totals.totalMarketCap)}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {sectors.reduce((sum, s) => sum + s.coinCount, 0)} coins across{" "}
            {sectors.length} sectors
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <p className="text-crypto-muted text-sm mb-1">24h Volume</p>
          <p className="text-xl font-bold text-crypto-text">
            {formatVolume(totals.totalVolume)}
          </p>
        </div>

        {totals.bestSector && (
          <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
            <p className="text-crypto-muted text-sm mb-1">Best Performer</p>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: totals.bestSector.color }}
              />
              <p className="text-lg font-bold text-crypto-text">
                {totals.bestSector.name}
              </p>
            </div>
            <p className="text-crypto-positive text-sm font-medium mt-1">
              +{totals.bestSector.priceChange24h.toFixed(2)}%
            </p>
          </div>
        )}

        {totals.worstSector && (
          <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
            <p className="text-crypto-muted text-sm mb-1">Worst Performer</p>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: totals.worstSector.color }}
              />
              <p className="text-lg font-bold text-crypto-text">
                {totals.worstSector.name}
              </p>
            </div>
            <p className="text-crypto-negative text-sm font-medium mt-1">
              {totals.worstSector.priceChange24h.toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      {/* Sector Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectors.map((sector) => (
          <Link
            key={sector.id}
            href={`/markets?sector=${sector.id}`}
            className="group bg-crypto-card rounded-lg border border-crypto-border p-5 hover:border-crypto-accent/50 transition-all hover:shadow-lg"
          >
            {/* Sector Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${sector.color}20` }}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: sector.color }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-crypto-text group-hover:text-crypto-accent transition-colors">
                    {sector.name}
                  </h3>
                  <p className="text-xs text-crypto-muted">
                    {sector.coinCount} coins
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-crypto-muted group-hover:text-crypto-accent transition-colors" />
            </div>

            {/* Performance */}
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-xs text-crypto-muted">24h</p>
                <div
                  className={cn(
                    "flex items-center gap-1 font-semibold",
                    sector.priceChange24h >= 0
                      ? "text-crypto-positive"
                      : "text-crypto-negative"
                  )}
                >
                  {sector.priceChange24h >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {sector.priceChange24h >= 0 ? "+" : ""}
                  {sector.priceChange24h.toFixed(2)}%
                </div>
              </div>
              <div>
                <p className="text-xs text-crypto-muted">7d</p>
                <div
                  className={cn(
                    "flex items-center gap-1 font-semibold",
                    sector.priceChange7d >= 0
                      ? "text-crypto-positive"
                      : "text-crypto-negative"
                  )}
                >
                  {sector.priceChange7d >= 0 ? "+" : ""}
                  {sector.priceChange7d.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Market Cap & Volume */}
            <div className="flex items-center gap-4 text-sm mb-4">
              <div>
                <p className="text-crypto-muted text-xs">Market Cap</p>
                <p className="text-crypto-text font-mono">
                  {formatMarketCap(sector.marketCap)}
                </p>
              </div>
              <div>
                <p className="text-crypto-muted text-xs">Volume 24h</p>
                <p className="text-crypto-text font-mono">
                  {formatVolume(sector.volume24h)}
                </p>
              </div>
            </div>

            {/* Top 3 Coins */}
            {sector.topCoins.length > 0 && (
              <div className="pt-3 border-t border-crypto-border">
                <p className="text-xs text-crypto-muted mb-2">Top Coins</p>
                <div className="flex items-center gap-2">
                  {sector.topCoins.map((coin) => (
                    <div
                      key={coin.id}
                      className="flex items-center gap-1.5 bg-crypto-bg px-2 py-1 rounded"
                    >
                      <Image
                        src={coin.image}
                        alt={coin.name}
                        width={16}
                        height={16}
                        className="rounded-full"
                      />
                      <span className="text-xs text-crypto-text font-medium uppercase">
                        {coin.symbol}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          (coin.price_change_percentage_24h || 0) >= 0
                            ? "text-crypto-positive"
                            : "text-crypto-negative"
                        )}
                      >
                        {(coin.price_change_percentage_24h || 0) >= 0 ? "+" : ""}
                        {(coin.price_change_percentage_24h || 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Info footer */}
      <div className="text-center text-crypto-muted text-sm py-4">
        <p>
          Sector performance is calculated as weighted average by market cap.
        </p>
        <p className="text-xs mt-1">
          Only coins in the top 100 by market cap are included in calculations.
        </p>
      </div>
    </div>
  );
}
