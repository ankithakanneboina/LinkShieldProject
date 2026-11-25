import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { ApiError } from '../api/client';
import ScannerPage from '../pages/ScannerPage';
import { legitScan, phishingScan } from './fixtures';
import { renderPage } from './utils';

vi.mock('../api', () => ({ api: { scan: vi.fn() }, authApi: {} }));

const submit = () => userEvent.click(screen.getByRole('button', { name: /analyze url/i }));
const input = () => screen.getByLabelText('URL to analyze');

describe('ScannerPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates the URL on the client and does not call the API', async () => {
    renderPage(<ScannerPage />);
    await submit();
    expect(await screen.findByText('Enter a URL to analyze.')).toBeInTheDocument();

    await userEvent.type(input(), 'javascript:alert(1)');
    await submit();
    expect(await screen.findByText('Only http and https URLs are supported.')).toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(api.scan).not.toHaveBeenCalled();
  });

  it('shows a loading state while the scan is running, and disables the input', async () => {
    api.scan.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage(<ScannerPage />);
    await userEvent.type(input(), 'example.com');
    await submit();
    expect(await screen.findByText('Analyzing the URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyzing url/i })).toBeDisabled();
    expect(input()).toBeDisabled();
  });

  it('renders the verdict, risk analysis and disclaimer for a phishing result', async () => {
    api.scan.mockResolvedValue({ scan: phishingScan });
    renderPage(<ScannerPage />);
    await userEvent.type(input(), '  paypal.com.secure-login.example.tk/verify ');
    await submit();

    await waitFor(() => expect(api.scan).toHaveBeenCalledWith('paypal.com.secure-login.example.tk/verify'));
    expect(await screen.findByText('The model classified this URL as phishing')).toBeInTheDocument();
    expect(screen.getByText('97.3%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /risk score 97 out of 100/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Risk analysis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Many subdomains' })).toBeInTheDocument();
    expect(screen.getByText(/2026\.11\.10-test0001/)).toBeInTheDocument();
    expect(screen.getAllByText(/automated risk estimate/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /open full analysis/i })).toHaveAttribute('href', `/scans/${phishingScan.id}`);
  });

  it('says so honestly when no risk factor is triggered', async () => {
    api.scan.mockResolvedValue({ scan: legitScan });
    renderPage(<ScannerPage />);
    await userEvent.type(input(), 'https://www.example.com/');
    await submit();
    expect(await screen.findByText('The model classified this URL as legitimate')).toBeInTheDocument();
    expect(screen.getByText(/does not mean the website is safe/i)).toBeInTheDocument();
  });

  it('shows a specific message when the ML service is unavailable and lets the user retry', async () => {
    api.scan
      .mockRejectedValueOnce(new ApiError({ status: 503, code: 'ML_SERVICE_UNAVAILABLE', message: 'The analysis service is not reachable.' }))
      .mockResolvedValueOnce({ scan: legitScan });
    renderPage(<ScannerPage />);
    await userEvent.type(input(), 'https://www.example.com/');
    await submit();

    expect(await screen.findByText('The analysis service is not available')).toBeInTheDocument();
    expect(screen.getByText('The analysis service is not reachable.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('The model classified this URL as legitimate')).toBeInTheDocument();
    expect(api.scan).toHaveBeenCalledTimes(2);
  });

  it('shows the server message for a rejected URL', async () => {
    api.scan.mockRejectedValue(new ApiError({ status: 400, code: 'INVALID_URL', message: 'URL has no host' }));
    renderPage(<ScannerPage />);
    await userEvent.type(input(), 'https://exa_mple');
    await submit();
    expect(await screen.findByText('The scan did not complete')).toBeInTheDocument();
    expect(screen.getByText('URL has no host')).toBeInTheDocument();
  });

  it('can reset to scan another URL', async () => {
    api.scan.mockResolvedValue({ scan: legitScan });
    renderPage(<ScannerPage />);
    await userEvent.type(input(), 'https://www.example.com/');
    await submit();
    await userEvent.click(await screen.findByRole('button', { name: /scan another url/i }));
    expect(input()).toHaveValue('');
    expect(screen.queryByText(/the model classified/i)).not.toBeInTheDocument();
  });
});
