import { ApiErrorEnvelope } from '@sit/schemas';
import { z } from 'zod';
import { OPERATIONS, type Operation } from './operations';

/**
 * OpenAPI document generated from the Zod schemas (design 9.4, ADR-0003).
 * Zod 4 converts schemas to JSON Schema 2020-12, which OpenAPI 3.1 and 3.2 use
 * directly, so no third-party generator is needed. Change OPENAPI_VERSION to
 * '3.1.1' if the spike shows a tool in the chain cannot read 3.2.
 */
export const OPENAPI_VERSION = '3.2.0';
export const API_VERSION = '1.0.0';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type JsonObject = { [k: string]: Json };

const STATUS_TEXT: Record<number, string> = {
  400: 'Validation failed',
  401: 'Not signed in',
  403: 'Role does not allow this',
  404: 'Not found (or not visible to you)',
  409: 'Conflict: stale rowVersion, lock held by someone else, or duplicate',
  422: 'Request understood but cannot be applied',
  429: 'Too many requests for this user; see Retry-After',
  500: 'Unexpected error',
  503: 'A dependency is not reachable',
};

/** Moves $defs into components and rewrites their $refs. */
function hoist(schema: JsonObject, components: Record<string, Json>): JsonObject {
  const defs = (schema.$defs ?? {}) as Record<string, JsonObject>;
  delete schema.$defs;
  delete schema.$schema;
  const rewrite = (node: Json): Json => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (node && typeof node === 'object') {
      const out: JsonObject = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] =
          k === '$ref' && typeof v === 'string'
            ? v.replace(/^#\/\$defs\//, '#/components/schemas/')
            : rewrite(v);
      }
      return out;
    }
    return node;
  };
  for (const [name, def] of Object.entries(defs)) {
    const clean = { ...def };
    delete clean.id;
    components[name] = rewrite(clean);
  }
  return rewrite(schema) as JsonObject;
}

function toSchema(
  s: z.ZodType,
  io: 'input' | 'output',
  components: Record<string, Json>,
): JsonObject {
  const raw = z.toJSONSchema(s, {
    target: 'draft-2020-12',
    io,
    unrepresentable: 'any',
  }) as unknown as JsonObject;
  // A schema with its own id becomes a component and is referenced.
  const id = typeof raw.id === 'string' ? raw.id : undefined;
  const hoisted = hoist(raw, components);
  if (id) {
    delete hoisted.id;
    components[id] = hoisted;
    return { $ref: `#/components/schemas/${id}` };
  }
  return hoisted;
}

function parameters(op: Operation, components: Record<string, Json>): Json[] {
  const out: Json[] = [];
  for (const [where, obj] of [
    ['path', op.params],
    ['query', op.query],
  ] as const) {
    if (!obj) continue;
    for (const [name, field] of Object.entries(obj.shape) as [string, z.ZodType][]) {
      out.push({
        name,
        in: where,
        required: where === 'path' || !field.safeParse(undefined).success,
        schema: toSchema(field, 'input', components),
      });
    }
  }
  return out;
}

export function buildOpenApi(version: string = OPENAPI_VERSION): JsonObject {
  const components: Record<string, Json> = {};
  components.ApiError = toSchema(ApiErrorEnvelope, 'output', components);
  const paths: Record<string, JsonObject> = {};

  for (const op of OPERATIONS) {
    const responses: JsonObject = {};
    const success: JsonObject = { description: op.success.description };
    if (op.success.schema) {
      const media: JsonObject = { schema: toSchema(op.success.schema, 'output', components) };
      if (op.success.example !== undefined) media.example = op.success.example as Json;
      success.content = { 'application/json': media };
    } else if (op.path === '/docs') {
      success.content = { 'text/html': { schema: { type: 'string' } } };
    }
    responses[String(op.success.status)] = success;
    // Every signed-in operation is rate limited per user (threat model T-11).
    const limited = op.minRole !== 'none' ? [429] : [];
    for (const status of [...op.errors, ...limited, 500]) {
      responses[String(status)] = {
        description: STATUS_TEXT[status] ?? 'Error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      };
    }
    const operation: JsonObject = {
      operationId: op.operationId,
      tags: [op.tag],
      summary: op.summary,
      description: [
        op.description,
        op.minRole === 'none' ? 'No sign-in needed.' : `Minimum role: ${op.minRole}.`,
      ]
        .filter(Boolean)
        .join(' '),
      'x-required-role': op.minRole,
      parameters: parameters(op, components),
      responses,
      security: op.minRole === 'none' ? [] : [{ cookieAuth: [] }, { devUser: [] }],
    };
    if (op.body) {
      const media: JsonObject = { schema: toSchema(op.body, 'input', components) };
      if (op.bodyExample !== undefined) media.example = op.bodyExample as Json;
      operation.requestBody = { required: true, content: { 'application/json': media } };
    }
    (paths[op.path] ??= {})[op.method] = operation;
  }

  const sorted = Object.fromEntries(
    Object.entries(components).sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    openapi: version,
    info: {
      title: 'SIT Sizing API',
      version: API_VERSION,
      description:
        'REST API of the SIT Sizing tool. Errors use one envelope (ApiError). Lists page with `cursor` and `limit`. ' +
        'Results are planning ranges, not commitments. Examples use synthetic data only.',
    },
    servers: [{ url: '/api/v1' }],
    tags: [
      {
        name: 'Projects',
        description: 'Projects and their members. Project roles: Viewer, Estimator, QE Lead.',
      },
      {
        name: 'Estimates',
        description: 'Sizing exercises for a release or change, owned by a project.',
      },
      {
        name: 'Versions',
        description: 'The editable draft (with its edit lock) and saved, immutable versions.',
      },
      {
        name: 'Assumption profiles',
        description: 'Named sets of the 142 model assumptions, global or per project.',
      },
      { name: 'Session', description: 'The signed-in user.' },
      {
        name: 'Documentation',
        description: 'This OpenAPI document and the interactive reference.',
      },
      { name: 'Operations', description: 'Liveness and readiness probes; no sign-in needed.' },
    ],
    paths,
    components: {
      schemas: sorted,
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: '__Host-sit.session',
          description:
            'Encrypted session cookie set after Keycloak sign-in (/api/auth/signin). Named sit.session on plain http locally.',
        },
        devUser: {
          type: 'apiKey',
          in: 'header',
          name: 'x-dev-user',
          description:
            'Local development only (AUTH_MODE=dev): a seeded user subject such as dev-estimator.',
        },
      },
    },
  };
}

/** Stable JSON text for the committed copy and the drift check. */
export function openApiText(): string {
  return `${JSON.stringify(buildOpenApi(), null, 2)}\n`;
}
