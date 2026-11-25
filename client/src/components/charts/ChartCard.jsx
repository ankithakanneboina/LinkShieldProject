import { useId, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

/**
 * Card wrapper for a chart. Every chart can be switched to a plain table of the same numbers
 * (accessibility: no information lives only in colour or shape).
 * table: { columns: [{ key, header }], rows: [...] }
 */
export default function ChartCard({ title, description, table, children, className = '', legend }) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const hasRows = table && table.rows && table.rows.length > 0;

  return (
    <section aria-labelledby={titleId} className={`card card-pad ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-ink-mute">{description}</p>}
        </div>
        {hasRows && (
          <button type="button" onClick={() => setAsTable((v) => !v)} className="btn btn-ghost btn-sm shrink-0" aria-pressed={asTable}>
            {asTable ? <BarChart3 className="h-4 w-4" aria-hidden="true" /> : <Table2 className="h-4 w-4" aria-hidden="true" />}
            {asTable ? 'View chart' : 'View table'}
          </button>
        )}
      </div>

      {!asTable && legend && <div className="mt-3">{legend}</div>}

      <div className="mt-4">
        {asTable && hasRows ? (
          <div className="max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-navy-800">
                <tr>
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col" className="th">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {table.columns.map((c) => (
                      <td key={c.key} className="td tabular-nums">
                        {row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
