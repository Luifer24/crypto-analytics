"use client";

import { useState } from "react";
import {
  validateBacktestResult,
  testSyntheticCase,
  type ValidationResult,
} from "@/lib/backtest/validate";
import {
  testPnLCalculation,
  testEntryExitLogic,
  testSimpleOscillation,
} from "@/lib/backtest/debug-test";
import type { BacktestResult } from "@/types/arbitrage";

export default function TestBacktestPage() {
  const [results, setResults] = useState<{
    meanRevert?: { passed: boolean; message: string; result: BacktestResult };
    trending?: { passed: boolean; message: string; result: BacktestResult };
    random?: { passed: boolean; message: string; result: BacktestResult };
    validations?: {
      meanRevert: { allPassed: boolean; results: ValidationResult[] };
      trending: { allPassed: boolean; results: ValidationResult[] };
      random: { allPassed: boolean; results: ValidationResult[] };
    };
  }>({});
  const [isRunning, setIsRunning] = useState(false);

  const runTests = () => {
    setIsRunning(true);
    setResults({});

    // Run tests with slight delay to show progress
    setTimeout(() => {
      const meanRevert = testSyntheticCase("mean-reverting");
      setResults(prev => ({ ...prev, meanRevert }));

      setTimeout(() => {
        const trending = testSyntheticCase("trending");
        setResults(prev => ({ ...prev, trending }));

        setTimeout(() => {
          const random = testSyntheticCase("random");

          // Validate all results
          const validations = {
            meanRevert: validateBacktestResult(meanRevert.result),
            trending: validateBacktestResult(trending.result),
            random: validateBacktestResult(random.result),
          };

          setResults(prev => ({ ...prev, random, validations }));
          setIsRunning(false);
        }, 100);
      }, 100);
    }, 100);
  };

  const allPassed =
    results.meanRevert?.passed &&
    results.trending?.passed &&
    results.random?.passed &&
    results.validations?.meanRevert.allPassed &&
    results.validations?.trending.allPassed &&
    results.validations?.random.allPassed;

  return (
    <div className="min-h-screen bg-crypto-dark p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-crypto-text mb-2">
            🧪 Backtest Engine Validation
          </h1>
          <p className="text-crypto-muted">
            Run synthetic tests to validate the backtest engine is working correctly
          </p>
        </div>

        {/* Run Buttons */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={runTests}
            disabled={isRunning}
            className="bg-crypto-accent text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-crypto-accent/90 transition-colors"
          >
            {isRunning ? "Running Tests..." : "▶ Run Validation Suite"}
          </button>

          <button
            onClick={() => {
              console.clear();
              testPnLCalculation();
              testEntryExitLogic();
              testSimpleOscillation();
              alert("Check console (F12) for detailed diagnostics");
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            🔍 Run Diagnostics (Console)
          </button>
        </div>

        {results.validations && (
          <div className={`mt-4 p-4 rounded-lg ${allPassed ? "bg-green-900/20 border border-green-500" : "bg-red-900/20 border border-red-500"}`}>
            <p className="text-lg font-bold">
              {allPassed
                ? "✅ ALL TESTS PASSED - Backtest engine is working correctly"
                : "⚠️ SOME TESTS FAILED - Review results below"}
            </p>
          </div>
        )}

        {/* Results */}
        <div className="space-y-6">
          {/* Test 1: Mean Reversion */}
          {results.meanRevert && (
            <TestCaseCard
              title="Test 1: Perfect Mean Reversion"
              subtitle="Should be profitable with high win rate"
              testResult={results.meanRevert}
              validationResult={results.validations?.meanRevert}
            />
          )}

          {/* Test 2: Trending */}
          {results.trending && (
            <TestCaseCard
              title="Test 2: Trending Market"
              subtitle="Should be unprofitable (spread diverges)"
              testResult={results.trending}
              validationResult={results.validations?.trending}
            />
          )}

          {/* Test 3: Random */}
          {results.random && (
            <TestCaseCard
              title="Test 3: Random Walk"
              subtitle="Should have neutral results (no edge)"
              testResult={results.random}
              validationResult={results.validations?.random}
            />
          )}
        </div>

        {/* Bug History */}
        <div className="mt-12 p-6 bg-crypto-card rounded-lg border border-crypto-border">
          <h2 className="text-xl font-bold text-crypto-text mb-4">
            📚 Bug History (Fixed)
          </h2>
          <ol className="space-y-2 text-sm text-crypto-muted list-decimal list-inside">
            <li>Half-life reported in periods instead of days</li>
            <li>Backtest resampling forced to daily (99% data loss)</li>
            <li>PnL amplified by hedge ratio without weight normalization</li>
            <li>Equity baseline reset incorrectly on position entry</li>
            <li>Hedge ratio calculated with only 20 candles</li>
            <li>Compounding of unrealized PnL across bars</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function TestCaseCard({
  title,
  subtitle,
  testResult,
  validationResult,
}: {
  title: string;
  subtitle: string;
  testResult: { passed: boolean; message: string; result: BacktestResult };
  validationResult?: { allPassed: boolean; results: ValidationResult[] };
}) {
  const { result } = testResult;

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-crypto-text">{title}</h3>
        <p className="text-sm text-crypto-muted">{subtitle}</p>
      </div>

      {/* Test Result */}
      <div className="mb-4 p-3 rounded-lg bg-crypto-bg">
        <p className={`font-semibold ${testResult.passed ? "text-green-400" : "text-red-400"}`}>
          {testResult.message}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricBox
          label="Total Return"
          value={`${(result.metrics.totalReturn * 100).toFixed(2)}%`}
          positive={result.metrics.totalReturn > 0}
        />
        <MetricBox
          label="Profit Factor"
          value={result.metrics.profitFactor.toFixed(2)}
          positive={result.metrics.profitFactor > 1.0}
        />
        <MetricBox
          label="Win Rate"
          value={`${(result.metrics.winRate * 100).toFixed(1)}%`}
          positive={result.metrics.winRate > 0.5}
        />
        <MetricBox
          label="Total Trades"
          value={result.trades.length.toString()}
          positive={result.trades.length > 0}
        />
      </div>

      {/* Validation Results */}
      {validationResult && (
        <div className="mt-4 p-4 bg-crypto-bg rounded-lg">
          <h4 className="text-sm font-semibold text-crypto-text mb-2">
            Validation Checks ({validationResult.results.filter(r => r.passed).length}/{validationResult.results.length} passed)
          </h4>
          <div className="space-y-1">
            {validationResult.results.map((r, i) => (
              <div key={i} className={`text-sm ${r.passed ? "text-green-400" : "text-red-400"}`}>
                {r.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="p-3 bg-crypto-bg rounded-lg">
      <div className="text-xs text-crypto-muted mb-1">{label}</div>
      <div className={`text-lg font-bold ${positive === undefined ? "text-crypto-text" : positive ? "text-green-400" : "text-red-400"}`}>
        {value}
      </div>
    </div>
  );
}
