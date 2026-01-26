"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Gauge,
  ArrowLeftRight,
  Star,
  FlaskConical,
  Globe,
  Link2,
  PieChart,
  Search,
  LineChart,
  DollarSign,
  Database,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: TrendingUp, label: "Markets", path: "/markets" },
  { icon: PieChart, label: "Sectors", path: "/sectors" },
  { icon: Gauge, label: "Signals", path: "/signals" },
  { icon: ArrowLeftRight, label: "Compare", path: "/compare" },
  { icon: Search, label: "Scanner", path: "/scanner" },
  { icon: Database, label: "Database", path: "/database" },
  { icon: LineChart, label: "Backtest", path: "/backtest" },
  { icon: Star, label: "Watchlist", path: "/watchlist" },
  { icon: FlaskConical, label: "Analysis", path: "/analysis" },
  { icon: Globe, label: "Macro", path: "/macro" },
  { icon: Link2, label: "On-Chain", path: "/onchain" },
  { icon: DollarSign, label: "Funding", path: "/funding" },
];

export const CryptoSidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 lg:w-56 bg-crypto-card border-r border-crypto-border flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-crypto-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-crypto-accent to-crypto-accent/60 flex items-center justify-center">
          <span className="text-crypto-bg font-bold text-sm">C</span>
        </div>
        <span className="hidden lg:block ml-3 font-semibold text-lg tracking-tight">
          CryptoAnalytics
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.path ||
            (item.path !== "/" && pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                "flex items-center h-12 px-4 lg:px-6 text-sm font-medium transition-colors",
                "hover:bg-crypto-border/50",
                isActive
                  ? "text-crypto-accent bg-crypto-accent/10 border-r-2 border-crypto-accent"
                  : "text-crypto-muted hover:text-crypto-text"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block ml-3">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
