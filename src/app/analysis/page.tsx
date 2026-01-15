"use client";

import { useCryptoList } from "@/hooks/useCryptoData";
import { useBinancePriceHistory } from "@/hooks/useBinanceData";
import { useMemo } from "react";
import { getDescriptiveStats, getReturnStats, correlation } from "@/lib/statistics";
import { Card } from "@/components/ui/card";
import { FlaskConical, Database } from "lucide-react";

export default function AnalysisPage() {
  const { data: cryptoList } = useCryptoList(10);
  // Use Binance for 30 days of daily data
  const { data: btcHistory, isLoading: btcLoading } = useBinancePriceHistory("bitcoin", "1d", 30);
  const { data: ethHistory, isLoading: ethLoading } = useBinancePriceHistory("ethereum", "1d", 30);

  const btcPrices = useMemo(() => btcHistory?.map(p => p.price) || [], [btcHistory]);
  const ethPrices = useMemo(() => ethHistory?.map(p => p.price) || [], [ethHistory]);

  const btcStats = useMemo(() => btcPrices.length > 0 ? getDescriptiveStats(btcPrices) : null, [btcPrices]);
  const ethStats = useMemo(() => ethPrices.length > 0 ? getDescriptiveStats(ethPrices) : null, [ethPrices]);
  const btcReturns = useMemo(() => btcPrices.length > 0 ? getReturnStats(btcPrices) : null, [btcPrices]);
  const ethReturns = useMemo(() => ethPrices.length > 0 ? getReturnStats(ethPrices) : null, [ethPrices]);

  const corr = useMemo(() => {
    if (btcPrices.length > 0 && ethPrices.length > 0) {
      const minLen = Math.min(btcPrices.length, ethPrices.length);
      return correlation(btcPrices.slice(0, minLen), ethPrices.slice(0, minLen));
    }
    return 0;
  }, [btcPrices, ethPrices]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-crypto-accent" />
          Statistical Analysis
        </h1>
        <p className="text-crypto-muted mt-1">
          Advanced statistical metrics for cryptocurrencies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BTC Stats */}
        <Card className="bg-crypto-card border-crypto-border p-6">
          <h3 className="text-lg font-semibold text-crypto-text mb-4">Bitcoin (BTC) - 30 Day Stats</h3>
          {btcStats ? (
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Mean Price" value={`$${btcStats.mean.toLocaleString()}`} />
              <StatItem label="Median Price" value={`$${btcStats.median.toLocaleString()}`} />
              <StatItem label="Std Deviation" value={`$${btcStats.stdDev.toFixed(2)}`} />
              <StatItem label="Range" value={`$${btcStats.range.toFixed(2)}`} />
              <StatItem label="Min" value={`$${btcStats.min.toLocaleString()}`} />
              <StatItem label="Max" value={`$${btcStats.max.toLocaleString()}`} />
            </div>
          ) : (
            <div className="animate-pulse h-32 bg-crypto-border rounded" />
          )}
        </Card>

        {/* ETH Stats */}
        <Card className="bg-crypto-card border-crypto-border p-6">
          <h3 className="text-lg font-semibold text-crypto-text mb-4">Ethereum (ETH) - 30 Day Stats</h3>
          {ethStats ? (
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Mean Price" value={`$${ethStats.mean.toLocaleString()}`} />
              <StatItem label="Median Price" value={`$${ethStats.median.toLocaleString()}`} />
              <StatItem label="Std Deviation" value={`$${ethStats.stdDev.toFixed(2)}`} />
              <StatItem label="Range" value={`$${ethStats.range.toFixed(2)}`} />
              <StatItem label="Min" value={`$${ethStats.min.toLocaleString()}`} />
              <StatItem label="Max" value={`$${ethStats.max.toLocaleString()}`} />
            </div>
          ) : (
            <div className="animate-pulse h-32 bg-crypto-border rounded" />
          )}
        </Card>
      </div>

      {/* Returns Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-crypto-card border-crypto-border p-6">
          <h3 className="text-lg font-semibold text-crypto-text mb-4">BTC Return Statistics</h3>
          {btcReturns ? (
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Mean Daily Return" value={`${(btcReturns.meanReturn * 100).toFixed(4)}%`} />
              <StatItem label="Volatility" value={`${(btcReturns.volatility * 100).toFixed(2)}%`} />
              <StatItem label="Sharpe Ratio" value={btcReturns.sharpeRatio.toFixed(3)} />
              <StatItem label="Max Drawdown" value={`${(btcReturns.maxDrawdown * 100).toFixed(2)}%`} />
              <StatItem label="Win Rate" value={`${(btcReturns.winRate * 100).toFixed(1)}%`} />
              <StatItem label="Pos/Neg Days" value={`${btcReturns.positiveCount}/${btcReturns.negativeCount}`} />
            </div>
          ) : (
            <div className="animate-pulse h-32 bg-crypto-border rounded" />
          )}
        </Card>

        <Card className="bg-crypto-card border-crypto-border p-6">
          <h3 className="text-lg font-semibold text-crypto-text mb-4">ETH Return Statistics</h3>
          {ethReturns ? (
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Mean Daily Return" value={`${(ethReturns.meanReturn * 100).toFixed(4)}%`} />
              <StatItem label="Volatility" value={`${(ethReturns.volatility * 100).toFixed(2)}%`} />
              <StatItem label="Sharpe Ratio" value={ethReturns.sharpeRatio.toFixed(3)} />
              <StatItem label="Max Drawdown" value={`${(ethReturns.maxDrawdown * 100).toFixed(2)}%`} />
              <StatItem label="Win Rate" value={`${(ethReturns.winRate * 100).toFixed(1)}%`} />
              <StatItem label="Pos/Neg Days" value={`${ethReturns.positiveCount}/${ethReturns.negativeCount}`} />
            </div>
          ) : (
            <div className="animate-pulse h-32 bg-crypto-border rounded" />
          )}
        </Card>
      </div>

      {/* Correlation */}
      <Card className="bg-crypto-card border-crypto-border p-6">
        <h3 className="text-lg font-semibold text-crypto-text mb-4">BTC/ETH Correlation</h3>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-crypto-muted text-sm">Pearson Correlation</p>
            <p className="text-3xl font-bold text-crypto-accent">{corr.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-crypto-muted text-sm">Interpretation</p>
            <p className="text-crypto-text font-medium">
              {Math.abs(corr) >= 0.8 ? "Very Strong" :
               Math.abs(corr) >= 0.6 ? "Strong" :
               Math.abs(corr) >= 0.4 ? "Moderate" :
               Math.abs(corr) >= 0.2 ? "Weak" : "Very Weak"}
              {corr >= 0 ? " Positive" : " Negative"} Correlation
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-crypto-bg rounded-lg p-3">
      <p className="text-crypto-muted text-xs mb-1">{label}</p>
      <p className="text-crypto-text font-semibold">{value}</p>
    </div>
  );
}
