"use client";

import { CompareChart } from "@/components/crypto/CompareChart";
import { useCryptoList } from "@/hooks/useCryptoData";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function ComparePage() {
  const { data: cryptoList, isLoading } = useCryptoList(20);

  const performanceData = cryptoList?.map((crypto) => ({
    ...crypto,
    performance24h: crypto.price_change_percentage_24h || 0,
    performance7d: crypto.price_change_percentage_7d_in_currency || 0,
    performance30d: crypto.price_change_percentage_30d_in_currency || 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text">Compare Assets</h1>
        <p className="text-crypto-muted mt-1">
          Compare performance of multiple cryptocurrencies
        </p>
      </div>

      <CompareChart />

      <div className="bg-crypto-card rounded-lg border border-crypto-border overflow-hidden">
        <div className="p-6 border-b border-crypto-border">
          <h3 className="font-semibold text-crypto-text text-lg">
            Performance Overview
          </h3>
        </div>

        {isLoading ? (
          <div className="p-4 animate-pulse space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 bg-crypto-border rounded" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-crypto-border">
                  <th className="text-left text-crypto-muted text-sm font-medium p-4">
                    Asset
                  </th>
                  <th className="text-right text-crypto-muted text-sm font-medium p-4">
                    Price
                  </th>
                  <th className="text-right text-crypto-muted text-sm font-medium p-4">
                    24h
                  </th>
                  <th className="text-right text-crypto-muted text-sm font-medium p-4">
                    7d
                  </th>
                  <th className="text-right text-crypto-muted text-sm font-medium p-4">
                    30d
                  </th>
                  <th className="text-right text-crypto-muted text-sm font-medium p-4">
                    Market Cap
                  </th>
                </tr>
              </thead>
              <tbody>
                {performanceData?.map((crypto) => (
                  <tr
                    key={crypto.id}
                    className="border-b border-crypto-border/50 hover:bg-crypto-border/20"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Image
                          src={crypto.image}
                          alt={crypto.name}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                        <div>
                          <p className="text-crypto-text font-medium">
                            {crypto.name}
                          </p>
                          <p className="text-crypto-muted text-sm uppercase">
                            {crypto.symbol}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right p-4 font-mono text-crypto-text">
                      ${crypto.current_price.toLocaleString()}
                    </td>
                    <PerformanceCell value={crypto.performance24h} />
                    <PerformanceCell value={crypto.performance7d} />
                    <PerformanceCell value={crypto.performance30d} />
                    <td className="text-right p-4 text-crypto-muted font-mono">
                      ${(crypto.market_cap / 1e9).toFixed(2)}B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceCell({ value }: { value: number }) {
  return (
    <td className="text-right p-4">
      <span
        className={cn(
          "inline-flex items-center font-medium",
          value >= 0 ? "text-crypto-positive" : "text-crypto-negative"
        )}
      >
        {value >= 0 ? (
          <TrendingUp className="w-3 h-3 mr-1" />
        ) : (
          <TrendingDown className="w-3 h-3 mr-1" />
        )}
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}%
      </span>
    </td>
  );
}
