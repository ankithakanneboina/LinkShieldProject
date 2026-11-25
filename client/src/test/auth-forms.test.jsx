import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import { renderPage } from './utils';

const guest = { user: null };

describe('LoginPage', () => {
  it('shows field errors and does not call the API when the form is empty', async () => {
    const login = vi.fn();
    renderPage(<LoginPage />, { auth: { ...guest, login } });
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const login = vi.fn();
    renderPage(<LoginPage />, { auth: { ...guest, login } });
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'whatever123');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('logs in with a trimmed email and goes to the dashboard', async () => {
    const login = vi.fn().mockResolvedValue({ name: 'Ada Lovelace' });
    renderPage(<LoginPage />, { auth: { ...guest, login }, stubs: { '/dashboard': 'Dashboard stub' } });
    await userEvent.type(screen.getByLabelText('Email'), '  ada@example.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('ada@example.com', 'correct-horse-1'));
    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument();
  });

  it('shows the server message when credentials are wrong', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' }));
    renderPage(<LoginPage />, { auth: { ...guest, login } });
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password-1');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });

  it('can reveal and hide the password', async () => {
    renderPage(<LoginPage />, { auth: guest });
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('RegisterPage', () => {
  const fill = async ({ name = 'Ada Lovelace', email = 'ada@example.com', password = 'a-strong-pass-1', confirm = password } = {}) => {
    await userEvent.type(screen.getByLabelText('Name'), name);
    await userEvent.type(screen.getByLabelText('Email'), email);
    await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: /^create account$/i }));
  };

  it('requires matching passwords', async () => {
    const register = vi.fn();
    renderPage(<RegisterPage />, { auth: { ...guest, register } });
    await fill({ confirm: 'something-else-1' });
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('enforces the password policy and live requirement list', async () => {
    const register = vi.fn();
    renderPage(<RegisterPage />, { auth: { ...guest, register } });
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(screen.getByText(/at least one digit/i).parentElement).toHaveTextContent(/not met yet/i);
    await fill({ password: 'short' });
    expect(await screen.findByText(/password needs: 10 to 72 characters/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects a too-short name', async () => {
    const register = vi.fn();
    renderPage(<RegisterPage />, { auth: { ...guest, register } });
    await fill({ name: 'A' });
    expect(await screen.findByText('Enter at least 2 characters.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers and navigates to the dashboard', async () => {
    const register = vi.fn().mockResolvedValue({ name: 'Ada Lovelace' });
    renderPage(<RegisterPage />, { auth: { ...guest, register }, stubs: { '/dashboard': 'Dashboard stub' } });
    await fill({});
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'a-strong-pass-1' }),
    );
    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument();
  });

  it('maps API validation details onto fields (e.g. duplicate email)', async () => {
    const register = vi.fn().mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'An account with this email already exists.',
        details: [{ field: 'email', message: 'This email is already registered.' }],
      }),
    );
    renderPage(<RegisterPage />, { auth: { ...guest, register } });
    await fill({});
    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument();
    expect(screen.getByText('This email is already registered.')).toBeInTheDocument();
  });
});
