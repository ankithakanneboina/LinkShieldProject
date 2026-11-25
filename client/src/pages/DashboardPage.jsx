import { useState } from 'react';
import { Activity, AlertOctagon, ArrowRight, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ChartCard from '../components/charts/ChartCard';
import { ActivityChart, DonutChart, Legend, PREDICTION_LEGEND, TrendChart, riskDonutItems } from '../components/charts/charts';
import UrlText from '../components/scan/UrlText';
import { PredictionBadge, RiskBadge } from '../components/ui/Badges';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import { PageSkeleton } from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { usePageTitle } from '../hooks/usePageTitle';
import { firstName, formatDateTime, formatDayLabel, formatNumber } from '../lib/format';
import { validateScanUrl } from '../lib/validators';

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.getDashboard(), []);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickError, setQuickError] = useState('');

  const quickScan = (e) => {
    e.preventDefault();
    const problem = validateScanUrl(quickUrl);
    setQuickError(problem);
    if (!problem) navigate('/scan', { state: { url: quickUrl.trim() } });
  };

  const header = (
    <PageHeader
      title="Dashboard"
      description={user ? `Your scanning activity, ${firstName(user.name)}.` : 'Your scanning activity.'}
      actions={
        <Link to="/scan" className="btn btn-primary">
          <Search className="h-4 w-4" aria-hidden="true" /> Scan a URL
        </Link>
      }
    />
  );

  if (loading && !data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }
  if (error && !data) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  const { totals, recentScans, dailyActivity, weeklyTrend, riskDistribution } = data;

  if (totals.totalScans === 0) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            icon={Search}
            title="No scans yet"
            description="Scan your first URL and your totals, weekly trends and risk breakdown will appear here."
            action={
              <Link to="/scan" className="btn btn-primary">
                Scan your first URL
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        <form onSubmit={quickScan} noValidate className="card card-pad">
          <label htmlFor="quick-url" className="label">
            Quick scan
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="quick-url"
              className="input font-mono"
              placeholder="Paste a URL"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={quickError ? 'true' : undefined}
              aria-describedby={quickError ? 'quick-url-error' : undefined}
            />
            <Button type="submit" variant="secondary" icon={ArrowRight}>
              Continue to scanner
            </Button>
          </div>
          {quickError && (
            <p id="quick-url-error" role="alert" className="mt-2 text-sm font-medium text-risk-high-text">
              {quickError}
            </p>
          )}
        </form>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Activity} label="Total scans" value={formatNumber(totals.totalScans)} />
          <StatCard icon={ShieldAlert} label="Phishing detected" value={formatNumber(totals.phishingCount)} accent="text-series-phish-text" />
          <StatCard icon={CheckCircle2} label="Legitimate" value={formatNumber(totals.legitimateCount)} accent="text-series-legit-text" />
          <StatCard icon={AlertOctagon} label="High-risk scans" value={formatNumber(totals.highRiskCount)} accent="text-risk-high-text" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Weekly trend"
            description="Scans per week, last 8 weeks"
            legend={<Legend items={PREDICTION_LEGEND} />}
            table={{
              columns: [
                { key: 'week', header: 'Week of' },
                { key: 'total', header: 'Total' },
                { key: 'legitimate', header: 'Legitimate' },
                { key: 'phishing', header: 'Phishing' },
              ],
              rows: weeklyTrend.map((w) => ({ ...w, week: formatDayLabel(w.weekStart) })),
            }}
          >
            <TrendChart data={weeklyTrend} />
          </ChartCard>

          <ChartCard
            title="Recent activity"
            description="Scans per day, last 14 days"
            legend={<Legend items={PREDICTION_LEGEND} />}
            table={{
              columns: [
                { key: 'day', header: 'Day' },
                { key: 'total', header: 'Total' },
                { key: 'legitimate', header: 'Legitimate' },
                { key: 'phishing', header: 'Phishing' },
              ],
              rows: dailyActivity.map((d) => ({ ...d, day: formatDayLabel(d.date) })),
            }}
          >
            <ActivityChart data={dailyActivity} />
          </ChartCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ChartCard
            title="Risk distribution"
            description="All of your scans by risk category"
            table={{
              columns: [
                { key: 'label', header: 'Risk category' },
                { key: 'value', header: 'Scans' },
              ],
              rows: riskDonutItems(riskDistribution),
            }}
          >
            <DonutChart items={riskDonutItems(riskDistribution)} ariaLabel="Scans by risk category" />
          </ChartCard>

          <section aria-labelledby="recent-title" className="card">
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 id="recent-title" className="text-base font-semibold">
                Latest scans
              </h2>
              <Link to="/history" className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
                View all
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {recentScans.map((s) => (
                <li key={s.id}>
                  <Link to={`/scans/${s.id}`} className="block px-5 py-3.5 hover:bg-navy-800/60 sm:px-6">
                    <UrlText url={s.normalizedUrl} truncate />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PredictionBadge prediction={s.prediction} />
                      <RiskBadge level={s.riskCategory} score={s.riskScore} />
                      <span className="text-xs text-ink-mute">{formatDateTime(s.scannedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
