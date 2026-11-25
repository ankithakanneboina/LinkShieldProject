import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import HistoryPage from '../pages/HistoryPage';
import { legitScan, page, phishingScan } from './fixtures';
import { renderPage } from './utils';

vi.mock('../api', () => ({ api: { listScans: vi.fn(), deleteScan: vi.fn() }, authApi: {} }));

describe('HistoryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an empty state for a new user', async () => {
    api.listScans.mockResolvedValue(page([]));
    renderPage(<HistoryPage />);
    expect(await screen.findByText('No scans yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /scan a url/i })).toHaveAttribute('href', '/scan');
  });

  it('shows a loading state, then the user\'s scans with working detail links', async () => {
    let resolve;
    api.listScans.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage(<HistoryPage />);
    expect(screen.getByRole('status', { name: 'Loading scans' })).toBeInTheDocument();

    resolve(page([phishingScan, legitScan]));
    expect(await screen.findByRole('link', { name: /view details for www\.example\.com/i })).toHaveAttribute(
      'href',
      `/scans/${legitScan.id}`,
    );
    expect(screen.getAllByText('Phishing').length).toBeGreaterThan(0);
  });

  it('passes search, filters and sort to the API and resets to page 1', async () => {
    api.listScans.mockResolvedValue(page([phishingScan], { total: 25, totalPages: 3, page: 2 }));
    renderPage(<HistoryPage />);
    await screen.findByRole('navigation', { name: 'Pagination' });

    await userEvent.selectOptions(screen.getByLabelText('Result'), 'phishing');
    await userEvent.selectOptions(screen.getByLabelText('Risk'), 'high');
    await userEvent.selectOptions(screen.getByLabelText('Sort by date'), 'oldest');
    await userEvent.type(screen.getByLabelText('Search URLs'), 'paypal');

    await waitFor(() =>
      expect(api.listScans).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        search: 'paypal',
        prediction: 'phishing',
        risk: 'high',
        sort: 'oldest',
      }),
    );
  });

  it('shows a "no matches" state with a working Clear filters button', async () => {
    api.listScans.mockResolvedValue(page([]));
    renderPage(<HistoryPage />);
    await screen.findByText('No scans yet');
    await userEvent.selectOptions(screen.getByLabelText('Result'), 'phishing');
    expect(await screen.findByText('No scans match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Result')).toHaveValue('');
  });

  it('asks for confirmation before deleting, and deleting calls the API', async () => {
    api.listScans.mockResolvedValue(page([phishingScan, legitScan]));
    api.deleteScan.mockResolvedValue(undefined);
    renderPage(<HistoryPage />);

    await userEvent.click(await screen.findByRole('button', { name: /delete scan of www\.example\.com/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Delete this scan?')).toBeInTheDocument();
    expect(api.deleteScan).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete scan' }));
    await waitFor(() => expect(api.deleteScan).toHaveBeenCalledWith(legitScan.id));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.listScans).toHaveBeenCalledTimes(2); // list is reloaded after deleting
  });

  it('cancelling the dialog deletes nothing', async () => {
    api.listScans.mockResolvedValue(page([phishingScan]));
    renderPage(<HistoryPage />);
    await userEvent.click(await screen.findByRole('button', { name: /delete scan of/i }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.deleteScan).not.toHaveBeenCalled();
  });

  it('shows an error state with a retry button when the API fails', async () => {
    api.listScans.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([]));
    renderPage(<HistoryPage />);
    const retry = await screen.findByRole('button', { name: /try again|retry/i });
    await userEvent.click(retry);
    expect(await screen.findByText('No scans yet')).toBeInTheDocument();
  });
});
