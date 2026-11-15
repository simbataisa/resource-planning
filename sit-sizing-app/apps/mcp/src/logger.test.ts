import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from './logger';

describe('createLogger', () => {
  it('writes JSON lines and redacts token-like fields', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const log = createLogger('info', sink);
    log.info(
      { token: 'synthetic-token', headers: { authorization: 'Bearer x' }, tool: 'whoami' },
      'hello',
    );
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(line).toMatchObject({
      level: 'info',
      msg: 'hello',
      tool: 'whoami',
      service: 'sit-sizing-mcp',
      token: '[redacted]',
    });
    expect(lines[0]).not.toContain('synthetic-token');
    expect(lines[0]).not.toContain('Bearer x');
  });

  it('redacts the draft lock token in bodies and the X-Lock-Token header', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const log = createLogger('info', sink);
    log.info({
      res: { lockToken: 'synthetic-lock-a' },
      headers: { 'x-lock-token': 'synthetic-lock-b' },
      req: { headers: { 'x-lock-token': 'synthetic-lock-c' } },
    });
    expect(lines[0]).not.toContain('synthetic-lock-');
    expect(lines[0]).toContain('[redacted]');
  });
});
