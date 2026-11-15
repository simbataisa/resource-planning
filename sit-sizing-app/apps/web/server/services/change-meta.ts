import type { CurrentUser } from '../auth/current-user';

/**
 * Audit detail shared by every change a person or an assistant confirms: which channel made
 * it (only recorded for `mcp`; the web app is the default) and the one-line summary the caller
 * confirmed. Never put input or assumption values in here (design 11).
 */
export function changeDetail(
  user: CurrentUser,
  summary?: string,
): { channel?: 'mcp'; summary?: string } {
  return {
    ...(user.channel === 'mcp' ? { channel: 'mcp' as const } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };
}
