import { COLORS, RISK_LABEL } from '../../lib/constants';
import { formatDateTime, formatPercent } from '../../lib/format';
import { PredictionBadge, RiskBadge } from '../ui/Badges';
import CopyButton from '../ui/CopyButton';
import UrlText from './UrlText';

const ARC = Math.PI * 80; // length of the semicircle (radius 80)

function RiskGauge({ score, category }) {
  const clamped = Math.min(Math.max(score, 0), 100);
  const length = (clamped / 100) * ARC;
  return (
    <div
      className="relative mx-auto w-full max-w-[220px]"
      role="img"
      aria-label={`Risk score ${score} out of 100, ${RISK_LABEL[category]}`}
    >
      <svg viewBox="0 0 200 112" className="w-full" aria-hidden="true">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={COLORS.grid} strokeWidth="14" strokeLinecap="round" />
        {length >= 1 && (
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke={COLORS[category]}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${length} ${ARC}`}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="font-display text-4xl font-bold leading-none tabular-nums">{score}</div>
        <div className="mt-1 text-xs text-ink-mute">risk score out of 100</div>
      </div>
    </div>
  );
}

function Meta({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function ScanVerdict({ scan }) {
  const phishing = scan.prediction === 'phishing';
  return (
    <section aria-labelledby="verdict-title" className="card card-pad">
      <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)] md:items-center">
        <RiskGauge score={scan.riskScore} category={scan.riskCategory} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PredictionBadge prediction={scan.prediction} />
            <RiskBadge level={scan.riskCategory} />
          </div>
          <h2 id="verdict-title" className="mt-3 text-2xl font-bold">
            {phishing ? 'The model classified this URL as phishing' : 'The model classified this URL as legitimate'}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">
            Estimated phishing probability: <strong className="text-ink">{formatPercent(scan.phishingProbability)}</strong>.
            This is an estimate based on the URL text alone, not a verdict on the website.
          </p>

          <div className="mt-4 rounded-lg border border-line bg-navy-900/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-mute">Submitted URL</span>
              <CopyButton text={scan.submittedUrl} />
            </div>
            <UrlText url={scan.normalizedUrl || scan.submittedUrl} className="mt-1" />
            {scan.schemeAssumed && (
              <p className="mt-1.5 text-xs text-ink-mute">
                You did not include http:// or https://, so https:// was assumed. You entered{' '}
                <span className="break-all font-mono">{scan.submittedUrl}</span>.
              </p>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Prediction">{phishing ? 'Phishing' : 'Legitimate'}</Meta>
        <Meta label="Risk category">{RISK_LABEL[scan.riskCategory]}</Meta>
        <Meta label="Scanned">{formatDateTime(scan.scannedAt)}</Meta>
        <Meta label="Model">
          <span className="font-mono text-[0.8rem]">
            {scan.modelName} · {scan.modelVersion}
          </span>
        </Meta>
      </dl>
    </section>
  );
}
