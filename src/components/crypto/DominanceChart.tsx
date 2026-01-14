"use client";

import { useGlobalData } from "@/hooks/useCryptoData";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = [
  "#f7931a", // Bitcoin orange
  "#627eea", // Ethereum blue
  "#26a17b", // Tether green
  "#2775ca", // USD Coin blue
  "#e84142", // Avalanche red
  "#8247e5", // Polygon purple
  "#00d395", // Solana green
  "#ff007a", // Uniswap pink
];

export const DominanceChart = () => {
  const { data: globalData, isLoading } = useGlobalData();

  if (isLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-crypto-border rounded w-48 mb-4" />
          <div className="h-64 bg-crypto-border rounded-full mx-auto w-64" />
        </div>
      </div>
    );
  }

  if (!globalData?.market_cap_percentage) return null;

  const dominanceData = Object.entries(globalData.market_cap_percentage)
    .slice(0, 7)
    .map(([symbol, percentage]) => ({
      name: symbol.toUpperCase(),
      value: Number(percentage.toFixed(2)),
    }));

  const totalShown = dominanceData.reduce((sum, item) => sum + item.value, 0);
  if (totalShown < 100) {
    dominanceData.push({
      name: "Others",
      value: Number((100 - totalShown).toFixed(2)),
    });
  }

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <h3 className="font-semibold text-crypto-text text-lg mb-6">
        Market Dominance
      </h3>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dominanceData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {dominanceData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-crypto-text font-semibold">{data.name}</p>
                      <p className="text-crypto-muted">{data.value}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => (
                <span className="text-crypto-text text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-crypto-bg rounded-lg p-3">
          <p className="text-crypto-muted text-xs mb-1">BTC Dominance</p>
          <p className="text-crypto-text font-semibold">
            {globalData.market_cap_percentage.btc?.toFixed(1)}%
          </p>
        </div>
        <div className="bg-crypto-bg rounded-lg p-3">
          <p className="text-crypto-muted text-xs mb-1">ETH Dominance</p>
          <p className="text-crypto-text font-semibold">
            {globalData.market_cap_percentage.eth?.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};
