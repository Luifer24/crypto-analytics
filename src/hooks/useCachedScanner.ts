/**
 * Cached Scanner Hook Wrapper
 *
 * Wraps scanner hooks with sessionStorage caching to avoid re-running
 * expensive scans when navigating between tabs.
 */

import { useState, useEffect } from "react";

interface CacheConfig {
  cacheKey: string;
  ttlMs?: number; // Time to live in milliseconds (default: 5 minutes)
}

interface CacheData<T> {
  timestamp: number;
  data: T;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data from sessionStorage
 */
function getCached<T>(key: string, ttlMs: number): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const { timestamp, data }: CacheData<T> = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age < ttlMs) {
      console.log(`[Cache] Hit for ${key} (age: ${Math.round(age / 1000)}s)`);
      return data;
    }

    console.log(`[Cache] Expired for ${key} (age: ${Math.round(age / 1000)}s)`);
    sessionStorage.removeItem(key);
    return null;
  } catch (e) {
    console.warn(`[Cache] Failed to read ${key}:`, e);
    return null;
  }
}

/**
 * Save data to sessionStorage cache
 */
function setCached<T>(key: string, data: T): void {
  try {
    const cacheData: CacheData<T> = {
      timestamp: Date.now(),
      data,
    };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
    console.log(`[Cache] Saved ${key}`);
  } catch (e) {
    console.warn(`[Cache] Failed to save ${key}:`, e);
  }
}

/**
 * Wrapper hook that adds caching to scanner results
 *
 * @example
 * ```ts
 * const scanner = useFuturesPairScanner({ lookbackDays: 90, interval: "15m" });
 * const cachedScanner = useCachedScanner(scanner, {
 *   cacheKey: `futures-90-15m`,
 *   ttlMs: 10 * 60 * 1000, // 10 minutes
 * });
 * ```
 */
export function useCachedScanner<T>(
  scannerResult: {
    allResults: T | null;
    isLoading: boolean;
    isError: boolean;
    progress: { loaded: number; total: number };
  },
  config: CacheConfig
): typeof scannerResult {
  const { cacheKey, ttlMs = DEFAULT_TTL } = config;

  const [cachedData, setCachedData] = useState<T | null>(() =>
    getCached<T>(cacheKey, ttlMs)
  );
  const [isUsingCache, setIsUsingCache] = useState(false);

  useEffect(() => {
    // Check cache on mount
    const cached = getCached<T>(cacheKey, ttlMs);
    if (cached) {
      setCachedData(cached);
      setIsUsingCache(true);
    }
  }, [cacheKey, ttlMs]);

  useEffect(() => {
    // Save to cache when scan completes
    if (!scannerResult.isLoading && !scannerResult.isError && scannerResult.allResults) {
      setCached(cacheKey, scannerResult.allResults);
      setCachedData(scannerResult.allResults);
      setIsUsingCache(false);
    }
  }, [scannerResult.isLoading, scannerResult.isError, scannerResult.allResults, cacheKey]);

  // If we have cached data and scanner is still loading, use cache
  if (isUsingCache && cachedData) {
    return {
      allResults: cachedData,
      isLoading: false,
      isError: false,
      progress: { loaded: 0, total: 0 },
    };
  }

  return scannerResult;
}

/**
 * Clear all scanner caches
 */
export function clearScannerCache(): void {
  const keys = Object.keys(sessionStorage);
  const scannerKeys = keys.filter(k => k.startsWith("futures-") || k.startsWith("spot-"));

  scannerKeys.forEach(key => {
    sessionStorage.removeItem(key);
    console.log(`[Cache] Cleared ${key}`);
  });

  console.log(`[Cache] Cleared ${scannerKeys.length} scanner caches`);
}
