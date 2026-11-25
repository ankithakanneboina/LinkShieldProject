export const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export default function RangeSelector({ value, onChange }) {
  return (
    <div role="group" aria-label="Time range" className="inline-flex rounded-lg border border-line bg-navy-900 p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          aria-pressed={value === r.value}
          onClick={() => onChange(r.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === r.value ? 'bg-navy-700 text-ink shadow-glow' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
