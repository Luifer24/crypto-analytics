"use client";

import { GlobalMetrics } from "@/components/crypto/GlobalMetrics";
import { PriceChart } from "@/components/crypto/PriceChart";
import { TopMovers } from "@/components/crypto/TopMovers";
import { DominanceChart } from "@/components/crypto/DominanceChart";
import { FearGreedMini } from "@/components/crypto/FearGreedIndex";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-crypto-text">Market Overview</h1>
        <p className="text-crypto-muted mt-1">
          Real-time cryptocurrency market data
        </p>
      </div>

      {/* Global Metrics */}
      <GlobalMetrics />

      {/* Fear & Greed Mini Widget */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FearGreedMini />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <PriceChart coinId="bitcoin" />
        </div>
        <div>
          <DominanceChart />
        </div>
      </div>

      {/* Top Movers */}
      <TopMovers />
    </div>
  );
}
