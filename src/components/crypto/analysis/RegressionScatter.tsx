"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatExplanation } from "./StatExplanation";
import { ScatterChart as ScatterIcon } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { useMemo } from "react";
import { mean, correlation } from "@/lib/statistics";

interface RegressionScatterProps {
  pricesA: number[];
  pricesB: number[];
  symbolA: string;
  symbolB: string;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  correlation: number;
  residualStdError: number;
}

const calculateRegression = (x: number[], y: number[]): RegressionResult => {
  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += (x[i] - meanX) * (x[i] - meanX);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  const predictions = x.map(xi => slope * xi + intercept);
  const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Correlation
  const corr = correlation(x, y);

  // Residual standard error
  const residualStdError = Math.sqrt(ssRes / (n - 2));

  return { slope, intercept, rSquared, correlation: corr, residualStdError };
};

export const RegressionScatter = ({ pricesA, pricesB, symbolA, symbolB }: RegressionScatterProps) => {
  const { scatterData, regression, regressionLine } = useMemo(() => {
    if (pricesA.length !== pricesB.length || pricesA.length < 2) {
      return { scatterData: [], regression: null, regressionLine: [] };
    }

    // Create scatter data points
    const data = pricesA.map((a, i) => ({
      x: a,
      y: pricesB[i],
      index: i,
    }));

    // Calculate regression
    const reg = calculateRegression(pricesA, pricesB);

    // Create regression line points
    const minX = Math.min(...pricesA);
    const maxX = Math.max(...pricesA);
    const line = [
      { x: minX, y: reg.slope * minX + reg.intercept },
      { x: maxX, y: reg.slope * maxX + reg.intercept },
    ];

    return { scatterData: data, regression: reg, regressionLine: line };
  }, [pricesA, pricesB]);

  const getRSquaredInterpretation = (r2: number): string => {
    if (r2 >= 0.9) return "Ajuste excelente";
    if (r2 >= 0.7) return "Ajuste bueno";
    if (r2 >= 0.5) return "Ajuste moderado";
    if (r2 >= 0.3) return "Ajuste débil";
    return "Ajuste muy débil";
  };

  if (!regression || scatterData.length === 0) {
    return (
      <Card className="bg-crypto-card border-crypto-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
            <ScatterIcon className="h-5 w-5 text-crypto-accent" />
            Scatter Plot con Regresión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Selecciona dos activos para ver el scatter plot
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <ScatterIcon className="h-5 w-5 text-crypto-accent" />
          Regresión Lineal: {symbolA.toUpperCase()} vs {symbolB.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Regression Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Pendiente (β)</p>
            <p className="text-lg font-mono text-crypto-text">
              {regression.slope.toFixed(4)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Intercepto (α)</p>
            <p className="text-lg font-mono text-crypto-text">
              {regression.intercept.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">R²</p>
            <p className="text-lg font-mono text-crypto-text">
              {(regression.rSquared * 100).toFixed(1)}%
              <span className="text-xs text-muted-foreground ml-1">
                ({getRSquaredInterpretation(regression.rSquared)})
              </span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Correlación</p>
            <p className={`text-lg font-mono ${regression.correlation >= 0 ? 'text-crypto-positive' : 'text-crypto-negative'}`}>
              {regression.correlation.toFixed(3)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Error Std Residual</p>
            <p className="text-lg font-mono text-crypto-text">
              ${regression.residualStdError.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Regression Equation */}
        <div className="p-3 bg-crypto-bg/50 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Ecuación de Regresión</p>
          <p className="text-sm font-mono text-crypto-accent">
            {symbolB.toUpperCase()} = {regression.slope.toFixed(4)} × {symbolA.toUpperCase()} + {regression.intercept.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Por cada $1 de aumento en {symbolA.toUpperCase()}, {symbolB.toUpperCase()} aumenta ${regression.slope.toFixed(4)} en promedio
          </p>
        </div>

        {/* Scatter Plot */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
              <XAxis
                type="number"
                dataKey="x"
                name={symbolA.toUpperCase()}
                tick={{ fill: '#8884d8', fontSize: 10 }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                label={{
                  value: `${symbolA.toUpperCase()} (USD)`,
                  position: 'bottom',
                  fill: '#8884d8',
                  fontSize: 12,
                  offset: 0
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={symbolB.toUpperCase()}
                tick={{ fill: '#8884d8', fontSize: 10 }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                label={{
                  value: `${symbolB.toUpperCase()} (USD)`,
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#8884d8',
                  fontSize: 12
                }}
              />
              <ZAxis range={[30, 30]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(225 25% 12%)',
                  border: '1px solid hsl(47 100% 50%)',
                  borderRadius: '8px',
                }}
                formatter={(value, name) => {
                  const v = typeof value === 'number' ? value : 0;
                  return [
                    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    String(name)
                  ];
                }}
                labelFormatter={(_, payload) => {
                  if (payload && payload[0]) {
                    return `Observación #${payload[0].payload.index + 1}`;
                  }
                  return '';
                }}
              />

              {/* Scatter points */}
              <Scatter
                name="Precios"
                data={scatterData}
                fill="hsl(47 100% 50%)"
                fillOpacity={0.6}
              />

              {/* Regression line */}
              <Scatter
                name="Regresión"
                data={regressionLine}
                line={{ stroke: '#22c55e', strokeWidth: 2 }}
                shape={() => <g />}
                legendType="line"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Interpretation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-crypto-bg/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Interpretación del R²</p>
            <p className="text-sm text-crypto-text">
              El {(regression.rSquared * 100).toFixed(1)}% de la variación en {symbolB.toUpperCase()}
              puede explicarse por los movimientos de {symbolA.toUpperCase()}
            </p>
          </div>
          <div className="p-3 bg-crypto-bg/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Implicación para Trading</p>
            <p className="text-sm text-crypto-text">
              {regression.rSquared >= 0.7
                ? `Alta dependencia: movimientos en ${symbolA.toUpperCase()} predicen bien a ${symbolB.toUpperCase()}`
                : regression.rSquared >= 0.4
                ? `Dependencia moderada: otros factores también influyen en ${symbolB.toUpperCase()}`
                : `Baja dependencia: ${symbolB.toUpperCase()} tiene dinámica propia`}
            </p>
          </div>
        </div>

        <StatExplanation
          title="regresión lineal"
          formula="Y = β₀ + β₁X + ε | R² = 1 - SSres/SStot"
          interpretation="La regresión lineal modela la relación entre dos variables. La pendiente (β₁) indica cuánto cambia Y por cada unidad de cambio en X. El R² (coeficiente de determinación) mide qué porcentaje de la variación en Y es explicado por X. Un R² alto sugiere que los precios se mueven juntos de manera predecible, útil para pairs trading y hedging."
        />
      </CardContent>
    </Card>
  );
};
