import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const TONES = {
  error: { icon: AlertTriangle, box: 'border-risk-high/50 bg-risk-high/10', text: 'text-risk-high-text', role: 'alert' },
  warning: { icon: AlertTriangle, box: 'border-risk-medium/50 bg-risk-medium/10', text: 'text-risk-medium-text', role: 'status' },
  success: { icon: CheckCircle2, box: 'border-risk-low/50 bg-risk-low/10', text: 'text-risk-low-text', role: 'status' },
  info: { icon: Info, box: 'border-brand-400/40 bg-brand-500/10', text: 'text-brand-300', role: 'status' },
};

export default function Alert({ tone = 'info', title, children, action, className = '' }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={t.role} className={`flex gap-3 rounded-lg border p-4 ${t.box} ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.text}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={`${title ? 'mt-0.5' : ''} text-ink-soft`}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
