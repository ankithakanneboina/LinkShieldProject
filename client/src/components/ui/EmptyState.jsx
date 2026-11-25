export default function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-navy-800 text-cyan-400">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
