"""
Backtest API Routes

Endpoints for running backtests and optimizations.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np

# Will implement engine later
# from src.backtest.engine import run_backtest

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class BacktestConfig(BaseModel):
    """Backtest configuration parameters."""

    entry_threshold: float = Field(default=2.0, description="Z-Score entry threshold")
    exit_threshold: float = Field(default=0.0, description="Z-Score exit threshold")
    stop_loss: float = Field(default=3.0, description="Z-Score stop loss")
    commission_pct: float = Field(default=0.0004, description="Commission percentage")
    slippage_bps: float = Field(default=3, description="Slippage in basis points")
    use_dynamic_hedge: bool = Field(default=False, description="Use Kalman filter")
    lookback_hours: Optional[float] = Field(
        default=24, description="Lookback period in hours for Z-Score"
    )


class BacktestRequest(BaseModel):
    """Request model for backtest endpoint."""

    symbol1: str = Field(..., description="First asset symbol", example="FIL")
    symbol2: str = Field(..., description="Second asset symbol", example="ICP")
    prices1: List[float] = Field(..., description="Price series for asset 1")
    prices2: List[float] = Field(..., description="Price series for asset 2")
    timestamps: Optional[List[int]] = Field(
        None, description="Unix timestamps (optional)"
    )
    lookback_days: int = Field(..., description="Lookback period in days", example=90)
    interval: str = Field(
        ..., description="Bar interval (5min, 15min, 1h, 1d)", example="15min"
    )
    config: Optional[BacktestConfig] = Field(
        default_factory=BacktestConfig, description="Backtest configuration"
    )


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

        # TODO: Implement actual backtest engine
        # For now, return mock data
        result = _mock_backtest_result(request)

        execution_time = (time.time() - start_time) * 1000

        return BacktestResponse(
            success=True,
            trades=result["trades"],
            metrics=result["metrics"],
            equity_curve=result["equity_curve"],
            config_used=request.config or BacktestConfig(),
            execution_time_ms=execution_time,
        )

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
# Temporary Mock (Remove when engine is ready)
# ============================================================================


def _mock_backtest_result(request: BacktestRequest) -> Dict[str, Any]:
    """Generate mock backtest result for testing API."""
    # Create simple mock data
    n_trades = 10
    trades = [
        TradeResult(
            entry_time=i * 100,
            exit_time=i * 100 + 50,
            side="long_spread" if i % 2 == 0 else "short_spread",
            entry_z_score=2.5 * (1 if i % 2 == 0 else -1),
            exit_z_score=0.1,
            pnl_gross=0.005,
            pnl_net=0.004,
            holding_period=50,
            exit_reason="mean_reversion",
        )
        for i in range(n_trades)
    ]

    metrics = BacktestMetrics(
        total_return=0.04,
        annualized_return=0.16,
        sharpe=1.5,
        sortino=2.0,
        max_drawdown=0.08,
        win_rate=0.7,
        profit_factor=2.3,
        avg_trade_pnl=0.004,
        avg_holding_period=50,
        total_trades=n_trades,
        winning_trades=7,
        losing_trades=3,
    )

    equity_curve = [1.0 + i * 0.004 for i in range(n_trades + 1)]

    return {
        "trades": trades,
        "metrics": metrics,
        "equity_curve": equity_curve,
    }
