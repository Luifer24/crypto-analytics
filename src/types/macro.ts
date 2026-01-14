export interface MacroIndicator {
  id: string;
  name: string;
  symbol: string;
  category: "market" | "monetary" | "economic";
  value: number;
  previousValue?: number;
  change: number;
  changePercent: number;
  unit: string;
  lastUpdate: string;
  description: string;
  cryptoImpact: "positive" | "negative" | "neutral";
  cryptoImpactReason: string;
}

export interface MacroHistoryPoint {
  date: string;
  value: number;
}

export interface FREDSeries {
  id: string;
  title: string;
  observations: { date: string; value: string }[];
}

export const FRED_SERIES = {
  FEDFUNDS: "FEDFUNDS",
  DGS10: "DGS10",
  T10YIE: "T10YIE",
  M2SL: "M2SL",
  CPIAUCSL: "CPIAUCSL",
  UNRATE: "UNRATE",
  GDP: "GDP",
  DTWEXBGS: "DTWEXBGS",
} as const;

export const YAHOO_SYMBOLS = {
  DXY: "DX-Y.NYB",
  SPX: "^GSPC",
  GOLD: "GC=F",
  VIX: "^VIX",
  NDX: "^NDQ",
  TNX: "^TNX",
} as const;
