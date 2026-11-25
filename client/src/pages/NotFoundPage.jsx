import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-sm text-cyan-400">404</p>
      <h1 className="mt-2 text-3xl font-bold">This page does not exist</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        The link may be mistyped or the page may have moved. Ironically, that is a good habit to apply to any link you
        receive.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn btn-secondary">
          Go to the home page
        </Link>
        <Link to="/dashboard" className="btn btn-primary">
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
