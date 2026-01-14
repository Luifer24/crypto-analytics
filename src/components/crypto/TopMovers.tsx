"use client";

import { useCryptoList } from "@/hooks/useCryptoData";
import { TrendingUp, TrendingDown } from "lucide-react";
import Image from "next/image";

export const TopMovers = () => {
  const { data: cryptos, isLoading } = useCryptoList(50);

  if (isLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-crypto-border rounded w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-crypto-border rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...(cryptos || [])].sort(
    (a, b) =>
      Math.abs(b.price_change_percentage_24h) -
      Math.abs(a.price_change_percentage_24h)
  );

  const gainers = sorted
    .filter((c) => c.price_change_percentage_24h > 0)
    .slice(0, 5);
  const losers = sorted
    .filter((c) => c.price_change_percentage_24h < 0)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Gainers */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-crypto-positive" />
          <h3 className="font-semibold text-crypto-text">Top Gainers</h3>
        </div>
        <div className="space-y-3">
          {gainers.map((crypto, index) => (
            <div
              key={crypto.id}
              className="flex items-center justify-between py-2 border-b border-crypto-border/50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-crypto-muted text-sm w-4">{index + 1}</span>
                <Image
                  src={crypto.image}
                  alt={crypto.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <div>
                  <p className="text-crypto-text font-medium text-sm">{crypto.symbol.toUpperCase()}</p>
                  <p className="text-crypto-muted text-xs">${crypto.current_price.toLocaleString()}</p>
                </div>
              </div>
              <span className="text-crypto-positive font-semibold">
                +{crypto.price_change_percentage_24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-crypto-negative" />
          <h3 className="font-semibold text-crypto-text">Top Losers</h3>
        </div>
        <div className="space-y-3">
          {losers.map((crypto, index) => (
            <div
              key={crypto.id}
              className="flex items-center justify-between py-2 border-b border-crypto-border/50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-crypto-muted text-sm w-4">{index + 1}</span>
                <Image
                  src={crypto.image}
                  alt={crypto.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <div>
                  <p className="text-crypto-text font-medium text-sm">{crypto.symbol.toUpperCase()}</p>
                  <p className="text-crypto-muted text-xs">${crypto.current_price.toLocaleString()}</p>
                </div>
              </div>
              <span className="text-crypto-negative font-semibold">
                {crypto.price_change_percentage_24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
