import { useState } from 'react';
import { Activity, AlertOctagon, BarChart3, Gauge, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ChartCard from '../components/charts/ChartCard';
import {
  ActivityChart,
  BarList,
  DonutChart,
  Legend,
  PREDICTION_LEGEND,
  SimpleBars,
  TrendChart,
  predictionDonutItems,
  riskDonutItems,
} from '../components/charts/charts';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';
import RangeSelector from '../components/ui/RangeSelector';
import { PageSkeleton } from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import { useApi } from '../hooks/useApi';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDayLabel, formatNumber } from '../lib/format';

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const [range, setRange] = useState(30);
  const { data, error, loading, reload } = useApi(() => api.getAnalytics(range), [range]);

  const header = (
    <PageHeader
      title="Analytics"
      description="Trends across your own scans for the selected period."
      actions={<RangeSelector value={range} onChange={setRange} />}
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

  const { totals } = data;
  if (totals.totalScans === 0) {
    return (
      <>
        {header}
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title={`No scans in the last ${data.range} days`}
            description="Run a scan, or choose a longer time range, to see trends here."
            action={
              <Link to="/scan" className="btn btn-primary">
                Scan a URL
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
      <div className={`space-y-6 ${loading ? 'opacity-70 transition-opacity' : ''}`} aria-busy={loading}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Activity} label="Scans" value={formatNumber(totals.totalScans)} hint={`Last ${data.range} days`} />
          <StatCard icon={ShieldAlert} label="Phishing detected" value={formatNumber(totals.phishingCount)} accent="text-series-phish-text" />
          <StatCard icon={AlertOctagon} label="High-risk scans" value={formatNumber(totals.highRiskCount)} accent="text-risk-high-text" />
          <StatCard icon={Gauge} label="Average risk score" value={Number(totals.averageRiskScore).toFixed(1)} hint="Out of 100" />
        </div>

        <ChartCard
          title="Daily scans"
          legend={<Legend items={PREDICTION_LEGEND} />}
          table={{
            columns: [
              { key: 'day', header: 'Day' },
              { key: 'total', header: 'Total' },
              { key: 'legitimate', header: 'Legitimate' },
              { key: 'phishing', header: 'Phishing' },
            ],
            rows: data.dailySeries.map((d) => ({ ...d, day: formatDayLabel(d.date) })),
          }}
        >
          <ActivityChart data={data.dailySeries} />
        </ChartCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Weekly trend"
            legend={<Legend items={PREDICTION_LEGEND} />}
            table={{
              columns: [
                { key: 'week', header: 'Week of' },
                { key: 'total', header: 'Total' },
                { key: 'legitimate', header: 'Legitimate' },
                { key: 'phishing', header: 'Phishing' },
              ],
              rows: data.weeklyTrend.map((w) => ({ ...w, week: formatDayLabel(w.weekStart) })),
            }}
          >
            <TrendChart data={data.weeklyTrend} />
          </ChartCard>

          <ChartCard
            title="Risk score distribution"
            description="How many scans fell in each 10-point score band"
            table={{
              columns: [
                { key: 'bucket', header: 'Score band' },
                { key: 'count', header: 'Scans' },
              ],
              rows: data.riskScoreBuckets,
            }}
          >
            <SimpleBars data={data.riskScoreBuckets} xKey="bucket" yKey="count" name="Scans" label="Scans per risk score band" />
          </ChartCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Risk categories"
            table={{
              columns: [
                { key: 'label', header: 'Category' },
                { key: 'value', header: 'Scans' },
              ],
              rows: riskDonutItems(data.riskDistribution),
            }}
          >
            <DonutChart items={riskDonutItems(data.riskDistribution)} ariaLabel="Scans by risk category" />
          </ChartCard>

          <ChartCard
            title="Predictions"
            table={{
              columns: [
                { key: 'label', header: 'Prediction' },
                { key: 'value', header: 'Scans' },
              ],
              rows: predictionDonutItems({
                phishing: data.predictionSplit.find((p) => p.prediction === 'phishing')?.count,
                legitimate: data.predictionSplit.find((p) => p.prediction === 'legitimate')?.count,
              }),
            }}
          >
            <DonutChart
              items={predictionDonutItems({
                phishing: data.predictionSplit.find((p) => p.prediction === 'phishing')?.count,
                legitimate: data.predictionSplit.find((p) => p.prediction === 'legitimate')?.count,
              })}
              ariaLabel="Scans by prediction"
            />
          </ChartCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Most scanned domains" description="Orange shows how many of those scans were phishing">
            <BarList
              items={data.topDomains.map((d) => ({ label: d.hostname, value: d.count, secondary: d.phishingCount }))}
              secondaryLabel="phishing"
            />
          </ChartCard>
          <ChartCard title="Most common risk factors" description="Characteristics found most often in your scans">
            <BarList items={data.topRiskFactors.map((r) => ({ label: r.title, value: r.count }))} empty="No risk factors were triggered in this period." />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
