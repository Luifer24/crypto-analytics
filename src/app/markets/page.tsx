"use client";

import { useState } from "react";
import { CryptoTable } from "@/components/crypto/CryptoTable";
import { PriceChart } from "@/components/crypto/PriceChart";

export default function MarketsPage() {
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text">Markets</h1>
        <p className="text-crypto-muted mt-1">
          Top cryptocurrencies by market capitalization
        </p>
      </div>

      {selectedCoin && (
        <div className="relative">
          <button
            onClick={() => setSelectedCoin(null)}
            className="absolute top-4 right-4 z-10 text-crypto-muted hover:text-crypto-text text-sm"
          >
            Close
          </button>
          <PriceChart coinId={selectedCoin} />
        </div>
      )}

      <CryptoTable limit={50} onSelectCoin={setSelectedCoin} />
    </div>
  );
}
