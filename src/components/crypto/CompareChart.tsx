"use client";

import { useState, useMemo } from "react";
import { useCryptoList } from "@/hooks/useCryptoData";
import { useCryptoComparePriceHistory, isCryptoCompareSupported } from "@/hooks/useCryptoCompareData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

const timeRanges = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export const CompareChart = () => {
  const [selectedCoins, setSelectedCoins] = useState<string[]>(["bitcoin", "ethereum"]);
  const [days, setDays] = useState(30);
  const { data: cryptoList } = useCryptoList(50);

  // Filter to only supported coins
  const supportedCryptos = cryptoList?.filter(c => isCryptoCompareSupported(c.id));

  const { data: coin1Data } = useCryptoComparePriceHistory(selectedCoins[0], days);
  const { data: coin2Data } = useCryptoComparePriceHistory(selectedCoins[1], days);
  const { data: coin3Data } = useCryptoComparePriceHistory(selectedCoins[2] || "", days);
  const { data: coin4Data } = useCryptoComparePriceHistory(selectedCoins[3] || "", days);
  const { data: coin5Data } = useCryptoComparePriceHistory(selectedCoins[4] || "", days);

  const coinDataMap = useMemo(() => {
    const map: Record<string, typeof coin1Data> = {};
    if (selectedCoins[0] && coin1Data) map[selectedCoins[0]] = coin1Data;
    if (selectedCoins[1] && coin2Data) map[selectedCoins[1]] = coin2Data;
    if (selectedCoins[2] && coin3Data) map[selectedCoins[2]] = coin3Data;
    if (selectedCoins[3] && coin4Data) map[selectedCoins[3]] = coin4Data;
    if (selectedCoins[4] && coin5Data) map[selectedCoins[4]] = coin5Data;
    return map;
  }, [selectedCoins, coin1Data, coin2Data, coin3Data, coin4Data, coin5Data]);

  const chartData = useMemo(() => {
    const allTimestamps = new Set<number>();
    Object.values(coinDataMap).forEach((data) => {
      data?.forEach((point) => {
        allTimestamps.add(Math.floor(point.timestamp / (1000 * 60 * 60)) * 1000 * 60 * 60);
      });
    });

    const sortedTimestamps = Array.from(allTimestamps).sort();

    const initialPrices: Record<string, number> = {};
    Object.entries(coinDataMap).forEach(([coinId, data]) => {
      if (data && data.length > 0) {
        initialPrices[coinId] = data[0].price;
      }
    });

    return sortedTimestamps.map((timestamp) => {
      const point: Record<string, number | null> = { time: timestamp };

      Object.entries(coinDataMap).forEach(([coinId, data]) => {
        if (!data) return;
        const closest = data.reduce((prev, curr) =>
          Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp)
            ? curr
            : prev
        );
        if (initialPrices[coinId]) {
          point[coinId] = ((closest.price - initialPrices[coinId]) / initialPrices[coinId]) * 100;
        }
      });

      return point;
    });
  }, [coinDataMap]);

  const handleCoinSelect = (coinId: string, index: number) => {
    const newSelected = [...selectedCoins];
    newSelected[index] = coinId;
    setSelectedCoins(newSelected.filter(Boolean));
  };

  const addCoin = () => {
    if (selectedCoins.length < 5) {
      const available = supportedCryptos?.find((c) => !selectedCoins.includes(c.id));
      if (available) {
        setSelectedCoins([...selectedCoins, available.id]);
      }
    }
  };

  const removeCoin = (index: number) => {
    if (selectedCoins.length > 2) {
      setSelectedCoins(selectedCoins.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <h3 className="font-semibold text-crypto-text text-lg">
          Performance Comparison
        </h3>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCoins.map((coinId, index) => (
              <div key={index} className="flex items-center gap-1">
                <Select
                  value={coinId}
                  onValueChange={(v) => handleCoinSelect(v, index)}
                >
                  <SelectTrigger className="w-32 bg-crypto-bg border-crypto-border text-crypto-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-crypto-card border-crypto-border">
                    {supportedCryptos?.map((crypto) => (
                      <SelectItem
                        key={crypto.id}
                        value={crypto.id}
                        className="text-crypto-text hover:bg-crypto-border"
                      >
                        <div className="flex items-center gap-2">
                          <Image
                            src={crypto.image}
                            alt={crypto.name}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                          {crypto.symbol.toUpperCase()}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCoins.length > 2 && (
                  <button
                    onClick={() => removeCoin(index)}
                    className="text-crypto-muted hover:text-crypto-negative text-sm"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            {selectedCoins.length < 5 && (
              <button
                onClick={addCoin}
                className="px-3 py-1 text-sm text-crypto-accent hover:bg-crypto-accent/10 rounded"
              >
                + Add
              </button>
            )}
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
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="time"
              tickFormatter={(ts) => format(new Date(ts), "MMM d")}
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={60}
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
                          className="text-sm font-medium"
                          style={{ color: entry.color }}
                        >
                          {String(entry.dataKey).toUpperCase()}:{" "}
                          {typeof entry.value === "number"
                            ? `${entry.value >= 0 ? "+" : ""}${entry.value.toFixed(2)}%`
                            : "N/A"}
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
                <span className="text-crypto-text text-sm uppercase">{value}</span>
              )}
            />
            {selectedCoins.map((coinId, index) => (
              <Line
                key={coinId}
                type="monotone"
                dataKey={coinId}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
