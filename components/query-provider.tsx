"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            // Default freshness window. With staleTime: 0 every same-session
            // revisit triggered a refetch — operators saw a loading bar and
            // an opacity fade on lists they'd just been on. One minute is
            // long enough to make routine back-navigation feel instant, short
            // enough that data never looks stale to the eye. List/detail
            // hooks that need different freshness already override this.
            staleTime: 1000 * 60,
          },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
