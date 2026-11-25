import { Loader2 } from 'lucide-react';

export function Spinner({ label = 'Loading', className = 'h-5 w-5' }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={`animate-spin text-cyan-400 ${className}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading LinkShield' }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={label} className="h-8 w-8" />
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-navy-700/70 ${className}`} />;
}

/** Placeholder layout shown while a page's first request is in flight. */
export function PageSkeleton({ stats = 4 }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <span className="sr-only">Loading</span>
      <div className={`grid gap-4 sm:grid-cols-2 ${stats === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {Array.from({ length: stats }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
