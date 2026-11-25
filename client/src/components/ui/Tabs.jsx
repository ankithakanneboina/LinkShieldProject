import { useRef } from 'react';

/** Accessible tab list (roving focus with arrow keys). Panels are rendered by the caller. */
export default function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const refs = useRef({});

  const onKeyDown = (e, index) => {
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[tabs[next].id]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-navy-900/70 p-1">
      {tabs.map((t, i) => {
        const selected = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              selected ? 'bg-navy-700 text-ink shadow-glow' : 'text-ink-soft hover:bg-navy-800 hover:text-ink'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
