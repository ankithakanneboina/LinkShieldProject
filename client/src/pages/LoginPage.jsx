import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toApiError } from '../api/client';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import { PasswordField, TextField } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { validateEmail } from '../lib/validators';

export default function LoginPage() {
  usePageTitle('Log in');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = {
      email: validateEmail(form.email),
      password: form.password ? '' : 'Enter your password.',
    };
    setErrors(next);
    setSubmitError('');
    if (next.email || next.password) return;

    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      navigate(from?.pathname ? `${from.pathname}${from.search || ''}` : '/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(toApiError(err).message);
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold">Log in to LinkShield</h1>
      <p className="mt-2 text-sm text-ink-soft">Pick up where you left off and check your scan history.</p>

      <form onSubmit={onSubmit} noValidate className="card card-pad mt-8 space-y-5">
        {submitError && <Alert tone="error">{submitError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          placeholder="you@example.com"
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
        />
        <Button type="submit" loading={loading} className="w-full">
          {loading ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        New to LinkShield?{' '}
        <Link to="/register" className="font-medium text-cyan-400 hover:text-cyan-300">
          Create an account
        </Link>
      </p>
    </div>
  );
}
