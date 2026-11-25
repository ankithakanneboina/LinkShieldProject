export default function StatCard({ icon: Icon, label, value, hint, accent = 'text-cyan-400' }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        {Icon && <Icon className={`h-5 w-5 ${accent}`} aria-hidden="true" />}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}
