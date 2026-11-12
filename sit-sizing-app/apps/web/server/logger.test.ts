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
});
