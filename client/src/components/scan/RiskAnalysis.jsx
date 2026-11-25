import { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { BOOLEAN_FEATURES, COLORS, FEATURE_LABELS } from '../../lib/constants';
import { formatFeatureValue } from '../../lib/format';
import { SeverityBadge } from '../ui/Badges';

function Contributions({ items }) {
  const max = Math.max(...items.map((c) => Math.abs(c.influence)), 0.0001);
  return (
    <div>
      <h3 className="text-base font-semibold">What moved the score</h3>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
        Each row shows how the estimated phishing probability changes when that one characteristic is replaced with the
        typical (median) value from the training data. Points are percentage points of probability.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((c) => {
          const towardPhishing = c.influence > 0;
          const width = `${(Math.abs(c.influence) / max) * 50}%`;
          const points = `${towardPhishing ? '+' : '−'}${(Math.abs(c.influence) * 100).toFixed(1)} pts`;
          return (
            <li key={c.feature}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink">
                  {FEATURE_LABELS[c.feature] || c.feature}{' '}
                  <span className="text-ink-mute">
                    = {formatFeatureValue(c.feature, c.value, BOOLEAN_FEATURES)}
                    <span className="sr-only"> (typical value {formatFeatureValue(c.feature, c.baseline, BOOLEAN_FEATURES)})</span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-ink-soft">
                  {points} {towardPhishing ? 'toward phishing' : 'toward legitimate'}
                </span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-navy-700" aria-hidden="true">
                <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line-strong" />
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    width,
                    background: towardPhishing ? COLORS.phishing : COLORS.legitimate,
                    left: towardPhishing ? '50%' : undefined,
                    right: towardPhishing ? undefined : '50%',
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeatureTable({ features }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(features || {});
  if (!entries.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn btn-secondary btn-sm"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        {open ? 'Hide' : 'Show'} all {entries.length} extracted features
      </button>
      {open && (
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
              <dt className="text-sm text-ink-soft">{FEATURE_LABELS[key] || key}</dt>
              <dd className="font-mono text-sm text-ink">{formatFeatureValue(key, value, BOOLEAN_FEATURES)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Explanations come straight from the API: triggered, data-supported risk factors and model contributions. */
export default function RiskAnalysis({ scan, showAllFeatures = true }) {
  const factors = scan.riskFactors || [];
  const contributions = scan.contributions || [];
  return (
    <section aria-labelledby="risk-analysis-title" className="card card-pad space-y-7">
      <div>
        <h2 id="risk-analysis-title" className="text-xl font-bold">
          Risk analysis
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
          Only characteristics that are present in this URL and were measurably more common in phishing URLs during
          training are listed.
        </p>
      </div>

      {factors.length > 0 ? (
        <ul className="space-y-3">
          {factors.map((f) => (
            <li key={f.code} className="rounded-lg border border-line bg-navy-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{f.title}</h3>
                <SeverityBadge severity={f.severity} />
              </div>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">{f.description}</p>
              <p className="mt-2 font-mono text-xs text-ink-mute">
                {FEATURE_LABELS[f.feature] || f.feature}: {formatFeatureValue(f.feature, f.value, BOOLEAN_FEATURES)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex gap-3 rounded-lg border border-line bg-navy-900/60 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" aria-hidden="true" />
          <p className="text-sm leading-6 text-ink-soft">
            None of the known risk characteristics were triggered by this URL. That does not mean the website is safe:
            the model only sees the text of the URL.
          </p>
        </div>
      )}

      {contributions.length > 0 && <Contributions items={contributions} />}
      {showAllFeatures && <FeatureTable features={scan.features} />}
    </section>
  );
}
