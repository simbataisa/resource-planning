import { describe, expect, it } from 'vitest';
import type { CurrentUser } from '../auth/current-user';
import { changeDetail } from './change-meta';

const user = (channel: CurrentUser['channel']) => ({ channel }) as CurrentUser;

describe('changeDetail', () => {
  it('adds channel only for mcp and summary only when given', () => {
    expect(changeDetail(user('web'))).toEqual({});
    expect(changeDetail(user('web'), 'Synthetic summary')).toEqual({
      summary: 'Synthetic summary',
    });
    expect(changeDetail(user('mcp'))).toEqual({ channel: 'mcp' });
    expect(changeDetail(user('mcp'), 'Synthetic summary')).toEqual({
      channel: 'mcp',
      summary: 'Synthetic summary',
    });
  });
});
