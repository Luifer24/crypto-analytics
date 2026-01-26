"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 60 * 1000, // 10 minutes - data is fresh for 10 min
            gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for 30 min
            refetchOnWindowFocus: false, // Don't refetch when user returns to tab
            refetchOnMount: false, // Don't refetch if data exists in cache
            retry: 1, // Only retry once on error
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
