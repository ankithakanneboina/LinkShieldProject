import { useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toApiError } from '../api/client';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import { PasswordField, TextField } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { passwordChecks, validateEmail, validateName, validatePassword } from '../lib/validators';

export default function RegisterPage() {
  usePageTitle('Create account');
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const checks = passwordChecks(form.password);

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? 'The passwords do not match.' : '',
    };
    setErrors(next);
    setSubmitError('');
    if (Object.values(next).some(Boolean)) return;

    setLoading(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success('Account created. You are logged in.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      // Show field-level messages from the API (docs/API.md `details`) next to the matching inputs.
      if (apiError.details?.length) {
        const fieldErrors = {};
        apiError.details.forEach((d) => {
          if (d.field === 'password' || d.field === 'email' || d.field === 'name') fieldErrors[d.field] = d.message;
        });
        setErrors(fieldErrors);
      }
      setSubmitError(apiError.message);
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-2 text-sm text-ink-soft">Save every scan, see your trends and download PDF reports.</p>

      <form onSubmit={onSubmit} noValidate className="card card-pad mt-8 space-y-5">
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <TextField label="Name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          placeholder="you@example.com"
        />
        <div>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
          />
          <ul className="mt-2 space-y-1" aria-label="Password requirements">
            {checks.map((c) => (
              <li key={c.id} className={`flex items-center gap-2 text-xs ${c.ok ? 'text-risk-low-text' : 'text-ink-mute'}`}>
                {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                {c.label}
                <span className="sr-only">{c.ok ? ' (met)' : ' (not met yet)'}</span>
              </li>
            ))}
          </ul>
        </div>
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" loading={loading} className="w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-cyan-400 hover:text-cyan-300">
          Log in
        </Link>
      </p>
    </div>
  );
}
