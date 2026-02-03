"""
Backtest API Routes

Endpoints for running backtests and optimizations.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np

# Import our backtest engine
from src.backtest.engine import run_backtest, BacktestConfig as EngineConfig

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class BacktestConfig(BaseModel):
    """Backtest configuration parameters."""

    entry_threshold: float = Field(
        default=2.0,
        alias="entryThreshold",
        description="Z-Score entry threshold"
    )
    exit_threshold: float = Field(
        default=0.0,
        alias="exitThreshold",
        description="Z-Score exit threshold"
    )
    stop_loss: float = Field(
        default=3.0,
        alias="stopLoss",
        description="Z-Score stop loss"
    )
    commission_pct: float = Field(
        default=0.0004,
        alias="commissionPct",
        description="Commission percentage"
    )
    slippage_bps: float = Field(
        default=3,
        alias="slippageBps",
        description="Slippage in basis points"
    )
    use_rolling_hedge: bool = Field(
        default=False,
        alias="useRollingHedge",
        description="Use rolling OLS for hedge ratio"
    )
    hedge_ratio_lookback_days: Optional[float] = Field(
        default=30,
        alias="hedgeRatioLookbackDays",
        description="Lookback period in days for rolling hedge ratio"
    )
    hedge_recalc_interval_hours: Optional[float] = Field(
        default=1.0,
        alias="hedgeRecalcIntervalHours",
        description="Recalculate hedge ratio every N hours (performance optimization)"
    )
    use_dynamic_hedge: bool = Field(
        default=False,
        alias="useDynamicHedge",
        description="Use Kalman filter"
    )
    lookback_hours: Optional[float] = Field(
        default=24,
        alias="lookbackHours",
        description="Lookback period in hours for Z-Score"
    )

    model_config = {"populate_by_name": True}


class BacktestRequest(BaseModel):
    """Request model for backtest endpoint."""

    symbol1: str = Field(..., description="First asset symbol", example="FIL")
    symbol2: str = Field(..., description="Second asset symbol", example="ICP")
    prices1: List[float] = Field(..., description="Price series for asset 1")
    prices2: List[float] = Field(..., description="Price series for asset 2")
    timestamps: Optional[List[int]] = Field(
        None, description="Unix timestamps (optional)"
    )
    lookback_days: int = Field(
        ...,
        alias="lookbackDays",
        description="Lookback period in days",
        example=90
    )
    interval: str = Field(
        ..., description="Bar interval (5min, 15min, 1h, 1d)", example="15min"
    )
    config: Optional[BacktestConfig] = Field(
        default_factory=BacktestConfig, description="Backtest configuration"
    )

    model_config = {"populate_by_name": True}


class TradeResult(BaseModel):
    """Individual trade result."""

    entry_time: int
    exit_time: int
    side: str  # "long_spread" or "short_spread"
    entry_z_score: float
    exit_z_score: float
    pnl_gross: float
    pnl_net: float
    holding_period: int
    exit_reason: str


class BacktestMetrics(BaseModel):
    """Backtest performance metrics."""

    total_return: float
    annualized_return: float
    sharpe: float
    sortino: float
    max_drawdown: float
    win_rate: float
    profit_factor: float
    avg_trade_pnl: float
    avg_holding_period: float
    total_trades: int
    winning_trades: int
    losing_trades: int


class BacktestResponse(BaseModel):
    """Response model for backtest endpoint."""

    success: bool
    trades: List[TradeResult]
    metrics: BacktestMetrics
    equity_curve: List[float]
    config_used: BacktestConfig
    execution_time_ms: float
    hedge_ratio: float  # Hedge ratio (β) used in backtest
    intercept: float  # Intercept (α) used in backtest


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/run", response_model=BacktestResponse)
async def run_backtest_endpoint(request: BacktestRequest):
    """
    Run backtest for a pairs trading strategy.

    This endpoint accepts price series and configuration, then runs a full
    backtest simulation using professional quant libraries (pandas, statsmodels).

    **Features:**
    - Automatic lookback period scaling based on interval
    - Engle-Granger cointegration test
    - Optional Kalman filter for dynamic hedge ratio
    - Proper Sharpe ratio calculation for intraday bars
    - Realistic cost model (commission + slippage)

    **Returns:**
    - Complete trade list with entry/exit details
    - Performance metrics (Sharpe, Sortino, drawdown, etc.)
    - Equity curve for visualization
    """
    import time

    start_time = time.time()

    try:
        # Validate input
        if len(request.prices1) != len(request.prices2):
            raise HTTPException(
                status_code=400, detail="Price series must have the same length"
            )

        if len(request.prices1) < 30:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for backtest (need at least 30 data points)",
            )

        # Convert prices to numpy arrays
        prices1 = np.array(request.prices1)
        prices2 = np.array(request.prices2)

        # Convert API config to engine config
        config = request.config or BacktestConfig()
        engine_config = EngineConfig(
            entry_threshold=config.entry_threshold,
            exit_threshold=config.exit_threshold,
            stop_loss=config.stop_loss,
            commission_pct=config.commission_pct,
            slippage_bps=config.slippage_bps,
            use_rolling_hedge=config.use_rolling_hedge,
            hedge_ratio_lookback_days=config.hedge_ratio_lookback_days,
            hedge_recalc_interval_hours=config.hedge_recalc_interval_hours,
            use_dynamic_hedge=config.use_dynamic_hedge,
            lookback_hours=config.lookback_hours,
        )

        # Run backtest using our professional engine
        result = run_backtest(
            prices1=prices1,
            prices2=prices2,
            interval=request.interval,
            config=engine_config,
        )

        # Convert trades to API format
        trades = [
            TradeResult(
                entry_time=t["entry_time"],
                exit_time=t["exit_time"],
                side=t["side"],
                entry_z_score=t["entry_z_score"],
                exit_z_score=t["exit_z_score"],
                pnl_gross=t["pnl_gross"],
                pnl_net=t["pnl_net"],
                holding_period=t["holding_period"],
                exit_reason=t["exit_reason"],
            )
            for t in result.trades
        ]

        # Calculate annualized return for metrics
        total_return = result.metrics["total_return"]
        periods = len(result.daily_returns)
        ann_factor = _get_annualization_factor(request.interval)
        annualized_return = (1 + total_return) ** (ann_factor / periods) - 1 if periods > 0 else 0.0

        # Convert metrics to API format
        metrics = BacktestMetrics(
            total_return=result.metrics["total_return"],
            annualized_return=annualized_return,
            sharpe=result.metrics["sharpe_ratio"],
            sortino=result.metrics["sortino_ratio"],
            max_drawdown=result.metrics["max_drawdown"],
            win_rate=result.metrics["win_rate"],
            profit_factor=result.metrics["profit_factor"],
            avg_trade_pnl=(result.metrics["avg_win"] * result.metrics["win_rate"] +
                          result.metrics["avg_loss"] * (1 - result.metrics["win_rate"]))
                          if result.metrics["total_trades"] > 0 else 0.0,
            avg_holding_period=result.metrics["avg_holding_period"],
            total_trades=result.metrics["total_trades"],
            winning_trades=result.metrics["winning_trades"],
            losing_trades=result.metrics["losing_trades"],
        )

        execution_time = (time.time() - start_time) * 1000

        return BacktestResponse(
            success=True,
            trades=trades,
            metrics=metrics,
            equity_curve=result.equity_curve,
            config_used=config,
            execution_time_ms=execution_time,
            hedge_ratio=result.hedge_ratio,
            intercept=result.intercept,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check for backtest service."""
    return {
        "status": "healthy",
        "engine": "vectorbt",
        "version": "0.1.0",
    }


# ============================================================================
# Helper Functions
# ============================================================================


def _get_annualization_factor(interval: str) -> float:
    """Get annualization factor for a given interval."""
    interval = interval.lower().strip()

    # Minute intervals
    if interval.endswith('min') or interval.endswith('m'):
        minutes = float(interval.rstrip('minm'))
        return 365 * 24 * 60 / minutes

    # Hour intervals
    if interval.endswith('h'):
        hours = float(interval.rstrip('h'))
        return 365 * 24 / hours

    # Day intervals
    if interval.endswith('d'):
        days = float(interval.rstrip('d'))
        return 365 / days

    # Week intervals
    if interval.endswith('w'):
        weeks = float(interval.rstrip('w'))
        return 52 / weeks

    # Default to daily
    return 365
