/**
 * Scanner Progress Hook
 *
 * Shared state for tracking scanner progress across async operations.
 */

import { useState, useEffect } from "react";

export interface ScannerProgress {
  phase: "idle" | "loading-symbols" | "loading-prices" | "analyzing" | "complete";
  symbolsLoaded: number;
  symbolsTotal: number;
  pairsAnalyzed: number;
  pairsTotal: number;
  message: string;
}

// Simple event emitter for progress updates
class ProgressEmitter {
  private listeners: ((progress: ScannerProgress) => void)[] = [];
  private currentProgress: ScannerProgress = {
    phase: "idle",
    symbolsLoaded: 0,
    symbolsTotal: 0,
    pairsAnalyzed: 0,
    pairsTotal: 0,
    message: "",
  };

  subscribe(listener: (progress: ScannerProgress) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(progress: Partial<ScannerProgress>) {
    this.currentProgress = { ...this.currentProgress, ...progress };
    this.listeners.forEach((listener) => listener(this.currentProgress));
  }

  reset() {
    this.currentProgress = {
      phase: "idle",
      symbolsLoaded: 0,
      symbolsTotal: 0,
      pairsAnalyzed: 0,
      pairsTotal: 0,
      message: "",
    };
    this.listeners.forEach((listener) => listener(this.currentProgress));
  }

  getCurrent() {
    return this.currentProgress;
  }
}

export const progressEmitter = new ProgressEmitter();

export function useScannerProgress() {
  const [progress, setProgress] = useState<ScannerProgress>(
    progressEmitter.getCurrent()
  );

  useEffect(() => {
    const unsubscribe = progressEmitter.subscribe(setProgress);
    return unsubscribe;
  }, []);

  return progress;
}
