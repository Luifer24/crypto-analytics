"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sma, ema } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { Layers } from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMemo, useState } from "react";

interface TrendDecompositionProps {
  prices: number[];
  timestamps?: number[];
  symbol: string;
}

export const TrendDecomposition = ({ prices, timestamps, symbol }: TrendDecompositionProps) => {
  const [showResiduals, setShowResiduals] = useState(false);

  const decomposition = useMemo(() => {
    const sma7 = sma(prices, 7);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);

    // Start from index where all MAs are available
    const startIdx = 49; // 50-period SMA needs 50 points

    return prices.slice(startIdx).map((price, idx) => {
      const actualIdx = startIdx + idx;
      const trend = sma50[idx] || price;
      const residual = price - trend;

      return {
        index: idx,
        date: timestamps ? new Date(timestamps[actualIdx]).toLocaleDateString() : idx,
        price,
        sma7: sma7[actualIdx - 6] || null,
        sma20: sma20[actualIdx - 19] || null,
        sma50: sma50[idx] || null,
        ema12: ema12[actualIdx - 11] || null,
        ema26: ema26[actualIdx - 25] || null,
        trend,
        residual,
      };
    });
  }, [prices, timestamps]);

  const trendAnalysis = useMemo(() => {
    if (decomposition.length < 2) return { direction: 'neutral', strength: 0, priceVsTrend: 0 };

    const recentPrices = decomposition.slice(-20);
    const firstTrend = recentPrices[0]?.sma50 || 0;
    const lastTrend = recentPrices[recentPrices.length - 1]?.sma50 || 0;
    const trendChange = firstTrend > 0 ? ((lastTrend - firstTrend) / firstTrend) * 100 : 0;

    const currentPrice = decomposition[decomposition.length - 1]?.price || 0;
    const currentSMA50 = decomposition[decomposition.length - 1]?.sma50 || 0;
    const priceVsTrend = currentSMA50 > 0 ? ((currentPrice - currentSMA50) / currentSMA50) * 100 : 0;

    return {
      direction: trendChange > 1 ? 'alcista' : trendChange < -1 ? 'bajista' : 'lateral',
      strength: Math.abs(trendChange),
      priceVsTrend,
    };
  }, [decomposition]);

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-crypto-accent" />
          Descomposición de Tendencia: {symbol.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Tendencia</p>
            <p className={`text-lg font-medium ${
              trendAnalysis.direction === 'alcista' ? 'text-crypto-positive' :
              trendAnalysis.direction === 'bajista' ? 'text-crypto-negative' :
              'text-crypto-text'
            }`}>
              {trendAnalysis.direction.charAt(0).toUpperCase() + trendAnalysis.direction.slice(1)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Fuerza (%)</p>
            <p className="text-lg font-mono text-crypto-text">
              {trendAnalysis.strength.toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Precio vs SMA50</p>
            <p className={`text-lg font-mono ${trendAnalysis.priceVsTrend >= 0 ? 'text-crypto-positive' : 'text-crypto-negative'}`}>
              {trendAnalysis.priceVsTrend >= 0 ? '+' : ''}{trendAnalysis.priceVsTrend.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResiduals(!showResiduals)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              showResiduals
                ? "bg-crypto-accent text-white"
                : "bg-crypto-bg text-muted-foreground hover:text-crypto-text"
            }`}
          >
            {showResiduals ? 'Mostrar MAs' : 'Mostrar Residuales'}
          </button>
        </div>

        {!showResiduals ? (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Precio con Medias Móviles</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={decomposition} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    tick={{ fill: '#8884d8', fontSize: 10 }}
                    domain={['auto', 'auto']}
                    orientation="right"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 25% 12%)',
                      border: '1px solid hsl(47 100% 50%)',
                      borderRadius: '8px',
                    }}
                    formatter={(value, name) => {
                      const v = typeof value === 'number' ? value : 0;
                      return [
                        `$${v.toFixed(2)}`,
                        name === 'price' ? 'Precio' :
                        name === 'sma7' ? 'SMA 7' :
                        name === 'sma20' ? 'SMA 20' :
                        name === 'sma50' ? 'SMA 50' :
                        name === 'ema12' ? 'EMA 12' :
                        name === 'ema26' ? 'EMA 26' : String(name)
                      ];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '10px' }}
                    formatter={(value) =>
                      value === 'price' ? 'Precio' :
                      value === 'sma7' ? 'SMA 7' :
                      value === 'sma20' ? 'SMA 20' :
                      value === 'sma50' ? 'SMA 50' :
                      value === 'ema12' ? 'EMA 12' :
                      value === 'ema26' ? 'EMA 26' : value
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#f8fafc"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma7"
                    stroke="#22c55e"
                    dot={false}
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma20"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma50"
                    stroke="#ef4444"
                    dot={false}
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="ema12"
                    stroke="#8b5cf6"
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="ema26"
                    stroke="#ec4899"
                    dot={false}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Residuales (Precio - Tendencia SMA50)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={decomposition} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis
                    tick={{ fill: '#8884d8', fontSize: 10 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 25% 12%)',
                      border: '1px solid hsl(47 100% 50%)',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`$${(typeof value === 'number' ? value : 0).toFixed(2)}`, 'Residual']}
                  />
                  <Area
                    type="monotone"
                    dataKey="residual"
                    stroke="hsl(47 100% 50%)"
                    fill="hsl(47 100% 50%)"
                    fillOpacity={0.3}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <StatExplanation
          title="descomposición de tendencias"
          formula="SMA(n) = Σ(Pᵢ) / n | EMA = α×Pₜ + (1-α)×EMAₜ₋₁"
          interpretation="La descomposición separa la serie en tendencia (movimiento de largo plazo) y residuales (fluctuaciones alrededor de la tendencia). SMA da igual peso a todos los puntos; EMA da más peso a datos recientes. Cruces de MAs cortas sobre largas son señales alcistas (golden cross). Los residuales muestran la volatilidad alrededor de la tendencia, útil para identificar desviaciones extremas."
        />
      </CardContent>
    </Card>
  );
};
