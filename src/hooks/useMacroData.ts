import { useQuery } from "@tanstack/react-query";
import { MacroIndicator, MacroHistoryPoint } from "@/types/macro";

const generateMockFREDData = (seriesId: string, days: number): MacroHistoryPoint[] => {
  const data: MacroHistoryPoint[] = [];
  const now = new Date();

  const seriesConfig: Record<string, { base: number; volatility: number; trend: number }> = {
    FEDFUNDS: { base: 5.25, volatility: 0.02, trend: -0.001 },
    DGS10: { base: 4.2, volatility: 0.08, trend: 0.002 },
    M2SL: { base: 21000, volatility: 50, trend: 5 },
    CPIAUCSL: { base: 314, volatility: 0.3, trend: 0.2 },
    UNRATE: { base: 4.1, volatility: 0.1, trend: 0.01 },
    GDP: { base: 28500, volatility: 100, trend: 50 },
    DTWEXBGS: { base: 123, volatility: 0.5, trend: 0.1 },
    DXY: { base: 104.5, volatility: 0.8, trend: 0.05 },
    SPX: { base: 5950, volatility: 30, trend: 5 },
    GOLD: { base: 2650, volatility: 15, trend: 3 },
    VIX: { base: 16, volatility: 2, trend: 0 },
  };

  const config = seriesConfig[seriesId] || { base: 100, volatility: 1, trend: 0 };
  let value = config.base;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const randomChange = (Math.random() - 0.5) * 2 * config.volatility;
    value = value + randomChange + config.trend;

    data.push({
      date: date.toISOString().split('T')[0],
      value: Number(value.toFixed(2)),
    });
  }

  return data;
};

const fetchFREDSeries = async (seriesId: string, limit: number = 365): Promise<MacroHistoryPoint[]> => {
  const mockData = generateMockFREDData(seriesId, limit);
  return mockData;
};

const fetchMacroIndicators = async (): Promise<MacroIndicator[]> => {
  const indicators: MacroIndicator[] = [
    {
      id: "dxy",
      name: "US Dollar Index",
      symbol: "DXY",
      category: "market",
      value: 104.52,
      previousValue: 104.18,
      change: 0.34,
      changePercent: 0.33,
      unit: "",
      lastUpdate: new Date().toISOString(),
      description: "Mide el valor del dólar vs canasta de divisas principales",
      cryptoImpact: "negative",
      cryptoImpactReason: "DXY alto = dólar fuerte = presión bajista en crypto",
    },
    {
      id: "spx",
      name: "S&P 500",
      symbol: "SPX",
      category: "market",
      value: 5952.34,
      previousValue: 5918.25,
      change: 34.09,
      changePercent: 0.58,
      unit: "",
      lastUpdate: new Date().toISOString(),
      description: "Índice de las 500 empresas más grandes de EE.UU.",
      cryptoImpact: "positive",
      cryptoImpactReason: "S&P al alza = risk-on = positivo para crypto",
    },
    {
      id: "gold",
      name: "Oro",
      symbol: "XAU",
      category: "market",
      value: 2652.80,
      previousValue: 2638.40,
      change: 14.40,
      changePercent: 0.55,
      unit: "USD/oz",
      lastUpdate: new Date().toISOString(),
      description: "Precio del oro, activo refugio tradicional",
      cryptoImpact: "positive",
      cryptoImpactReason: "Oro y BTC compiten como reserva de valor; tendencias similares",
    },
    {
      id: "vix",
      name: "VIX",
      symbol: "VIX",
      category: "market",
      value: 16.42,
      previousValue: 17.85,
      change: -1.43,
      changePercent: -8.01,
      unit: "",
      lastUpdate: new Date().toISOString(),
      description: "Índice de volatilidad del S&P 500 ('índice del miedo')",
      cryptoImpact: "neutral",
      cryptoImpactReason: "VIX bajo = mercado tranquilo; VIX alto = pánico/oportunidad",
    },
    {
      id: "fedfunds",
      name: "Fed Funds Rate",
      symbol: "FEDFUNDS",
      category: "monetary",
      value: 5.25,
      previousValue: 5.25,
      change: 0,
      changePercent: 0,
      unit: "%",
      lastUpdate: new Date().toISOString(),
      description: "Tasa de interés de referencia de la Reserva Federal",
      cryptoImpact: "negative",
      cryptoImpactReason: "Tasas altas = menos liquidez = negativo para activos de riesgo",
    },
    {
      id: "dgs10",
      name: "Treasury 10Y",
      symbol: "DGS10",
      category: "monetary",
      value: 4.28,
      previousValue: 4.22,
      change: 0.06,
      changePercent: 1.42,
      unit: "%",
      lastUpdate: new Date().toISOString(),
      description: "Rendimiento del bono del Tesoro a 10 años",
      cryptoImpact: "negative",
      cryptoImpactReason: "Yields altos compiten con crypto por capital",
    },
    {
      id: "cpi",
      name: "CPI (Inflación)",
      symbol: "CPI",
      category: "monetary",
      value: 3.4,
      previousValue: 3.5,
      change: -0.1,
      changePercent: -2.86,
      unit: "% YoY",
      lastUpdate: new Date().toISOString(),
      description: "Índice de precios al consumidor, mide inflación",
      cryptoImpact: "positive",
      cryptoImpactReason: "Inflación alta favorece a BTC como cobertura",
    },
    {
      id: "m2",
      name: "M2 Money Supply",
      symbol: "M2",
      category: "economic",
      value: 21020,
      previousValue: 20890,
      change: 130,
      changePercent: 0.62,
      unit: "B USD",
      lastUpdate: new Date().toISOString(),
      description: "Masa monetaria M2 de EE.UU.",
      cryptoImpact: "positive",
      cryptoImpactReason: "M2 creciente = más liquidez = positivo para crypto",
    },
    {
      id: "unemployment",
      name: "Tasa de Desempleo",
      symbol: "UNRATE",
      category: "economic",
      value: 4.1,
      previousValue: 4.0,
      change: 0.1,
      changePercent: 2.5,
      unit: "%",
      lastUpdate: new Date().toISOString(),
      description: "Porcentaje de la fuerza laboral desempleada",
      cryptoImpact: "neutral",
      cryptoImpactReason: "Desempleo alto puede llevar a política monetaria expansiva",
    },
    {
      id: "gdp",
      name: "GDP Growth",
      symbol: "GDP",
      category: "economic",
      value: 2.8,
      previousValue: 2.1,
      change: 0.7,
      changePercent: 33.33,
      unit: "% QoQ",
      lastUpdate: new Date().toISOString(),
      description: "Crecimiento del PIB de EE.UU. trimestral",
      cryptoImpact: "positive",
      cryptoImpactReason: "Economía fuerte = más inversión en activos de riesgo",
    },
  ];

  return indicators;
};

export const useMacroIndicators = () => {
  return useQuery({
    queryKey: ["macroIndicators"],
    queryFn: fetchMacroIndicators,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useMacroHistory = (seriesId: string, days: number = 365) => {
  return useQuery({
    queryKey: ["macroHistory", seriesId, days],
    queryFn: () => fetchFREDSeries(seriesId, days),
    staleTime: 60 * 60 * 1000,
    enabled: !!seriesId,
  });
};

export const useMacroComparison = (seriesIds: string[], days: number = 365) => {
  return useQuery({
    queryKey: ["macroComparison", seriesIds.join(","), days],
    queryFn: async () => {
      const results: Record<string, MacroHistoryPoint[]> = {};
      for (const id of seriesIds) {
        results[id] = await fetchFREDSeries(id, days);
      }
      return results;
    },
    staleTime: 60 * 60 * 1000,
    enabled: seriesIds.length > 0,
  });
};
