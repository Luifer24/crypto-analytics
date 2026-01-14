"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MiniSparklineProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

export const MiniSparkline = ({
  data,
  positive,
  width = 100,
  height = 32,
}: MiniSparklineProps) => {
  const path = useMemo(() => {
    if (!data || data.length === 0) return "";

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height * 0.8 - height * 0.1;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [data, width, height]);

  return (
    <svg
      width={width}
      height={height}
      className={cn(
        "overflow-visible",
        positive ? "text-crypto-positive" : "text-crypto-negative"
      )}
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
