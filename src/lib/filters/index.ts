/**
 * Filters Module
 *
 * Dynamic parameter estimation for pairs trading.
 */

export {
  KalmanFilter,
  runKalmanFilter,
  compareStaticVsDynamic,
} from "./kalman";

export type {
  KalmanState,
  KalmanConfig,
  KalmanFilterResult,
} from "@/types/arbitrage";
