import { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { toApiError } from '../api/client';
import Disclaimer from '../components/Disclaimer';
import RiskAnalysis from '../components/scan/RiskAnalysis';
import ScanVerdict from '../components/scan/ScanVerdict';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { MAX_URL_LENGTH, validateScanUrl } from '../lib/validators';

export default function ScannerPage() {
  usePageTitle('Scan a URL');
  const toast = useToast();
  const location = useLocation();

  const [url, setUrl] = useState(location.state?.url || '');
  const [fieldError, setFieldError] = useState('');
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const problem = validateScanUrl(url);
    setFieldError(problem);
    setApiError(null);
    if (problem) return;

    setLoading(true);
    setResult(null);
    try {
      const { scan } = await api.scan(url.trim());
      setResult(scan);
      toast.success('Scan complete and saved to your history.');
    } catch (err) {
      setApiError(toApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setUrl('');
    setResult(null);
    setApiError(null);
    setFieldError('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan a URL"
        description="Paste a link you are unsure about. LinkShield analyzes the text of the URL only. It never opens, visits or downloads anything from the link."
      />

      <form onSubmit={onSubmit} noValidate className="card card-pad">
        <label htmlFor="scan-url" className="label">
          URL to analyze
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="scan-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/login"
            maxLength={MAX_URL_LENGTH + 200}
            className="input font-mono"
            aria-invalid={fieldError ? 'true' : undefined}
            aria-describedby={fieldError ? 'scan-url-error' : 'scan-url-hint'}
            disabled={loading}
          />
          <Button type="submit" loading={loading} icon={Search} className="sm:w-auto sm:min-w-[10rem]">
            {loading ? 'Analyzing URL…' : 'Analyze URL'}
          </Button>
        </div>
        {fieldError ? (
          <p id="scan-url-error" role="alert" className="mt-2 text-sm font-medium text-risk-high-text">
            {fieldError}
          </p>
        ) : (
          <p id="scan-url-hint" className="mt-2 text-xs text-ink-mute">
            You can leave out https://. Only http and https links are supported.
          </p>
        )}
      </form>

      {apiError && (
        <Alert
          tone="error"
          title={apiError.code === 'ML_SERVICE_UNAVAILABLE' ? 'The analysis service is not available' : 'The scan did not complete'}
          action={
            <Button variant="secondary" size="sm" onClick={onSubmit}>
              Try again
            </Button>
          }
        >
          {apiError.message}
        </Alert>
      )}

      {loading && (
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">Analyzing the URL</span>
          <Skeleton className="h-56" />
          <Skeleton className="h-40" />
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <ScanVerdict scan={result} />
          <RiskAnalysis scan={result} showAllFeatures={false} />
          <Disclaimer />
          <div className="flex flex-wrap gap-3">
            <Link to={`/scans/${result.id}`} className="btn btn-primary">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open full analysis and report
            </Link>
            <Button variant="secondary" onClick={reset}>
              Scan another URL
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
