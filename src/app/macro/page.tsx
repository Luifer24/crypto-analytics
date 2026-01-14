"use client";

import { useMacroIndicators } from "@/hooks/useMacroData";
import { Card } from "@/components/ui/card";
import { Globe, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MacroPage() {
  const { data: indicators, isLoading } = useMacroIndicators();

  const marketIndicators = indicators?.filter(i => i.category === "market");
  const monetaryIndicators = indicators?.filter(i => i.category === "monetary");
  const economicIndicators = indicators?.filter(i => i.category === "economic");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
            <Globe className="w-6 h-6 text-crypto-accent" />
            Macro Indicators
          </h1>
          <p className="text-crypto-muted mt-1">
            Macroeconomic factors affecting crypto markets
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-crypto-card rounded-lg border border-crypto-border p-6 animate-pulse">
              <div className="h-24 bg-crypto-border rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
          <Globe className="w-6 h-6 text-crypto-accent" />
          Macro Indicators
        </h1>
        <p className="text-crypto-muted mt-1">
          Macroeconomic factors affecting crypto markets
        </p>
      </div>

      {/* Market Indicators */}
      <div>
        <h2 className="text-lg font-semibold text-crypto-text mb-4">Market Indicators</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketIndicators?.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </div>

      {/* Monetary Policy */}
      <div>
        <h2 className="text-lg font-semibold text-crypto-text mb-4">Monetary Policy</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monetaryIndicators?.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </div>

      {/* Economic Indicators */}
      <div>
        <h2 className="text-lg font-semibold text-crypto-text mb-4">Economic Indicators</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {economicIndicators?.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface Indicator {
  id: string;
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
  unit: string;
  description: string;
  cryptoImpact: "positive" | "negative" | "neutral";
  cryptoImpactReason: string;
}

function IndicatorCard({ indicator }: { indicator: Indicator }) {
  const isPositiveChange = indicator.change >= 0;

  return (
    <Card className="bg-crypto-card border-crypto-border p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-crypto-muted text-sm">{indicator.name}</p>
          <p className="text-crypto-text font-mono text-xs">{indicator.symbol}</p>
        </div>
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            indicator.cryptoImpact === "positive" && "bg-crypto-positive/20 text-crypto-positive",
            indicator.cryptoImpact === "negative" && "bg-crypto-negative/20 text-crypto-negative",
            indicator.cryptoImpact === "neutral" && "bg-crypto-muted/20 text-crypto-muted"
          )}
        >
          {indicator.cryptoImpact === "positive" ? "Bullish" :
           indicator.cryptoImpact === "negative" ? "Bearish" : "Neutral"}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-2xl font-bold text-crypto-text">
          {indicator.value.toLocaleString()}{indicator.unit}
        </p>
        <span
          className={cn(
            "inline-flex items-center text-sm font-medium",
            isPositiveChange ? "text-crypto-positive" : "text-crypto-negative"
          )}
        >
          {isPositiveChange ? (
            <TrendingUp className="w-3 h-3 mr-1" />
          ) : (
            <TrendingDown className="w-3 h-3 mr-1" />
          )}
          {isPositiveChange ? "+" : ""}{indicator.changePercent.toFixed(2)}%
        </span>
      </div>

      <div className="pt-3 border-t border-crypto-border">
        <div className="flex items-start gap-2">
          <ArrowRight className="w-4 h-4 text-crypto-accent mt-0.5 flex-shrink-0" />
          <p className="text-crypto-muted text-xs">{indicator.cryptoImpactReason}</p>
        </div>
      </div>
    </Card>
  );
}
