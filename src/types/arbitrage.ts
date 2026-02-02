/**
 * Statistical Arbitrage Types
 * Core types for cointegration testing, spread analysis, and trading signals
 */

// ============================================================================
// Trading Signals
// ============================================================================

export type Signal = "long_a_short_b" | "short_a_long_b" | "neutral";

export type SignalStrength = "strong" | "moderate" | "weak";

// ============================================================================
// Cointegration Testing
// ============================================================================

export interface ADFResult {
  /** ADF test statistic */
  statistic: number;
  /** P-value for the test */
  pValue: number;
  /** Critical values at different significance levels */
  criticalValues: {
    "1%": number;
    "5%": number;
    "10%": number;
  };
  /** Whether the series is stationary at 5% significance */
  isStationary: boolean;
  /** Number of lags used in the test */
  nLags: number;
  /** Regression type used */
  regression: "c" | "ct" | "n";
}

export interface CointegrationTestResult {
  /** Test method used */
  method: "engle-granger" | "johansen";
  /** Test statistic */
  statistic: number;
  /** P-value */
  pValue: number;
  /** Whether cointegration was detected */
  isCointegrated: boolean;
  /** Hedge ratio(s) - single value for EG, array for Johansen */
  hedgeRatio: number | number[];
  /** Intercept (alpha) if applicable */
  intercept?: number;
  /** Critical values */
  criticalValues?: {
    "1%": number;
    "5%": number;
    "10%": number;
  };
}

export interface EngleGrangerResult extends CointegrationTestResult {
  method: "engle-granger";
  hedgeRatio: number;
  intercept: number;
  /** ADF test result on residuals */
  residualADF: ADFResult;
  /** Residuals from the cointegrating regression */
  residuals: number[];
}

export interface JohansenResult extends CointegrationTestResult {
  method: "johansen";
  hedgeRatio: number[];
  /** Number of cointegrating relationships */
  rank: number;
  /** Trace statistic */
  traceStatistic: number;
  /** Max eigenvalue statistic */
  maxEigenStatistic: number;
  /** Eigenvectors (cointegration vectors) */
  eigenvectors: number[][];
}

// ============================================================================
// Spread Analysis
// ============================================================================

export interface SpreadAnalysis {
  /** Spread values over time */
  values: number[];
  /** Mean of the spread */
  mean: number;
  /** Standard deviation of the spread */
  std: number;
  /** Current Z-Score */
  zScore: number;
  /** Z-Score time series */
  zScoreHistory: number[];
  /** Half-life of mean reversion (in periods) */
  halfLife: number;
  /** Trading signal based on Z-Score */
  signal: Signal;
  /** Signal strength */
  signalStrength: SignalStrength;
  /** Hedge ratio used to construct the spread */
  hedgeRatio: number;
  /** Intercept used */
  intercept: number;
}

export interface HalfLifeResult {
  /** Half-life in periods */
  halfLife: number;
  /** Mean reversion speed parameter (theta in OU process) */
  theta: number;
  /** R-squared of the AR(1) regression */
  rSquared: number;
  /** Whether half-life is reasonable for trading (1 < halfLife < 100) */
  isTradeable: boolean;
}

// ============================================================================
// Pair Scanner
// ============================================================================

export interface PairScanResult {
  /** Asset pair identifiers */
  pair: [string, string];
  /** Asset pair symbols */
  symbols: [string, string];
  /** Pearson correlation */
  correlation: number;
  /** Cointegration test result */
  isCointegrated: boolean;
  /** P-value from cointegration test */
  pValue: number;
  /** Half-life of mean reversion */
  halfLife: number;
  /** Current Z-Score of the spread */
  currentZScore: number;
  /** Trading signal */
  signal: Signal;
  /** Signal strength */
  signalStrength: SignalStrength;
  /** Hedge ratio */
  hedgeRatio: number;
  /** Composite score for ranking (higher = better opportunity) */
  score: number;
}

export interface ScannerConfig {
  /** Minimum correlation threshold */
  minCorrelation: number;
  /** Maximum p-value for cointegration */
  maxPValue: number;
  /** Minimum half-life (periods) */
  minHalfLife: number;
  /** Maximum half-life (periods) */
  maxHalfLife: number;
  /** Number of days of historical data */
  lookbackDays: number;
}

// ============================================================================
// Kalman Filter
// ============================================================================

export interface KalmanState {
  /** Dynamic intercept (alpha_t) */
  alpha: number;
  /** Dynamic hedge ratio (beta_t) */
  beta: number;
  /** State covariance matrix */
  P: number[][];
  /** Observation variance estimate */
  Ve: number;
}

export interface KalmanConfig {
  /** Process noise variance for states */
  delta: number;
  /** Initial state covariance */
  initialP: number;
  /** Initial observation variance */
  initialVe: number;
}

export interface KalmanFilterResult {
  /** Time series of alpha estimates */
  alphaHistory: number[];
  /** Time series of beta estimates (hedge ratios) */
  betaHistory: number[];
  /** Time series of spread using dynamic parameters */
  spreadHistory: number[];
  /** Time series of Z-Scores */
  zScoreHistory: number[];
  /** Current state */
  currentState: KalmanState;
  /** Current spread value */
  currentSpread: number;
  /** Current Z-Score */
  currentZScore: number;
}

// ============================================================================
// Backtesting
// ============================================================================

export interface Trade {
  /** Trade entry time */
  entryTime: number;
  /** Trade exit time */
  exitTime: number;
  /** Trade direction */
  side: "long_spread" | "short_spread";
  /** Z-Score at entry */
  entryZScore: number;
  /** Z-Score at exit */
  exitZScore: number;
  /** Entry prices */
  entryPrices: { asset1: number; asset2: number };
  /** Exit prices */
  exitPrices: { asset1: number; asset2: number };
  /** Trade PnL (percentage) */
  pnl: number;
  /** Trade PnL after costs */
  pnlNet: number;
  /** Holding period (bars) */
  holdingPeriod: number;
  /** Exit reason */
  exitReason: "mean_reversion" | "stop_loss" | "end_of_data";
}

export interface BacktestConfig {
  /** Z-Score threshold to enter a trade */
  entryThreshold: number;
  /** Z-Score threshold to exit (typically 0 for mean reversion) */
  exitThreshold: number;
  /** Stop-loss Z-Score threshold */
  stopLoss: number;
  /** Commission per trade (as decimal, e.g., 0.001 = 0.1%) */
  commissionPct: number;
  /** Slippage in basis points */
  slippageBps: number;
  /** Use dynamic hedge ratio (Kalman) or static */
  useDynamicHedge: boolean;
  /** Kalman filter config if using dynamic hedge */
  kalmanConfig?: KalmanConfig;
  /** Force specific hedge ratio (for synthetic tests) */
  forceHedgeRatio?: number;
  /** Force specific intercept (for synthetic tests) */
  forceIntercept?: number;
  /** Bar interval for proper annualization (default: '1d') */
  barInterval?: '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1d';
  /** Lookback period in hours for Z-Score calculation (default: 24.0) */
  lookbackHours?: number;
}

export interface BacktestMetrics {
  /** Total return (percentage) */
  totalReturn: number;
  /** Annualized return */
  annualizedReturn: number;
  /** Sharpe ratio (annualized) */
  sharpe: number;
  /** Sortino ratio */
  sortino: number;
  /** Maximum drawdown (percentage) */
  maxDrawdown: number;
  /** Win rate (percentage of profitable trades) */
  winRate: number;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Average trade PnL */
  avgTradePnl: number;
  /** Average holding period (bars) */
  avgHoldingPeriod: number;
  /** Total number of trades */
  totalTrades: number;
  /** Number of winning trades */
  winningTrades: number;
  /** Number of losing trades */
  losingTrades: number;
}

export interface BacktestResult {
  /** List of all trades */
  trades: Trade[];
  /** Equity curve (cumulative returns) */
  equity: number[];
  /** Performance metrics */
  metrics: BacktestMetrics;
  /** Daily returns for analysis */
  dailyReturns: number[];
  /** Configuration used */
  config: BacktestConfig;
}

// ============================================================================
// Position Management (for live trading)
// ============================================================================

export interface Position {
  /** Unique position ID */
  id: string;
  /** Asset pair */
  pair: [string, string];
  /** Position direction */
  side: "long_spread" | "short_spread";
  /** Z-Score at entry */
  entryZScore: number;
  /** Entry timestamp */
  entryTime: number;
  /** Position size (notional) */
  size: number;
  /** Entry prices */
  entryPrices: { asset1: number; asset2: number };
  /** Current prices */
  currentPrices: { asset1: number; asset2: number };
  /** Current Z-Score */
  currentZScore: number;
  /** Unrealized PnL */
  unrealizedPnl: number;
  /** Hedge ratio used */
  hedgeRatio: number;
}

export interface PortfolioState {
  /** Open positions */
  positions: Position[];
  /** Total unrealized PnL */
  totalUnrealizedPnl: number;
  /** Total realized PnL */
  totalRealizedPnl: number;
  /** Available capital */
  availableCapital: number;
  /** Margin used */
  marginUsed: number;
}
