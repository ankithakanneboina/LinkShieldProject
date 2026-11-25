import { http, toApiError } from './client';

const data = (res) => res.data;

/** Drops empty values so they are not sent as `?search=`. */
function clean(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
}

export const authApi = {
  register: (body) => http.post('/auth/register', body).then(data),
  login: (body) => http.post('/auth/login', body).then(data),
  logout: () => http.post('/auth/logout').then(() => undefined),
  profile: () => http.get('/auth/profile').then(data),
  updateProfile: (body) => http.patch('/auth/profile', body).then(data),
  changePassword: (body) => http.post('/auth/change-password', body).then(() => undefined),
};

async function downloadReport(id) {
  const res = await http.get(`/reports/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `linkshield-report-${String(id).slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  // scanning
  scan: (url) => http.post('/scan', { url }).then(data),
  listScans: (params) => http.get('/scans', { params: clean(params) }).then(data),
  getScan: (id) => http.get(`/scans/${encodeURIComponent(id)}`).then(data),
  deleteScan: (id) => http.delete(`/scans/${encodeURIComponent(id)}`).then(() => undefined),
  downloadReport,

  // dashboard / analytics
  getDashboard: () => http.get('/dashboard').then(data),
  getAnalytics: (range) => http.get('/analytics', { params: { range } }).then(data),

  // feedback
  submitFeedback: (body) => http.post('/feedback', body).then(data),

  // admin
  adminUsers: (params) => http.get('/admin/users', { params: clean(params) }).then(data),
  adminScans: (params) => http.get('/admin/scans', { params: clean(params) }).then(data),
  adminAnalytics: (range) => http.get('/admin/analytics', { params: { range } }).then(data),
  adminFeedback: (params) => http.get('/admin/feedback', { params: clean(params) }).then(data),
  adminModel: () => http.get('/admin/model').then(data),
  adminActivity: (limit = 20) => http.get('/admin/activity', { params: { limit } }).then(data),

  health: () => http.get('/health').then(data),
};

export { toApiError };
