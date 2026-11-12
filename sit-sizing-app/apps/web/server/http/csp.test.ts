import { describe, expect, it } from 'vitest';
import { addNonceToScripts, buildCsp, newNonce } from './csp';

describe('Content Security Policy (T-07)', () => {
  it('allows scripts only with the request nonce, without unsafe-inline', () => {
    const csp = buildCsp('abc123', { dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('adds eval and websockets only in development', () => {
    const csp = buildCsp('n', { dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws: wss:");
  });

  it('makes a new random nonce each time', () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(newNonce()).not.toBe(a);
  });

  it('puts the nonce on script tags that do not have one', () => {
    const html = '<script>x()</script><script src="/a.js"></script><script nonce="k">y()</script>';
    expect(addNonceToScripts(html, 'N')).toBe(
      '<script nonce="N">x()</script><script nonce="N" src="/a.js"></script><script nonce="k">y()</script>',
    );
  });
});
