import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AuditPage, EstimateResult } from '@sit/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Scripted end-to-end flow through the running MCP server in dev mode (design spec 6.8):
 * the server runs with `MCP_DEV_USER=dev-estimator` against an API with `AUTH_MODE=dev`
 * and the synthetic seed. Run against `pnpm dev:up` (defaults below) or the isolated stack
 * of `pnpm --filter @sit/mcp test:e2e:stack`, which sets both URLs.
 * Document-free: only synthetic names and numbers.
 */
const MCP_URL = process.env.MCP_E2E_URL ?? 'http://localhost:3100/mcp';
const API_URL = (process.env.SIT_E2E_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

type ToolResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
};

let client: Client;

/** Calls a tool and returns its structured result; a tool error fails the test with its text. */
async function call<T = Record<string, unknown>>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  if (result.isError) {
    const text = result.content?.map((c) => c.text ?? '').join('\n') ?? '';
    throw new Error(`${name} failed: ${text}`);
  }
  return result.structuredContent as T;
}

/** The figures both the preview and the stored result carry (the stored one adds groups). */
function headline(mode: Record<string, unknown>) {
  const { groups: _groups, ...rest } = mode;
  return rest;
}

beforeAll(async () => {
  client = new Client({ name: 'sit-mcp-flow-test', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
});

afterAll(async () => {
  await client?.close();
});

describe('MCP server scripted flow (dev mode)', () => {
  it('creates an estimate, updates the draft, previews, saves and submits', async () => {
    const me = await call<{ email: string; memberships: Array<{ projectKey: string }> }>('whoami');
    expect(me.email).toBe('estimator@example.invalid');

    const projects = await call<{ items: Array<{ id: string; key: string }> }>('list_projects');
    const project = projects.items.find((p) => p.key === 'DEMO');
    expect(project, 'seeded project DEMO').toBeDefined();
    const projectId = project!.id;

    const name = `MCP flow ${new Date().toISOString()}`;
    const estimate = await call<{ id: string; hasDraft: boolean }>('create_estimate', {
      projectId,
      name,
      summary: 'Create a blank synthetic estimate for the scripted flow.',
    });
    expect(estimate.hasDraft).toBe(true);
    const estimateId = estimate.id;

    const updateSummary = 'Set the API band to 4/6/9 and API cases to 2/3/5.';
    const updated = await call<{ number: number; inputs: { detail: { api: number[] } } }>(
      'update_draft',
      {
        estimateId,
        changes: [
          { path: 'inputs.detail.api', value: [4, 6, 9] },
          { path: 'assumptions.cases.api', value: [2, 3, 5] },
        ],
        summary: updateSummary,
      },
    );
    expect(updated.inputs.detail.api).toEqual([4, 6, 9]);

    const preview = await call<{ preview: true; engineVersion: string } & Record<string, unknown>>(
      'preview_estimate',
      { base: { estimateId, number: 'draft' } },
    );
    const draft = await call<{ result: unknown; assumptions: { cases: { api: number[] } } }>(
      'get_version',
      { estimateId, number: 'draft' },
    );
    expect(draft.assumptions.cases.api).toEqual([2, 3, 5]);
    const stored = EstimateResult.parse(draft.result);
    expect(preview.preview).toBe(true);
    expect(preview.engineVersion).toBe(stored.engineVersion);
    expect(preview.rough).toEqual(headline(stored.rough));
    expect(preview.detailed).toEqual(headline(stored.detailed));
    expect(stored.detailed.cases).toBeGreaterThan(0);

    const saved = await call<{ number: number; status: string; note: string | null }>(
      'save_version',
      { estimateId, summary: 'Save the draft as version 1.' },
    );
    expect(saved.status).toBe('SAVED');
    expect(saved.note).toMatch(/^Prepared with the estimation assistant:/);

    const submitted = await call<{ status: string }>('submit_version', {
      estimateId,
      number: saved.number,
      summary: 'Submit version 1 for review.',
    });
    expect(submitted.status).toBe('SUBMITTED');

    // The QE Lead sees the confirmed summary in the audit trail (dev header, AUTH_MODE=dev).
    const res = await fetch(
      `${API_URL}/api/v1/audit?${new URLSearchParams({ projectId, action: 'estimate.draft.update' })}`,
      { headers: { 'x-dev-user': 'dev-lead' } },
    );
    expect(res.status).toBe(200);
    const audit = AuditPage.parse(await res.json());
    const event = audit.items.find(
      (e) => e.detail.summary === updateSummary && e.detail.number === updated.number,
    );
    expect(event, 'estimate.draft.update event with the summary').toBeDefined();
    expect(event!.actor.email).toBe('estimator@example.invalid');
    expect(event!.detail.changed).toEqual(['inputs', 'assumptions']);
  });
});
