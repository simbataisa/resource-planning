import { ApiReference, type ApiReferenceConfiguration } from '@scalar/nextjs-api-reference';
import { api } from '@/server/http/authed';
import { addNonceToScripts } from '@/server/http/csp';

export const dynamic = 'force-dynamic';

/**
 * Scalar API Reference, self-hosted (design 9.4, ADR-0003):
 * - the Scalar bundle is served from this app (`public/vendor/scalar`, copied at build), not a CDN;
 * - no Scalar fonts, telemetry, proxy, AI agent or hosted tools: "try it" calls go to this origin
 *   with the user's own session;
 * - behind sign-in like every other /api/v1 route.
 */
const config = {
  url: '/api/v1/openapi.json',
  cdn: '/vendor/scalar/standalone.js',
  pageTitle: 'SIT Sizing API',
  // Keep everything inside the bank's network (ADR-0003, threat model T-10):
  withDefaultFonts: false, // no fonts.scalar.com
  telemetry: false, // Scalar's telemetry is on by default
  showDeveloperTools: 'never', // hides the toolbar with Share / Generate SDK / Deploy (scalar.com services)
  hideClientButton: true, // hides "Open API Client" (client.scalar.com)
  agent: { disabled: true }, // hides "Ask AI Agent"
  mcp: { disabled: true },
};
// Cast: option names are checked in the ADR-0003 spike against the installed Scalar version.
const render = ApiReference(config as Partial<ApiReferenceConfiguration>) as (
  request?: Request,
) => Response | Promise<Response>;

/** Scalar's page has an inline config script: give it this request's CSP nonce (T-07). */
export const GET = api(async (request) => {
  const page = await render(request);
  const nonce = request.headers.get('x-nonce');
  if (!nonce) return page;
  const headers = new Headers(page.headers);
  headers.delete('content-length');
  return new Response(addNonceToScripts(await page.text(), nonce), {
    status: page.status,
    headers,
  });
});
