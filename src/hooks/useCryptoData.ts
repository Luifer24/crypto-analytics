import { useQuery } from "@tanstack/react-query";
import type { CryptoAsset, GlobalData, PriceHistoryPoint, OHLCData } from "@/types/crypto";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Helper to handle rate limiting
const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    if (response.ok) return response;
    if (response.status === 429 && i < retries - 1) {
      // Wait before retry (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      continue;
    }
    throw new Error(`API error: ${response.status}`);
  }
  throw new Error("Max retries exceeded");
};

export const useCryptoList = (limit: number = 50) => {
  return useQuery<CryptoAsset[]>({
    queryKey: ["cryptoList", limit],
    queryFn: async () => {
      const response = await fetchWithRetry(
        `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=7d,30d`
      );
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes cache
    refetchInterval: 3 * 60 * 1000, // Refetch every 3 min
    retry: 2,
  });
};

export const useGlobalData = () => {
  return useQuery<GlobalData>({
    queryKey: ["globalData"],
    queryFn: async () => {
      const response = await fetchWithRetry(`${COINGECKO_API}/global`);
      const data = await response.json();
      return data.data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    retry: 2,
  });
};

export const usePriceHistory = (coinId: string, days: number = 7) => {
  return useQuery<PriceHistoryPoint[]>({
    queryKey: ["priceHistory", coinId, days],
    queryFn: async () => {
      const response = await fetchWithRetry(
        `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
      );
      const data = await response.json();
      return data.prices.map(([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: !!coinId,
    retry: 2,
  });
};

export const useOHLCData = (coinId: string, days: number = 7) => {
  return useQuery<OHLCData[]>({
    queryKey: ["ohlc", coinId, days],
    queryFn: async () => {
      const response = await fetchWithRetry(
        `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
      );
      const data = await response.json();
      return data.map(([timestamp, open, high, low, close]: number[]) => ({
        timestamp,
        open,
        high,
        low,
        close,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: !!coinId,
    retry: 2,
  });
};
