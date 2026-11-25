import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

function FieldShell({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-risk-high-text">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ label, error, hint, id, className = '', ...input }) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <input
        id={fieldId}
        className={`input ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...input}
      />
    </FieldShell>
  );
}

export function PasswordField({ label, error, hint, id, ...input }) {
  const auto = useId();
  const fieldId = id || auto;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className="input pr-11"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-mute hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  );
}

export function SelectField({ label, error, hint, id, options, className = '', ...select }) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <select
        id={fieldId}
        className={`input ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...select}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, id, ...area }) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <textarea
        id={fieldId}
        className="input min-h-[96px] resize-y"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...area}
      />
    </FieldShell>
  );
}
