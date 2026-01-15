"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acf, pacf, calculateReturns } from "@/lib/statistics";
import { StatExplanation } from "./StatExplanation";
import { Waves } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AutocorrelationChartProps {
  prices: number[];
  symbol: string;
  maxLag?: number;
}

export const AutocorrelationChart = ({ prices, symbol, maxLag = 20 }: AutocorrelationChartProps) => {
  const [dataType, setDataType] = useState<"prices" | "returns">("returns");

  const data = useMemo(() => {
    const values = dataType === "returns" ? calculateReturns(prices, false) : prices;
    const acfValues = acf(values, maxLag);
    const pacfValues = pacf(values, maxLag);
    const n = values.length;
    const confidenceBound = 1.96 / Math.sqrt(n); // 95% confidence interval

    return {
      acf: acfValues.map((value, lag) => ({
        lag,
        value,
        significant: Math.abs(value) > confidenceBound,
      })),
      pacf: pacfValues.map((value, lag) => ({
        lag,
        value,
        significant: Math.abs(value) > confidenceBound,
      })),
      confidenceBound,
    };
  }, [prices, maxLag, dataType]);

  const interpretation = useMemo(() => {
    // Check for significant autocorrelation in returns
    const significantLags = data.acf.slice(1).filter(d => d.significant).length;

    if (significantLags === 0) {
      return {
        text: "No hay autocorrelación significativa en los retornos",
        implication: "Los retornos parecen seguir un random walk, consistente con mercados eficientes",
        color: "text-muted-foreground"
      };
    } else if (significantLags <= 2) {
      return {
        text: "Autocorrelación débil detectada",
        implication: "Posible momentum o mean reversion de corto plazo",
        color: "text-yellow-400"
      };
    } else {
      return {
        text: "Autocorrelación significativa detectada",
        implication: "Puede indicar ineficiencias explotables o patrones predecibles",
        color: "text-crypto-accent"
      };
    }
  }, [data.acf]);

  return (
    <Card className="bg-crypto-card border-crypto-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-crypto-text flex items-center gap-2 text-lg">
          <Waves className="h-5 w-5 text-crypto-accent" />
          Autocorrelación: {symbol.toUpperCase()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDataType("returns")}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                dataType === "returns"
                  ? "bg-crypto-accent text-white"
                  : "bg-crypto-bg text-muted-foreground hover:text-crypto-text"
              }`}
            >
              Retornos
            </button>
            <button
              onClick={() => setDataType("prices")}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                dataType === "prices"
                  ? "bg-crypto-accent text-white"
                  : "bg-crypto-bg text-muted-foreground hover:text-crypto-text"
              }`}
            >
              Precios
            </button>
          </div>
        </div>

        {/* Interpretation */}
        <div className="p-3 bg-crypto-bg/50 rounded-lg">
          <p className={`text-sm font-medium ${interpretation.color}`}>
            {interpretation.text}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {interpretation.implication}
          </p>
        </div>

        <Tabs defaultValue="acf" className="w-full">
          <TabsList className="bg-crypto-bg">
            <TabsTrigger value="acf" className="data-[state=active]:bg-crypto-accent">
              ACF
            </TabsTrigger>
            <TabsTrigger value="pacf" className="data-[state=active]:bg-crypto-accent">
              PACF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="acf">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Función de Autocorrelación (ACF)
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.acf} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                    <XAxis
                      dataKey="lag"
                      tick={{ fill: '#8884d8', fontSize: 10 }}
                      label={{ value: 'Lag', position: 'bottom', fill: '#8884d8', fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fill: '#8884d8', fontSize: 10 }}
                      domain={[-1, 1]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(225 25% 12%)',
                        border: '1px solid hsl(47 100% 50%)',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [typeof value === 'number' ? value.toFixed(4) : '0', 'ACF']}
                    />
                    <ReferenceLine y={data.confidenceBound} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={-data.confidenceBound} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#f8fafc" />
                    <Bar dataKey="value">
                      {data.acf.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.significant ? 'hsl(47 100% 50%)' : '#f8fafc'}
                          opacity={entry.significant ? 1 : 0.5}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pacf">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Función de Autocorrelación Parcial (PACF)
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pacf} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                    <XAxis
                      dataKey="lag"
                      tick={{ fill: '#8884d8', fontSize: 10 }}
                      label={{ value: 'Lag', position: 'bottom', fill: '#8884d8', fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fill: '#8884d8', fontSize: 10 }}
                      domain={[-1, 1]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(225 25% 12%)',
                        border: '1px solid hsl(47 100% 50%)',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [typeof value === 'number' ? value.toFixed(4) : '0', 'PACF']}
                    />
                    <ReferenceLine y={data.confidenceBound} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={-data.confidenceBound} stroke="#ef4444" strokeDasharray="3 3" />
                    <ReferenceLine y={0} stroke="#f8fafc" />
                    <Bar dataKey="value">
                      {data.pacf.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.significant ? 'hsl(47 100% 50%)' : '#f8fafc'}
                          opacity={entry.significant ? 1 : 0.5}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground">
          Las barras que superan las líneas rojas punteadas (±{data.confidenceBound.toFixed(3)}) son estadísticamente significativas al 95%
        </div>

        <StatExplanation
          title="ACF y PACF"
          formula="ACF(k) = Cov(Xₜ, Xₜ₋ₖ) / Var(X)"
          interpretation="ACF mide la correlación entre una observación y sus valores pasados. PACF mide la correlación directa, eliminando efectos intermedios. En mercados eficientes, los retornos no deberían tener autocorrelación significativa (random walk). Si hay autocorrelación, puede indicar momentum (ACF positivo) o mean reversion (ACF negativo). ACF ayuda a identificar el orden 'q' en modelos MA, PACF ayuda con el orden 'p' en modelos AR."
        />
      </CardContent>
    </Card>
  );
};
