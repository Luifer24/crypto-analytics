"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CryptoTable } from "@/components/crypto/CryptoTable";
import { PriceChart } from "@/components/crypto/PriceChart";
import { useCoinsBySector, useAllSectors } from "@/hooks/useSectorData";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function MarketsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Use URL as single source of truth for sector
  const selectedSector = searchParams.get("sector");

  // Update URL when sector changes
  const handleSectorChange = (sectorId: string | null) => {
    if (sectorId) {
      router.push(`/markets?sector=${sectorId}`, { scroll: false });
    } else {
      router.push("/markets", { scroll: false });
    }
  };

  const sectors = useAllSectors();
  const { coins, sectorInfo, isLoading } = useCoinsBySector(selectedSector, 450);

  const selectedSectorName = selectedSector
    ? sectors.find((s) => s.id === selectedSector)?.name || "All Sectors"
    : "All Sectors";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text">Markets</h1>
          <p className="text-crypto-muted mt-1">
            {sectorInfo
              ? `${sectorInfo.name} - ${sectorInfo.description}`
              : "Top cryptocurrencies by market capitalization"}
          </p>
        </div>

        {/* Sector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border",
              "bg-crypto-card border-crypto-border text-crypto-text",
              "hover:bg-crypto-border/50 transition-colors min-w-[180px] justify-between"
            )}
          >
            <span className="flex items-center gap-2">
              {selectedSector && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: sectorInfo?.color || "#64748b" }}
                />
              )}
              {selectedSectorName}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-crypto-muted transition-transform",
                isDropdownOpen && "rotate-180"
              )}
            />
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-crypto-border bg-crypto-card shadow-xl z-20 py-1 max-h-[400px] overflow-y-auto">
                <button
                  onClick={() => {
                    handleSectorChange(null);
                    setIsDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left hover:bg-crypto-border/50 transition-colors",
                    "flex items-center gap-3",
                    !selectedSector && "bg-crypto-border/30"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-crypto-muted" />
                  <span className="text-crypto-text">All Sectors</span>
                </button>

                <div className="border-t border-crypto-border my-1" />

                {sectors.map((sector) => (
                  <button
                    key={sector.id}
                    onClick={() => {
                      handleSectorChange(sector.id);
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2.5 text-left hover:bg-crypto-border/50 transition-colors",
                      "flex items-center gap-3",
                      selectedSector === sector.id && "bg-crypto-border/30"
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sector.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-crypto-text block">{sector.name}</span>
                      <span className="text-crypto-muted text-xs truncate block">
                        {sector.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Results count */}
      {selectedSector && (
        <div className="text-sm text-crypto-muted">
          Showing {coins.length} cryptocurrencies in{" "}
          <span
            className="font-medium"
            style={{ color: sectorInfo?.color || "#64748b" }}
          >
            {sectorInfo?.name}
          </span>
        </div>
      )}

      {selectedCoin && (
        <div className="relative">
          <button
            onClick={() => setSelectedCoin(null)}
            className="absolute top-4 right-4 z-10 text-crypto-muted hover:text-crypto-text text-sm"
          >
            Close
          </button>
          <PriceChart coinId={selectedCoin} />
        </div>
      )}

      <CryptoTable
        limit={100}
        onSelectCoin={setSelectedCoin}
        data={coins}
        isLoading={isLoading}
      />
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-crypto-text">Markets</h1>
            <p className="text-crypto-muted mt-1">Loading...</p>
          </div>
          <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
            <div className="animate-pulse space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-12 bg-crypto-border rounded" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <MarketsContent />
    </Suspense>
  );
}
