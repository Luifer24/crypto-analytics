import { useQuery } from "@tanstack/react-query";

const FEAR_GREED_API = "https://api.alternative.me/fng";

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: number;
}

interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

const fetchFearGreedIndex = async (limit: number = 1): Promise<FearGreedData[]> => {
  const response = await fetch(`${FEAR_GREED_API}/?limit=${limit}&format=json`);

  if (!response.ok) {
    throw new Error("Failed to fetch Fear & Greed Index");
  }

  const json: FearGreedResponse = await response.json();

  return json.data.map(item => ({
    value: parseInt(item.value, 10),
    classification: item.value_classification,
    timestamp: parseInt(item.timestamp, 10) * 1000,
  }));
};

export const useFearGreedCurrent = () => {
  return useQuery({
    queryKey: ["fearGreed", "current"],
    queryFn: () => fetchFearGreedIndex(1),
    staleTime: 30 * 60 * 1000, // 30 minutes
    select: (data) => data[0],
  });
};

export const useFearGreedHistory = (days: number = 365) => {
  return useQuery({
    queryKey: ["fearGreed", "history", days],
    queryFn: () => fetchFearGreedIndex(days),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

// Helper to get color based on value
export const getFearGreedColor = (value: number): string => {
  if (value <= 25) return "#ef4444"; // Extreme Fear - red
  if (value <= 45) return "#f97316"; // Fear - orange
  if (value <= 55) return "#eab308"; // Neutral - yellow
  if (value <= 75) return "#84cc16"; // Greed - lime
  return "#22c55e"; // Extreme Greed - green
};

// Helper to get classification
export const getFearGreedClassification = (value: number): string => {
  if (value <= 25) return "Extreme Fear";
  if (value <= 45) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 75) return "Greed";
  return "Extreme Greed";
};
