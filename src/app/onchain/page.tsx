"use client";

import {
  useMempoolStats,
  useRecommendedFees,
  useRecentBlocks,
  useCurrentHashrate,
  useDifficultyAdjustment,
  useMiningPools,
} from "@/hooks/useOnChainData";
import { Card } from "@/components/ui/card";
import { Link2, Activity, Clock, Cpu, Zap, Users } from "lucide-react";
import { format } from "date-fns";

export default function OnChainPage() {
  const { data: mempool, isLoading: mempoolLoading } = useMempoolStats();
  const { data: fees, isLoading: feesLoading } = useRecommendedFees();
  const { data: blocks, isLoading: blocksLoading } = useRecentBlocks(10);
  const { data: hashrate, isLoading: hashrateLoading } = useCurrentHashrate();
  const { data: difficulty, isLoading: difficultyLoading } = useDifficultyAdjustment();
  const { data: pools, isLoading: poolsLoading } = useMiningPools();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
          <Link2 className="w-6 h-6 text-crypto-accent" />
          Bitcoin On-Chain Data
        </h1>
        <p className="text-crypto-muted mt-1">
          Real-time Bitcoin blockchain metrics from Mempool.space
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Mempool Transactions"
          value={mempool?.count.toLocaleString() || "-"}
          loading={mempoolLoading}
        />
        <StatCard
          icon={Zap}
          label="Fastest Fee (sat/vB)"
          value={fees?.fastestFee.toString() || "-"}
          loading={feesLoading}
        />
        <StatCard
          icon={Cpu}
          label="Hashrate (EH/s)"
          value={hashrate ? (hashrate.currentHashrate / 1e18).toFixed(2) : "-"}
          loading={hashrateLoading}
        />
        <StatCard
          icon={Clock}
          label="Next Difficulty Adj."
          value={difficulty ? `${difficulty.difficultyChange >= 0 ? "+" : ""}${difficulty.difficultyChange.toFixed(2)}%` : "-"}
          loading={difficultyLoading}
        />
      </div>

      {/* Fee Recommendations */}
      <Card className="bg-crypto-card border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-4">
          Recommended Fees (sat/vB)
        </h3>
        {feesLoading ? (
          <div className="animate-pulse h-24 bg-crypto-border rounded" />
        ) : fees ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <FeeBox label="Fastest (~10 min)" value={fees.fastestFee} priority="high" />
            <FeeBox label="Fast (~30 min)" value={fees.halfHourFee} priority="medium" />
            <FeeBox label="Normal (~1 hour)" value={fees.hourFee} priority="normal" />
            <FeeBox label="Economy" value={fees.economyFee} priority="low" />
            <FeeBox label="Minimum" value={fees.minimumFee} priority="min" />
          </div>
        ) : null}
      </Card>

      {/* Recent Blocks */}
      <Card className="bg-crypto-card border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-4">
          Recent Blocks
        </h3>
        {blocksLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-crypto-border rounded" />
            ))}
          </div>
        ) : blocks ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-crypto-border">
                  <th className="text-left text-crypto-muted text-sm p-2">Height</th>
                  <th className="text-left text-crypto-muted text-sm p-2">Time</th>
                  <th className="text-right text-crypto-muted text-sm p-2">Transactions</th>
                  <th className="text-right text-crypto-muted text-sm p-2">Size</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.height} className="border-b border-crypto-border/50">
                    <td className="p-2 text-crypto-accent font-mono">{block.height.toLocaleString()}</td>
                    <td className="p-2 text-crypto-muted text-sm">
                      {format(new Date(block.timestamp * 1000), "HH:mm:ss")}
                    </td>
                    <td className="p-2 text-right text-crypto-text">{block.tx_count.toLocaleString()}</td>
                    <td className="p-2 text-right text-crypto-muted font-mono">
                      {(block.size / 1e6).toFixed(2)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {/* Mining Pools */}
      <Card className="bg-crypto-card border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Mining Pools (Last Month)
        </h3>
        {poolsLoading ? (
          <div className="animate-pulse h-48 bg-crypto-border rounded" />
        ) : pools?.pools ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {pools.pools.slice(0, 8).map((pool) => (
              <div
                key={pool.name}
                className="bg-crypto-bg rounded-lg p-4"
              >
                <p className="text-crypto-text font-medium">{pool.name}</p>
                <p className="text-crypto-accent font-bold text-lg">{pool.share.toFixed(1)}%</p>
                <p className="text-crypto-muted text-xs">{pool.blockCount} blocks</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="bg-crypto-card border-crypto-border p-4">
      <div className="flex items-center gap-2 text-crypto-muted mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      {loading ? (
        <div className="animate-pulse h-8 bg-crypto-border rounded w-20" />
      ) : (
        <p className="text-2xl font-bold text-crypto-text">{value}</p>
      )}
    </Card>
  );
}

function FeeBox({
  label,
  value,
  priority,
}: {
  label: string;
  value: number;
  priority: "high" | "medium" | "normal" | "low" | "min";
}) {
  const colors = {
    high: "bg-crypto-negative/20 text-crypto-negative",
    medium: "bg-crypto-accent/20 text-crypto-accent",
    normal: "bg-crypto-positive/20 text-crypto-positive",
    low: "bg-crypto-muted/20 text-crypto-muted",
    min: "bg-crypto-border text-crypto-muted",
  };

  return (
    <div className={`rounded-lg p-4 ${colors[priority]}`}>
      <p className="text-xs mb-1 opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
