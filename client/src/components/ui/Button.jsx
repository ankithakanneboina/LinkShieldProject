import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

export default function Button({
  variant = 'primary',
  size,
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn ${VARIANTS[variant]} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
