'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { TourProvider } from '@/components/features/tours/tour-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiClientError } from '@/lib/http';
import { TOURS } from '@/lib/tours/registry';

/** Client-side providers for every page: server state (TanStack Query), tooltips and guided tours. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // 4xx answers (not found, forbidden) do not get better by retrying.
            retry: (count, err) =>
              !(err instanceof ApiClientError && err.status >= 400 && err.status < 500) &&
              count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={300}>
        <TourProvider registry={TOURS}>{children}</TourProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
