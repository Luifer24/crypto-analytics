"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { correlation } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { Grid3X3 } from "lucide-react";
import { useMemo } from "react";

interface Asset {
  id: string;
  symbol: string;
  prices: number[];
}

interface CorrelationMatrixProps {
  assets: Asset[];
  title?: string;
}

export const CorrelationMatrix = ({ assets, title = "Matriz de Correlación" }: CorrelationMatrixProps) => {
  const matrix = useMemo(() => {
    const result: { row: string; cols: { symbol: string; value: number }[] }[] = [];

    for (let i = 0; i < assets.length; i++) {
      const row = {
        row: assets[i].symbol.toUpperCase(),
        cols: [] as { symbol: string; value: number }[]
      };

      for (let j = 0; j < assets.length; j++) {
        const corr = correlation(assets[i].prices, assets[j].prices);
        row.cols.push({
          symbol: assets[j].symbol.toUpperCase(),
          value: corr
        });
      }

      result.push(row);
    }

    return result;
  }, [assets]);

  const getColor = (value: number): string => {
    if (value >= 0.8) return 'bg-crypto-positive/80';
    if (value >= 0.5) return 'bg-crypto-positive/50';
    if (value >= 0.2) return 'bg-crypto-positive/30';
    if (value >= -0.2) return 'bg-crypto-card';
    if (value >= -0.5) return 'bg-crypto-negative/30';
    if (value >= -0.8) return 'bg-crypto-negative/50';
    return 'bg-crypto-negative/80';
  };

  if (assets.length < 2) {
    return (
      <Card className="bg-crypto-card border-crypto-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
            <Grid3X3 className="h-5 w-5 text-crypto-accent" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Selecciona al menos 2 activos para ver la matriz de correlación
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <Grid3X3 className="h-5 w-5 text-crypto-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2"></th>
                {assets.map(a => (
                  <th key={a.id} className="p-2 text-crypto-text font-mono text-xs">
                    {a.symbol.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={row.row}>
                  <td className="p-2 text-crypto-text font-mono text-xs">{row.row}</td>
                  {row.cols.map((col, j) => (
                    <td
                      key={col.symbol}
                      className={`p-2 text-center font-mono text-xs ${getColor(col.value)} ${i === j ? 'opacity-50' : ''}`}
                    >
                      {col.value.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-muted-foreground">-1</span>
          <div className="flex">
            <div className="w-6 h-4 bg-crypto-negative/80"></div>
            <div className="w-6 h-4 bg-crypto-negative/50"></div>
            <div className="w-6 h-4 bg-crypto-negative/30"></div>
            <div className="w-6 h-4 bg-crypto-card"></div>
            <div className="w-6 h-4 bg-crypto-positive/30"></div>
            <div className="w-6 h-4 bg-crypto-positive/50"></div>
            <div className="w-6 h-4 bg-crypto-positive/80"></div>
          </div>
          <span className="text-muted-foreground">+1</span>
        </div>

        <StatExplanation
          title="la correlación"
          formula="ρ = Σ(xᵢ - x̄)(yᵢ - ȳ) / √(Σ(xᵢ - x̄)² · Σ(yᵢ - ȳ)²)"
          interpretation="La correlación mide la relación lineal entre dos activos (-1 a +1). Correlación alta (+0.8) significa que se mueven juntos. Correlación baja o negativa indica diversificación. En cripto, la mayoría de activos tienen alta correlación con BTC. Para arbitraje estadístico, buscamos pares altamente correlacionados que temporalmente divergen."
        />
      </CardContent>
    </Card>
  );
};
