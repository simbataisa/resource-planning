import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk: unknown, _enc, cb) {
      lines.push(JSON.parse(String(chunk)) as Record<string, unknown>);
      cb();
    },
  });
  return { lines, stream };
}

describe('logger', () => {
  it('writes JSON with a textual level and redacts secrets', () => {
    process.env.LOG_LEVEL = 'info';
    const { lines, stream } = capture();
    const log = createLogger(stream);
    log.info(
      { user: { id: 'u-synthetic-1', password: 'synthetic-pass', accessToken: 'synthetic-token' } },
      'hello',
    );
    const line = lines[0] as { level: string; msg: string; user: Record<string, string> };
    expect(line.level).toBe('info');
    expect(line.msg).toBe('hello');
    expect(line.user.password).toBe('[redacted]');
    expect(line.user.accessToken).toBe('[redacted]');
    expect(line.user.id).toBe('u-synthetic-1');
    delete process.env.LOG_LEVEL;
  });

  it('redacts the draft lock token in bodies and request headers', () => {
    process.env.LOG_LEVEL = 'info';
    const { lines, stream } = capture();
    const log = createLogger(stream);
    log.info(
      {
        draft: { id: 'v-synthetic-1', lockToken: 'tok-synthetic-1' },
        req: { headers: { 'x-lock-token': 'tok-synthetic-2', accept: 'application/json' } },
      },
      'draft',
    );
    const line = lines[0] as {
      draft: Record<string, string>;
      req: { headers: Record<string, string> };
    };
    expect(line.draft.lockToken).toBe('[redacted]');
    expect(line.draft.id).toBe('v-synthetic-1');
    expect(line.req.headers['x-lock-token']).toBe('[redacted]');
    expect(line.req.headers.accept).toBe('application/json');
    delete process.env.LOG_LEVEL;
  });
});
