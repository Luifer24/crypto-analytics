"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatExplanationProps {
  title: string;
  formula?: string;
  interpretation: string;
  className?: string;
}

export const StatExplanation = ({ title, formula, interpretation, className }: StatExplanationProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("border-t border-crypto-card pt-2 mt-2", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-crypto-text transition-colors w-full"
      >
        <Info className="h-3 w-3" />
        <span>¿Qué significa {title}?</span>
        {isOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-crypto-bg/50 rounded-lg text-xs space-y-2">
          {formula && (
            <div>
              <span className="text-crypto-accent font-mono">Fórmula: </span>
              <span className="text-crypto-text font-mono">{formula}</span>
            </div>
          )}
          <p className="text-muted-foreground leading-relaxed">{interpretation}</p>
        </div>
      )}
    </div>
  );
};
