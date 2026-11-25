import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const noop = () => {};
const ToastContext = createContext({ success: noop, error: noop, info: noop });

const STYLES = {
  success: { icon: CheckCircle2, ring: 'border-risk-low/50', tone: 'text-risk-low-text' },
  error: { icon: AlertTriangle, ring: 'border-risk-high/60', tone: 'text-risk-high-text' },
  info: { icon: Info, ring: 'border-brand-400/50', tone: 'text-brand-300' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, message) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-lg border ${s.ring} bg-navy-800 p-3.5 shadow-panel`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.tone}`} aria-hidden="true" />
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-ink-mute hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
