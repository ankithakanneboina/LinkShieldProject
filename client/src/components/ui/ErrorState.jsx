import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

export default function ErrorState({ error, onRetry, title = 'Could not load this data' }) {
  return (
    <div role="alert" className="card flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-risk-high/15 text-risk-high-text">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-ink-soft">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry} className="mt-5">
          Try again
        </Button>
      )}
    </div>
  );
}
