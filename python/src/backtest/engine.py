"""
Backtest Engine

Professional pairs trading backtest engine using pandas, statsmodels, and numba.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Literal

from .cointegration import (
    engle_granger_test,
    build_spread,
    calculate_z_score,
    calculate_lookback_bars,
)
from .execution import (
    ExecutionCosts,
    BINANCE_FUTURES_COSTS,
    calculate_pair_trade_pnl,
    calculate_round_trip_costs,
)
from .metrics import calculate_metrics, BacktestMetrics


@dataclass
class BacktestConfig:
    """Backtest configuration"""

    entry_threshold: float = 2.0  # Enter when |Z| > 2
    exit_threshold: float = 0.0  # Exit when Z crosses 0
    stop_loss: float = 3.0  # Stop if |Z| > 3
    commission_pct: float = 0.0004  # Binance Futures taker
    slippage_bps: float = 3.0  # ~3 bps slippage
    use_dynamic_hedge: bool = False  # Kalman filter (not implemented yet)
    lookback_hours: Optional[float] = 24.0  # Time-based lookback (fixes interval bug!)
    force_hedge_ratio: Optional[float] = None  # Override hedge ratio
    force_intercept: Optional[float] = None  # Override intercept


@dataclass
class Trade:
    """Single trade record"""

    entry_time: int  # Bar index
    exit_time: int  # Bar index
    side: Literal["long_spread", "short_spread"]
    entry_z_score: float
    exit_z_score: float
    entry_price1: float
    entry_price2: float
    exit_price1: float
    exit_price2: float
    pnl_gross: float  # Gross PnL as percentage
    pnl_net: float  # Net PnL after costs
    holding_period: int  # Bars
    exit_reason: Literal["mean_reversion", "stop_loss", "end_of_data"]


@dataclass
class BacktestResult:
    """Complete backtest result"""

    trades: List[Dict]  # List of trade dicts for JSON serialization
    equity_curve: List[float]
    metrics: Dict  # Metrics dict for JSON serialization
    daily_returns: List[float]
    config: Dict  # Config dict for JSON serialization
    hedge_ratio: float  # Hedge ratio (β) used
    intercept: float  # Intercept (α) used


class PositionState:
    """Tracks open position state"""

    def __init__(self):
        self.is_open: bool = False
        self.side: Optional[str] = None
        self.entry_bar: int = 0
        self.entry_z_score: float = 0.0
        self.entry_price1: float = 0.0
        self.entry_price2: float = 0.0
        self.hedge_ratio: float = 0.0
        self.entry_equity: float = 1.0

    def open_position(
        self,
        side: str,
        bar: int,
        z_score: float,
        price1: float,
        price2: float,
        hedge_ratio: float,
        equity: float,
    ):
        """Open a new position"""
        self.is_open = True
        self.side = side
        self.entry_bar = bar
        self.entry_z_score = z_score
        self.entry_price1 = price1
        self.entry_price2 = price2
        self.hedge_ratio = hedge_ratio
        self.entry_equity = equity

    def close_position(self):
        """Close the position"""
        self.is_open = False
        self.side = None
        self.entry_bar = 0
        self.entry_z_score = 0.0
        self.entry_price1 = 0.0
        self.entry_price2 = 0.0
        self.hedge_ratio = 0.0


def run_backtest(
    prices1: np.ndarray,
    prices2: np.ndarray,
    interval: str = "1d",
    config: Optional[BacktestConfig] = None,
) -> BacktestResult:
    """
    Run pairs trading backtest

    This implementation fixes the critical interval bug where fixed 20-bar lookback
    caused different results for 5min vs 15min data.

    Args:
        prices1: Price series for asset 1
        prices2: Price series for asset 2
        interval: Bar interval ('5min', '15min', '1h', '1d', etc.)
        config: Backtest configuration

    Returns:
        BacktestResult with trades, equity curve, and metrics

    Key Improvements over TypeScript:
        1. Time-based lookback (24 hours default) instead of fixed 20 bars
        2. Professional statsmodels for cointegration test
        3. Vectorized operations with pandas/numpy
        4. Type safety with dataclasses
    """
    # Use default config if none provided
    if config is None:
        config = BacktestConfig()

    # Validate input
    if len(prices1) != len(prices2):
        raise ValueError("Price series must have same length")

    # Calculate lookback in bars based on time (fixes the interval bug!)
    if config.lookback_hours:
        lookback_bars = calculate_lookback_bars(config.lookback_hours, interval)
        print(f"[Backtest] Lookback: {config.lookback_hours}h = {lookback_bars} bars @ {interval}")
    else:
        lookback_bars = 20  # Fallback to fixed bars if no time specified

    if len(prices1) < lookback_bars + 10:
        raise ValueError(f"Insufficient data: need at least {lookback_bars + 10} bars")

    n = len(prices1)
    trades: List[Trade] = []
    daily_returns: List[float] = []

    # Execution costs
    costs = ExecutionCosts(
        commission_pct=config.commission_pct,
        slippage_bps=config.slippage_bps,
    )

    # Calculate hedge ratio using Engle-Granger on full dataset
    # Note: This creates look-ahead bias and is only suitable for backtesting
    # For live trading, use rolling window or dynamic hedge (Kalman)
    if config.force_hedge_ratio is not None and config.force_intercept is not None:
        # Use forced parameters (for synthetic tests)
        hedge_ratio = config.force_hedge_ratio
        intercept = config.force_intercept
        print(f"[Backtest] Using FORCED parameters (synthetic test)")
        print(f"[Backtest] Hedge Ratio (β): {hedge_ratio:.4f}")
        print(f"[Backtest] Intercept (α): {intercept:.4f}")
    else:
        # Calculate from data using Engle-Granger
        eg_result = engle_granger_test(prices1, prices2)
        hedge_ratio = eg_result.hedge_ratio
        intercept = eg_result.intercept

        print(f"[Backtest] Engle-Granger Test:")
        print(f"  Hedge Ratio (β): {hedge_ratio:.4f}")
        print(f"  Intercept (α): {intercept:.4f}")
        print(f"  ADF Statistic: {eg_result.statistic:.4f}")
        print(f"  P-Value: {eg_result.p_value:.4f}")
        print(f"  Is Cointegrated: {eg_result.is_cointegrated}")
        print(f"  R²: {eg_result.r_squared:.4f}")

    # Build spread for entire series
    spread = build_spread(prices1, prices2, hedge_ratio, intercept)

    # Initialize position state
    position = PositionState()

    # Track equity
    equity = 1.0

    # Main simulation loop
    for i in range(lookback_bars, n):
        p1 = prices1[i]
        p2 = prices2[i]

        # Calculate Z-Score using rolling window
        spread_window = spread[max(0, i - lookback_bars + 1) : i + 1]
        _, z_score, _, _ = calculate_z_score(spread_window, lookback=None)

        # === Check Exit Conditions ===
        if position.is_open:
            should_exit = False
            exit_reason: Literal["mean_reversion", "stop_loss", "end_of_data"] = "mean_reversion"

            # Mean reversion exit
            if position.side == "long_spread" and z_score >= config.exit_threshold:
                should_exit = True
                exit_reason = "mean_reversion"
            elif position.side == "short_spread" and z_score <= config.exit_threshold:
                should_exit = True
                exit_reason = "mean_reversion"

            # Stop loss exit
            if not should_exit and abs(z_score) >= config.stop_loss:
                # Only trigger stop if Z moved further against us
                if (
                    position.side == "long_spread"
                    and z_score < position.entry_z_score
                ) or (
                    position.side == "short_spread"
                    and z_score > position.entry_z_score
                ):
                    should_exit = True
                    exit_reason = "stop_loss"

            if should_exit:
                # Calculate PnL
                gross_pnl = calculate_pair_trade_pnl(
                    position.entry_price1,
                    position.entry_price2,
                    p1,
                    p2,
                    position.hedge_ratio,
                    position.side == "long_spread",
                )

                round_trip_cost = calculate_round_trip_costs(costs)
                net_pnl = gross_pnl - round_trip_cost

                # Create trade record
                trade = Trade(
                    entry_time=position.entry_bar,
                    exit_time=i,
                    side=position.side,  # type: ignore
                    entry_z_score=position.entry_z_score,
                    exit_z_score=z_score,
                    entry_price1=position.entry_price1,
                    entry_price2=position.entry_price2,
                    exit_price1=p1,
                    exit_price2=p2,
                    pnl_gross=gross_pnl,
                    pnl_net=net_pnl,
                    holding_period=i - position.entry_bar,
                    exit_reason=exit_reason,
                )

                trades.append(trade)

                # Update equity
                equity = equity * (1 + net_pnl)

                # Record return
                daily_returns[-1] = net_pnl

                # Debug logging for first 3 trades
                if len(trades) <= 3:
                    print(f"\n[Trade {len(trades)}] Exit:")
                    print(f"  Side: {position.side}")
                    print(f"  Entry Bar: {position.entry_bar}, Exit Bar: {i}")
                    print(f"  Entry Z: {position.entry_z_score:.2f}, Exit Z: {z_score:.2f}")
                    print(f"  Entry Prices: P1={position.entry_price1:.2f}, P2={position.entry_price2:.2f}")
                    print(f"  Exit Prices: P1={p1:.2f}, P2={p2:.2f}")
                    print(f"  Hedge Ratio: {position.hedge_ratio:.4f}")
                    print(f"  Gross PnL: {gross_pnl * 100:.2f}%")
                    print(f"  Net PnL: {net_pnl * 100:.2f}%")
                    print(f"  Exit Reason: {exit_reason}")

                # Close position
                position.close_position()

        # === Check Entry Conditions ===
        if not position.is_open:
            # Long spread entry: Z < -threshold (spread is cheap)
            if z_score < -config.entry_threshold:
                position.open_position(
                    side="long_spread",
                    bar=i,
                    z_score=z_score,
                    price1=p1,
                    price2=p2,
                    hedge_ratio=hedge_ratio,
                    equity=equity,
                )

            # Short spread entry: Z > threshold (spread is expensive)
            elif z_score > config.entry_threshold:
                position.open_position(
                    side="short_spread",
                    bar=i,
                    z_score=z_score,
                    price1=p1,
                    price2=p2,
                    hedge_ratio=hedge_ratio,
                    equity=equity,
                )

        # Record zero return if no trade closed this bar
        daily_returns.append(0.0)

    # Close any open position at end of data
    if position.is_open:
        final_p1 = prices1[n - 1]
        final_p2 = prices2[n - 1]

        gross_pnl = calculate_pair_trade_pnl(
            position.entry_price1,
            position.entry_price2,
            final_p1,
            final_p2,
            position.hedge_ratio,
            position.side == "long_spread",
        )

        round_trip_cost = calculate_round_trip_costs(costs)
        net_pnl = gross_pnl - round_trip_cost

        trade = Trade(
            entry_time=position.entry_bar,
            exit_time=n - 1,
            side=position.side,  # type: ignore
            entry_z_score=position.entry_z_score,
            exit_z_score=0.0,
            entry_price1=position.entry_price1,
            entry_price2=position.entry_price2,
            exit_price1=final_p1,
            exit_price2=final_p2,
            pnl_gross=gross_pnl,
            pnl_net=net_pnl,
            holding_period=n - 1 - position.entry_bar,
            exit_reason="end_of_data",
        )

        trades.append(trade)

        # Update equity
        equity = equity * (1 + net_pnl)

        # Record return
        daily_returns[-1] = net_pnl

    # Build equity curve
    equity_curve = [1.0]
    for r in daily_returns:
        equity_curve.append(equity_curve[-1] * (1 + r))

    # Calculate metrics
    trade_dicts = [asdict(t) for t in trades]
    returns_array = np.array(daily_returns)
    metrics = calculate_metrics(trade_dicts, returns_array, interval)

    # Summary logging
    print(f"\n[Backtest] Complete:")
    print(f"  Total Trades: {len(trades)}")
    print(f"  Win Rate: {metrics.win_rate * 100:.1f}%")
    print(f"  Total Return: {metrics.total_return * 100:.2f}%")
    print(f"  Profit Factor: {metrics.profit_factor:.2f}")
    print(f"  Sharpe Ratio: {metrics.sharpe_ratio:.2f}")
    print(f"  Max Drawdown: {metrics.max_drawdown * 100:.2f}%")
    print(f"  Final Equity: {equity:.4f}")

    return BacktestResult(
        trades=trade_dicts,
        equity_curve=equity_curve,
        metrics=asdict(metrics),
        daily_returns=daily_returns,
        config=asdict(config),
        hedge_ratio=hedge_ratio,
        intercept=intercept,
    )
