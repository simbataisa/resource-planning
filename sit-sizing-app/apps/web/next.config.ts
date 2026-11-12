import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The Content Security Policy is set per request by proxy.ts, with a script nonce
// (threat model T-07, server/http/csp.ts). These headers apply to every response.

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS only matters behind TLS; harmless on plain-HTTP local runs.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@sit/db', '@sit/engine', '@sit/schemas', '@sit/tokens'],
  // Node-only libraries loaded at runtime, not bundled (ExcelJS: X-02 export).
  serverExternalPackages: ['pino', '@opentelemetry/sdk-node', 'exceljs'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
