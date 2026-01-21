import { useQuery } from "@tanstack/react-query";

export interface DominancePoint {
  timestamp: number;
  btcDominance: number;
  ethDominance: number;
  othersDominance: number;
  totalMarketCap: number;
}

interface CMCQuote {
  timestamp: string;
  btcDominance: number;
  ethDominance: number;
  totalMarketCap: number;
}

interface CMCResponse {
  data: {
    quotes: CMCQuote[];
  };
  status: {
    error_code: string;
    error_message: string;
  };
}

const fetchDominanceHistory = async (days: number): Promise<DominancePoint[]> => {
  // Use local API route to avoid CORS issues
  const response = await fetch(`/api/dominance?days=${days}`);

  if (!response.ok) {
    throw new Error("Failed to fetch dominance data");
  }

  const json: CMCResponse = await response.json();

  if (!json.data?.quotes) {
    throw new Error("Invalid response format");
  }

  return json.data.quotes.map((quote) => ({
    timestamp: new Date(quote.timestamp).getTime(),
    btcDominance: quote.btcDominance,
    ethDominance: quote.ethDominance,
    othersDominance: 100 - quote.btcDominance - quote.ethDominance,
    totalMarketCap: quote.totalMarketCap,
  }));
};

export const useDominanceHistory = (days: number = 365) => {
  return useQuery({
    queryKey: ["dominanceHistory", days],
    queryFn: () => fetchDominanceHistory(days),
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

// Get current dominance (latest point from history)
export const useCurrentDominance = () => {
  return useQuery({
    queryKey: ["dominanceHistory", 7],
    queryFn: () => fetchDominanceHistory(7),
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data[data.length - 1], // Latest point
  });
};

// Helper to format market cap
export const formatMarketCap = (value: number): string => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  return `$${(value / 1e6).toFixed(2)}M`;
};
