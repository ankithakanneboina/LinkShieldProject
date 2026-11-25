import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidUrlError, normalizeUrl } from '../src/utils/url.js';

describe('normalizeUrl (text-only validation; nothing is ever fetched)', () => {
  it('assumes https when the scheme is missing', () => {
    assert.deepEqual(normalizeUrl('example.com/a?b=1'), { normalizedUrl: 'https://example.com/a?b=1', schemeAssumed: true, hostname: 'example.com' });
  });

  it('keeps an explicit scheme, trims whitespace and lowercases the hostname', () => {
    const r = normalizeUrl('  HTTP://WWW.Example.COM/Path  ');
    assert.equal(r.normalizedUrl, 'HTTP://WWW.Example.COM/Path');
    assert.equal(r.hostname, 'www.example.com');
    assert.equal(r.schemeAssumed, false);
  });

  it('treats "host:port/path" as a host, not as a scheme', () => {
    assert.equal(normalizeUrl('example.com:8080/x').normalizedUrl, 'https://example.com:8080/x');
  });

  it('accepts IP-address hosts (they are classified, never connected to)', () => {
    assert.equal(normalizeUrl('http://192.168.0.1:8080/login').hostname, '192.168.0.1');
    assert.equal(normalizeUrl('http://[::1]/x').hostname, '[::1]');
  });

  for (const bad of [
    '',
    '   ',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'gopher://example.com',
    'mailto:a@b.com',
    'http://',
    'https://',
    'http://exa mple.com',
    'http://example.com/\nHost: evil',
    'https://example.com:99999',
    'a'.repeat(2049),
  ]) {
    it(`rejects ${JSON.stringify(bad.slice(0, 40))}`, () => {
      assert.throws(() => normalizeUrl(bad), InvalidUrlError);
    });
  }

  it('rejects non-string input', () => {
    for (const v of [null, undefined, 5, {}, []]) assert.throws(() => normalizeUrl(v), InvalidUrlError);
  });

  it('accepts exactly the maximum length', () => {
    const url = `https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}`;
    assert.equal(url.length, 2048);
    assert.equal(normalizeUrl(url).normalizedUrl, url);
  });
});
