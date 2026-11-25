import { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={() => !loading && onCancel?.()}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="card relative w-full max-w-md p-6"
      >
        <div className="flex gap-4">
          {danger && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-risk-high/15 text-risk-high-text">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <p id={descId} className="mt-1.5 text-sm leading-6 text-ink-soft">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
