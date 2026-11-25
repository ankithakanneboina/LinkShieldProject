import { describe, expect, it } from 'vitest';
import { validateEmail, validateName, validatePassword, validateScanUrl } from '../lib/validators';

describe('validateScanUrl', () => {
  it.each(['example.com', 'https://example.com/a?b=1', 'http://192.168.0.1:8080/login', 'example.com:8080/x', 'bit.ly/abc'])(
    'accepts %s',
    (url) => expect(validateScanUrl(url)).toBe(''),
  );

  it.each([
    ['', /enter a url/i],
    ['   ', /enter a url/i],
    ['javascript:alert(1)', /only http and https/i],
    ['ftp://example.com', /only http and https/i],
    ['http://exa mple.com', /spaces/i],
    ['https://', /./],
    ['a'.repeat(2100), /at most 2048/i],
  ])('rejects %s', (url, message) => expect(validateScanUrl(url)).toMatch(message));
});

describe('account field validators', () => {
  it('validates email', () => {
    expect(validateEmail('')).toMatch(/enter your email/i);
    expect(validateEmail('nope')).toMatch(/valid email/i);
    expect(validateEmail('ada@example.com')).toBe('');
  });

  it('validates name length', () => {
    expect(validateName('A')).toMatch(/at least 2/i);
    expect(validateName('A'.repeat(61))).toMatch(/60/);
    expect(validateName('Ada')).toBe('');
  });

  it('enforces the password policy from the API docs', () => {
    expect(validatePassword('')).toMatch(/enter a password/i);
    expect(validatePassword('short1')).toMatch(/10 to 72/i);
    expect(validatePassword('allletterspassword')).toMatch(/digit/i);
    expect(validatePassword('1234567890123')).toMatch(/letter/i);
    expect(validatePassword('a-strong-pass-1')).toBe('');
  });
});
