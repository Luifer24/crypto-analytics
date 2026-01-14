"use client";

import { DominanceChart } from "@/components/crypto/DominanceChart";
import { useGlobalData, useCryptoList } from "@/hooks/useCryptoData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = [
  "#f7931a",
  "#627eea",
  "#26a17b",
  "#2775ca",
  "#e84142",
  "#8247e5",
  "#00d395",
  "#ff007a",
  "#22c55e",
  "#3b82f6",
];

export default function DominancePage() {
  const { data: globalData } = useGlobalData();
  const { data: cryptoList, isLoading: listLoading } = useCryptoList(20);

  const marketCapData = cryptoList?.slice(0, 10).map((crypto, index) => ({
    name: crypto.symbol.toUpperCase(),
    marketCap: crypto.market_cap / 1e9,
    color: COLORS[index % COLORS.length],
  }));

  const volumeData = cryptoList?.slice(0, 10).map((crypto, index) => ({
    name: crypto.symbol.toUpperCase(),
    volume: crypto.total_volume / 1e9,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text">Market Dominance</h1>
        <p className="text-crypto-muted mt-1">
          Distribution of market capitalization across cryptocurrencies
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DominanceChart />

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text text-lg mb-6">
            Top 10 by Market Cap
          </h3>
          <div className="h-72">
            {listLoading ? (
              <div className="animate-pulse h-full bg-crypto-border rounded" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketCapData} layout="vertical">
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${v}B`}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={12}
                    width={50}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload?.[0]) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-crypto-text font-semibold">{data.name}</p>
                            <p className="text-crypto-muted">${data.marketCap.toFixed(2)}B</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="marketCap" radius={[0, 4, 4, 0]}>
                    {marketCapData?.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-6">
          24h Trading Volume
        </h3>
        <div className="h-64">
          {listLoading ? (
            <div className="animate-pulse h-full bg-crypto-border rounded" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
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
                        <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-crypto-text font-semibold">{data.name}</p>
                          <p className="text-crypto-muted">Volume: ${data.volume.toFixed(2)}B</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                  {volumeData?.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {globalData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox
            label="Total Market Cap"
            value={`$${(globalData.total_market_cap.usd / 1e12).toFixed(2)}T`}
          />
          <StatBox
            label="24h Change"
            value={`${globalData.market_cap_change_percentage_24h_usd >= 0 ? "+" : ""}${globalData.market_cap_change_percentage_24h_usd.toFixed(2)}%`}
            positive={globalData.market_cap_change_percentage_24h_usd >= 0}
          />
          <StatBox
            label="BTC Dominance"
            value={`${globalData.market_cap_percentage.btc.toFixed(1)}%`}
          />
          <StatBox
            label="ETH Dominance"
            value={`${globalData.market_cap_percentage.eth.toFixed(1)}%`}
          />
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
      <p className="text-crypto-muted text-sm mb-1">{label}</p>
      <p
        className={`text-xl font-semibold ${
          positive === undefined
            ? "text-crypto-text"
            : positive
            ? "text-crypto-positive"
            : "text-crypto-negative"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
