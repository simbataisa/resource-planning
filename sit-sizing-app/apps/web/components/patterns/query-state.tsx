import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './empty-state';

export interface QueryStateLabels {
  loading: string;
  errorTitle: string;
  /** Already formatted, e.g. with the request reference. */
  errorBody: string;
  retry: string;
  notFoundTitle: string;
  notFoundBody: string;
}

export interface QueryStateProps {
  status: 'pending' | 'error' | 'success';
  /** HTTP status of the error, when known: 404 shows "not found" instead of an error. */
  errorStatus?: number;
  onRetry?: () => void;
  labels: QueryStateLabels;
  /** Rows of skeleton while loading. */
  skeletonRows?: number;
  children: ReactNode;
}

/** Loading, error and not-found states around data that comes from the API. */
export function QueryState({
  status,
  errorStatus,
  onRetry,
  labels,
  skeletonRows = 3,
  children,
}: QueryStateProps) {
  if (status === 'pending') {
    return (
      <div className="grid gap-2" aria-busy="true">
        <span className="sr-only" role="status">
          {labels.loading}
        </span>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (status === 'error') {
    if (errorStatus === 404)
      return <EmptyState title={labels.notFoundTitle} description={labels.notFoundBody} />;
    return (
      <Alert variant="destructive">
        <AlertTitle>{labels.errorTitle}</AlertTitle>
        <AlertDescription>
          <p>{labels.errorBody}</p>
          {onRetry ? (
            <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              {labels.retry}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  return <>{children}</>;
}
