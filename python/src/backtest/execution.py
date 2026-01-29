"""
Execution Model

Models transaction costs, slippage, and order execution for backtesting.
"""

from dataclasses import dataclass
from typing import Tuple
import numpy as np


@dataclass
class ExecutionCosts:
    """Execution cost parameters"""

    commission_pct: float  # Commission as percentage (e.g., 0.001 = 0.1%)
    slippage_bps: float  # Slippage in basis points (e.g., 5 = 0.05%)


# Default costs for Binance Futures
BINANCE_FUTURES_COSTS = ExecutionCosts(
    commission_pct=0.0004,  # 0.04% taker fee
    slippage_bps=3.0,  # ~3 bps slippage for liquid pairs
)

# Conservative estimates
CONSERVATIVE_COSTS = ExecutionCosts(
    commission_pct=0.001,  # 0.1% total fees
    slippage_bps=10.0,  # 10 bps slippage
)


def calculate_round_trip_costs(costs: ExecutionCosts) -> float:
    """
    Calculate round-trip costs (entry + exit)

    Returns:
        Total round-trip cost as percentage
    """
    # Commission on both entry and exit
    commissions = costs.commission_pct * 2

    # Slippage on both entry and exit
    slippage = (costs.slippage_bps / 10000) * 2

    return commissions + slippage


def calculate_pair_trade_pnl(
    entry_price1: float,
    entry_price2: float,
    exit_price1: float,
    exit_price2: float,
    hedge_ratio: float,
    is_long_spread: bool,
) -> float:
    """
    Calculate pair trade PnL

    IMPORTANT: PnL is normalized by position weights to avoid amplification effects.
    Each leg contributes proportionally to total capital at risk.

    For example, if hedgeRatio = 5.0:
    - Asset1 weight: 1/(1+5) = 16.7%
    - Asset2 weight: 5/(1+5) = 83.3%

    This prevents small price differences from causing massive PnL swings.

    Args:
        entry_price1: Entry price for asset 1
        entry_price2: Entry price for asset 2
        exit_price1: Exit price for asset 1
        exit_price2: Exit price for asset 2
        hedge_ratio: β from cointegrating regression
        is_long_spread: True if long spread (long asset1, short asset2)

    Returns:
        PnL as percentage
    """
    # Calculate returns for each leg
    return1 = (exit_price1 - entry_price1) / entry_price1
    return2 = (exit_price2 - entry_price2) / entry_price2

    # Normalize by position weights (beta-neutral with equal risk contribution)
    abs_hedge_ratio = abs(hedge_ratio)
    weight1 = 1 / (1 + abs_hedge_ratio)
    weight2 = abs_hedge_ratio / (1 + abs_hedge_ratio)

    # Long spread: profit when spread widens (asset1 outperforms asset2)
    # Short spread: profit when spread narrows (asset2 outperforms asset1)
    if is_long_spread:
        return weight1 * return1 - weight2 * return2
    else:
        return weight2 * return2 - weight1 * return1


def apply_trade_costs(gross_pnl_pct: float, costs: ExecutionCosts) -> float:
    """
    Apply execution costs to gross PnL

    Args:
        gross_pnl_pct: Gross PnL as percentage
        costs: Execution costs

    Returns:
        Net PnL after costs
    """
    round_trip_costs = calculate_round_trip_costs(costs)
    return gross_pnl_pct - round_trip_costs


def calculate_break_even_pnl(costs: ExecutionCosts) -> float:
    """
    Calculate minimum trade profit needed to break even after costs

    Returns:
        Break-even PnL percentage
    """
    return calculate_round_trip_costs(costs)
