"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReturnStats, histogram } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ReturnsAnalysisCardProps {
  stats: ReturnStats;
  title?: string;
}

export const ReturnsAnalysisCard = ({ stats, title = "Análisis de Retornos" }: ReturnsAnalysisCardProps) => {
  const histogramData = histogram(stats.dailyReturns, 25);

  const getSharpeInterpretation = (sharpe: number): string => {
    if (sharpe >= 2) return "Excelente";
    if (sharpe >= 1) return "Bueno";
    if (sharpe >= 0.5) return "Aceptable";
    if (sharpe >= 0) return "Bajo";
    return "Negativo";
  };

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-crypto-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Retorno Medio Diario</p>
            <p className={`text-lg font-mono ${stats.meanReturn >= 0 ? 'text-crypto-positive' : 'text-crypto-negative'}`}>
              {(stats.meanReturn * 100).toFixed(3)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Volatilidad (Anual)</p>
            <p className="text-lg font-mono text-crypto-text">
              {(stats.volatility * Math.sqrt(365) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
            <p className="text-lg font-mono text-crypto-text">
              {stats.sharpeRatio.toFixed(2)}
              <span className="text-xs text-muted-foreground ml-1">
                ({getSharpeInterpretation(stats.sharpeRatio)})
              </span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Max Drawdown</p>
            <p className="text-lg font-mono text-crypto-negative">
              -{(stats.maxDrawdown * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-crypto-positive" />
            <div>
              <p className="text-sm font-mono text-crypto-positive">{stats.positiveCount}</p>
              <p className="text-xs text-muted-foreground">Días positivos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-crypto-negative" />
            <div>
              <p className="text-sm font-mono text-crypto-negative">{stats.negativeCount}</p>
              <p className="text-xs text-muted-foreground">Días negativos</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-mono text-crypto-text">{(stats.winRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
        </div>

        {/* Histogram */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Distribución de Retornos Diarios</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                <XAxis
                  dataKey="bin"
                  tick={{ fill: '#8884d8', fontSize: 8 }}
                  interval="preserveStartEnd"
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: '#8884d8', fontSize: 10 }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(225 25% 12%)',
                    border: '1px solid hsl(47 100% 50%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${((typeof value === 'number' ? value : 0) * 100).toFixed(1)}%`, 'Frecuencia']}
                />
                <ReferenceLine x="0.0%" stroke="hsl(47 100% 50%)" strokeDasharray="3 3" />
                <Bar
                  dataKey="frequency"
                  fill="hsl(47 100% 50%)"
                  opacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <StatExplanation
          title="el análisis de retornos"
          formula="Rₜ = (Pₜ - Pₜ₋₁) / Pₜ₋₁"
          interpretation="Los retornos diarios miden el cambio porcentual del precio. El Sharpe Ratio compara el retorno con el riesgo: valores >1 son buenos, >2 excelentes. El Max Drawdown muestra la peor caída desde un máximo, importante para gestión de riesgo. La distribución típica de crypto tiene 'fat tails' (curtosis alta), indicando más eventos extremos que una distribución normal."
        />
      </CardContent>
    </Card>
  );
};
