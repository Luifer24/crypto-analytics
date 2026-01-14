"use client";

import { useState, useEffect } from "react";
import { useCryptoList } from "@/hooks/useCryptoData";
import { Star, TrendingUp, TrendingDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniSparkline } from "@/components/crypto/MiniSparkline";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

const STORAGE_KEY = "crypto-watchlist";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string>("");
  const { data: cryptoList, isLoading } = useCryptoList(100);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setWatchlist(JSON.parse(saved));
    } else {
      setWatchlist(["bitcoin", "ethereum", "solana", "cardano", "polkadot"]);
    }
  }, []);

  useEffect(() => {
    if (watchlist.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    }
  }, [watchlist]);

  const addToWatchlist = () => {
    if (selectedCoin && !watchlist.includes(selectedCoin)) {
      setWatchlist([...watchlist, selectedCoin]);
      setSelectedCoin("");
    }
  };

  const removeFromWatchlist = (coinId: string) => {
    setWatchlist(watchlist.filter((id) => id !== coinId));
  };

  const watchlistCoins = cryptoList?.filter((crypto) =>
    watchlist.includes(crypto.id)
  );

  const availableCoins = cryptoList?.filter(
    (crypto) => !watchlist.includes(crypto.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" />
            Watchlist
          </h1>
          <p className="text-crypto-muted mt-1">
            Track your favorite cryptocurrencies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedCoin} onValueChange={setSelectedCoin}>
            <SelectTrigger className="w-48 bg-crypto-card border-crypto-border text-crypto-text">
              <SelectValue placeholder="Select coin..." />
            </SelectTrigger>
            <SelectContent className="bg-crypto-card border-crypto-border max-h-80">
              {availableCoins?.map((crypto) => (
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
                    <span>{crypto.symbol.toUpperCase()}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={addToWatchlist}
            disabled={!selectedCoin}
            className="bg-crypto-accent text-crypto-bg hover:bg-crypto-accent/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-crypto-card rounded-lg border border-crypto-border p-6 animate-pulse"
            >
              <div className="h-20 bg-crypto-border rounded" />
            </div>
          ))}
        </div>
      ) : watchlistCoins?.length === 0 ? (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-12 text-center">
          <Star className="w-12 h-12 text-crypto-muted mx-auto mb-4" />
          <h3 className="text-crypto-text font-semibold mb-2">
            Your watchlist is empty
          </h3>
          <p className="text-crypto-muted">
            Add cryptocurrencies to track their performance
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchlistCoins?.map((crypto) => {
            const change24h = crypto.price_change_percentage_24h || 0;
            const change7d = crypto.price_change_percentage_7d_in_currency || 0;

            return (
              <div
                key={crypto.id}
                className="bg-crypto-card rounded-lg border border-crypto-border p-6 hover:border-crypto-accent/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src={crypto.image}
                      alt={crypto.name}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                    <div>
                      <h3 className="text-crypto-text font-semibold">
                        {crypto.name}
                      </h3>
                      <p className="text-crypto-muted text-sm uppercase">
                        {crypto.symbol}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromWatchlist(crypto.id)}
                    className="text-crypto-muted hover:text-crypto-negative opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-2xl font-bold text-crypto-text font-mono">
                    ${crypto.current_price.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={cn(
                        "inline-flex items-center text-sm font-medium",
                        change24h >= 0
                          ? "text-crypto-positive"
                          : "text-crypto-negative"
                      )}
                    >
                      {change24h >= 0 ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {change24h >= 0 ? "+" : ""}
                      {change24h.toFixed(2)}% 24h
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        change7d >= 0
                          ? "text-crypto-positive"
                          : "text-crypto-negative"
                      )}
                    >
                      {change7d >= 0 ? "+" : ""}
                      {change7d.toFixed(2)}% 7d
                    </span>
                  </div>
                </div>

                {crypto.sparkline_in_7d?.price && (
                  <MiniSparkline
                    data={crypto.sparkline_in_7d.price}
                    positive={change7d >= 0}
                    width={200}
                    height={40}
                  />
                )}

                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-crypto-border">
                  <div>
                    <p className="text-crypto-muted text-xs">Market Cap</p>
                    <p className="text-crypto-text font-medium">
                      ${(crypto.market_cap / 1e9).toFixed(2)}B
                    </p>
                  </div>
                  <div>
                    <p className="text-crypto-muted text-xs">Volume 24h</p>
                    <p className="text-crypto-text font-medium">
                      ${(crypto.total_volume / 1e9).toFixed(2)}B
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
