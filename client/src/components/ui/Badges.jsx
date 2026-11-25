import { CheckCircle2, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';
import { PREDICTION_LABEL, RISK_LABEL, SEVERITY_LABEL } from '../../lib/constants';

const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset';

const RISK_STYLE = {
  low: { cls: 'bg-risk-low/15 text-risk-low-text ring-risk-low/40', icon: ShieldCheck },
  medium: { cls: 'bg-risk-medium/15 text-risk-medium-text ring-risk-medium/40', icon: AlertTriangle },
  high: { cls: 'bg-risk-high/15 text-risk-high-text ring-risk-high/50', icon: ShieldAlert },
};

/** Risk is always icon + text, never colour alone. */
export function RiskBadge({ level, score }) {
  const s = RISK_STYLE[level] || RISK_STYLE.low;
  const Icon = s.icon;
  return (
    <span className={`${base} ${s.cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {RISK_LABEL[level] || level}
      {typeof score === 'number' && <span className="font-mono font-medium opacity-80">{score}</span>}
    </span>
  );
}

export function PredictionBadge({ prediction }) {
  const phishing = prediction === 'phishing';
  return (
    <span
      className={`${base} ${
        phishing ? 'bg-series-phish/15 text-series-phish-text ring-series-phish/45' : 'bg-series-legit/15 text-series-legit-text ring-series-legit/45'
      }`}
    >
      {phishing ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {PREDICTION_LABEL[prediction] || prediction}
    </span>
  );
}

const SEVERITY_STYLE = {
  high: 'bg-risk-high/15 text-risk-high-text ring-risk-high/50',
  medium: 'bg-risk-medium/15 text-risk-medium-text ring-risk-medium/40',
  low: 'bg-navy-700 text-ink-soft ring-line-strong',
};

export function SeverityBadge({ severity }) {
  return <span className={`${base} ${SEVERITY_STYLE[severity] || SEVERITY_STYLE.low}`}>{SEVERITY_LABEL[severity] || severity}</span>;
}

export function RoleBadge({ role }) {
  return (
    <span className={`${base} ${role === 'admin' ? 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/40' : 'bg-navy-700 text-ink-soft ring-line-strong'}`}>
      {role === 'admin' ? 'Admin' : 'User'}
    </span>
  );
}

export function StatusBadge({ ok, okLabel = 'Active', badLabel = 'Disabled' }) {
  return (
    <span className={`${base} ${ok ? 'bg-risk-low/15 text-risk-low-text ring-risk-low/40' : 'bg-navy-700 text-ink-soft ring-line-strong'}`}>
      {ok ? okLabel : badLabel}
    </span>
  );
}
