import { useState } from 'react';
import { ArrowLeft, Download, Search, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { toApiError } from '../api/client';
import Disclaimer from '../components/Disclaimer';
import FeedbackForm from '../components/scan/FeedbackForm';
import RiskAnalysis from '../components/scan/RiskAnalysis';
import ScanVerdict from '../components/scan/ScanVerdict';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { usePageTitle } from '../hooks/usePageTitle';

export default function ScanDetailsPage() {
  usePageTitle('Scan details');
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(() => api.getScan(id), [id]);

  const [feedback, setFeedback] = useState(undefined); // undefined = use what the API returned
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await api.downloadReport(id);
      toast.success('PDF report downloaded.');
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteScan(id);
      toast.success('Scan deleted.');
      navigate('/history', { replace: true });
    } catch (err) {
      toast.error(toApiError(err).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading && !data) {
    return (
      <div role="status" aria-label="Loading scan" className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error?.status === 404) {
    return (
      <div className="card">
        <EmptyState
          icon={Search}
          title="Scan not found"
          description="This scan does not exist or was deleted. You can only open scans that belong to your account."
          action={
            <Link to="/history" className="btn btn-primary">
              Back to scan history
            </Link>
          }
        />
      </div>
    );
  }
  if (error && !data) return <ErrorState error={error} onRetry={reload} title="Could not load this scan" />;

  const scan = data.scan;
  const currentFeedback = feedback === undefined ? scan.feedback : feedback;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Scan history
          </Link>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Scan details</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={download} loading={downloading}>
            Download PDF report
          </Button>
          <Link to="/scan" className="btn btn-secondary">
            <Search className="h-4 w-4" aria-hidden="true" /> Scan another
          </Link>
          <Button variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <ScanVerdict scan={scan} />
      <RiskAnalysis scan={scan} />
      <Disclaimer />
      <FeedbackForm
        key={currentFeedback?.id || 'new'}
        scanId={scan.id}
        existing={currentFeedback}
        onSaved={setFeedback}
      />

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete this scan?"
        message="The scan, its analysis and any feedback you sent for it will be permanently removed. This cannot be undone."
        confirmLabel="Delete scan"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
