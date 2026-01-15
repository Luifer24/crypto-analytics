"use client";

import { useMemo, useState } from "react";
import { useCryptoList } from "@/hooks/useCryptoData";
import {
  useBinancePriceHistory,
  useBinanceOHLC,
  daysToIntervalAndLimit,
  isBinanceSupported,
} from "@/hooks/useBinanceData";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LineChart, CandlestickChart, Database } from "lucide-react";
import Image from "next/image";

const timeRanges = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

type ChartType = "line" | "candle";

interface PriceChartProps {
  coinId: string;
}

export const PriceChart = ({ coinId }: PriceChartProps) => {
  const [days, setDays] = useState(7);
  const [chartType, setChartType] = useState<ChartType>("line");

  // Get interval and limit based on days
  const { interval, limit } = daysToIntervalAndLimit(days);

  // Use Binance for price data
  const { data: priceHistory, isLoading: lineLoading } = useBinancePriceHistory(coinId, interval, limit);
  const { data: ohlcData, isLoading: candleLoading } = useBinanceOHLC(coinId, interval, limit);
  const { data: cryptoList } = useCryptoList(50);

  const isSupported = isBinanceSupported(coinId);
  const isLoading = chartType === "line" ? lineLoading : candleLoading;
  const coin = cryptoList?.find((c) => c.id === coinId);

  const chartData = useMemo(() => {
    if (!priceHistory) return [];
    return priceHistory.map((point) => ({
      time: point.timestamp,
      price: point.price,
    }));
  }, [priceHistory]);

  const candleChartData = useMemo(() => {
    if (!ohlcData) return [];
    return ohlcData.map((point) => ({
      time: point.timestamp,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      range: [point.low, point.high],
      body: [Math.min(point.open, point.close), Math.max(point.open, point.close)],
    }));
  }, [ohlcData]);

  const priceChange = useMemo(() => {
    if (chartType === "line") {
      if (!chartData.length) return 0;
      const first = chartData[0].price;
      const last = chartData[chartData.length - 1].price;
      return ((last - first) / first) * 100;
    } else {
      if (!candleChartData.length) return 0;
      const first = candleChartData[0].open;
      const last = candleChartData[candleChartData.length - 1].close;
      return ((last - first) / first) * 100;
    }
  }, [chartData, candleChartData, chartType]);

  const isPositive = priceChange >= 0;

  const { priceMin, priceMax } = useMemo(() => {
    if (!candleChartData.length) return { priceMin: 0, priceMax: 0 };
    const lows = candleChartData.map((d) => d.low);
    const highs = candleChartData.map((d) => d.high);
    return {
      priceMin: Math.min(...lows),
      priceMax: Math.max(...highs),
    };
  }, [candleChartData]);

  // Show message if coin not supported by Binance
  if (!isSupported) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="flex items-center gap-3 mb-4">
          {coin && (
            <>
              <Image src={coin.image} alt={coin.name} width={32} height={32} className="rounded-full" />
              <div>
                <h3 className="font-semibold text-crypto-text text-lg">{coin.name}</h3>
                <span className="text-crypto-muted text-sm uppercase">{coin.symbol}</span>
              </div>
            </>
          )}
        </div>
        <div className="h-64 flex items-center justify-center bg-crypto-bg rounded-lg">
          <div className="text-center">
            <Database className="w-12 h-12 text-crypto-muted mx-auto mb-3" />
            <p className="text-crypto-muted">Chart data not available for this coin</p>
            <p className="text-crypto-muted text-sm mt-1">Only top 30 cryptocurrencies supported</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-crypto-border rounded w-48 mb-4" />
          <div className="h-64 bg-crypto-border rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {coin && (
            <>
              <Image src={coin.image} alt={coin.name} width={32} height={32} className="rounded-full" />
              <div>
                <h3 className="font-semibold text-crypto-text text-lg">{coin.name}</h3>
                <span className="text-crypto-muted text-sm uppercase">{coin.symbol}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-crypto-bg rounded-lg p-1">
            <button
              onClick={() => setChartType("line")}
              className={cn(
                "p-2 rounded transition-colors",
                chartType === "line"
                  ? "bg-crypto-accent text-crypto-bg"
                  : "text-crypto-muted hover:text-crypto-text"
              )}
              title="Line chart"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType("candle")}
              className={cn(
                "p-2 rounded transition-colors",
                chartType === "candle"
                  ? "bg-crypto-accent text-crypto-bg"
                  : "text-crypto-muted hover:text-crypto-text"
              )}
              title="Candlestick chart"
            >
              <CandlestickChart className="w-4 h-4" />
            </button>
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

      <div className="mb-6">
        <span className="text-3xl font-bold text-crypto-text font-mono">
          ${coin?.current_price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
        <span
          className={cn(
            "ml-3 text-sm font-medium",
            isPositive ? "text-crypto-positive" : "text-crypto-negative"
          )}
        >
          {isPositive ? "+" : ""}
          {priceChange.toFixed(2)}%
        </span>
      </div>

      <div className="h-64">
        {chartType === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isPositive ? "#22c55e" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={isPositive ? "#22c55e" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(ts) => format(new Date(ts), days <= 1 ? "HH:mm" : "MMM d")}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-crypto-muted text-xs">
                          {format(new Date(data.time), "MMM d, yyyy HH:mm")}
                        </p>
                        <p className="text-crypto-text font-mono font-semibold">
                          ${data.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candleChartData}>
              <XAxis
                dataKey="time"
                tickFormatter={(ts) => format(new Date(ts), days <= 1 ? "HH:mm" : "MMM d")}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[priceMin * 0.995, priceMax * 1.005]}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    const data = payload[0].payload;
                    const isUp = data.close >= data.open;
                    return (
                      <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-crypto-muted text-xs mb-2">
                          {format(new Date(data.time), "MMM d, yyyy HH:mm")}
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                          <span className="text-crypto-muted">Open:</span>
                          <span className="text-crypto-text">${data.open.toLocaleString()}</span>
                          <span className="text-crypto-muted">High:</span>
                          <span className="text-crypto-positive">${data.high.toLocaleString()}</span>
                          <span className="text-crypto-muted">Low:</span>
                          <span className="text-crypto-negative">${data.low.toLocaleString()}</span>
                          <span className="text-crypto-muted">Close:</span>
                          <span className={isUp ? "text-crypto-positive" : "text-crypto-negative"}>
                            ${data.close.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="high" fill="transparent" isAnimationActive={false}>
                {candleChartData.map((_, index) => (
                  <Cell key={`wick-${index}`} fill="transparent" />
                ))}
              </Bar>
              <Bar
                dataKey="close"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={(props: any) => {
                  const { x = 0, width = 0, payload } = props;
                  if (!payload) return <g />;

                  const { open, close, high, low } = payload;
                  const isUp = close >= open;
                  const color = isUp ? "#22c55e" : "#ef4444";

                  const chartHeight = 256;
                  const padding = 0.005;
                  const adjustedMin = priceMin * (1 - padding);
                  const adjustedMax = priceMax * (1 + padding);
                  const adjustedRange = adjustedMax - adjustedMin;

                  const scale = (price: number) =>
                    chartHeight - ((price - adjustedMin) / adjustedRange) * chartHeight;

                  const yHigh = scale(high);
                  const yLow = scale(low);
                  const yOpen = scale(open);
                  const yClose = scale(close);

                  const candleWidth = Math.max(width * 0.7, 3);
                  const xCenter = x + width / 2;
                  const xCandle = xCenter - candleWidth / 2;

                  const candleTop = Math.min(yOpen, yClose);
                  const candleHeight = Math.max(Math.abs(yClose - yOpen), 1);

                  return (
                    <g>
                      <line
                        x1={xCenter}
                        y1={yHigh}
                        x2={xCenter}
                        y2={yLow}
                        stroke={color}
                        strokeWidth={1}
                      />
                      <rect
                        x={xCandle}
                        y={candleTop}
                        width={candleWidth}
                        height={candleHeight}
                        fill={isUp ? "transparent" : color}
                        stroke={color}
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
