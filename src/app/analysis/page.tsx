"use client";

import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCryptoList } from "@/hooks/useCryptoData";
import { useBinancePriceHistory, isBinanceSupported, type BinanceInterval } from "@/hooks/useBinanceData";
import { DescriptiveStatsCard } from "@/components/crypto/analysis/DescriptiveStatsCard";
import { ReturnsAnalysisCard } from "@/components/crypto/analysis/ReturnsAnalysisCard";
import { CorrelationMatrix } from "@/components/crypto/analysis/CorrelationMatrix";
import { CointegrationCard } from "@/components/crypto/analysis/CointegrationCard";
import { RegressionScatter } from "@/components/crypto/analysis/RegressionScatter";
import { VolatilityChart } from "@/components/crypto/analysis/VolatilityChart";
import { AutocorrelationChart } from "@/components/crypto/analysis/AutocorrelationChart";
import { TrendDecomposition } from "@/components/crypto/analysis/TrendDecomposition";
import { getDescriptiveStats, getReturnStats } from "@/lib/statistics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, TrendingUp, GitMerge, Activity, Waves, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const BINANCE_API = "https://api.binance.com/api/v3";

// Map days to Binance interval and limit
const daysToConfig = (days: number): { interval: BinanceInterval; limit: number } => {
  if (days <= 30) return { interval: "1d", limit: days };
  if (days <= 90) return { interval: "1d", limit: days };
  if (days <= 180) return { interval: "1d", limit: days };
  return { interval: "1d", limit: Math.min(days, 365) };
};

export default function AnalysisPage() {
  const { data: cryptoList } = useCryptoList(50);
  const [selectedCrypto, setSelectedCrypto] = useState("bitcoin");
  const [selectedCrypto2, setSelectedCrypto2] = useState("ethereum");
  const [selectedForCorrelation, setSelectedForCorrelation] = useState<string[]>(["bitcoin", "ethereum", "solana", "cardano", "ripple"]);
  const [days, setDays] = useState(90);

  const { interval, limit } = daysToConfig(days);

  const { data: priceHistory, isLoading: priceLoading } = useBinancePriceHistory(selectedCrypto, interval, limit);
  const { data: priceHistory2 } = useBinancePriceHistory(selectedCrypto2, interval, limit);

  // Use useQueries for dynamic number of queries (correlation matrix)
  const correlationQueries = useQueries({
    queries: selectedForCorrelation.filter(id => isBinanceSupported(id)).map(coinId => ({
      queryKey: ["binancePrices", coinId, interval, limit],
      queryFn: async () => {
        const symbolMap: Record<string, string> = {
          bitcoin: "BTCUSDT",
          ethereum: "ETHUSDT",
          binancecoin: "BNBUSDT",
          solana: "SOLUSDT",
          ripple: "XRPUSDT",
          cardano: "ADAUSDT",
          dogecoin: "DOGEUSDT",
          polkadot: "DOTUSDT",
          avalanche: "AVAXUSDT",
          chainlink: "LINKUSDT",
          polygon: "MATICUSDT",
          litecoin: "LTCUSDT",
          uniswap: "UNIUSDT",
          stellar: "XLMUSDT",
          monero: "XMRUSDT",
          "ethereum-classic": "ETCUSDT",
          filecoin: "FILUSDT",
          cosmos: "ATOMUSDT",
          tron: "TRXUSDT",
          near: "NEARUSDT",
        };
        const symbol = symbolMap[coinId];
        if (!symbol) return [];

        const response = await fetch(
          `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        return data.map((k: (string | number)[]) => ({
          timestamp: k[0] as number,
          price: parseFloat(k[4] as string),
        }));
      },
      staleTime: 60 * 60 * 1000,
    })),
  });

  const prices = useMemo(() =>
    priceHistory?.map(p => p.price) || [],
    [priceHistory]
  );

  const prices2 = useMemo(() =>
    priceHistory2?.map(p => p.price) || [],
    [priceHistory2]
  );

  const timestamps = useMemo(() =>
    priceHistory?.map(p => p.timestamp) || [],
    [priceHistory]
  );

  const descriptiveStats = useMemo(() =>
    prices.length > 0 ? getDescriptiveStats(prices) : null,
    [prices]
  );

  const returnStats = useMemo(() =>
    prices.length > 1 ? getReturnStats(prices) : null,
    [prices]
  );

  const correlationAssets = useMemo(() => {
    const supportedIds = selectedForCorrelation.filter(id => isBinanceSupported(id));
    return supportedIds.map((id, idx) => {
      const query = correlationQueries[idx];
      const crypto = cryptoList?.find(c => c.id === id);
      return {
        id,
        symbol: crypto?.symbol || id,
        prices: query?.data?.map((p: { price: number }) => p.price) || [],
      };
    }).filter(a => a.prices.length > 0);
  }, [selectedForCorrelation, correlationQueries, cryptoList]);

  const handleCorrelationToggle = (id: string) => {
    setSelectedForCorrelation(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 8) return prev;
      return [...prev, id];
    });
  };

  const selectedSymbol = cryptoList?.find(c => c.id === selectedCrypto)?.symbol || selectedCrypto;
  const selectedSymbol2 = cryptoList?.find(c => c.id === selectedCrypto2)?.symbol || selectedCrypto2;

  // Filter cryptos that are supported by Binance
  const supportedCryptos = cryptoList?.filter(c => isBinanceSupported(c.id)) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text">Análisis Estadístico</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Herramientas de análisis estadístico y series temporales para criptomonedas
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
            <SelectTrigger className="w-40 bg-crypto-card border-crypto-card">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent className="bg-crypto-card border-crypto-card">
              {supportedCryptos.map(crypto => (
                <SelectItem key={crypto.id} value={crypto.id}>
                  {crypto.symbol.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={days.toString()} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-28 bg-crypto-card border-crypto-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-crypto-card border-crypto-card">
              <SelectItem value="30">30 días</SelectItem>
              <SelectItem value="90">90 días</SelectItem>
              <SelectItem value="180">180 días</SelectItem>
              <SelectItem value="365">1 año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="descriptive" className="w-full">
        <TabsList className="bg-crypto-card flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="descriptive" className="data-[state=active]:bg-crypto-accent gap-2">
            <BarChart3 className="h-4 w-4" />
            Descriptivas
          </TabsTrigger>
          <TabsTrigger value="returns" className="data-[state=active]:bg-crypto-accent gap-2">
            <TrendingUp className="h-4 w-4" />
            Retornos
          </TabsTrigger>
          <TabsTrigger value="correlation" className="data-[state=active]:bg-crypto-accent gap-2">
            <GitMerge className="h-4 w-4" />
            Correlación
          </TabsTrigger>
          <TabsTrigger value="volatility" className="data-[state=active]:bg-crypto-accent gap-2">
            <Activity className="h-4 w-4" />
            Volatilidad
          </TabsTrigger>
          <TabsTrigger value="autocorrelation" className="data-[state=active]:bg-crypto-accent gap-2">
            <Waves className="h-4 w-4" />
            ACF/PACF
          </TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-crypto-accent gap-2">
            <Layers className="h-4 w-4" />
            Tendencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="descriptive" className="mt-6">
          {priceLoading ? (
            <Skeleton className="h-64 w-full bg-crypto-card" />
          ) : descriptiveStats ? (
            <DescriptiveStatsCard stats={descriptiveStats} title={`Estadísticas: ${selectedSymbol.toUpperCase()} (${days} días)`} />
          ) : (
            <p className="text-muted-foreground">No hay datos disponibles</p>
          )}
        </TabsContent>

        <TabsContent value="returns" className="mt-6">
          {priceLoading ? (
            <Skeleton className="h-96 w-full bg-crypto-card" />
          ) : returnStats ? (
            <ReturnsAnalysisCard stats={returnStats} title={`Retornos: ${selectedSymbol.toUpperCase()} (${days} días)`} />
          ) : (
            <p className="text-muted-foreground">No hay datos disponibles</p>
          )}
        </TabsContent>

        <TabsContent value="correlation" className="mt-6 space-y-6">
          <div className="bg-crypto-card rounded-lg p-4">
            <p className="text-sm text-crypto-text mb-3">Seleccionar activos para matriz (máx 8):</p>
            <div className="flex flex-wrap gap-3">
              {supportedCryptos.slice(0, 20).map(crypto => (
                <label key={crypto.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedForCorrelation.includes(crypto.id)}
                    onCheckedChange={() => handleCorrelationToggle(crypto.id)}
                    className="border-crypto-accent data-[state=checked]:bg-crypto-accent"
                  />
                  <span className="text-sm text-crypto-text">{crypto.symbol.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <CorrelationMatrix assets={correlationAssets} />

          <div className="bg-crypto-card rounded-lg p-4 space-y-4">
            <p className="text-sm text-crypto-text">Análisis de Cointegración (par a par):</p>
            <div className="flex items-center gap-4">
              <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                <SelectTrigger className="w-32 bg-crypto-bg border-crypto-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-crypto-card border-crypto-card">
                  {supportedCryptos.map(crypto => (
                    <SelectItem key={crypto.id} value={crypto.id}>
                      {crypto.symbol.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">vs</span>
              <Select value={selectedCrypto2} onValueChange={setSelectedCrypto2}>
                <SelectTrigger className="w-32 bg-crypto-bg border-crypto-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-crypto-card border-crypto-card">
                  {supportedCryptos.map(crypto => (
                    <SelectItem key={crypto.id} value={crypto.id}>
                      {crypto.symbol.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {prices.length > 0 && prices2.length > 0 && (
            <>
              <RegressionScatter
                pricesA={prices}
                pricesB={prices2}
                symbolA={selectedSymbol}
                symbolB={selectedSymbol2}
              />
              <CointegrationCard
                pricesA={prices}
                pricesB={prices2}
                symbolA={selectedSymbol}
                symbolB={selectedSymbol2}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="volatility" className="mt-6">
          {priceLoading ? (
            <Skeleton className="h-96 w-full bg-crypto-card" />
          ) : prices.length > 0 ? (
            <VolatilityChart prices={prices} timestamps={timestamps} symbol={selectedSymbol} />
          ) : (
            <p className="text-muted-foreground">No hay datos disponibles</p>
          )}
        </TabsContent>

        <TabsContent value="autocorrelation" className="mt-6">
          {priceLoading ? (
            <Skeleton className="h-96 w-full bg-crypto-card" />
          ) : prices.length > 0 ? (
            <AutocorrelationChart prices={prices} symbol={selectedSymbol} />
          ) : (
            <p className="text-muted-foreground">No hay datos disponibles</p>
          )}
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          {priceLoading ? (
            <Skeleton className="h-96 w-full bg-crypto-card" />
          ) : prices.length > 0 ? (
            <TrendDecomposition prices={prices} timestamps={timestamps} symbol={selectedSymbol} />
          ) : (
            <p className="text-muted-foreground">No hay datos disponibles</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
