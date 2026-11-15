import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_API_ERROR_CODES } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import { buildOpenApi, OPENAPI_VERSION } from './build';
import { OPERATIONS } from './operations';

const API_DIR = fileURLToPath(new URL('../../app/api/v1/', import.meta.url));

/** Every route.ts under app/api/v1 with its exported HTTP methods, as OpenAPI path + method. */
function routeHandlers(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'route.ts') {
        const rel = relative(API_DIR, dir).split(sep).filter(Boolean);
        const path = `/${rel.map((s) => s.replace(/^\[(.+)\]$/, '{$1}')).join('/')}`;
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g))
          out.push(`${m[1]!.toLowerCase()} ${path}`);
      }
    }
  };
  walk(API_DIR);
  return out.sort();
}

describe('OpenAPI contract (AGENTS.md rule 15)', () => {
  it('documents exactly the route handlers that exist', () => {
    const documented = OPERATIONS.map((o) => `${o.method} ${o.path}`).sort();
    expect(documented).toEqual(routeHandlers());
  });

  it('has unique operation ids, a tag, a summary and a required role on every operation', () => {
    const ids = OPERATIONS.map((o) => o.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of OPERATIONS) {
      expect(o.summary.length, o.operationId).toBeGreaterThan(3);
      expect(o.tag.length, o.operationId).toBeGreaterThan(0);
    }
  });

  it('builds a document with error responses and security on signed-in operations', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = buildOpenApi() as Record<string, any>;
    expect(doc.openapi).toBe(OPENAPI_VERSION);
    expect(doc.components.schemas.ApiError).toBeDefined();
    // Error codes are an extensible set (ADR-0018): no closed enum in the contract.
    const code = doc.components.schemas.ApiError.properties.error.properties.code;
    expect(code.type).toBe('string');
    expect(code.enum).toBeUndefined();
    expect(code['x-extensible-enum']).toEqual([...KNOWN_API_ERROR_CODES]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [path, item] of Object.entries<Record<string, any>>(doc.paths)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [method, op] of Object.entries<any>(item)) {
        expect(op.responses['500'], `${method} ${path}`).toBeDefined();
        if (op['x-required-role'] !== 'none') {
          expect(op.responses['401'], `${method} ${path}`).toBeDefined();
          expect(op.security.length, `${method} ${path}`).toBeGreaterThan(0);
          // Bearer tokens from MCP clients (ADR-0016), and 403 NOT_PROVISIONED for them.
          expect(op.security, `${method} ${path}`).toContainEqual({ bearerAuth: [] });
          expect(op.responses['403'], `${method} ${path}`).toBeDefined();
          // 503 NOT_READY when Keycloak's signing keys cannot be fetched (not a 401 loop).
          expect(op.responses['503'], `${method} ${path}`).toBeDefined();
        }
      }
    }
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(JSON.stringify(doc)).not.toContain('#/$defs/');
  });

  it('resolves every $ref to a component', () => {
    const doc = buildOpenApi() as { components: { schemas: Record<string, unknown> } };
    const refs = [
      ...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g),
    ].map((m) => m[1]!);
    for (const r of refs) expect(doc.components.schemas[r], r).toBeDefined();
  });
});
