export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** 'YYYY-MM-DD' (a UTC calendar day from the API) → 'Nov 10'. Parsed as UTC so the day never shifts. */
export function formatDayLabel(day) {
  if (!day) return '';
  const d = new Date(`${String(day).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatNumber(n) {
  return typeof n === 'number' ? n.toLocaleString() : '—';
}

/** 0.9731 → '97.3%' */
export function formatPercent(fraction, digits = 1) {
  if (typeof fraction !== 'number' || Number.isNaN(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatMetric(value, digits = 4) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

export function shortId(id) {
  return id ? String(id).slice(0, 8) : '';
}

export function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || '';
}

export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function formatFeatureValue(key, value, booleanKeys) {
  if (booleanKeys.has(key)) return value ? 'Yes' : 'No';
  if (typeof value !== 'number') return String(value ?? '—');
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}
