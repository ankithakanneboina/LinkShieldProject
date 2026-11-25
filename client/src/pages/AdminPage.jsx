import { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BrainCircuit,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../api';
import ChartCard from '../components/charts/ChartCard';
import {
  ActivityChart,
  BarList,
  DonutChart,
  Legend,
  PREDICTION_LEGEND,
  SimpleBars,
  riskDonutItems,
} from '../components/charts/charts';
import UrlText from '../components/scan/UrlText';
import { PredictionBadge, RiskBadge, RoleBadge, StatusBadge } from '../components/ui/Badges';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { SelectField } from '../components/ui/Field';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import RangeSelector from '../components/ui/RangeSelector';
import { PageSkeleton, Skeleton } from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import Tabs from '../components/ui/Tabs';
import { useApi } from '../hooks/useApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePageTitle } from '../hooks/usePageTitle';
import { ACTIVITY_LABEL, FEEDBACK_CATEGORIES, FEEDBACK_LABEL } from '../lib/constants';
import { formatDateTime, formatDayLabel, formatMetric, formatNumber, formatPercent } from '../lib/format';

const PAGE_SIZE = 10;

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'scans', label: 'Scans', icon: ScanSearch },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'model', label: 'Model', icon: BrainCircuit },
  { id: 'activity', label: 'Activity', icon: Activity },
];

/** Shared loading / error wrapper so every tab behaves the same way. */
function Async({ state, skeleton = <PageSkeleton />, children }) {
  const { data, error, loading, reload } = state;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return skeleton;
  return <div className={loading ? 'opacity-70 transition-opacity' : ''} aria-busy={loading}>{children(data)}</div>;
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 p-5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- Overview */

function OverviewTab() {
  const [range, setRange] = useState(30);
  const state = useApi(() => api.adminAnalytics(range), [range]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RangeSelector value={range} onChange={setRange} />
      </div>
      <Async state={state}>
        {(d) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Users} label="Registered users" value={formatNumber(d.totals.totalUsers)} hint={`${formatNumber(d.totals.newUsersLast7Days)} new in the last 7 days`} />
              <StatCard icon={Activity} label="Total scans" value={formatNumber(d.totals.totalScans)} hint={`${formatNumber(d.totals.scansLast24h)} in the last 24 hours`} />
              <StatCard icon={ShieldAlert} label="Phishing predictions" value={formatNumber(d.totals.phishingCount)} accent="text-series-phish-text" />
              <StatCard icon={ShieldCheck} label="Legitimate predictions" value={formatNumber(d.totals.legitimateCount)} accent="text-series-legit-text" />
              <StatCard icon={AlertOctagon} label="High-risk scans" value={formatNumber(d.totals.highRiskCount)} accent="text-risk-high-text" />
              <StatCard icon={MessageSquare} label="Feedback received" value={formatNumber(d.totals.totalFeedback)} />
              <StatCard icon={UserPlus} label="New users (7 days)" value={formatNumber(d.totals.newUsersLast7Days)} />
              <StatCard icon={FileText} label="Scans (24 hours)" value={formatNumber(d.totals.scansLast24h)} />
            </div>

            <ChartCard
              title="Platform scans per day"
              description={`All users, last ${d.range} days`}
              legend={<Legend items={PREDICTION_LEGEND} />}
              table={{
                columns: [
                  { key: 'day', header: 'Day' },
                  { key: 'total', header: 'Total' },
                  { key: 'legitimate', header: 'Legitimate' },
                  { key: 'phishing', header: 'Phishing' },
                ],
                rows: d.dailySeries.map((r) => ({ ...r, day: formatDayLabel(r.date) })),
              }}
            >
              <ActivityChart data={d.dailySeries} />
            </ChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="New registrations"
                table={{
                  columns: [
                    { key: 'day', header: 'Day' },
                    { key: 'newUsers', header: 'New users' },
                  ],
                  rows: d.userGrowth.map((r) => ({ ...r, day: formatDayLabel(r.date) })),
                }}
              >
                <SimpleBars data={d.userGrowth} xKey="date" yKey="newUsers" name="New users" label="New registrations per day" xFormatter={formatDayLabel} />
              </ChartCard>

              <ChartCard
                title="Risk categories"
                table={{
                  columns: [
                    { key: 'label', header: 'Category' },
                    { key: 'value', header: 'Scans' },
                  ],
                  rows: riskDonutItems(d.riskDistribution),
                }}
              >
                <DonutChart items={riskDonutItems(d.riskDistribution)} ariaLabel="Platform scans by risk category" />
              </ChartCard>
            </div>

            <ChartCard title="Feedback by category" description="Unverified user opinions; never used as ground-truth labels.">
              <BarList
                items={d.feedbackByCategory.map((f) => ({ label: FEEDBACK_LABEL[f.category] || f.category, value: f.count }))}
                empty="No feedback has been submitted yet."
              />
            </ChartCard>
          </div>
        )}
      </Async>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- Users */

function UsersTab() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search]);
  const state = useApi(() => api.adminUsers({ page, limit: PAGE_SIZE, search }), [page, search]);

  return (
    <section className="card" aria-label="Registered users">
      <div className="border-b border-line p-4 sm:p-5">
        <label htmlFor="admin-user-search" className="label">
          Search users
        </label>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <input id="admin-user-search" type="search" className="input pl-9" placeholder="Name or email" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={100} autoComplete="off" />
        </div>
      </div>
      <Async state={state} skeleton={<TableSkeleton />}>
        {(d) =>
          d.data.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description={search ? 'Try a different name or email.' : 'No one has registered yet.'} />
          ) : (
            <>
              <DataTable
                caption="Registered users"
                rows={d.data}
                columns={[
                  { key: 'name', header: 'Name' },
                  { key: 'email', header: 'Email', className: 'break-all' },
                  { key: 'role', header: 'Role', render: (u) => <RoleBadge role={u.role} /> },
                  { key: 'isActive', header: 'Status', render: (u) => <StatusBadge ok={u.isActive} /> },
                  { key: 'scanCount', header: 'Scans', render: (u) => formatNumber(u.scanCount) },
                  { key: 'createdAt', header: 'Registered', render: (u) => formatDateTime(u.createdAt) },
                  { key: 'lastLoginAt', header: 'Last login', render: (u) => formatDateTime(u.lastLoginAt) },
                ]}
              />
              <Pagination pagination={d.pagination} onPageChange={setPage} />
            </>
          )
        }
      </Async>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- Scans */

function ScansTab() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [prediction, setPrediction] = useState('');
  const [risk, setRisk] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, prediction, risk, sort]);
  const state = useApi(() => api.adminScans({ page, limit: PAGE_SIZE, search, prediction, risk, sort }), [page, search, prediction, risk, sort]);

  return (
    <section className="card" aria-label="All scans">
      <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] sm:p-5">
        <div>
          <label htmlFor="admin-scan-search" className="label">
            Search URLs
          </label>
          <input id="admin-scan-search" type="search" className="input" placeholder="Part of a URL" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={200} autoComplete="off" />
        </div>
        <SelectField label="Result" value={prediction} onChange={(e) => setPrediction(e.target.value)} options={[{ value: '', label: 'All results' }, { value: 'phishing', label: 'Phishing' }, { value: 'legitimate', label: 'Legitimate' }]} />
        <SelectField label="Risk" value={risk} onChange={(e) => setRisk(e.target.value)} options={[{ value: '', label: 'All risk levels' }, { value: 'low', label: 'Low risk' }, { value: 'medium', label: 'Medium risk' }, { value: 'high', label: 'High risk' }]} />
        <SelectField label="Sort by date" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} />
      </div>
      <Async state={state} skeleton={<TableSkeleton />}>
        {(d) =>
          d.data.length === 0 ? (
            <EmptyState icon={ScanSearch} title="No scans found" description="No scans match these filters." />
          ) : (
            <>
              <DataTable
                caption="All scans"
                rows={d.data}
                columns={[
                  { key: 'normalizedUrl', header: 'URL', className: 'max-w-[20rem]', render: (s) => <UrlText url={s.normalizedUrl} truncate /> },
                  { key: 'prediction', header: 'Result', render: (s) => <PredictionBadge prediction={s.prediction} /> },
                  { key: 'riskCategory', header: 'Risk', render: (s) => <RiskBadge level={s.riskCategory} score={s.riskScore} /> },
                  { key: 'user', header: 'User', render: (s) => <span title={s.user?.email}>{s.user?.name || '—'}</span> },
                  { key: 'scannedAt', header: 'Scanned', render: (s) => formatDateTime(s.scannedAt) },
                ]}
              />
              <Pagination pagination={d.pagination} onPageChange={setPage} />
            </>
          )
        }
      </Async>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- Feedback */

function FeedbackTab() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [category]);
  const state = useApi(() => api.adminFeedback({ page, limit: PAGE_SIZE, category }), [page, category]);

  return (
    <section className="card" aria-label="User feedback">
      <div className="border-b border-line p-4 sm:p-5">
        <div className="max-w-sm">
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: 'All categories' }, ...FEEDBACK_CATEGORIES]} />
        </div>
        <p className="mt-3 text-sm text-ink-mute">Feedback is unverified user opinion. It is not treated as a ground-truth label and is never used to retrain the model automatically.</p>
      </div>
      <Async state={state} skeleton={<TableSkeleton />}>
        {(d) =>
          d.data.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No feedback yet" description={category ? 'Nothing in this category.' : 'Feedback submitted from scan results appears here.'} />
          ) : (
            <>
              <DataTable
                caption="User feedback"
                rows={d.data}
                columns={[
                  { key: 'category', header: 'Category', render: (f) => FEEDBACK_LABEL[f.category] || f.category },
                  { key: 'comments', header: 'Comments', className: 'max-w-[18rem] whitespace-pre-wrap break-words', render: (f) => f.comments || <span className="text-ink-mute">No comment</span> },
                  { key: 'scan', header: 'Scan', className: 'max-w-[16rem]', render: (f) => (<div className="space-y-1"><UrlText url={f.scan.normalizedUrl} truncate /><div className="flex gap-2"><PredictionBadge prediction={f.scan.prediction} /><RiskBadge level={f.scan.riskCategory} score={f.scan.riskScore} /></div></div>) },
                  { key: 'user', header: 'User', render: (f) => <span title={f.user?.email}>{f.user?.name || '—'}</span> },
                  { key: 'createdAt', header: 'Submitted', render: (f) => formatDateTime(f.createdAt) },
                ]}
              />
              <Pagination pagination={d.pagination} onPageChange={setPage} />
            </>
          )
        }
      </Async>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- Model */

function ConfusionMatrix({ cm }) {
  const cell = 'flex flex-col items-center justify-center rounded-lg border border-line p-4 text-center';
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] items-stretch gap-2 text-sm" role="table" aria-label="Confusion matrix on the held-out test split">
      <div />
      <div className="px-2 text-center text-ink-mute" role="columnheader">Predicted legitimate</div>
      <div className="px-2 text-center text-ink-mute" role="columnheader">Predicted phishing</div>
      <div className="flex items-center pr-2 text-ink-mute" role="rowheader">Actual legitimate</div>
      <div className={cell} role="cell"><span className="font-display text-xl font-bold tabular-nums">{formatNumber(cm.tn)}</span><span className="text-xs text-ink-mute">true negatives</span></div>
      <div className={cell} role="cell"><span className="font-display text-xl font-bold tabular-nums">{formatNumber(cm.fp)}</span><span className="text-xs text-ink-mute">false positives</span></div>
      <div className="flex items-center pr-2 text-ink-mute" role="rowheader">Actual phishing</div>
      <div className={cell} role="cell"><span className="font-display text-xl font-bold tabular-nums">{formatNumber(cm.fn)}</span><span className="text-xs text-ink-mute">false negatives</span></div>
      <div className={cell} role="cell"><span className="font-display text-xl font-bold tabular-nums">{formatNumber(cm.tp)}</span><span className="text-xs text-ink-mute">true positives</span></div>
    </div>
  );
}

function ModelTab() {
  const state = useApi(() => api.adminModel(), []);
  return (
    <Async state={state}>
      {(d) => {
        const m = d.active;
        const status = d.service.status;
        const statusText = { ok: 'ML service online', model_not_loaded: 'ML service online, no model loaded', unavailable: 'ML service unreachable' }[status] || status;
        if (!m) {
          return (
            <div className="card">
              <EmptyState
                icon={BrainCircuit}
                title="No model has been trained yet"
                description={`${statusText}. Download the dataset, then run the training pipeline in ml-service/ (see the README). Metrics appear here only after a real training run.`}
              />
            </div>
          );
        }
        const test = m.metrics?.test;
        const details = m.details || {};
        const thresholds = m.riskThresholds || {};
        return (
          <div className="space-y-6">
            <div className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{m.modelName.replace(/_/g, ' ')}</h2>
                  <p className="text-sm text-ink-soft">{m.algorithm}</p>
                </div>
                <StatusBadge ok={status === 'ok'} okLabel="Service online" badLabel={statusText} />
              </div>
              <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Version', m.modelVersion],
                  ['Trained', formatDateTime(m.trainedAt)],
                  ['Features', m.featureCount],
                  ['Extractor version', m.extractorVersion],
                  ['Dataset', m.datasetName || '—'],
                  ['Records used', formatNumber(details.dataset?.records_used ?? m.datasetRecords)],
                  ['Calibration', details.calibration ? `${details.calibration.method} (${formatNumber(details.calibration.calibration_records)} records)` : '—'],
                  ['Label mapping', details.dataset?.label_mapping ? `dataset label ${details.dataset.label_mapping.phishing} = phishing, ${details.dataset.label_mapping.legitimate} = legitimate` : '—'],
                  ['Split', m.metrics?.split ? `${m.metrics.split.strategy}` : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-ink-mute">{k}</dt>
                    <dd className="mt-0.5 break-all font-mono text-ink">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {test && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <StatCard icon={ShieldCheck} label="Accuracy" value={formatPercent(test.accuracy, 2)} hint={`Test split, ${formatNumber(test.n)} URLs`} />
                  <StatCard icon={ShieldCheck} label="Precision" value={formatPercent(test.precision, 2)} hint="Phishing class" />
                  <StatCard icon={ShieldCheck} label="Recall" value={formatPercent(test.recall, 2)} hint="Phishing class" />
                  <StatCard icon={ShieldCheck} label="F1-score" value={formatMetric(test.f1)} />
                  <StatCard icon={ShieldCheck} label="ROC AUC" value={formatMetric(test.roc_auc)} />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <ChartCard title="Confusion matrix" description={`Held-out, domain-disjoint test split at decision threshold ${thresholds.decision}`}>
                    <ConfusionMatrix cm={test.confusion_matrix} />
                  </ChartCard>
                  <ChartCard title="Risk categories" description="Observed phishing rate per category on the test split">
                    <DataTable
                      caption="Risk category statistics"
                      rowKey="category"
                      rows={m.metrics.risk_category_stats || []}
                      columns={[
                        { key: 'category', header: 'Category', render: (r) => r.category },
                        { key: 'count', header: 'URLs', render: (r) => formatNumber(r.count) },
                        { key: 'phishing_rate', header: 'Phishing rate', render: (r) => formatPercent(r.phishing_rate) },
                      ]}
                    />
                    <p className="mt-3 text-xs text-ink-mute">Thresholds (from the calibration split): medium ≥ {thresholds.medium}, high ≥ {thresholds.high}. {thresholds.method}</p>
                  </ChartCard>
                </div>
              </>
            )}

            {m.metrics?.comparison?.length > 0 && (
              <section className="card" aria-label="Model comparison">
                <div className="border-b border-line p-5">
                  <h2 className="text-base font-semibold">Model comparison</h2>
                  <p className="mt-0.5 text-sm text-ink-mute">{m.metrics.selection_rule}. Test columns use the uncalibrated model at threshold 0.5.</p>
                </div>
                <DataTable
                  caption="Model comparison"
                  rowKey="model"
                  rows={m.metrics.comparison}
                  columns={[
                    { key: 'model', header: 'Model', render: (r) => (<span>{r.model.replace(/_/g, ' ')}{r.model === m.metrics.selected_model && <span className="ml-2 text-xs text-cyan-300">selected</span>}</span>) },
                    { key: 'cv', header: 'CV F1', render: (r) => `${formatMetric(r.cv_f1_mean)} ± ${formatMetric(r.cv_f1_std)}` },
                    { key: 'acc', header: 'Accuracy', render: (r) => formatMetric(r.test.accuracy) },
                    { key: 'prec', header: 'Precision', render: (r) => formatMetric(r.test.precision) },
                    { key: 'rec', header: 'Recall', render: (r) => formatMetric(r.test.recall) },
                    { key: 'f1', header: 'F1', render: (r) => formatMetric(r.test.f1) },
                  ]}
                />
              </section>
            )}

            {details.feature_importance?.length > 0 && (
              <ChartCard title="Feature importance" description="Importance reported by the selected model (top 10)">
                <BarList items={details.feature_importance.slice(0, 10).map((f) => ({ label: f.feature, value: Number((f.importance * 100).toFixed(2)), detail: `${(f.importance * 100).toFixed(1)}%` }))} />
              </ChartCard>
            )}

            {d.history?.length > 0 && (
              <section className="card" aria-label="Registered model versions">
                <div className="border-b border-line p-5"><h2 className="text-base font-semibold">Registered versions</h2></div>
                <DataTable
                  caption="Registered model versions"
                  rowKey="modelVersion"
                  rows={d.history}
                  columns={[
                    { key: 'modelVersion', header: 'Version', className: 'font-mono' },
                    { key: 'modelName', header: 'Model' },
                    { key: 'trainedAt', header: 'Trained', render: (r) => formatDateTime(r.trainedAt) },
                    { key: 'isActive', header: 'Status', render: (r) => <StatusBadge ok={r.isActive} okLabel="Active" badLabel="Previous" /> },
                  ]}
                />
              </section>
            )}
          </div>
        );
      }}
    </Async>
  );
}

/* ----------------------------------------------------------------------------------------- Activity */

function ActivityTab() {
  const state = useApi(() => api.adminActivity(30), []);
  return (
    <section className="card" aria-label="Recent platform activity">
      <Async state={state} skeleton={<TableSkeleton />}>
        {(d) =>
          d.data.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" description="Registrations, scans and feedback will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {d.data.map((a) => (
                <li key={`${a.type}-${a.refId}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink"><span className="mr-2 rounded bg-navy-700 px-1.5 py-0.5 text-xs font-semibold text-ink-soft">{ACTIVITY_LABEL[a.type] || a.type}</span>{a.summary}</p>
                    <p className="mt-0.5 text-xs text-ink-mute">{a.actor?.name} · {a.actor?.email}</p>
                  </div>
                  <time className="shrink-0 text-xs text-ink-mute" dateTime={a.at}>{formatDateTime(a.at)}</time>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </section>
  );
}

/* ----------------------------------------------------------------------------------------- Page */

export default function AdminPage() {
  usePageTitle('Admin');
  const [tab, setTab] = useState('overview');
  const panels = { overview: OverviewTab, users: UsersTab, scans: ScansTab, feedback: FeedbackTab, model: ModelTab, activity: ActivityTab };
  const Panel = panels[tab];

  return (
    <div>
      <PageHeader title="Admin dashboard" description="Platform-wide users, scans, feedback and model information. Visible to administrators only." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Admin sections" />
      <div className="mt-6" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <Panel />
      </div>
    </div>
  );
}
