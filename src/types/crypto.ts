export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  high_24h?: number;
  low_24h?: number;
  sparkline_in_7d?: {
    price: number[];
  };
  ath: number;
  ath_change_percentage: number;
  circulating_supply: number;
  total_supply: number | null;
}

export interface GlobalData {
  total_market_cap: { [key: string]: number };
  total_volume: { [key: string]: number };
  market_cap_percentage: { [key: string]: number };
  market_cap_change_percentage_24h_usd: number;
}

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
