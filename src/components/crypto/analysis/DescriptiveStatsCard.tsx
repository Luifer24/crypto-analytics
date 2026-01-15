"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DescriptiveStats } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { BarChart3 } from "lucide-react";

interface DescriptiveStatsCardProps {
  stats: DescriptiveStats;
  title?: string;
}

const formatNumber = (num: number, decimals: number = 4): string => {
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toFixed(decimals);
};

export const DescriptiveStatsCard = ({ stats, title = "Estadísticas Descriptivas" }: DescriptiveStatsCardProps) => {
  const getSkewnessInterpretation = (skew: number): string => {
    if (skew > 0.5) return "Asimetría positiva: cola derecha más larga, más valores extremos altos";
    if (skew < -0.5) return "Asimetría negativa: cola izquierda más larga, más valores extremos bajos";
    return "Distribución aproximadamente simétrica";
  };

  const getKurtosisInterpretation = (kurt: number): string => {
    if (kurt > 1) return "Leptocúrtica: colas pesadas, más valores extremos de lo esperado (mayor riesgo)";
    if (kurt < -1) return "Platicúrtica: colas ligeras, menos valores extremos";
    return "Mesocúrtica: similar a distribución normal";
  };

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-crypto-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Central Tendency */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Media</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.mean)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Mediana</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.median)}</p>
          </div>

          {/* Dispersion */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Desv. Estándar</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.stdDev)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Varianza</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.variance)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Shape */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Asimetría (Skewness)</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.skewness, 3)}</p>
            <p className="text-xs text-muted-foreground">{getSkewnessInterpretation(stats.skewness)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Curtosis</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.kurtosis, 3)}</p>
            <p className="text-xs text-muted-foreground">{getKurtosisInterpretation(stats.kurtosis)}</p>
          </div>

          {/* Range */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Mínimo</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.min)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Máximo</p>
            <p className="text-lg font-mono text-crypto-text">{formatNumber(stats.max)}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          n = {stats.count} observaciones | Rango: {formatNumber(stats.range)}
        </div>

        <StatExplanation
          title="estas métricas"
          formula="σ = √(Σ(xᵢ - μ)² / n)"
          interpretation="La media mide el valor central, mientras que la desviación estándar indica cuánto varían los datos. Skewness mide la asimetría de la distribución: valores positivos indican cola derecha más larga. Kurtosis mide el 'peso' de las colas: valores altos indican más valores extremos (fat tails), típico en criptomonedas."
        />
      </CardContent>
    </Card>
  );
};
