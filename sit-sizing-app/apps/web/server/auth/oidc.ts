import * as client from 'openid-client';
import { getEnv } from '../env';

/**
 * OIDC relying party (design 10.3, ADR-0004) on openid-client, an OpenID Certified library.
 * Authorization code flow with PKCE (S256), state and nonce; confidential client.
 */
export const SCOPES = 'openid profile email';

export function oidcConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_SECRET && env.SESSION_SECRET);
}

/**
 * In compose the browser reaches Keycloak at localhost:8080 but the web container at
 * keycloak:8080. Server-side calls to the public origin are sent to the internal one;
 * the issuer and every URL the browser sees stay unchanged.
 */
export function rewriteToInternal(
  url: string,
  publicIssuer: string,
  internalBase: string | undefined,
): string {
  if (!internalBase) return url;
  const from = new URL(publicIssuer).origin;
  if (!url.startsWith(from)) return url;
  return new URL(internalBase).origin + url.slice(from.length);
}

let configPromise: Promise<client.Configuration> | undefined;

export function oidcConfig(): Promise<client.Configuration> {
  const env = getEnv();
  if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_SECRET) throw new Error('OIDC is not configured');
  const issuer = env.OIDC_ISSUER;
  if (configPromise) return configPromise;
  const pending = client
    .discovery(new URL(issuer), env.OIDC_CLIENT_ID, env.OIDC_CLIENT_SECRET, undefined, {
      execute: issuer.startsWith('http://') ? [client.allowInsecureRequests] : [],
      // CustomFetchOptions is a subset of RequestInit; the cast only bridges the body typing.
      [client.customFetch]: (url, options) =>
        fetch(rewriteToInternal(url, issuer, env.OIDC_INTERNAL_URL), options as RequestInit),
    })
    .catch((err: unknown) => {
      configPromise = undefined; // retry discovery on the next request
      throw err;
    });
  configPromise = pending;
  return pending;
}

/** Redirect URI registered in the realm: built from APP_BASE_URL, never from the request host. */
export function callbackUrl(search = ''): URL {
  return new URL(`/api/auth/callback${search}`, getEnv().APP_BASE_URL);
}

export { client };
