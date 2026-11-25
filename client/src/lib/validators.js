// Client-side checks mirror docs/API.md so users get instant feedback.
// The backend remains the authority and re-validates everything.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):\/\//i;
const SCHEME_NO_SLASHES_RE = /^[a-z][a-z0-9+.-]*:(?!\/\/)/i;
const HOST_PORT_RE = /^[^/?#:@]+:\d+(?:[/?#]|$)/;
// eslint-disable-next-line no-control-regex
const SPACE_OR_CONTROL_RE = /[\s\u0000-\u001f\u007f]/;

export const MAX_URL_LENGTH = 2048;

export function validateEmail(value) {
  const v = (value || '').trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address.';
  return '';
}

export function validateName(value) {
  const v = (value || '').trim();
  if (v.length < 2) return 'Enter at least 2 characters.';
  if (v.length > 60) return 'Use 60 characters or fewer.';
  return '';
}

export function passwordChecks(value) {
  const v = value || '';
  return [
    { id: 'length', label: '10 to 72 characters', ok: v.length >= 10 && v.length <= 72 },
    { id: 'letter', label: 'At least one letter', ok: /[A-Za-z]/.test(v) },
    { id: 'digit', label: 'At least one digit', ok: /\d/.test(v) },
  ];
}

export function validatePassword(value) {
  if (!value) return 'Enter a password.';
  const failed = passwordChecks(value).find((c) => !c.ok);
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : '';
}

/** Returns an error message, or '' when the URL is acceptable to submit. */
export function validateScanUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return 'Enter a URL to analyze.';
  if (s.length > MAX_URL_LENGTH) return `URLs can be at most ${MAX_URL_LENGTH} characters.`;
  if (SPACE_OR_CONTROL_RE.test(s)) return 'The URL must not contain spaces or control characters.';

  let candidate = s;
  const scheme = SCHEME_RE.exec(s);
  if (scheme) {
    if (!['http', 'https'].includes(scheme[1].toLowerCase())) return 'Only http and https URLs are supported.';
  } else {
    if (SCHEME_NO_SLASHES_RE.test(s) && !HOST_PORT_RE.test(s)) return 'Only http and https URLs are supported.';
    candidate = `https://${s.startsWith('//') ? s.slice(2) : s}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return 'The URL needs a host name, for example example.com.';
  } catch {
    return 'That does not look like a valid URL.';
  }
  return '';
}
