/**
 * URL validation and normalisation. Mirrors ml-service/linkshield_ml/features.py `normalize_url` so the backend and
 * the ML service always agree on what an acceptable URL is.
 *
 * SECURITY: nothing in LinkShield ever fetches, resolves or connects to a submitted URL. It is treated purely as text.
 * That is the primary SSRF defence; the rules below additionally reject non-http(s) schemes (javascript:, data:,
 * file:, ftp:, ...), whitespace/control characters and unparsable input so that the string stored and displayed is
 * always a well-formed web URL.
 */
export const MAX_URL_LENGTH = 2048;

const HAS_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const SCHEME_NO_SLASHES = /^[A-Za-z][A-Za-z0-9+.-]*:(?!\/\/)/;
const HOST_PORT = /^[^/?#:@]+:\d+(?:[/?#]|$)/;
// eslint-disable-next-line no-control-regex
const SPACE_OR_CONTROL = /[\s\u0000-\u001f\u007f]/;

export class InvalidUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUrlError';
  }
}

/** @returns {{ normalizedUrl: string, schemeAssumed: boolean, hostname: string }} */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') throw new InvalidUrlError('URL must be a string');
  let s = raw.trim();
  if (!s) throw new InvalidUrlError('URL is empty');
  if (s.length > MAX_URL_LENGTH) throw new InvalidUrlError(`URL is longer than ${MAX_URL_LENGTH} characters`);
  if (SPACE_OR_CONTROL.test(s)) throw new InvalidUrlError('URL must not contain whitespace or control characters');

  let schemeAssumed = false;
  if (!HAS_SCHEME.test(s)) {
    // "javascript:...", "mailto:..." have a scheme but no "//"; "host:8080/x" is a host plus port.
    if (SCHEME_NO_SLASHES.test(s) && !HOST_PORT.test(s)) throw new InvalidUrlError('Only http and https URLs are supported');
    if (s.startsWith('//')) s = s.slice(2);
    s = `https://${s}`;
    schemeAssumed = true;
  }

  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    throw new InvalidUrlError('URL could not be parsed');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new InvalidUrlError('Only http and https URLs are supported');
  if (!parsed.hostname) throw new InvalidUrlError('URL has no host');

  // `hostname` is for display and grouping only (IPv6 hosts keep their brackets); it is never resolved or connected to.
  return { normalizedUrl: s, schemeAssumed, hostname: parsed.hostname.toLowerCase().slice(0, 255) };
}
