export default function Logo({ className = '', withText = true }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id="ls-logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#3987e5" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.5 4.5 6.8v8.2c0 7.1 4.8 12.2 11.5 14.5 6.7-2.3 11.5-7.4 11.5-14.5V6.8L16 2.5Z"
          fill="url(#ls-logo-g)"
        />
        <path
          d="M13.2 18.2a3.3 3.3 0 0 1 0-4.7l2-2a3.3 3.3 0 0 1 4.7 0M18.8 13.8a3.3 3.3 0 0 1 0 4.7l-2 2a3.3 3.3 0 0 1-4.7 0"
          fill="none"
          stroke="#0a1128"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {withText && <span className="font-display text-lg font-bold tracking-tight text-ink">LinkShield</span>}
    </span>
  );
}
