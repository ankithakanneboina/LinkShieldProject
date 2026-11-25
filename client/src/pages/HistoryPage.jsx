import { useEffect, useState } from 'react';
import { Eye, History, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toApiError } from '../api/client';
import UrlText from '../components/scan/UrlText';
import { PredictionBadge, RiskBadge } from '../components/ui/Badges';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { SelectField } from '../components/ui/Field';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import { Skeleton } from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDateTime } from '../lib/format';

const PAGE_SIZE = 10;

export default function HistoryPage() {
  usePageTitle('Scan history');
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [prediction, setPrediction] = useState('');
  const [risk, setRisk] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Any filter change returns to the first page.
  useEffect(() => setPage(1), [search, prediction, risk, sort]);

  const { data, error, loading, reload } = useApi(
    () => api.listScans({ page, limit: PAGE_SIZE, search, prediction, risk, sort }),
    [page, search, prediction, risk, sort],
  );

  const filtersActive = Boolean(search || prediction || risk);
  const clearFilters = () => {
    setSearchInput('');
    setPrediction('');
    setRisk('');
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteScan(pendingDelete.id);
      toast.success('Scan deleted.');
      const onlyRowOnPage = data.data.length === 1 && page > 1;
      setPendingDelete(null);
      if (onlyRowOnPage) setPage(page - 1);
      else reload();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  const rows = data?.data || [];

  return (
    <div>
      <PageHeader title="Scan history" description="Every URL you have analyzed. Only you can see these scans." />

      <section className="card" aria-label="Scan history">
        <div className="grid gap-4 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] sm:p-5">
          <div>
            <label htmlFor="history-search" className="label">
              Search URLs
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
              <input
                id="history-search"
                type="search"
                className="input pl-9"
                placeholder="Part of a URL"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={200}
                autoComplete="off"
              />
            </div>
          </div>
          <SelectField
            label="Result"
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
            options={[
              { value: '', label: 'All results' },
              { value: 'phishing', label: 'Phishing' },
              { value: 'legitimate', label: 'Legitimate' },
            ]}
          />
          <SelectField
            label="Risk"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            options={[
              { value: '', label: 'All risk levels' },
              { value: 'low', label: 'Low risk' },
              { value: 'medium', label: 'Medium risk' },
              { value: 'high', label: 'High risk' },
            ]}
          />
          <SelectField
            label="Sort by date"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
          />
        </div>

        {error && !data ? (
          <div className="p-5">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <div role="status" aria-label="Loading scans" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={Search}
              title="No scans match these filters"
              description="Try a shorter search or remove a filter."
              action={
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title="No scans yet"
              description="Scans you run will be listed here so you can review, report or delete them later."
              action={
                <Link to="/scan" className="btn btn-primary">
                  Scan a URL
                </Link>
              }
            />
          )
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''} aria-busy={loading}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <caption className="sr-only">Your scans</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="th">URL</th>
                    <th scope="col" className="th">Result</th>
                    <th scope="col" className="th">Risk</th>
                    <th scope="col" className="th">Scanned</th>
                    <th scope="col" className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-navy-800/50">
                      <td className="td max-w-[22rem]">
                        <UrlText url={s.normalizedUrl} truncate />
                      </td>
                      <td className="td">
                        <PredictionBadge prediction={s.prediction} />
                      </td>
                      <td className="td">
                        <RiskBadge level={s.riskCategory} score={s.riskScore} />
                      </td>
                      <td className="td whitespace-nowrap">{formatDateTime(s.scannedAt)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Link to={`/scans/${s.id}`} className="btn btn-secondary btn-sm" aria-label={`View details for ${s.hostname}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" /> View
                          </Link>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPendingDelete(s)}
                            aria-label={`Delete scan of ${s.hostname}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={setPage} />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        danger
        title="Delete this scan?"
        message={
          pendingDelete
            ? `The scan of ${pendingDelete.hostname} and any feedback you sent for it will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete scan"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
