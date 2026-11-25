import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { toApiError } from '../api/client';
import { RoleBadge } from '../components/ui/Badges';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import { PasswordField, TextField } from '../components/ui/Field';
import PageHeader from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApi } from '../hooks/useApi';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { passwordChecks, validateName, validatePassword } from '../lib/validators';

function NameForm({ profile, onSaved }) {
  const toast = useToast();
  const { setUser } = useAuth();
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateName(name);
    setError(problem);
    setApiError('');
    if (problem) return;
    setSaving(true);
    try {
      const { user } = await authApi.updateProfile({ name: name.trim() });
      setUser((u) => ({ ...u, ...user }));
      onSaved(user);
      toast.success('Profile updated.');
    } catch (err) {
      setApiError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card card-pad space-y-5">
      <h2 className="text-lg font-semibold">Your details</h2>
      {apiError && <Alert tone="error">{apiError}</Alert>}
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} autoComplete="name" />
      <TextField label="Email" value={profile.email} readOnly disabled hint="Your email address identifies your account and cannot be changed here." />
      <Button type="submit" loading={saving} disabled={name.trim() === profile.name}>
        Save changes
      </Button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      current: form.current ? '' : 'Enter your current password.',
      next: validatePassword(form.next),
      confirm: form.confirm !== form.next ? 'The passwords do not match.' : '',
    };
    setErrors(next);
    setApiError('');
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: form.current, newPassword: form.next });
      // The server revokes every session on a password change, so sign in again.
      await logout();
      toast.success('Password changed. Log in again with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      const apiErr = toApiError(err);
      if (apiErr.code === 'INVALID_CREDENTIALS') setErrors({ current: 'That is not your current password.' });
      else setApiError(apiErr.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="card card-pad space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-ink-soft">You will be logged out on every device and asked to log in again.</p>
      </div>
      {apiError && <Alert tone="error">{apiError}</Alert>}
      <PasswordField label="Current password" autoComplete="current-password" value={form.current} onChange={set('current')} error={errors.current} />
      <div>
        <PasswordField label="New password" autoComplete="new-password" value={form.next} onChange={set('next')} error={errors.next} />
        <ul className="mt-2 space-y-1" aria-label="Password requirements">
          {passwordChecks(form.next).map((c) => (
            <li key={c.id} className={`text-xs ${c.ok ? 'text-risk-low-text' : 'text-ink-mute'}`}>
              {c.ok ? '✓' : '○'} {c.label}
            </li>
          ))}
        </ul>
      </div>
      <PasswordField label="Confirm new password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
      <Button type="submit" variant="secondary" loading={saving}>
        Change password
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  usePageTitle('Profile');
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => authApi.profile(), []);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (data?.user) setProfile(data.user);
  }, [data]);

  const signOut = async () => {
    await logout();
    toast.info('You have been logged out.');
    navigate('/login', { replace: true });
  };

  if (loading && !profile) {
    return (
      <>
        <PageHeader title="Profile" />
        <div role="status" aria-label="Loading profile" className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </>
    );
  }
  if (error && !profile) {
    return (
      <>
        <PageHeader title="Profile" />
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }
  if (!profile) return null;

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your account details and password."
        actions={
          <Button variant="secondary" icon={LogOut} onClick={signOut}>
            Log out
          </Button>
        }
      />
      <div className="space-y-6">
        <section aria-label="Account summary" className="card card-pad">
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-mute">Role</dt>
              <dd className="mt-1">
                <RoleBadge role={profile.role} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Total scans</dt>
              <dd className="mt-1 font-display text-xl font-bold tabular-nums">{formatNumber(profile.scanCount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Member since</dt>
              <dd className="mt-1 text-sm">{formatDate(profile.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-mute">Last login</dt>
              <dd className="mt-1 text-sm">{formatDateTime(profile.lastLoginAt)}</dd>
            </div>
          </dl>
        </section>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <NameForm profile={profile} onSaved={(u) => setProfile((p) => ({ ...p, ...u }))} />
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
