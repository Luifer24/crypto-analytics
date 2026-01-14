"use client";

import { useState } from "react";
import { PriceChart } from "@/components/crypto/PriceChart";
import { useCryptoList } from "@/hooks/useCryptoData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

export default function ChartsPage() {
  const [selectedCoin, setSelectedCoin] = useState("bitcoin");
  const { data: cryptoList } = useCryptoList(50);

  const coin = cryptoList?.find((c) => c.id === selectedCoin);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text">Price Charts</h1>
          <p className="text-crypto-muted mt-1">
            Detailed price analysis and trends
          </p>
        </div>

        <Select value={selectedCoin} onValueChange={setSelectedCoin}>
          <SelectTrigger className="w-48 bg-crypto-card border-crypto-border text-crypto-text">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-crypto-card border-crypto-border max-h-80">
            {cryptoList?.map((crypto) => (
              <SelectItem
                key={crypto.id}
                value={crypto.id}
                className="text-crypto-text hover:bg-crypto-border"
              >
                <div className="flex items-center gap-2">
                  <Image
                    src={crypto.image}
                    alt={crypto.name}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <span>{crypto.name}</span>
                  <span className="text-crypto-muted text-xs uppercase">
                    {crypto.symbol}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PriceChart coinId={selectedCoin} />

      {coin && (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text mb-4">Key Statistics</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatBox label="Market Cap Rank" value={`#${coin.market_cap_rank}`} />
            <StatBox label="Market Cap" value={`$${(coin.market_cap / 1e9).toFixed(2)}B`} />
            <StatBox label="24h Volume" value={`$${(coin.total_volume / 1e9).toFixed(2)}B`} />
            <StatBox label="All-Time High" value={`$${coin.ath.toLocaleString()}`} />
            <StatBox label="ATH Change" value={`${coin.ath_change_percentage.toFixed(2)}%`} />
            <StatBox label="Circulating Supply" value={`${(coin.circulating_supply / 1e6).toFixed(2)}M ${coin.symbol.toUpperCase()}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-crypto-bg rounded-lg p-4">
      <p className="text-crypto-muted text-xs mb-1">{label}</p>
      <p className="text-crypto-text font-semibold">{value}</p>
    </div>
  );
}
