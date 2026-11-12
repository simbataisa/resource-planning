'use client';

import { useTranslations } from 'next-intl';
import type { QueryStateProps } from '@/components/patterns/query-state';
import { ApiClientError } from '@/lib/http';

interface QueryLike {
  status: 'pending' | 'error' | 'success';
  error: unknown;
  refetch: () => unknown;
}

/** Props for <QueryState> from a TanStack query, with translated labels. */
export function useQueryState(q: QueryLike): Omit<QueryStateProps, 'children'> {
  const t = useTranslations('common');
  const err = q.error instanceof ApiClientError ? q.error : null;
  return {
    status: q.status,
    errorStatus: err?.status,
    onRetry: () => void q.refetch(),
    labels: {
      loading: t('loading'),
      errorTitle: t('errorTitle'),
      errorBody: t('errorBody', { ref: err?.requestId ?? '—' }),
      retry: t('retry'),
      notFoundTitle: t('notFoundTitle'),
      notFoundBody: t('notFoundBody'),
    },
  };
}
