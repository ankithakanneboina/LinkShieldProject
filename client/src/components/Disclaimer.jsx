import { Info } from 'lucide-react';
import { DISCLAIMER } from '../lib/constants';

export default function Disclaimer({ className = '' }) {
  return (
    <aside
      aria-label="Disclaimer"
      className={`flex gap-3 rounded-lg border border-brand-400/30 bg-brand-500/10 p-4 ${className}`}
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" />
      <p className="text-sm leading-6 text-ink-soft">{DISCLAIMER}</p>
    </aside>
  );
}
