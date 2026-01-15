"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rollingVolatility, bollingerBands, mean } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { Activity } from "lucide-react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

interface VolatilityChartProps {
  prices: number[];
  timestamps?: number[];
  symbol: string;
}

export const VolatilityChart = ({ prices, timestamps, symbol }: VolatilityChartProps) => {
  const chartData = useMemo(() => {
    const volatility = rollingVolatility(prices, 20);
    const bb = bollingerBands(prices, 20, 2);

    // Align data (volatility and BB start at index 19 for 20-period)
    const startIdx = 19;

    return prices.slice(startIdx).map((price, idx) => ({
      index: idx,
      date: timestamps ? new Date(timestamps[startIdx + idx]).toLocaleDateString() : idx,
      price,
      volatility: volatility[idx] ? volatility[idx] * 100 : null,
      upper: bb.upper[idx],
      middle: bb.middle[idx],
      lower: bb.lower[idx],
    }));
  }, [prices, timestamps]);

  const avgVolatility = useMemo(() => {
    const vol = rollingVolatility(prices, 20);
    return mean(vol) * 100;
  }, [prices]);

  const currentVolatility = chartData[chartData.length - 1]?.volatility || 0;
  const volChange = currentVolatility - avgVolatility;

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-crypto-accent" />
          Volatilidad y Bandas de Bollinger: {symbol.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Volatilidad Actual (20d)</p>
            <p className="text-lg font-mono text-crypto-text">
              {currentVolatility.toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Volatilidad Media</p>
            <p className="text-lg font-mono text-crypto-text">
              {avgVolatility.toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">vs Media</p>
            <p className={`text-lg font-mono ${volChange > 0 ? 'text-crypto-negative' : 'text-crypto-positive'}`}>
              {volChange > 0 ? '+' : ''}{volChange.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Price with Bollinger Bands */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Precio con Bandas de Bollinger (20, 2)</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  yAxisId="price"
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
                      name === 'volatility' ? `${v.toFixed(1)}%` : `$${v.toFixed(2)}`,
                      name === 'volatility' ? 'Volatilidad' :
                      name === 'upper' ? 'Banda Superior' :
                      name === 'lower' ? 'Banda Inferior' :
                      name === 'middle' ? 'SMA 20' : 'Precio'
                    ];
                  }}
                />
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="hsl(47 100% 50%)"
                  fillOpacity={0.1}
                />
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="hsl(225 25% 8%)"
                  fillOpacity={1}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="upper"
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="lower"
                  stroke="#22c55e"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="middle"
                  stroke="hsl(47 100% 50%)"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  stroke="#f8fafc"
                  dot={false}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rolling Volatility */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Volatilidad Rolling (20 días, anualizada)</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fill: '#8884d8', fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(225 25% 12%)',
                    border: '1px solid hsl(47 100% 50%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${(typeof value === 'number' ? value : 0).toFixed(1)}%`, 'Volatilidad']}
                />
                <Area
                  type="monotone"
                  dataKey="volatility"
                  stroke="hsl(47 100% 50%)"
                  fill="hsl(47 100% 50%)"
                  fillOpacity={0.3}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <StatExplanation
          title="volatilidad y Bollinger Bands"
          formula="BB: Media ± k × σ | Vol: σ(retornos) × √252"
          interpretation="La volatilidad mide la variabilidad de los retornos. Las Bandas de Bollinger envuelven el precio: cuando el precio toca la banda superior, puede estar sobrecomprado; en la inferior, sobrevendido. Bandas estrechas indican baja volatilidad (posible movimiento fuerte próximo). La volatilidad de crypto suele ser 50-100% anualizada, mucho mayor que activos tradicionales."
        />
      </CardContent>
    </Card>
  );
};
