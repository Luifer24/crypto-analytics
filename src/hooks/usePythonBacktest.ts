/**
 * Hook for Python-powered backtest engine
 *
 * Calls the professional Python API (FastAPI) instead of TypeScript implementation.
 * Uses statsmodels for cointegration, time-based lookback, and proper annualization.
 */

import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PythonBacktestConfig {
  entryThreshold: number;
  exitThreshold: number;
  stopLoss: number;
  commissionPct: number;
  slippageBps: number;
  useDynamicHedge: boolean;
  lookbackHours?: number;
}

interface PythonBacktestRequest {
  symbol1: string;
  symbol2: string;
  prices1: number[];
  prices2: number[];
  timestamps?: number[];
  lookbackDays: number;
  interval: string;
  config?: PythonBacktestConfig;
}

interface TradeResult {
  entry_time: number;
  exit_time: number;
  side: string;
  entry_z_score: number;
  exit_z_score: number;
  pnl_gross: number;
  pnl_net: number;
  holding_period: number;
  exit_reason: string;
}

interface BacktestMetrics {
  total_return: number;
  annualized_return: number;
  sharpe: number;
  sortino: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  avg_trade_pnl: number;
  avg_holding_period: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
}

interface PythonBacktestResponse {
  success: boolean;
  trades: TradeResult[];
  metrics: BacktestMetrics;
  equity_curve: number[];
  config_used: PythonBacktestConfig;
  execution_time_ms: number;
}

interface UsePythonBacktestReturn {
  runBacktest: (request: PythonBacktestRequest) => Promise<PythonBacktestResponse | null>;
  isLoading: boolean;
  error: string | null;
  result: PythonBacktestResponse | null;
}

// ============================================================================
// Hook
// ============================================================================

export function usePythonBacktest(): UsePythonBacktestReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PythonBacktestResponse | null>(null);

  const runBacktest = async (request: PythonBacktestRequest): Promise<PythonBacktestResponse | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Python API endpoint
      const apiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/api/v1/backtest/run`;

      console.log('[PythonBacktest] Sending request to:', endpoint);
      console.log('[PythonBacktest] Request:', {
        symbol1: request.symbol1,
        symbol2: request.symbol2,
        dataPoints: request.prices1.length,
        interval: request.interval,
        lookbackDays: request.lookbackDays,
        config: request.config,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data: PythonBacktestResponse = await response.json();

      console.log('[PythonBacktest] Success:', {
        trades: data.trades.length,
        totalReturn: (data.metrics.total_return * 100).toFixed(2) + '%',
        sharpe: data.metrics.sharpe.toFixed(2),
        executionTime: data.execution_time_ms.toFixed(0) + 'ms',
      });

      setResult(data);
      setIsLoading(false);
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('[PythonBacktest] Error:', errorMessage);
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  };

  return {
    runBacktest,
    isLoading,
    error,
    result,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert TypeScript backtest config to Python format
 */
export function convertConfigToPython(config: any): PythonBacktestConfig {
  return {
    entryThreshold: config.entryThreshold ?? 2.0,
    exitThreshold: config.exitThreshold ?? 0.0,
    stopLoss: config.stopLoss ?? 3.0,
    commissionPct: config.commissionPct ?? 0.0004,
    slippageBps: config.slippageBps ?? 3,
    useDynamicHedge: config.useDynamicHedge ?? false,
    lookbackHours: config.lookbackHours ?? 24.0,
  };
}

/**
 * Format trade for display
 */
export function formatTrade(trade: TradeResult, index: number) {
  return {
    id: index,
    entryTime: trade.entry_time,
    exitTime: trade.exit_time,
    side: trade.side === 'long_spread' ? 'Long Spread' : 'Short Spread',
    entryZScore: trade.entry_z_score,
    exitZScore: trade.exit_z_score,
    pnl: trade.pnl_net,
    holdingPeriod: trade.holding_period,
    exitReason: trade.exit_reason === 'mean_reversion' ? 'Mean Reversion' :
                trade.exit_reason === 'stop_loss' ? 'Stop Loss' : 'End of Data',
  };
}
