"use client";

import { ReactNode } from "react";
import { CryptoSidebar } from "./CryptoSidebar";

interface CryptoLayoutProps {
  children: ReactNode;
}

export const CryptoLayout = ({ children }: CryptoLayoutProps) => {
  return (
    <div className="min-h-screen bg-crypto-bg text-crypto-text flex">
      <CryptoSidebar />
      <main className="flex-1 ml-16 lg:ml-56">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
