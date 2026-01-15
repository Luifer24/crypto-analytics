"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCointegration } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { GitMerge, AlertTriangle, CheckCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CointegrationCardProps {
  pricesA: number[];
  pricesB: number[];
  symbolA: string;
  symbolB: string;
}

export const CointegrationCard = ({ pricesA, pricesB, symbolA, symbolB }: CointegrationCardProps) => {
  const result = getCointegration(pricesA, pricesB);

  const spreadData = result.spread.map((value, index) => ({
    index,
    spread: value,
    mean: result.meanSpread,
    upper: result.meanSpread + 2 * result.stdSpread,
    lower: result.meanSpread - 2 * result.stdSpread,
  }));

  const getZScoreSignal = (zScore: number): { signal: string; color: string } => {
    if (zScore >= 2) return { signal: "Vender spread (A sobrecomprado vs B)", color: "text-crypto-negative" };
    if (zScore <= -2) return { signal: "Comprar spread (A sobrevendido vs B)", color: "text-crypto-positive" };
    if (Math.abs(zScore) >= 1.5) return { signal: "Zona de alerta", color: "text-yellow-400" };
    return { signal: "Sin señal clara", color: "text-muted-foreground" };
  };

  const signal = getZScoreSignal(result.zScore);

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <GitMerge className="h-5 w-5 text-crypto-accent" />
          Cointegración: {symbolA.toUpperCase()} / {symbolB.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Z-Score Actual</p>
            <p className={`text-lg font-mono ${Math.abs(result.zScore) >= 2 ? 'text-crypto-accent' : 'text-crypto-text'}`}>
              {result.zScore.toFixed(3)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Half-Life</p>
            <p className="text-lg font-mono text-crypto-text">
              {result.halfLife > 0 ? `${result.halfLife.toFixed(1)} días` : 'N/A'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Media del Spread</p>
            <p className="text-lg font-mono text-crypto-text">
              {result.meanSpread.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Std del Spread</p>
            <p className="text-lg font-mono text-crypto-text">
              {result.stdSpread.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Cointegration Status */}
        <div className={`flex items-center gap-2 p-3 rounded-lg ${result.isCointegrated ? 'bg-crypto-positive/20' : 'bg-crypto-negative/20'}`}>
          {result.isCointegrated ? (
            <CheckCircle className="h-5 w-5 text-crypto-positive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-crypto-negative" />
          )}
          <div>
            <p className={`text-sm font-medium ${result.isCointegrated ? 'text-crypto-positive' : 'text-crypto-negative'}`}>
              {result.isCointegrated ? 'Posible Cointegración' : 'No Cointegrado'}
            </p>
            <p className="text-xs text-muted-foreground">
              {result.isCointegrated
                ? 'El spread tiende a revertir a la media, posible oportunidad de arbitraje'
                : 'No hay evidencia de relación de largo plazo estable'}
            </p>
          </div>
        </div>

        {/* Trading Signal */}
        <div className="p-3 bg-crypto-bg/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Señal de Trading</p>
          <p className={`text-sm font-medium ${signal.color}`}>{signal.signal}</p>
        </div>

        {/* Spread Chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Spread con Bandas ±2σ</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spreadData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis dataKey="index" hide />
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
                />
                <ReferenceLine y={result.meanSpread} stroke="hsl(47 100% 50%)" strokeDasharray="5 5" />
                <Line
                  type="monotone"
                  dataKey="upper"
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="lower"
                  stroke="#22c55e"
                  strokeDasharray="3 3"
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="spread"
                  stroke="#f8fafc"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <StatExplanation
          title="cointegración y arbitraje estadístico"
          formula="Spread = Precio_A - β × Precio_B"
          interpretation="Dos activos están cointegrados si tienen una relación de largo plazo estable, aunque cada uno sea individualmente no estacionario. El spread entre ellos tiende a revertir a la media. El Z-Score indica cuántas desviaciones estándar está el spread de su media: valores extremos (>2 o <-2) sugieren oportunidades de trading cuando el spread revertirá. El Half-Life estima cuánto tiempo tarda en revertir."
        />
      </CardContent>
    </Card>
  );
};
