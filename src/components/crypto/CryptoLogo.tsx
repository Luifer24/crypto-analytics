"use client";

import { useState } from "react";
import Image from "next/image";

interface CryptoLogoProps {
  symbol: string;
  size?: number;
}

export function CryptoLogo({ symbol, size = 32 }: CryptoLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    // Fallback: Circle with initials
    return (
      <div
        className="rounded-full bg-gradient-to-br from-crypto-accent to-crypto-accent/60 flex items-center justify-center text-white font-bold text-xs"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={`https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setHasError(true)}
    />
  );
}
