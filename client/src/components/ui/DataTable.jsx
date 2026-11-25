/** Simple responsive table. columns: [{ key, header, render?(row), className? }] */
export default function DataTable({ columns, rows, rowKey = 'id', caption }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.key} scope="col" className="th">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row[rowKey]} className="hover:bg-navy-800/50">
              {columns.map((c) => (
                <td key={c.key} className={`td ${c.className || ''}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
