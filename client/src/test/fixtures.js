// Test-only objects shaped like the responses documented in docs/API.md. They never appear in the running app.

export const phishingScan = {
  id: '11111111-2222-3333-4444-555555555555',
  submittedUrl: 'paypal.com.secure-login.example.tk/verify',
  normalizedUrl: 'https://paypal.com.secure-login.example.tk/verify',
  hostname: 'paypal.com.secure-login.example.tk',
  schemeAssumed: true,
  prediction: 'phishing',
  phishingProbability: 0.9731,
  riskScore: 97,
  riskCategory: 'high',
  modelName: 'random_forest',
  modelVersion: '2026.11.10-test0001',
  scannedAt: '2026-11-10T10:00:00.000Z',
  extractorVersion: '1.0',
  features: { url_length: 48, num_subdomains: 3, is_https: 1 },
  riskFactors: [
    {
      code: 'many_subdomains',
      title: 'Many subdomains',
      description: 'The host has 3 subdomain levels.',
      severity: 'high',
      feature: 'num_subdomains',
      value: 3,
      modelInfluence: 0.21,
    },
  ],
  contributions: [{ feature: 'num_subdomains', value: 3, baseline: 0, influence: 0.21 }],
  feedback: null,
};

export const legitScan = {
  ...phishingScan,
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  submittedUrl: 'https://www.example.com/',
  normalizedUrl: 'https://www.example.com/',
  hostname: 'www.example.com',
  schemeAssumed: false,
  prediction: 'legitimate',
  phishingProbability: 0.02,
  riskScore: 2,
  riskCategory: 'low',
  riskFactors: [],
  contributions: [],
};

export const emptyDashboard = {
  totals: { totalScans: 0, phishingCount: 0, legitimateCount: 0, highRiskCount: 0 },
  recentScans: [],
  dailyActivity: [],
  weeklyTrend: [],
  riskDistribution: [
    { category: 'low', count: 0 },
    { category: 'medium', count: 0 },
    { category: 'high', count: 0 },
  ],
};

export const page = (data, overrides = {}) => ({
  data,
  pagination: { page: 1, limit: 10, total: data.length, totalPages: data.length ? 1 : 0, ...overrides },
});
