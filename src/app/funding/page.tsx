"use client";

import { useState, useMemo } from "react";
import { useFundingRates, FundingRateStats } from "@/hooks/useFundingRates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Star } from "lucide-react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function FundingRatePage() {
  const [minAPY, setMinAPY] = useState(0);
  const [daysBack, setDaysBack] = useState(30);
  const [onlyPositive, setOnlyPositive] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [positionSize, setPositionSize] = useState(10000);
  const [holdingDays, setHoldingDays] = useState(30);

  const { opportunities, loading, error } = useFundingRates({
    minAPY,
    daysBack,
    onlyPositive,
  });

  const selectedStats = useMemo(() => {
    return opportunities.find((o) => o.symbol === selectedSymbol) || null;
  }, [opportunities, selectedSymbol]);

  // Calculate ROI for selected symbol
  const roiCalc = useMemo(() => {
    if (!selectedStats) return null;

    const fundingIncome = positionSize * (selectedStats.avg30d * 3 * holdingDays);
    const tradingFees = positionSize * 0.0008; // 0.04% taker × 2 (open+close)
    const netProfit = fundingIncome - tradingFees;
    const roi = (netProfit / positionSize) * 100;
    const annualizedROI = (roi / holdingDays) * 365;

    return {
      fundingIncome,
      tradingFees,
      netProfit,
      roi,
      annualizedROI,
    };
  }, [selectedStats, positionSize, holdingDays]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!selectedStats) return [];

    return selectedStats.history.map((h) => ({
      time: new Date(h.fundingTime).toLocaleDateString(),
      rate: h.fundingRate * 100, // as percentage
      apy: h.fundingRate * 3 * 365 * 100,
    }));
  }, [selectedStats]);

  // Prepare heatmap data (last 30 days, 3 periods per day)
  const heatmapData = useMemo(() => {
    if (!selectedStats) return [];

    const last30Days = selectedStats.history.slice(-90); // 30 days × 3 periods
    const grid: { date: string; period: number; rate: number }[] = [];

    last30Days.forEach((h) => {
      const date = new Date(h.fundingTime);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const hour = date.getUTCHours();
      const period = hour === 0 ? 0 : hour === 8 ? 1 : 2; // 00:00, 08:00, 16:00 UTC

      grid.push({
        date: dateStr,
        period,
        rate: h.fundingRate * 100,
      });
    });

    return grid;
  }, [selectedStats]);

  const renderStars = (score: number) => {
    const stars = Math.round(score);
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < stars
                ? "fill-yellow-500 text-yellow-500"
                : "fill-gray-300 text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const getRateColor = (rate: number) => {
    if (rate > 0.03) return "bg-green-700";
    if (rate > 0.015) return "bg-green-600";
    if (rate > 0.005) return "bg-green-500";
    if (rate > 0) return "bg-green-400";
    if (rate === 0) return "bg-gray-400";
    if (rate > -0.005) return "bg-red-400";
    if (rate > -0.015) return "bg-red-500";
    return "bg-red-600";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading funding rates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funding Rate Arbitrage</h1>
          <p className="text-muted-foreground">
            Identify cash & carry opportunities with positive funding rates
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Min APY (%)</label>
              <Input
                type="number"
                value={minAPY}
                onChange={(e) => setMinAPY(Number(e.target.value))}
                className="w-32"
                placeholder="0"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Period (days)</label>
              <Input
                type="number"
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
                className="w-32"
                placeholder="30"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="positive"
                checked={onlyPositive}
                onCheckedChange={(checked) => setOnlyPositive(checked as boolean)}
              />
              <label htmlFor="positive" className="text-sm font-medium cursor-pointer">
                Only Positive Rates
              </label>
            </div>

            <div className="ml-auto text-sm text-muted-foreground">
              Found {opportunities.length} opportunities
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Live Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Symbol</th>
                  <th className="text-right p-3 font-medium">Current FR</th>
                  <th className="text-right p-3 font-medium">Avg 7d</th>
                  <th className="text-right p-3 font-medium">Avg 30d</th>
                  <th className="text-right p-3 font-medium">APY</th>
                  <th className="text-right p-3 font-medium">Persistence</th>
                  <th className="text-right p-3 font-medium">Score</th>
                  <th className="text-center p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-muted-foreground">
                      No opportunities found. Try adjusting filters.
                    </td>
                  </tr>
                ) : (
                  opportunities.map((opp) => (
                    <tr
                      key={opp.symbol}
                      className={`border-b hover:bg-accent cursor-pointer ${
                        selectedSymbol === opp.symbol ? "bg-accent" : ""
                      }`}
                      onClick={() => setSelectedSymbol(opp.symbol)}
                    >
                      <td className="p-3 font-medium">{opp.symbol}</td>
                      <td className="p-3 text-right">
                        <span
                          className={
                            opp.currentRate > 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {(opp.currentRate * 100).toFixed(4)}%
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {(opp.avg7d * 100).toFixed(4)}%
                      </td>
                      <td className="p-3 text-right">
                        {(opp.avg30d * 100).toFixed(4)}%
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-semibold ${
                            opp.apy > 30
                              ? "text-green-600"
                              : opp.apy > 15
                              ? "text-green-500"
                              : opp.apy > 0
                              ? "text-green-400"
                              : "text-red-500"
                          }`}
                        >
                          {opp.apy.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {opp.persistenceDays}d
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end">
                          {renderStars(opp.score)}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant={selectedSymbol === opp.symbol ? "default" : "outline"}
                        >
                          Analyze
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Selected Symbol Analysis */}
      {selectedStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funding Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedStats.symbol} - Funding Rate History</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    label={{ value: "Funding Rate (%)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-background border rounded p-2 shadow-lg">
                          <p className="text-sm">{payload[0].payload.time}</p>
                          <p className="text-sm font-semibold">
                            Rate: {payload[0].value?.toFixed(4)}%
                          </p>
                          <p className="text-sm text-muted-foreground">
                            APY: {payload[0].payload.apy.toFixed(1)}%
                          </p>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cash & Carry Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Cash & Carry ROI Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Position Size ($)</label>
                <Input
                  type="number"
                  value={positionSize}
                  onChange={(e) => setPositionSize(Number(e.target.value))}
                  placeholder="10000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Holding Period (days)</label>
                <Input
                  type="number"
                  value={holdingDays}
                  onChange={(e) => setHoldingDays(Number(e.target.value))}
                  placeholder="30"
                />
              </div>

              {roiCalc && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Expected Funding Income:
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      +${roiCalc.fundingIncome.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Trading Fees (0.08%):
                    </span>
                    <span className="text-sm font-semibold text-red-600">
                      -${roiCalc.tradingFees.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Price Risk (hedged):
                    </span>
                    <span className="text-sm font-semibold">$0.00</span>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">Net Profit:</span>
                      <span
                        className={`font-bold ${
                          roiCalc.netProfit > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {roiCalc.netProfit > 0 ? "+" : ""}$
                        {roiCalc.netProfit.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-semibold">ROI:</span>
                      <span
                        className={`font-bold ${
                          roiCalc.roi > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {roiCalc.roi > 0 ? "+" : ""}
                        {roiCalc.roi.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="font-semibold">APY:</span>
                      <span
                        className={`text-lg font-bold ${
                          roiCalc.annualizedROI > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {roiCalc.annualizedROI > 0 ? "+" : ""}
                        {roiCalc.annualizedROI.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Funding Rate Heatmap */}
      {selectedStats && heatmapData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedStats.symbol} - Funding Rate Heatmap (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-[100px_1fr] gap-2 items-center text-xs">
                <div className="font-medium">Period</div>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from(new Set(heatmapData.map((d) => d.date)))
                    .slice(-10)
                    .map((date) => (
                      <div key={date} className="text-center">
                        {date}
                      </div>
                    ))}
                </div>
              </div>

              {[0, 1, 2].map((period) => (
                <div key={period} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                  <div className="text-sm font-medium">
                    {period === 0 ? "00:00 UTC" : period === 1 ? "08:00 UTC" : "16:00 UTC"}
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from(new Set(heatmapData.map((d) => d.date)))
                      .slice(-10)
                      .map((date) => {
                        const data = heatmapData.find(
                          (d) => d.date === date && d.period === period
                        );
                        return (
                          <div
                            key={`${date}-${period}`}
                            className={`h-8 rounded ${
                              data ? getRateColor(data.rate) : "bg-gray-200"
                            }`}
                            title={
                              data
                                ? `${date} ${
                                    period === 0 ? "00:00" : period === 1 ? "08:00" : "16:00"
                                  }: ${(data.rate).toFixed(4)}%`
                                : ""
                            }
                          />
                        );
                      })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-4 pt-4 text-xs">
                <span className="font-medium">Legend:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-700 rounded" />
                  <span>&gt;0.03%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span>0.005-0.03%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-gray-400 rounded" />
                  <span>~0%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span>&lt;0%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
