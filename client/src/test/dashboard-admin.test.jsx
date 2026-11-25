import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import AdminPage from '../pages/AdminPage';
import DashboardPage from '../pages/DashboardPage';
import { emptyDashboard, legitScan, phishingScan } from './fixtures';
import { adminUser, renderPage } from './utils';

vi.mock('../api', () => ({
  api: { getDashboard: vi.fn(), adminAnalytics: vi.fn(), adminModel: vi.fn(), adminUsers: vi.fn() },
  authApi: {},
}));

describe('DashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows an empty state for a user with no scans', async () => {
    api.getDashboard.mockResolvedValue(emptyDashboard);
    renderPage(<DashboardPage />);
    expect(await screen.findByText('No scans yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan your first URL' })).toHaveAttribute('href', '/scan');
    expect(screen.queryByText('Total scans')).not.toBeInTheDocument();
  });

  it('renders totals and latest scans exactly as returned by the API', async () => {
    api.getDashboard.mockResolvedValue({
      totals: { totalScans: 12, phishingCount: 5, legitimateCount: 7, highRiskCount: 4 },
      recentScans: [phishingScan, legitScan],
      dailyActivity: [{ date: '2026-11-10', total: 3, phishing: 1, legitimate: 2 }],
      weeklyTrend: [{ weekStart: '2026-11-09', total: 7, phishing: 3, legitimate: 4 }],
      riskDistribution: [
        { category: 'low', count: 6 },
        { category: 'medium', count: 2 },
        { category: 'high', count: 4 },
      ],
    });
    renderPage(<DashboardPage />);
    expect(await screen.findByText('Total scans')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('High-risk scans')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /www\.example\.com/ })).toHaveAttribute('href', `/scans/${legitScan.id}`);
  });

  it('validates the quick-scan box before navigating', async () => {
    api.getDashboard.mockResolvedValue({ ...emptyDashboard, totals: { ...emptyDashboard.totals, totalScans: 1 } });
    renderPage(<DashboardPage />, { stubs: { '/scan': 'Scanner stub' } });
    await userEvent.click(await screen.findByRole('button', { name: /continue to scanner/i }));
    expect(await screen.findByText('Enter a URL to analyze.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Quick scan'), 'example.com');
    await userEvent.click(screen.getByRole('button', { name: /continue to scanner/i }));
    expect(await screen.findByText('Scanner stub')).toBeInTheDocument();
  });
});

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.adminAnalytics.mockReturnValue(new Promise(() => {}));
  });

  it('is organised into tabs and starts on the overview', () => {
    renderPage(<AdminPage />, { auth: { user: adminUser } });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Overview', 'Users', 'Scans', 'Feedback', 'Model', 'Activity']);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(api.adminAnalytics).toHaveBeenCalled();
  });

  it('says plainly that no model exists instead of showing made-up metrics', async () => {
    api.adminModel.mockResolvedValue({ service: { status: 'model_not_loaded' }, active: null, history: [] });
    renderPage(<AdminPage />, { auth: { user: adminUser } });
    await userEvent.click(screen.getByRole('tab', { name: 'Model' }));
    expect(await screen.findByText('No model has been trained yet')).toBeInTheDocument();
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
  });

  it('lists users from the API on the Users tab', async () => {
    api.adminUsers.mockResolvedValue({
      data: [
        { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'user', isActive: true, createdAt: '2026-11-01T00:00:00Z', lastLoginAt: null, scanCount: 4 },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    renderPage(<AdminPage />, { auth: { user: adminUser } });
    await userEvent.click(screen.getByRole('tab', { name: 'Users' }));
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
