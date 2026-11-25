import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-sm text-ink-soft">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>
        <span className="px-2 text-sm text-ink-soft" aria-current="page">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
